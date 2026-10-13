// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../config/runtime');
/**
 * 社区帖子相关路由
 * 
 * 涉及以下功能：
 * 1. 创建帖子
 * 2. 获取帖子列表
 * 3. 获取帖子详情
 * 4. 更新帖子
 * 5. 删除帖子
 * 6. 审核帖子（批准/拒绝）
 * 7. 通过题目获取相关帖子
 * 
 * 题目引用信息存储在 community_post_questions 表中，包含：
 * - question_type: 题目类型（'latex' 或 'image'）
 * - question_id: LaTeX 题目的 ID（仅当 question_type 为 'latex' 时有值）
 * - question_path: 图片题目的路径（仅当 question_type 为 'image' 时有值）
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');

// 使用server.js中的连接池和executeWithRetry函数
const { pool, executeWithRetry } = require('../server');

// 敏感词检测函数
async function checkSensitiveContent(content) {
  try {
    // 使用AI服务检测敏感内容
    const response = await axios.post(
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      {
        model: 'doubao-1-5-lite-32k-250115',
        messages: [
          {
            role: 'user',
            content: `请检查以下内容是否包含敏感词汇、不良信息或违规内容。如果包含，请回复"SENSITIVE"，否则回复"SAFE"。内容：${content}`
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DOUBA_API_KEY || ''}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResult = response.data;
    if (aiResult?.choices?.[0]?.message?.content) {
      const aiResponse = aiResult.choices[0].message.content.trim();
      console.log('敏感词检测成功'); // 添加成功日志
      return aiResponse.includes('SENSITIVE');
    }
    return false;
  } catch (error) {
    console.error('敏感内容检测失败:', error);
    // 如果检测失败，默认通过
    return false;
  }
}

/**
 * 创建帖子
 */
router.post('/', async (req, res) => {
  try {
    const { 
      userId, 
      title, 
      content, 
      category, 
      visibility = 'public', // public, friends_only, teacher_hidden
      isAnonymous = false,
      questionRef = null // 引用的题目信息
    } = req.body;
    
    if (!userId || !title || !content || !category) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查用户今日发帖数量是否超过限制
    const [userLimits] = await pool.execute(
      'SELECT * FROM community_user_limits WHERE user_id = ?',
      [userId]
    );
    
    const today = new Date().toISOString().split('T')[0];
    let userLimit;
    
    if (userLimits.length === 0) {
      // 创建新的用户限制记录
      await pool.execute(
        'INSERT INTO community_user_limits (user_id, posts_today, last_reset_date) VALUES (?, 1, ?)',
        [userId, today]
      );
      userLimit = { posts_today: 1 };
    } else {
      userLimit = userLimits[0];
      
      // 如果是新的一天，重置计数
      if (userLimit.last_reset_date !== today) {
        await pool.execute(
          'UPDATE community_user_limits SET posts_today = 1, last_reset_date = ? WHERE user_id = ?',
          [today, userId]
        );
        userLimit.posts_today = 1;
      } else if (userLimit.posts_today >= 10) {
        return res.status(429).json({ error: '今日发帖数量已达上限（10条）' });
      } else {
        // 增加今日发帖计数
        await pool.execute(
          'UPDATE community_user_limits SET posts_today = posts_today + 1 WHERE user_id = ?',
          [userId]
        );
        userLimit.posts_today += 1;
      }
    }
    
    // 检查内容是否包含敏感词
    // 注意：已经使用AI进行了敏感词筛选，现在直接设置状态为已批准
    const hasSensitiveContent = await checkSensitiveContent(title + ' ' + content);
    // 即使包含敏感词，也设置为已批准，仅记录敏感内容标记供后续分析
    const status = 'approved'; // 统一设置为已批准状态
    
    // 添加帖子
    const [result] = await pool.execute(
      `INSERT INTO community_posts (
        user_id, 
        title, 
        content, 
        category, 
        visibility, 
        is_anonymous, 
        status,
        has_sensitive_content
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, content, category, visibility, isAnonymous ? 1 : 0, status, hasSensitiveContent ? 1 : 0]
    );
    
    const postId = result.insertId;
    
    // 如果有引用题目，保存题目引用关系
    if (questionRef && (questionRef.questionId || questionRef.questionPath)) {
      await pool.execute(
        `INSERT INTO community_post_questions (
          post_id, 
          question_type, 
          question_id, 
          question_path
        ) VALUES (?, ?, ?, ?)`,
        [
          postId, 
          questionRef.questionType, 
          questionRef.questionId || null, 
          questionRef.questionPath || null
        ]
      );
    }
    
    // 无论是否包含敏感内容，都直接返回发布成功
    res.status(201).json({
      id: postId,
      message: '帖子发布成功',
      hasSensitiveContent: hasSensitiveContent // 添加标记用于前端显示
    });
  } catch (error) {
    console.error('创建帖子失败:', error);
    res.status(500).json({ error: '创建帖子失败' });
  }
});

/**
 * 获取帖子列表
 * 
 * 请求参数：
 * - category: 可选，按分类筛选
 * - userId: 可选，用户ID（用于筛选可见性）
 * - sort: 可选，排序方式（latest, popular, recommended）
 * - page: 可选，页码（默认1）
 * - limit: 可选，每页条数（默认10）
 * - status: 可选，帖子状态（approved, rejected），默认approved
 * - hasSensitiveContent: 可选，是否包含敏感内容的帖子（仅对教师/管理员/助教有效）
 * 
 * 返回：
 * - posts: 帖子列表，每个帖子包含基本信息及引用的题目信息
 * - pagination: 分页信息
 */
router.get('/', async (req, res) => {
  try {
    const { 
      category, 
      userId, 
      sort = 'latest', // latest, popular, recommended
      page = 1, 
      limit = 10,
      status, // 移除默认值，使其可以为undefined
      hasSensitiveContent // 新增参数，用于筛选可能包含敏感内容的帖子
    } = req.query;
    
    // 确保分页参数是整数
    const limitNum = Number(limit);
    const pageNum = Number(page);
    const offset = (pageNum - 1) * limitNum;
    
    let query = `
      SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.category, 
        p.created_at, 
        p.updated_at, 
        p.visibility, 
        p.is_anonymous,
        p.status,
        p.has_sensitive_content,
        p.user_id,
        CASE WHEN p.is_anonymous = 1 THEN '匿名用户' ELSE u.name END AS author_name,
        (SELECT COUNT(*) FROM community_comments WHERE post_id = p.id) AS comment_count,
        (SELECT COUNT(*) FROM community_interactions WHERE post_id = p.id AND type = 'like') AS like_count,
        (SELECT COUNT(*) FROM community_interactions WHERE post_id = p.id AND type = 'favorite') AS favorite_count,
        (SELECT COUNT(*) FROM community_interactions WHERE post_id = p.id AND type = 'coin') AS coin_count,
        (SELECT COUNT(*) FROM community_interactions WHERE post_id = p.id AND type = 'recommend') AS recommend_count
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    // 根据状态筛选帖子
    if (status) {
      query += ' AND p.status = ?';
      queryParams.push(status);
    } else {
      // 检查用户角色，只有教师/管理员/助教可以看到所有状态的帖子
      let canSeeAllStatus = false;
      
      if (userId) {
        const [roles] = await pool.execute(
          'SELECT role FROM community_user_roles WHERE user_id = ? AND (role = "admin" OR role = "assistant" OR role = "teacher")',
          [userId]
        );
        
        if (roles.length > 0) {
          canSeeAllStatus = true;
        }
      }
      
      if (!canSeeAllStatus) {
        // 默认只显示已批准的帖子（对普通用户）
        query += ' AND p.status = "approved"';
      }
      // 对于有权限的用户，不添加status筛选，返回所有状态的帖子
    }
    
    // 如果指定了敏感内容筛选参数，且用户具有教师/管理员/助教权限
    if (hasSensitiveContent && userId) {
      // 检查用户角色
      const [roles] = await pool.execute(
        'SELECT role FROM community_user_roles WHERE user_id = ? AND (role = "admin" OR role = "assistant" OR role = "teacher")',
        [userId]
      );
      
      if (roles.length > 0) {
        // 有权限筛选敏感内容
        query += ' AND p.has_sensitive_content = ?';
        queryParams.push(hasSensitiveContent === 'true' || hasSensitiveContent === '1' ? 1 : 0);
      }
    }
    
    // 添加分类筛选
    if (category) {
      query += ' AND p.category = ?';
      queryParams.push(category);
    }
    
    // 添加可见性筛选
    if (userId) {
      query += ` AND (
        p.visibility = 'public' OR 
        (p.visibility = 'friends_only' AND EXISTS (
          SELECT 1 FROM community_friendships 
          WHERE (user_id = ? AND friend_id = p.user_id) OR (user_id = p.user_id AND friend_id = ?)
        )) OR
        p.user_id = ?
      )`;
      queryParams.push(userId, userId, userId);
    } else {
      query += " AND p.visibility = 'public'";
    }
    
    // 添加排序
    if (sort === 'popular') {
      query += ' ORDER BY (like_count + favorite_count + coin_count * 2 + recommend_count * 3) DESC, p.created_at DESC';
    } else if (sort === 'recommended') {
      query += ' ORDER BY recommend_count DESC, p.created_at DESC';
    } else {
      // 默认按最新排序
      query += ' ORDER BY p.created_at DESC';
    }
    
    // 添加分页 - 直接在SQL中使用数字值而不是参数占位符
    query += ` LIMIT ${limitNum} OFFSET ${offset}`;
    
    // 执行查询
    const [posts] = await pool.execute(query, queryParams);
    
    // 获取帖子引用的题目信息
    const postIds = posts.map(post => post.id);
    
    // 只有在有帖子时才查询引用题目信息
    if (postIds.length > 0) {
      const placeholders = postIds.map(() => '?').join(',');
      const [questionRefs] = await pool.execute(
        `SELECT * FROM community_post_questions WHERE post_id IN (${placeholders})`,
        postIds
      );
      
      // 将题目引用信息添加到对应的帖子中
      const questionRefMap = {};
      questionRefs.forEach(ref => {
        questionRefMap[ref.post_id] = {
          question_type: ref.question_type,
          question_id: ref.question_id,
          question_path: ref.question_path
        };
      });
      
      // 为每个帖子添加题目引用信息
      posts.forEach(post => {
        post.questionRef = questionRefMap[post.id] || null;
      });
    }
    
    // 获取总数
    let countQuery = `
      SELECT COUNT(*) AS total
      FROM community_posts p
      WHERE 1=1
    `;
    
    const countParams = [];
    
    // 根据状态筛选帖子
    if (status) {
      countQuery += ' AND p.status = ?';
      countParams.push(status);
    } else {
      // 检查用户角色，只有教师/管理员/助教可以看到所有状态的帖子
      let canSeeAllStatus = false;
      
      if (userId) {
        // 复用之前的权限检查结果，无需再次查询
        const [roles] = await pool.execute(
          'SELECT role FROM community_user_roles WHERE user_id = ? AND (role = "admin" OR role = "assistant" OR role = "teacher")',
          [userId]
        );
        
        if (roles.length > 0) {
          canSeeAllStatus = true;
        }
      }
      
      if (!canSeeAllStatus) {
        // 默认只显示已批准的帖子（对普通用户）
        countQuery += ' AND p.status = "approved"';
      }
      // 对于有权限的用户，不添加status筛选，返回所有状态的帖子总数
    }
    
    // 如果指定了敏感内容筛选参数，且用户具有教师/管理员/助教权限
    if (hasSensitiveContent && userId) {
      // 复用之前的权限检查结果，无需再次查询
      const [roles] = await pool.execute(
        'SELECT role FROM community_user_roles WHERE user_id = ? AND (role = "admin" OR role = "assistant" OR role = "teacher")',
        [userId]
      );
      
      if (roles.length > 0) {
        // 有权限筛选敏感内容
        countQuery += ' AND p.has_sensitive_content = ?';
        countParams.push(hasSensitiveContent === 'true' || hasSensitiveContent === '1' ? 1 : 0);
      }
    }
    
    // 添加分类筛选
    if (category) {
      countQuery += ' AND p.category = ?';
      countParams.push(category);
    }
    
    // 添加可见性筛选
    if (userId) {
      countQuery += ` AND (
        p.visibility = 'public' OR 
        (p.visibility = 'friends_only' AND EXISTS (
          SELECT 1 FROM community_friendships 
          WHERE (user_id = ? AND friend_id = p.user_id) OR (user_id = p.user_id AND friend_id = ?)
        )) OR
        p.user_id = ?
      )`;
      countParams.push(userId, userId, userId);
    } else {
      countQuery += " AND p.visibility = 'public'";
    }
    
    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;
    
    res.json({
      posts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取帖子列表失败:', error);
    res.status(500).json({ error: '获取帖子列表失败' });
  }
});

/**
 * 根据题目获取帖子列表
 * 
 * 请求参数：
 * - questionType: 题目类型（'latex' 或 'image'）
 * - questionId: 可选，LaTeX 题目的 ID（当 questionType 为 'latex' 时）
 * - questionPath: 可选，图片题目的路径（当 questionType 为 'image' 时）
 * 
 * 返回：包含引用指定题目的帖子列表
 */
router.get('/by-question', async (req, res) => {
  try {
    const { questionType, questionId, questionPath } = req.query;
    
    if (!questionType || (!questionId && !questionPath)) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    let query = `
      SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.category, 
        p.created_at, 
        p.updated_at, 
        p.visibility, 
        p.is_anonymous,
        p.user_id,
        CASE WHEN p.is_anonymous = 1 THEN '匿名用户' ELSE u.name END AS author_name
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      JOIN community_post_questions q ON p.id = q.post_id
      WHERE p.status = 'approved'
      AND q.question_type = ?
    `;
    
    const queryParams = [questionType];
    
    if (questionType === 'latex' && questionId) {
      query += ' AND q.question_id = ?';
      queryParams.push(questionId);
    } else if (questionPath) {
      query += ' AND q.question_path = ?';
      queryParams.push(questionPath);
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    const [posts] = await pool.execute(query, queryParams);
    
    res.json(posts);
  } catch (error) {
    console.error('获取引用题目的帖子列表失败:', error);
    res.status(500).json({ error: '获取帖子列表失败' });
  }
});

/**
 * 获取帖子详情
 * 
 * 路径参数：
 * - id: 帖子ID
 * 
 * 请求参数：
 * - userId: 可选，用户ID（用于检查可见性权限）
 * 
 * 返回：
 * - 帖子详情，包含基本信息、引用的题目信息和评论
 */
router.get('/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const { userId } = req.query;
    
    // 获取帖子详情
    const [posts] = await pool.execute(
      `SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.category, 
        p.created_at, 
        p.updated_at, 
        p.visibility, 
        p.is_anonymous,
        p.user_id,
        CASE WHEN p.is_anonymous = 1 THEN '匿名用户' ELSE u.name END AS author_name,
        (SELECT COUNT(*) FROM community_comments WHERE post_id = p.id) AS comment_count,
        (SELECT COUNT(*) FROM community_interactions WHERE post_id = p.id AND type = 'like') AS like_count,
        (SELECT COUNT(*) FROM community_interactions WHERE post_id = p.id AND type = 'favorite') AS favorite_count,
        (SELECT COUNT(*) FROM community_interactions WHERE post_id = p.id AND type = 'coin') AS coin_count,
        (SELECT COUNT(*) FROM community_interactions WHERE post_id = p.id AND type = 'recommend') AS recommend_count
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ? AND p.status = 'approved'`,
      [postId]
    );
    
    // 获取帖子引用的题目信息
    const [questionRefs] = await pool.execute(
      'SELECT * FROM community_post_questions WHERE post_id = ?',
      [postId]
    );
    
    if (posts.length === 0) {
      return res.status(404).json({ error: '帖子不存在或已被删除' });
    }
    
    // 将引用题目信息添加到帖子数据中
    const post = posts[0];
    post.questionRef = questionRefs.length > 0 ? questionRefs[0] : null;
    
    // 检查可见性权限
    if (post.visibility === 'friends_only' && userId && post.user_id !== userId) {
      // 检查是否为好友
      const [friendships] = await pool.execute(
        `SELECT 1 FROM community_friendships 
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
        [userId, post.user_id, post.user_id, userId]
      );
      
      if (friendships.length === 0) {
        return res.status(403).json({ error: '该帖子仅对作者好友可见' });
      }
    } else if (post.visibility === 'teacher_hidden') {
      // 检查用户是否为教师或助教
      const [roles] = await pool.execute(
        'SELECT role FROM community_user_roles WHERE user_id = ? AND (role = "teacher" OR role = "assistant")',
        [userId]
      );
      
      if (roles.length > 0) {
        return res.status(403).json({ error: '该帖子对教师和助教不可见' });
      }
    }
    
    // 获取评论
    const [comments] = await pool.execute(
      `SELECT 
        c.id, 
        c.content, 
        c.created_at, 
        c.parent_id,
        c.user_id,
        u.name AS author_name
      FROM community_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC`,
      [postId]
    );
    
    // 构建评论树
    const commentTree = buildCommentTree(comments);
    
    res.json({
      ...post,
      comments: commentTree
    });
  } catch (error) {
    console.error('获取帖子详情失败:', error);
    res.status(500).json({ error: '获取帖子详情失败' });
  }
});

// 更新帖子
router.put('/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const { 
      userId, 
      title, 
      content, 
      category, 
      visibility 
    } = req.body;
    
    // 验证帖子所有权
    const [posts] = await pool.execute(
      'SELECT * FROM community_posts WHERE id = ?',
      [postId]
    );
    
    if (posts.length === 0) {
      return res.status(404).json({ error: '帖子不存在' });
    }
    
    if (posts[0].user_id !== userId) {
      return res.status(403).json({ error: '无权修改此帖子' });
    }
    
    // 检查内容是否包含敏感词
    const hasSensitiveContent = await checkSensitiveContent(title + ' ' + content);
    const status = hasSensitiveContent ? 'pending' : 'approved';
    
    // 更新帖子
    await pool.execute(
      `UPDATE community_posts SET 
        title = ?, 
        content = ?, 
        category = ?, 
        visibility = ?, 
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [title, content, category, visibility, status, postId]
    );
    
    if (hasSensitiveContent) {
      res.json({ message: '帖子已更新，正在重新审核' });
    } else {
      res.json({ message: '帖子更新成功' });
    }
  } catch (error) {
    console.error('更新帖子失败:', error);
    res.status(500).json({ error: '更新帖子失败' });
  }
});

// 删除帖子
router.delete('/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const { userId } = req.body;
    
    // 验证帖子所有权
    const [posts] = await pool.execute(
      'SELECT * FROM community_posts WHERE id = ?',
      [postId]
    );
    
    if (posts.length === 0) {
      return res.status(404).json({ error: '帖子不存在' });
    }
    
    if (posts[0].user_id !== userId) {
      // 检查是否为管理员或助教
      const [roles] = await pool.execute(
        'SELECT * FROM community_user_roles WHERE user_id = ? AND (role = "admin" OR role = "assistant")',
        [userId]
      );
      
      if (roles.length === 0) {
        return res.status(403).json({ error: '无权删除此帖子' });
      }
    }
    
    // 删除帖子相关的评论
    await pool.execute('DELETE FROM community_comments WHERE post_id = ?', [postId]);
    
    // 删除帖子相关的互动
    await pool.execute('DELETE FROM community_interactions WHERE post_id = ?', [postId]);
    
    // 删除帖子
    await pool.execute('DELETE FROM community_posts WHERE id = ?', [postId]);
    
    res.json({ message: '帖子删除成功' });
  } catch (error) {
    console.error('删除帖子失败:', error);
    res.status(500).json({ error: '删除帖子失败' });
  }
});

// 举报帖子
router.post('/:id/report', async (req, res) => {
  try {
    const postId = req.params.id;
    const { userId, reason } = req.body;
    
    if (!userId || !reason) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查帖子是否存在
    const [posts] = await pool.execute(
      'SELECT * FROM community_posts WHERE id = ?',
      [postId]
    );
    
    if (posts.length === 0) {
      return res.status(404).json({ error: '帖子不存在' });
    }
    
    // 检查是否已举报
    const [existingReports] = await pool.execute(
      'SELECT * FROM community_reports WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );
    
    if (existingReports.length > 0) {
      return res.status(400).json({ error: '您已举报过该帖子' });
    }
    
    // 添加举报
    await pool.execute(
      'INSERT INTO community_reports (user_id, post_id, reason) VALUES (?, ?, ?)',
      [userId, postId, reason]
    );
    
    // 通知管理员和助教
    const [staff] = await pool.execute(
      'SELECT user_id, role FROM community_user_roles WHERE role = "admin" OR role = "assistant"'
    );
    
    for (const member of staff) {
      await pool.execute(
        'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
        [member.user_id, 'report', `有用户举报了一篇帖子，原因：${reason}`, postId]
      );
    }
    
    res.status(201).json({ message: '举报成功' });
  } catch (error) {
    console.error('举报帖子失败:', error);
    res.status(500).json({ error: '举报帖子失败' });
  }
});

/**
 * 审核帖子 - 批准
 * 
 * 路径参数：
 * - id: 帖子ID
 * 
 * 请求参数：
 * - userId: 教师/管理员/助教的ID
 * 
 * 返回：
 * - message: 成功消息
 * - post: 更新后的帖子详情，包含引用的题目信息
 * 
 * 注意：此API保留兼容性，实际上已经不再用于审核流程
 */
router.put('/:id/approve', async (req, res) => {
  try {
    const postId = req.params.id;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查用户权限（管理员、助教或教师）
    const [roles] = await pool.execute(
      'SELECT role FROM community_user_roles WHERE user_id = ? AND (role = "admin" OR role = "assistant" OR role = "teacher")',
      [userId]
    );
    
    if (roles.length === 0) {
      return res.status(403).json({ error: '您没有审核帖子的权限' });
    }
    
    // 检查帖子是否存在
    const [posts] = await pool.execute(
      'SELECT * FROM community_posts WHERE id = ?',
      [postId]
    );
    
    if (posts.length === 0) {
      return res.status(404).json({ error: '帖子不存在' });
    }
    
    // 更新帖子状态为已批准（如果尚未批准）
    if (posts[0].status !== 'approved') {
      await pool.execute(
        'UPDATE community_posts SET status = "approved" WHERE id = ?',
        [postId]
      );
      
      // 通知帖子作者
      await pool.execute(
        'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
        [posts[0].user_id, 'post_approved', '您的帖子已通过审核', postId]
      );
    }
    
    // 获取更新后的帖子详情，包括引用题目信息
    const [updatedPosts] = await pool.execute(
      `SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.category, 
        p.created_at, 
        p.updated_at, 
        p.visibility, 
        p.is_anonymous,
        p.status,
        p.has_sensitive_content,
        p.user_id,
        CASE WHEN p.is_anonymous = 1 THEN '匿名用户' ELSE u.name END AS author_name
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?`,
      [postId]
    );
    
    // 获取帖子引用的题目信息
    const [questionRefs] = await pool.execute(
      'SELECT * FROM community_post_questions WHERE post_id = ?',
      [postId]
    );
    
    // 将引用题目信息添加到帖子数据中
    const updatedPost = updatedPosts[0];
    if (updatedPost) {
      updatedPost.questionRef = questionRefs.length > 0 ? {
        question_type: questionRefs[0].question_type,
        question_id: questionRefs[0].question_id,
        question_path: questionRefs[0].question_path
      } : null;
    }
    
    res.json({
      message: '帖子已批准',
      post: updatedPost
    });
  } catch (error) {
    console.error('批准帖子失败:', error);
    res.status(500).json({ error: '批准帖子失败' });
  }
});

/**
 * 审核帖子 - 拒绝
 * 
 * 路径参数：
 * - id: 帖子ID
 * 
 * 请求参数：
 * - userId: 教师/管理员/助教的ID
 * 
 * 返回：
 * - message: 成功消息
 * - post: 更新后的帖子详情，包含引用的题目信息
 * 
 * 注意：此API保留兼容性，实际上已经用于教师拒绝特定帖子（比如违规内容）
 */
router.put('/:id/reject', async (req, res) => {
  try {
    const postId = req.params.id;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查用户权限（管理员、助教或教师）
    const [roles] = await pool.execute(
      'SELECT role FROM community_user_roles WHERE user_id = ? AND (role = "admin" OR role = "assistant" OR role = "teacher")',
      [userId]
    );
    
    if (roles.length === 0) {
      return res.status(403).json({ error: '您没有审核帖子的权限' });
    }
    
    // 检查帖子是否存在
    const [posts] = await pool.execute(
      'SELECT * FROM community_posts WHERE id = ?',
      [postId]
    );
    
    if (posts.length === 0) {
      return res.status(404).json({ error: '帖子不存在' });
    }
    
    // 更新帖子状态为已拒绝
    await pool.execute(
      'UPDATE community_posts SET status = "rejected" WHERE id = ?',
      [postId]
    );
    
    // 通知帖子作者
    await pool.execute(
      'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
      [posts[0].user_id, 'post_rejected', '您的帖子已被拒绝', postId]
    );
    
    // 获取更新后的帖子详情，包括引用题目信息
    const [updatedPosts] = await pool.execute(
      `SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.category, 
        p.created_at, 
        p.updated_at, 
        p.visibility, 
        p.is_anonymous,
        p.status,
        p.has_sensitive_content,
        p.user_id,
        CASE WHEN p.is_anonymous = 1 THEN '匿名用户' ELSE u.name END AS author_name
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?`,
      [postId]
    );
    
    // 获取帖子引用的题目信息
    const [questionRefs] = await pool.execute(
      'SELECT * FROM community_post_questions WHERE post_id = ?',
      [postId]
    );
    
    // 将引用题目信息添加到帖子数据中
    const updatedPost = updatedPosts[0];
    if (updatedPost) {
      updatedPost.questionRef = questionRefs.length > 0 ? {
        question_type: questionRefs[0].question_type,
        question_id: questionRefs[0].question_id,
        question_path: questionRefs[0].question_path
      } : null;
    }
    
    res.json({
      message: '帖子已拒绝',
      post: updatedPost
    });
  } catch (error) {
    console.error('拒绝帖子失败:', error);
    res.status(500).json({ error: '拒绝帖子失败' });
  }
});

/**
 * 构建评论树
 * 
 * 将平铺的评论列表转换为树状结构，支持回复嵌套
 * 
 * @param {Array} comments 评论列表
 * @returns {Array} 树状结构的评论列表
 */
function buildCommentTree(comments) {
  const commentMap = {};
  const rootComments = [];
  
  // 首先将所有评论映射到ID
  comments.forEach(comment => {
    comment.replies = [];
    commentMap[comment.id] = comment;
  });
  
  // 然后构建树结构
  comments.forEach(comment => {
    if (comment.parent_id) {
      // 如果有父评论，添加到父评论的回复中
      const parent = commentMap[comment.parent_id];
      if (parent) {
        parent.replies.push(comment);
      } else {
        // 如果找不到父评论，作为根评论处理
        rootComments.push(comment);
      }
    } else {
      // 没有父评论，是根评论
      rootComments.push(comment);
    }
  });
  
  return rootComments;
}

module.exports = router;