/**
 * 题目管理路由 - 题目统计相关辅助函数
 */
const { pool, executeWithRetry, generateQuestionId } = require('./questionUtils');
const statsUpdateHelper = require('./questionStatsUpdateHelper');

/**
 * 获取题目统计详情
 */
async function getQuestionStatsDetails(teacherId, id, questionType, appleCount, studentCount, avgRating) {
  try {
    // 查询统计数据
    return await executeWithRetry(async (conn) => {
      // 对于图片题目，需要构造正确的路径查询
      let query = "";
      let params = [];
      let postQueryCondition = "";
      let postQueryParams = [questionType];
      
      // 查询 teachers_selected_questions 表获取统计数据
      const [rows] = await conn.query(
        `SELECT 
          question_id, 
          question_type,
          star_count,
          post_count, 
          comment_count, 
          like_count, 
          recommend_count, 
          coin_count, 
          favorite_count,
          student_rating_total,
          student_rating_count,
          average_rating,
          subject,
          grade,
          year,
          type,
          timeid,
          \`select\`,
          last_refreshed
        FROM teachers_selected_questions 
        WHERE teacher_id = ? AND question_id = ? AND question_type = ?`,
        [teacherId, id, questionType]
      );
      
      // 查看是否有任何数据
      const foundRecord = rows.length > 0;
      
      // 尝试获取题目元数据（主题、年级等）
      let subject = null;
      let grade = null;
      let year = null;
      let type = null;
      let timeid = null;
      let select = '0';  // 默认为未选中
      
      if (rows.length > 0) {
        // 如果有记录，使用现有数据
        subject = rows[0].subject;
        grade = rows[0].grade;
        year = rows[0].year;
        type = rows[0].type;
        timeid = rows[0].timeid;
        select = rows[0].select || '0';  // 保持现有的选中状态
      } else {
        // 如果没有记录，尝试获取元数据
        if (questionType === 'image') {
          // 尝试查找与ID匹配的路径
          const [allPathsResult] = await conn.query(
            `SELECT DISTINCT question_path FROM community_post_questions 
             WHERE question_type = 'image' LIMIT 500`
          );
          
          for (const pathObj of allPathsResult) {
            const path = pathObj.question_path;
            const folderName = path.split('/').pop();
            const generatedId = generateQuestionId(folderName);
            
            if (generatedId == id) {
              console.log(`【获取统计】找到路径: ${path}, 生成ID: ${generatedId}`);
              // 解析路径信息
              const parts = path.split('/').filter(p => p.length > 0);
              if (parts.length >= 5) {
                subject = parts[1] || null;  // 线性代数
                grade = parts[2] || null;    // 大一
                year = parts[3] || null;     // 2019
                type = parts[4] || null;     // A卷
                if (parts.length >= 6) {
                  timeid = parts[5] || null; // 20250319T154706
                }
                break;
              }
            }
          }
        } else if (questionType === 'latex') {
          // 获取LaTeX题目的元数据 - 从latex_questions表获取
          try {
            const [latexData] = await conn.query(
              `SELECT subject, grade, year, type, folder_name 
               FROM latex_questions
               WHERE id = ?`,
              [id]
            );
            
            if (latexData && latexData.length > 0) {
              subject = latexData[0].subject || null;
              grade = latexData[0].grade || null;
              year = latexData[0].year || null;
              type = latexData[0].type || null;
              timeid = latexData[0].folder_name || null;
            }
          } catch (error) {
            console.error('获取LaTeX题目元数据失败:', error);
          }
        }
      }
      
      if (rows.length === 0) {
        // 如果不存在记录，返回默认值但同时自动创建记录
        console.log(`【warning】未找到题目在teachers_selected_questions中的记录，使用默认值并创建记录`);
        const defaultStats = {
          id: parseInt(id),
          type: questionType,
          starCount: 0,
          postCount: 0,
          commentCount: 0,
          likeCount: 0,
          recommendCount: 0,
          coinCount: 0,
          favoriteCount: 0,
          appleCount: appleCount,
          studentCount: studentCount,
          averageRating: avgRating,
          subject: subject,
          grade: grade,
          year: year,
          type: type,
          timeid: timeid,
          select: select,
          lastRefreshed: new Date().toISOString(),
          relatedPosts: []
        };
        
        // 尝试创建记录，防止数据丢失
        try {
          // 创建新记录
          if (questionType === 'latex') {
            await conn.query(
              `INSERT INTO teachers_selected_questions 
               (teacher_id, question_id, question_type, question_folder_or_id, 
                subject, grade, year, type, timeid, \`select\`, 
                student_rating_total, student_rating_count, average_rating)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                teacherId, 
                id, 
                questionType, 
                id.toString(),
                subject,
                grade,
                year,
                type,
                timeid,
                select,
                appleCount,
                studentCount,
                avgRating
              ]
            );
          } else {
            await conn.query(
              `INSERT INTO teachers_selected_questions 
               (teacher_id, question_id, question_type, question_folder_or_id, 
                subject, grade, year, type, timeid, \`select\`, 
                student_rating_total, student_rating_count, average_rating)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                teacherId, 
                id, 
                questionType, 
                `folder_${id}`,
                subject,
                grade,
                year,
                type,
                timeid,
                select,
                appleCount,
                studentCount,
                avgRating
              ]
            );
          }
          console.log(`已创建题目统计记录，题目ID: ${id}, 类型: ${questionType}, 教师ID: ${teacherId}`);
        } catch (updateError) {
          console.error(`创建题目统计记录失败:`, updateError);
        }
        
        return { ...defaultStats, isCreated: true };
      }
      
      // 检查student_rating_total和student_rating_count是否为0但community_question_apples有数据
      // 这可能表明数据不同步，我们需要更新它
      const dbTotalRating = parseInt(rows[0].student_rating_total || 0);
      const dbStudentCount = parseInt(rows[0].student_rating_count || 0);
      
      // 如果数据库中的评分数据与实际计算的不同，则自动更新
      if (dbTotalRating !== appleCount || dbStudentCount !== studentCount) {
        console.log(`【数据不同步】数据库记录与实际数据不同，将更新记录`);
        console.log(`【数据不同步】数据库: 总=${dbTotalRating}, 学生=${dbStudentCount}, 平均=${rows[0].average_rating}`);
        console.log(`【数据不同步】实际: 总=${appleCount}, 学生=${studentCount}, 平均=${avgRating}`);
        
        try {
          await conn.query(
            `UPDATE teachers_selected_questions 
             SET student_rating_total = ?,
                 student_rating_count = ?,
                 average_rating = ?,
                 last_refreshed = NOW()
             WHERE teacher_id = ? AND question_id = ? AND question_type = ?`,
            [appleCount, studentCount, avgRating, teacherId, id, questionType]
          );
          console.log(`【数据不同步】已更新评分数据`);
        } catch (updateError) {
          console.error(`【数据不同步】更新评分数据失败:`, updateError);
        }
      }
      
      // 如果缺少元数据（如subject, grade等），尝试更新
      if ((!rows[0].subject || !rows[0].grade || !rows[0].year || !rows[0].type) && 
          (subject || grade || year || type || timeid)) {
        console.log(`【元数据更新】发现缺少的元数据，尝试更新`);
        try {
          await conn.query(
            `UPDATE teachers_selected_questions SET
             subject = COALESCE(?, subject),
             grade = COALESCE(?, grade),
             year = COALESCE(?, year),
             type = COALESCE(?, type),
             timeid = COALESCE(?, timeid)
             WHERE teacher_id = ? AND question_id = ? AND question_type = ?`,
            [subject, grade, year, type, timeid, teacherId, id, questionType]
          );
          console.log(`【元数据更新】已更新题目元数据`);
        } catch (updateError) {
          console.error(`【元数据更新】更新元数据失败:`, updateError);
        }
      }
      
      // 设置查询条件
      if (questionType === 'latex') {
        // Latex题目使用question_id查询
        postQueryCondition = 'AND q.question_id = ?';
        postQueryParams.push(id);
      } else {
        // 图片题目使用question_path查询
        // 尝试查找与ID匹配的路径
        const [allPathsResult] = await conn.query(
          `SELECT DISTINCT question_path FROM community_post_questions 
           WHERE question_type = 'image' LIMIT 100`
        );
        
        let matchFound = false;
        for (const pathObj of allPathsResult) {
          const path = pathObj.question_path;
          const folderName = path.split('/').pop();
          const generatedId = generateQuestionId(folderName);
          
          if (generatedId == id) {
            console.log(`【获取统计】找到ID匹配路径: ${path}, 生成ID: ${generatedId}`);
            postQueryCondition = 'AND q.question_path = ?';
            postQueryParams.push(path);
            matchFound = true;
            break;
          }
        }
        
        if (!matchFound) {
          // 如果没有找到匹配的路径，使用更通用的查询
          postQueryCondition = 'AND q.question_id = ?';
          postQueryParams.push(id);
        }
      }
      
      // 查询引用该题目的帖子
      const [postsResult] = await conn.query(
        `SELECT 
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
          q.question_type = ?
          ${postQueryCondition}
        ORDER BY 
          p.created_at DESC`,
        postQueryParams
      );
      
      // 格式化数据
      const resultData = {
        id: parseInt(id),
        type: questionType,
        starCount: rows[0].star_count || 0,
        postCount: rows[0].post_count || 0,
        commentCount: rows[0].comment_count || 0,
        likeCount: rows[0].like_count || 0,
        recommendCount: rows[0].recommend_count || 0,
        coinCount: rows[0].coin_count || 0,
        favoriteCount: rows[0].favorite_count || 0,
        // 确保使用最新的评分数据，优先使用从community_question_apples表获取的数据
        appleCount: appleCount, 
        studentCount: studentCount,
        averageRating: avgRating, 
        lastRefreshed: rows[0].last_refreshed || new Date().toISOString(),
        relatedPosts: postsResult.map(post => ({
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
      
      return resultData;
    });
  } catch (error) {
    console.error('获取题目统计详情失败:', error);
    throw error;
  }
}

// 导出函数
module.exports = {
  getQuestionStatsDetails,
  refreshQuestionStatsDetails: statsUpdateHelper.refreshQuestionStatsDetails
}; 