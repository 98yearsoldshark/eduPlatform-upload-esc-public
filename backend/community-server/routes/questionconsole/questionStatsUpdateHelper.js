/**
 * 题目管理路由 - 题目统计刷新相关函数
 */
const { pool, executeWithRetry, generateQuestionId } = require('./questionUtils');

/**
 * 刷新题目统计详情
 */
async function refreshQuestionStatsDetails(teacherId, id, questionType, appleCount, studentCount, averageRating) {
  try {
    // 获取引用该题目的帖子
    const [postsResult] = await executeWithRetry(async (conn) => {
      // 对于图片题目，需要构造正确的路径查询
      let query = `SELECT 
          p.id
         FROM 
          community_posts p
         JOIN 
          community_post_questions q ON p.id = q.post_id
         WHERE 
          q.question_type = ?`;
      
      let params = [questionType];
      
      if (questionType === 'latex') {
        // Latex题目使用question_id查询
        query += ` AND q.question_id = ?`;
        params.push(id);
      } else {
        // 查找匹配的路径
        // 先获取所有图片题目相关的帖子路径
        const [allPaths] = await conn.query(
          `SELECT DISTINCT question_path FROM community_post_questions 
           WHERE question_type = 'image' LIMIT 100`
        );
        
        // 直接通过ID匹配
        let matchFound = false;
        for (const pathObj of allPaths) {
          const path = pathObj.question_path;
          const pathFolderName = path.split('/').pop();
          const generatedId = generateQuestionId(pathFolderName);
          
          if (generatedId == id) {
            console.log(`【刷新统计】找到ID匹配路径: ${path}, 生成ID: ${generatedId}`);
            query += ` AND q.question_path = ?`;
            params.push(path);
            matchFound = true;
            break;
          }
        }
        
        if (!matchFound) {
          // 使用ID进行匹配
          query += ` AND q.question_id = ?`;
          params.push(id);
        }
      }
      
      return await conn.query(query, params);
    });
    
    const postCount = postsResult.length;
    const postIds = postsResult.map(post => post.id);
    
    // 如果没有引用该题目的帖子，设置所有统计为0
    if (postIds.length === 0) {
      const stats = {
        id: parseInt(id),
        type: questionType,
        starCount: 0, // 教师端的打星功能，这里暂时设为0
        postCount: 0,
        commentCount: 0,
        likeCount: 0,
        recommendCount: 0,
        coinCount: 0,
        favoriteCount: 0,
        appleCount: appleCount,
        studentCount: studentCount,
        averageRating: averageRating,
        lastRefreshed: new Date().toISOString(),
        relatedPosts: []
      };
      
      // 更新或创建统计记录
      await updateQuestionStats(teacherId, id, questionType, stats);
      
      return stats;
    }
    
    // 将帖子ID列表转换为SQL IN语句的参数
    const postIdsPlaceholders = postIds.map(() => '?').join(',');
    
    // 计算评论数量
    const [commentResult] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT COUNT(*) as count 
         FROM community_comments 
         WHERE post_id IN (${postIdsPlaceholders})`,
        [...postIds]
      );
    });
    
    const commentCount = commentResult[0]?.count || 0;
    
    // 计算互动数据 (点赞、收藏、投币、推荐)
    const interactionTypes = ['like', 'favorite', 'coin', 'recommend'];
    const interactionCounts = {};
    
    for (const type of interactionTypes) {
      const [result] = await executeWithRetry(async (conn) => {
        return await conn.query(
          `SELECT COUNT(*) as count 
           FROM community_interactions 
           WHERE post_id IN (${postIdsPlaceholders}) AND type = ?`,
          [...postIds, type]
        );
      });
      
      interactionCounts[type] = result[0]?.count || 0;
    }
    
    // 获取引用该题目的帖子详情
    const [detailedPostsResult] = await executeWithRetry(async (conn) => {
      // 构建查询条件
      let query = `SELECT 
          p.id, 
          p.title, 
          u.name as author_name,
          p.created_at,
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
          q.question_type = ?`;
      
      // 使用相同的参数列表
      let params = [questionType];
      
      if (questionType === 'latex') {
        // Latex题目使用question_id查询
        query += ` AND q.question_id = ?`;
        params.push(id);
      } else {
        const [allPaths] = await conn.query(
          `SELECT DISTINCT question_path FROM community_post_questions 
           WHERE question_type = 'image' LIMIT 100`
        );
        
        // 直接通过ID匹配
        let matchFound = false;
        for (const pathObj of allPaths) {
          const path = pathObj.question_path;
          const pathFolderName = path.split('/').pop();
          const generatedId = generateQuestionId(pathFolderName);
          
          if (generatedId == id) {
            console.log(`【刷新统计】找到ID匹配路径: ${path}, 生成ID: ${generatedId}`);
            query += ` AND q.question_path = ?`;
            params.push(path);
            matchFound = true;
            break;
          }
        }
        
        if (!matchFound) {
          // 使用ID匹配
          query += ` AND q.question_id = ?`;
          params.push(id);
        }
      }
      
      query += ` ORDER BY p.created_at DESC LIMIT 10`;
      
      return await conn.query(query, params);
    });
    
    // 创建统计数据对象
    const stats = {
      id: parseInt(id),
      type: questionType,
      starCount: 0, // 教师端的打星功能，这里暂时设为0
      postCount,
      commentCount,
      likeCount: interactionCounts.like,
      recommendCount: interactionCounts.recommend,
      coinCount: interactionCounts.coin,
      favoriteCount: interactionCounts.favorite,
      appleCount: appleCount,
      studentCount: studentCount,
      averageRating: averageRating,
      lastRefreshed: new Date().toISOString(),
      relatedPosts: detailedPostsResult.map(post => ({
        id: post.id,
        title: post.title,
        author: post.author_name,
        commentCount: post.comment_count,
        likeCount: post.like_count,
        favoriteCount: post.favorite_count,
        coinCount: post.coin_count,
        created_at: post.created_at
      }))
    };
    
    // 更新或创建统计记录
    await updateQuestionStats(teacherId, id, questionType, stats);
    
    return stats;
  } catch (error) {
    console.error('刷新题目统计详情失败:', error);
    throw error;
  }
}

/**
 * 更新题目统计记录
 */
async function updateQuestionStats(teacherId, questionId, questionType, stats) {
  console.log(`【开始更新统计】教师ID: ${teacherId}, 题目ID: ${questionId}, 类型: ${questionType}`);
  console.log(`【更新统计数据】`, {
    post_count: stats.postCount,
    comment_count: stats.commentCount,
    like_count: stats.likeCount,
    recommend_count: stats.recommendCount,
    coin_count: stats.coinCount,
    favorite_count: stats.favoriteCount,
    apple_count: stats.appleCount,
    student_count: stats.studentCount,
    average_rating: stats.averageRating
  });
  
  try {
    return await executeWithRetry(async (conn) => {
      try {
        // 开始事务
        await conn.beginTransaction();
        
        // 对于图片题目，尝试获取完整路径并解析
        let subject = null;
        let grade = null;
        let year = null; 
        let type = null;
        let timeid = null;
        
        if (questionType === 'image') {
          // 查找匹配的图片路径
          const [allPaths] = await conn.query(
            `SELECT DISTINCT question_path FROM community_post_questions 
             WHERE question_type = 'image' LIMIT 500`
          );
          
          // 查找与ID匹配的路径
          for (const pathObj of allPaths) {
            const path = pathObj.question_path;
            const folderName = path.split('/').pop();
            const generatedId = generateQuestionId(folderName);
            
            if (generatedId == questionId) {
              // 拆解路径，格式如: /prtsc/线性代数/大一/2019/A卷/20250319T154706
              const parts = path.split('/').filter(p => p.length > 0);
              
              if (parts.length >= 5) {
                // 忽略第一个元素(prtsc)
                subject = parts[1] || null;  // 线性代数
                // 保留完整的年级格式，如"大一"
                grade = parts[2] || null;    // 大一
                year = parts[3] || null;     // 2019
                type = parts[4] || null;     // A卷
                
                if (parts.length >= 6) {
                  timeid = parts[5] || null; // 20250319T154706
                }
                
                console.log(`【更新统计】拆解路径: subject=${subject}, grade=${grade}, year=${year}, type=${type}, timeid=${timeid}`);
                break;
              }
            }
          }
        } else if (questionType === 'latex') {
          // 对于LaTeX题目，从latex_questions表获取元数据
          try {
            const [latexData] = await conn.query(
              `SELECT subject, grade, year, type, folder_name 
               FROM latex_questions
               WHERE id = ?`,
              [questionId]
            );
            
            if (latexData && latexData.length > 0) {
              subject = latexData[0].subject || null;
              grade = latexData[0].grade || null;
              year = latexData[0].year || null;
              type = latexData[0].type || null;
              timeid = latexData[0].folder_name || null;
              console.log(`【更新统计】从latex_questions表获取到LaTeX题目信息: subject=${subject}, grade=${grade}, year=${year}, type=${type}, timeid=${timeid}`);
            } else {
              console.log(`【更新统计】未在latex_questions表中找到ID为${questionId}的LaTeX题目`);
            }
          } catch (latexError) {
            console.error(`【更新统计】获取LaTeX题目元数据失败:`, latexError);
          }
        }
        
        // 检查记录是否存在
        const [existingRows] = await conn.query(
          `SELECT id, \`select\` FROM teachers_selected_questions 
           WHERE teacher_id = ? AND question_id = ? AND question_type = ?`,
          [teacherId, questionId, questionType]
        );
        
        const isSelected = existingRows.length > 0 ? (existingRows[0].select === '1') : false;
        
        if (existingRows.length === 0) {
          // 如果记录不存在，需要创建一个基本记录
          console.log(`【更新统计】创建新记录`);
          
          if (questionType === 'latex') {
            // Latex题目
            await conn.query(
              `INSERT INTO teachers_selected_questions 
               (teacher_id, question_id, question_type, question_folder_or_id, 
                subject, grade, year, type, timeid, \`select\`) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '0')`,
              [teacherId, questionId, questionType, questionId.toString(),
               subject, grade, year, type, timeid]
            );
          } else {
            // 图片题目，包含拆解的路径信息
            await conn.query(
              `INSERT INTO teachers_selected_questions 
               (teacher_id, question_id, question_type, question_folder_or_id, 
                subject, grade, year, type, timeid, \`select\`) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '0')`,
              [teacherId, questionId, questionType, `folder_${questionId}`, 
               subject, grade, year, type, timeid]
            );
          }
          
          console.log(`【更新统计】创建新记录成功`);
        } else if ((questionType === 'image' || questionType === 'latex') && 
                   (subject || grade || year || type || timeid)) {
          // 如果记录存在并且我们获取到了元数据，更新路径信息但保留select状态
          const currentSelect = existingRows[0].select || '0';
          console.log(`【更新统计】更新已有记录的元数据信息，保留select=${currentSelect}`);
          await conn.query(
            `UPDATE teachers_selected_questions SET
             subject = COALESCE(?, subject),
             grade = COALESCE(?, grade),
             year = COALESCE(?, year),
             type = COALESCE(?, type), 
             timeid = COALESCE(?, timeid)
             WHERE teacher_id = ? AND question_id = ? AND question_type = ?`,
            [subject, grade, year, type, timeid, teacherId, questionId, questionType]
          );
        }
        
        // 在更新前再次获取最新的community_question_apples数据，确保数据准确性
        const [appleResult] = await conn.query(
          `SELECT 
             IFNULL(AVG(apples_count), 0) as average_rating,
             IFNULL(SUM(apples_count), 0) as apple_count,
             COUNT(DISTINCT user_id) as student_count
           FROM community_question_apples 
           WHERE question_id = ? AND question_type = ?`,
          [questionId, questionType]
        );
        
        const averageRating = parseFloat(appleResult[0]?.average_rating || 0);
        const appleCount = parseInt(appleResult[0]?.apple_count || 0);
        const studentCount = parseInt(appleResult[0]?.student_count || 0);
        
        // 更新统计数据
        const updateQuery = `UPDATE teachers_selected_questions SET
           star_count = ?,
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
           WHERE teacher_id = ? AND question_id = ? AND question_type = ?`;
           
        const updateParams = [
          stats.starCount,
          stats.postCount,
          stats.commentCount,
          stats.likeCount,
          stats.recommendCount,
          stats.coinCount,
          stats.favoriteCount,
          appleCount,  // 使用最新获取的数据
          studentCount, // 使用最新获取的数据
          averageRating, // 使用最新获取的数据
          teacherId,
          questionId,
          questionType
        ];
        
        console.log(`【更新统计】SQL参数:`, updateParams);
        
        const [updateResult] = await conn.query(updateQuery, updateParams);
        
        // 检查更新是否成功
        if (updateResult.affectedRows === 0) {
          console.error(`【更新统计】更新失败，没有找到匹配的记录`);
          throw new Error('更新失败，没有找到匹配的记录');
        } else if (updateResult.changedRows === 0) {
          console.log(`【更新统计】数据没有变化或已经是最新的`);
        } else {
          console.log(`【更新统计】更新成功，已修改 ${updateResult.changedRows} 行`);
        }
        
        // 验证数据是否已更新
        const [verifyRows] = await conn.query(
          `SELECT * FROM teachers_selected_questions 
           WHERE teacher_id = ? AND question_id = ? AND question_type = ?`,
          [teacherId, questionId, questionType]
        );
        
        if (verifyRows.length > 0) {
          const record = verifyRows[0];
          console.log(`【更新统计】验证更新结果:`, {
            post_count: record.post_count,
            comment_count: record.comment_count,
            like_count: record.like_count,
            student_rating_total: record.student_rating_total,
            student_rating_count: record.student_rating_count,
            average_rating: record.average_rating,
            subject: record.subject,
            grade: record.grade,
            year: record.year,
            type: record.type,
            timeid: record.timeid,
            select: record.select
          });
        } else {
          console.error(`【更新统计】验证失败，找不到更新后的记录`);
        }
        
        // 提交事务
        await conn.commit();
        
        return updateResult;
      } catch (trxError) {
        // 发生错误时回滚事务
        await conn.rollback();
        console.error(`【更新统计】事务回滚，错误:`, trxError);
        throw trxError;
      }
    });
  } catch (error) {
    console.error(`【更新统计】更新失败，错误:`, error);
    throw error;
  }
}

// 导出函数
module.exports = {
  refreshQuestionStatsDetails,
  updateQuestionStats
}; 