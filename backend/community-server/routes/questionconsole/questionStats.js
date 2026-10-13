/**
 * 题目管理路由 - 题目统计相关功能
 */
const { executeWithRetry, generateQuestionId } = require('./questionUtils');
const statsHelper = require('./questionStatsHelper');

/**
 * 获取题目统计信息
 */
const getQuestionStats = async (req, res) => {
  const { id } = req.params;
  const { teacherId, questionType } = req.query;
  
  if (!teacherId || !id || !questionType) {
    return res.status(400).json({ message: '缺少必要参数' });
  }
  
  try {
    console.log(`获取题目统计信息, 题目ID: ${id}, 类型: ${questionType}, 教师ID: ${teacherId}`);
    
    // 获取题目的苹果数 - 这是学生打星评分
    const [appleResult] = await executeWithRetry(async (conn) => {
      console.log(`执行community_question_apples查询, 题目ID: ${id}, 类型: ${questionType}`);
      return await conn.query(
        `SELECT 
           COUNT(DISTINCT user_id) as student_count,
           IFNULL(SUM(apples_count), 0) as apple_count,
           IFNULL(AVG(apples_count), 0) as avg_rating
         FROM community_question_apples 
         WHERE question_id = ? AND question_type = ?`,
        [id, questionType]
      );
    });
    
    const appleCount = parseInt(appleResult[0]?.apple_count || 0);
    const studentCount = parseInt(appleResult[0]?.student_count || 0);
    // 计算平均评分 - 使用SQL的AVG更精确
    const avgRating = parseFloat(appleResult[0]?.avg_rating || 0);
    
    console.log(`id: ${id}类型: ${questionType}总评分: ${appleCount}学生数: ${studentCount}平均分: ${avgRating}检查：${appleCount} / ${studentCount} = ${studentCount > 0 ? (appleCount / studentCount) : 0}`);
    
    // 查询统计数据
    const stats = await statsHelper.getQuestionStatsDetails(
      teacherId, 
      id, 
      questionType, 
      appleCount, 
      studentCount, 
      avgRating
    );
    
    res.json(stats);
  } catch (error) {
    console.error('获取题目统计信息失败:', error);
    res.status(500).json({ message: '获取题目统计信息失败', error: error.message });
  }
};

/**
 * 刷新题目统计信息
 */
const refreshQuestionStats = async (req, res) => {
  const { id } = req.params;
  const { teacherId, questionType } = req.body;
  
  if (!teacherId || !id || !questionType) {
    return res.status(400).json({ message: '缺少必要参数' });
  }
  
  try {
    console.log(`=====================================`);
    console.log(`开始刷新题目统计信息, 题目ID: ${id}, 类型: ${questionType}, 教师ID: ${teacherId}`);
    console.log(`当前时间: ${new Date().toISOString()}`);
    console.log(`=====================================`);
    
    // 测试所有图片路径，查看哪个匹配ID
    const [allPathsResult] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT DISTINCT question_path FROM community_post_questions 
         WHERE question_type = 'image' LIMIT 100`
      );
    });
    
    // console.log('测试ID匹配结果:');
    for (const path of allPathsResult) {
      const pathId = generateQuestionId(path.question_path.split('/').pop());
      console.log(`路径: ${path.question_path}, 生成ID: ${pathId}, 是否匹配: ${pathId == id}`);
    }
    
    // 获取题目的苹果数 - 这是题目自身唯一的直接数据
    const [appleResult] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT 
           IFNULL(AVG(apples_count), 0) as apple_average,
           IFNULL(SUM(apples_count), 0) as apple_count,
           COUNT(DISTINCT user_id) as student_count
         FROM community_question_apples 
         WHERE question_id = ? AND question_type = ?`,
        [id, questionType]
      );
    });
    
    const averageRating = parseFloat(appleResult[0]?.apple_average || 0);
    const appleCount = parseInt(appleResult[0]?.apple_count || 0);
    const studentCount = parseInt(appleResult[0]?.student_count || 0);
    
    // 刷新题目统计信息
    const stats = await statsHelper.refreshQuestionStatsDetails(
      teacherId, 
      id, 
      questionType, 
      appleCount,
      studentCount,
      averageRating
    );
    
    res.json(stats);
  } catch (error) {
    console.error('刷新题目统计信息失败:', error);
    res.status(500).json({ message: '刷新题目统计信息失败', error: error.message });
  }
};

module.exports = {
  getQuestionStats,
  refreshQuestionStats
}; 