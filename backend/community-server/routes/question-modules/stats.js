/**
 * 题目管理路由 - 统计模块
 */
// 不再从query模块导入，因为它导致了getQuestionStats函数的重复声明
// const queryModule = require('./query');

/**
 * 更新题目统计信息
 * @param {string} questionId - 题目ID
 * @param {string} questionType - 题目类型
 * @param {function} executeWithRetry - 带重试机制的SQL执行函数
 * @returns {Promise<Object>} - 更新后的统计信息
 */
async function updateQuestionStats(questionId, questionType, executeWithRetry) {
  console.log(`【统计模块】开始更新题目统计，ID: ${questionId}, 类型: ${questionType}`);
  
  try {
    // 1. 获取题目的苹果数（评分）
    console.log(`【统计模块】开始查询苹果数（评分）数据...`);
    const [appleResult] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT 
           IFNULL(AVG(apples_count), 0) as apple_average,
           IFNULL(SUM(apples_count), 0) as apple_count,
           COUNT(DISTINCT user_id) as student_count
         FROM community_question_apples 
         WHERE question_id = ? AND question_type = ?`,
        [questionId, questionType]
      );
    });
    
    console.log(`【统计模块】查询苹果数结果:`, JSON.stringify(appleResult[0] || {}));
    
    const averageRating = parseFloat(appleResult[0]?.apple_average || 0);
    const appleCount = parseInt(appleResult[0]?.apple_count || 0);
    const studentCount = parseInt(appleResult[0]?.student_count || 0);
    
    console.log(`【统计模块】评分数据: 总评分=${appleCount}, 学生数=${studentCount}, 平均分=${averageRating}`);

    // 2. 获取引用该题目的帖子
    console.log(`【统计模块】开始查询相关帖子...`);
    const [postsResult] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT p.id
         FROM community_posts p
         JOIN community_post_questions q ON p.id = q.post_id
         WHERE q.question_type = ? AND q.question_id = ?`,
        [questionType, questionId]
      );
    });
    
    const postCount = postsResult.length;
    const postIds = postsResult.map(post => post.id);
    
    console.log(`【统计模块】找到 ${postCount} 个相关帖子, IDs: [${postIds.join(', ')}]`);
    
    // 初始化统计数据
    const stats = {
      questionId: parseInt(questionId),
      questionType,
      postCount,
      commentCount: 0,
      likeCount: 0,
      recommendCount: 0,
      coinCount: 0,
      favoriteCount: 0,
      appleCount,
      studentCount,
      averageRating,
      lastRefreshed: new Date()
    };
    
    // 3. 如果有关联帖子，计算互动数据
    if (postIds.length > 0) {
      const postIdsPlaceholders = postIds.map(() => '?').join(',');
      
      // 评论数量
      console.log(`【统计模块】开始查询评论数据...`);
      const [commentResult] = await executeWithRetry(async (conn) => {
        const query = `SELECT COUNT(*) as count 
                      FROM community_comments 
                      WHERE post_id IN (${postIdsPlaceholders})`;
        console.log(`【统计模块】查询评论SQL: ${query}, 参数:`, postIds);
        return await conn.query(query, [...postIds]);
      });
      
      stats.commentCount = parseInt(commentResult[0]?.count || 0);
      console.log(`【统计模块】查询评论结果:`, JSON.stringify(commentResult[0] || {}));
      console.log(`【统计模块】找到 ${stats.commentCount} 条评论`);
      
      // 互动数据 (点赞、收藏、投币、推荐)
      const interactionTypes = ['like', 'favorite', 'coin', 'recommend'];
      
      for (const type of interactionTypes) {
        console.log(`【统计模块】开始查询 ${type} 类型的互动数据...`);
        const [result] = await executeWithRetry(async (conn) => {
          const query = `SELECT COUNT(*) as count 
                        FROM community_interactions 
                        WHERE post_id IN (${postIdsPlaceholders}) AND type = ?`;
          console.log(`【统计模块】查询${type}互动SQL: ${query}, 参数:`, [...postIds, type]);
          return await conn.query(query, [...postIds, type]);
        });
        
        const count = parseInt(result[0]?.count || 0);
        console.log(`【统计模块】查询${type}互动结果:`, JSON.stringify(result[0] || {}));
        
        switch (type) {
          case 'like':
            stats.likeCount = count;
            break;
          case 'favorite':
            stats.favoriteCount = count;
            break;
          case 'coin':
            stats.coinCount = count;
            break;
          case 'recommend':
            stats.recommendCount = count;
            break;
        }
      }
      
      console.log(`【统计模块】互动数据汇总: 点赞=${stats.likeCount}, 收藏=${stats.favoriteCount}, 投币=${stats.coinCount}, 推荐=${stats.recommendCount}`);
    }
    
    // 4. 更新数据库中的统计记录（使用teachers_selected_questions表）
    console.log(`【统计模块】正在更新统计记录到数据库...`);
    
    // 检查在teachers_selected_questions表中是否有记录
    console.log(`【统计模块】检查teachers_selected_questions表记录...`);
    const [existingRecords] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT * FROM teachers_selected_questions 
         WHERE question_id = ? AND question_type = ?`,
        [questionId, questionType]
      );
    });
    
    console.log(`【统计模块】teachers_selected_questions表查询结果: 找到 ${existingRecords?.length || 0} 条记录`);
    
    if (existingRecords && existingRecords.length > 0) {
      // 更新现有记录
      console.log(`【统计模块】更新现有统计记录...`);
      for (const record of existingRecords) {
        const [updateResult] = await executeWithRetry(async (conn) => {
          const query = `UPDATE teachers_selected_questions 
                        SET 
                          post_count = ?,
                          comment_count = ?,
                          like_count = ?,
                          recommend_count = ?,
                          coin_count = ?,
                          favorite_count = ?,
                          student_rating_total = ?,
                          student_rating_count = ?,
                          average_rating = ?,
                          last_refreshed = CURRENT_TIMESTAMP
                        WHERE id = ?`;
          
          const params = [
            stats.postCount,
            stats.commentCount,
            stats.likeCount,
            stats.recommendCount,
            stats.coinCount,
            stats.favoriteCount,
            stats.appleCount,
            stats.studentCount,
            stats.averageRating,
            record.id
          ];
          
          console.log(`【统计模块】更新SQL: ${query.replace(/\s+/g, ' ')}`);
          console.log(`【统计模块】更新参数:`, params);
          
          return await conn.query(query, params);
        });
        
        console.log(`【统计模块】更新ID为${record.id}的记录结果: 影响行数=${updateResult.affectedRows}`);
      }
    } else {
      // 如果没有记录，不尝试创建新记录，因为这个表需要teacherId
      console.log(`【统计模块】未找到记录，需要在查看统计时先确保记录存在`);
    }
    
    // 6. 返回更新后的统计数据
    console.log(`【统计模块】题目统计更新完成，返回结果:`, stats);
    return stats;
  } catch (error) {
    console.error(`【统计模块】更新题目统计失败:`, error);
    throw new Error(`更新题目统计失败: ${error.message}`);
  }
}

/**
 * 获取题目统计信息
 * @param {string|number} questionId - 题目ID
 * @param {string} questionType - 题目类型
 * @param {Function} executeQuery - 执行SQL的函数
 * @returns {Promise<Object>} 题目统计信息
 */
async function getQuestionStats(questionId, questionType, executeQuery) {
  try {
    console.log(`【获取统计】开始获取题目(ID=${questionId}, 类型=${questionType})的统计信息`);
    
    // 从teachers_selected_questions表获取统计信息
    console.log(`【获取统计】查询teachers_selected_questions表...`);
    const [statsRecords] = await executeQuery(async (conn) => {
      return await conn.query(
        `SELECT * FROM teachers_selected_questions 
         WHERE question_id = ? AND question_type = ? 
         ORDER BY last_refreshed DESC LIMIT 1`,
        [questionId, questionType]
      );
    });
    
    console.log(`【获取统计】teachers_selected_questions表查询结果: 找到 ${statsRecords?.length || 0} 条记录`);
    
    // 如果没有统计记录或统计记录过期，则重新生成
    if (!statsRecords || statsRecords.length === 0 || isStatsExpired(statsRecords[0]?.last_refreshed)) {
      console.log(`【获取统计】未找到统计记录或记录已过期，将重新生成`);
      return await updateQuestionStats(questionId, questionType, executeQuery);
    }
    
    console.log(`【获取统计】找到现有统计记录，上次刷新时间: ${statsRecords[0].last_refreshed}`);
    const stats = statsRecords[0];
    
    // 获取相关帖子
    console.log(`【获取统计】开始查询相关帖子...`);
    const [relatedPosts] = await executeQuery(async (conn) => {
      return await conn.query(
        `SELECT 
          p.id, 
          p.title, 
          p.content,
          p.user_id,
          p.created_at,
          u.name as author_name,
          u.avatar as author_avatar,
          (SELECT COUNT(*) FROM community_comments WHERE post_id = p.id) as comment_count,
          (SELECT COUNT(*) FROM community_interactions WHERE post_id = p.id AND type = 'like') as like_count,
          (SELECT COUNT(*) FROM community_interactions WHERE post_id = p.id AND type = 'favorite') as favorite_count,
          (SELECT COUNT(*) FROM community_interactions WHERE post_id = p.id AND type = 'coin') as coin_count
        FROM 
          community_posts p
        JOIN 
          community_post_questions q ON p.id = q.post_id
        LEFT JOIN
          users u ON p.user_id = u.id
        WHERE 
          q.question_type = ? AND q.question_id = ?
        ORDER BY 
          p.created_at DESC
        LIMIT 10`,
        [questionType, questionId]
      );
    });
    
    console.log(`【获取统计】找到 ${relatedPosts.length} 个相关帖子`);
    
    // 将数据库查询结果转换为前端需要的格式
    const result = {
      questionId: parseInt(questionId),
      questionType,
      postCount: stats.post_count || 0,
      commentCount: stats.comment_count || 0,
      likeCount: stats.like_count || 0,
      recommendCount: stats.recommend_count || 0,
      coinCount: stats.coin_count || 0,
      favoriteCount: stats.favorite_count || 0,
      appleCount: stats.student_rating_total || 0,
      studentCount: stats.student_rating_count || 0,
      averageRating: stats.average_rating || 0,
      lastRefreshed: stats.last_refreshed,
      relatedPosts: relatedPosts.map(post => ({
        id: post.id,
        title: post.title,
        content: post.content ? post.content.substring(0, 100) + (post.content.length > 100 ? '...' : '') : '',
        userId: post.user_id,
        author: post.author_name,
        authorAvatar: post.author_avatar,
        commentCount: parseInt(post.comment_count || 0),
        likeCount: parseInt(post.like_count || 0),
        favoriteCount: parseInt(post.favorite_count || 0),
        coinCount: parseInt(post.coin_count || 0),
        createdAt: post.created_at
      }))
    };
    
    console.log(`【获取统计】成功获取题目统计信息，返回结果:`, {
      questionId: result.questionId,
      postCount: result.postCount,
      commentCount: result.commentCount,
      likeCount: result.likeCount,
      relatedPostsCount: result.relatedPosts.length
    });
    
    return result;
  } catch (error) {
    console.error(`【获取统计】获取题目统计信息失败:`, error);
    throw new Error(`获取题目统计信息失败: ${error.message}`);
  }
}

/**
 * 检查统计记录是否过期
 * @param {Date|string} lastRefreshed - 上次刷新时间
 * @returns {boolean} 是否过期
 */
function isStatsExpired(lastRefreshed) {
  if (!lastRefreshed) return true;
  
  const refreshDate = new Date(lastRefreshed);
  const now = new Date();
  const hoursDiff = (now - refreshDate) / (1000 * 60 * 60);
  
  console.log(`【统计模块】检查记录是否过期: 上次刷新=${refreshDate.toISOString()}, 现在=${now.toISOString()}, 相差=${hoursDiff.toFixed(2)}小时`);
  
  // 超过6小时视为过期
  return hoursDiff > 100;
}

module.exports = {
  updateQuestionStats,
  getQuestionStats
};