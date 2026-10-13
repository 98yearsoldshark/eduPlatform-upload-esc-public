/**
 * 题目管理路由 - 查询模块
 */
const axios = require('axios');
const { generateQuestionId, handleFolderRecursively } = require('./utils');

// 获取题目列表
async function getQuestionList(params, teacherId, executeWithRetry) {
  const { 
    subject, 
    year, 
    type,
    grade, 
    selectionStatus = 'all', 
    page = 1, 
    limit = 10,
    tab = 'all'
  } = params;
  
  console.log(`【查询模块】获取题目列表, 教师ID: ${teacherId}, 筛选条件:`, params);
  
  try {
    // 查询已选题目
    const selectedQuestions = await executeWithRetry(async (conn) => {
      const [rows] = await conn.query(
        `SELECT question_id, question_type, question_folder_or_id 
         FROM teachers_selected_questions 
         WHERE teacher_id = ?`,
        [teacherId]
      );
      return rows;
    });
    
    // 构建已选题目ID映射
    const selectedMap = new Map();
    selectedQuestions.forEach(q => {
      const key = `${q.question_type}-${q.question_id}`;
      selectedMap.set(key, q.question_folder_or_id);
    });
    
    console.log(`【查询模块】已选择题目: ${selectedMap.size}个`);
    
    // 构建API请求参数
    const latexParams = {};
    const imageParams = {};
    
    if (subject) {
      latexParams.subject = subject;
      imageParams.subject = subject;
    }
    if (year) {
      latexParams.year = year;
      imageParams.year = year;
    }
    if (type) {
      latexParams.type = type;
      imageParams.type = type;
    }
    if (grade) {
      latexParams.grade = grade;
      imageParams.grade = grade;
    }
    
    // 获取题目数据
    let latexQuestions = [];
    let imageQuestions = [];
    
    // 根据tab决定获取哪种类型的题目
    if (tab === 'all' || tab === 'latex') {
      console.log(`【查询模块】获取LaTeX题目，参数:`, latexParams);
      // 获取LaTeX题目
      try {
        const latexResponse = await axios.get('http://localhost:3001/latex-questions', {
          params: latexParams
        });
        latexQuestions = Array.isArray(latexResponse.data) ? latexResponse.data : [];
        
        // 添加类型标记和选中状态
        latexQuestions = latexQuestions.map(q => ({
          ...q,
          id: parseInt(q.id),
          type: 'latex',
          is_selected: selectedMap.has(`latex-${q.id}`)
        }));
        
        console.log(`【查询模块】获取到 ${latexQuestions.length} 个LaTeX题目`);
      } catch (error) {
        console.error('【查询模块】获取LaTeX题目失败:', error);
      }
    }
    
    if (tab === 'all' || tab === 'image') {
      console.log(`【查询模块】获取图片题目，参数:`, imageParams);
      
      try {
        // 使用遍历方法获取所有题目，然后根据筛选条件过滤
        // 第一步：获取所有科目
        const allSubjectsResponse = await axios.get('http://localhost:3001/folders');
        let allSubjects = [];
        
        if (Array.isArray(allSubjectsResponse.data)) {
          allSubjects = allSubjectsResponse.data;
        } else if (allSubjectsResponse.data && Array.isArray(allSubjectsResponse.data.folders)) {
          allSubjects = allSubjectsResponse.data.folders;
        }
        
        console.log(`【查询模块】获取到 ${allSubjects.length} 个科目`);
        
        // 根据筛选条件过滤科目
        const subjectsToProcess = subject 
          ? allSubjects.filter(s => s.name === subject)
          : allSubjects;
          
        // 逐个处理每个科目
        for (const subjectFolder of subjectsToProcess) {
          await handleFolderRecursively(subjectFolder, imageParams, selectedMap, imageQuestions, axios);
        }
        
        console.log(`【查询模块】总计获取到 ${imageQuestions.length} 个图片题目`);
      } catch (folderError) {
        console.error('【查询模块】获取文件夹结构失败:', folderError);
      }
    }
    
    // 合并题目
    let allQuestions = [...latexQuestions, ...imageQuestions];
    
    // 根据选中状态筛选
    if (selectionStatus === 'selected') {
      allQuestions = allQuestions.filter(q => q.is_selected);
      console.log(`【查询模块】筛选已选中题目: ${allQuestions.length}个`);
    } else if (selectionStatus === 'unselected') {
      allQuestions = allQuestions.filter(q => !q.is_selected);
      console.log(`【查询模块】筛选未选中题目: ${allQuestions.length}个`);
    }
    
    // 分页处理
    const startIndex = (page - 1) * limit;
    const paginatedQuestions = allQuestions.slice(startIndex, startIndex + parseInt(limit));
    
    console.log(`【查询模块】分页结果: 页码=${page}, 每页=${limit}, 总数=${allQuestions.length}, 本页=${paginatedQuestions.length}`);
    
    return {
      questions: paginatedQuestions,
      total: allQuestions.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(allQuestions.length / limit)
    };
  } catch (error) {
    console.error('【查询模块】获取题目列表失败:', error);
    throw error;
  }
}

/**
 * 获取题目的统计信息
 * @param {string} id 题目ID 
 * @param {string} type 题目类型
 * @param {function} executeWithRetry 带重试的数据库执行函数
 * @returns {object} 统计信息
 */
const getQuestionStats = async (id, type, executeWithRetry) => {
  console.log(`[查询模块] 获取题目统计, ID: ${id}, 类型: ${type}`);
  
  try {
    // 获取帖子数量
    const [posts] = await executeWithRetry(async (conn) => {
      console.log(`[查询模块] 查询帖子数量`);
      return await conn.query(
        'SELECT COUNT(*) as count FROM community_posts WHERE question_id = ? AND question_type = ?',
        [id, type]
      );
    });
    const postCount = posts[0]?.count || 0;
    console.log(`[查询模块] 查询到帖子数量: ${postCount}`);
    
    // 获取评论数量
    const [comments] = await executeWithRetry(async (conn) => {
      console.log(`[查询模块] 查询评论数量`);
      return await conn.query(
        `SELECT COUNT(*) as count FROM community_comments 
         WHERE post_id IN (
           SELECT id FROM community_posts WHERE question_id = ? AND question_type = ?
         )`,
        [id, type]
      );
    });
    const commentCount = comments[0]?.count || 0;
    console.log(`[查询模块] 查询到评论数量: ${commentCount}`);
    
    // 获取各类互动数量
    const interactionTypes = ['like', 'favorite', 'coin', 'recommend'];
    const interactions = {};
    
    for (const type of interactionTypes) {
      const [result] = await executeWithRetry(async (conn) => {
        console.log(`[查询模块] 查询${type}互动数量`);
        return await conn.query(
          `SELECT COUNT(*) as count FROM community_interactions 
           WHERE post_id IN (
             SELECT id FROM community_posts WHERE question_id = ? AND question_type = ?
           ) AND type = ?`,
          [id, type, type]
        );
      });
      interactions[`${type}Count`] = result[0]?.count || 0;
      console.log(`[查询模块] 查询到${type}互动数量: ${interactions[`${type}Count`]}`);
    }
    
    // 获取学生评分数据
    const [ratings] = await executeWithRetry(async (conn) => {
      console.log(`[查询模块] 查询学生评分`);
      return await conn.query(
        `SELECT SUM(rating) as total, COUNT(*) as count 
         FROM student_question_ratings 
         WHERE question_id = ? AND question_type = ?`,
        [id, type]
      );
    });
    
    const studentRatingTotal = ratings[0]?.total || 0;
    const studentRatingCount = ratings[0]?.count || 0;
    const averageRating = studentRatingCount > 0 ? studentRatingTotal / studentRatingCount : 0;
    
    console.log(`[查询模块] 查询到学生评分: 总分${studentRatingTotal}, 人数${studentRatingCount}, 平均${averageRating.toFixed(2)}`);
    
    // 获取收藏数据
    const [stars] = await executeWithRetry(async (conn) => {
      console.log(`[查询模块] 查询收藏数量`);
      return await conn.query(
        `SELECT COUNT(*) as count 
         FROM student_starred_questions 
         WHERE question_id = ? AND question_type = ?`,
        [id, type]
      );
    });
    const starCount = stars[0]?.count || 0;
    console.log(`[查询模块] 查询到收藏数量: ${starCount}`);
    
    // 构建统计结果
    const stats = {
      postCount,
      commentCount,
      likeCount: interactions.likeCount,
      favoriteCount: interactions.favoriteCount,
      coinCount: interactions.coinCount,
      recommendCount: interactions.recommendCount,
      appleCount: studentRatingTotal,
      studentCount: studentRatingCount,
      averageRating,
      starCount
    };
    
    console.log(`[查询模块] 统计结果: ${JSON.stringify(stats)}`);
    return stats;
  } catch (error) {
    console.error(`[查询模块] 获取题目统计失败: ${error.message}`, error);
    throw error;
  }
};

module.exports = {
  getQuestionList,
  getQuestionStats
}; 