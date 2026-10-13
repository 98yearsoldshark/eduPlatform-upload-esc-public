/**
 * 题目管理路由 - 选择模块
 */
const { generateQuestionId } = require('./utils');

// 查询题目选中状态
async function getSelectStatus(teacherId, executeWithRetry) {
  console.log(`【选择模块】查询题目选中状态, 教师ID: ${teacherId}`);
  
  try {
    // 查询老师选中的题目记录
    const selectedQuestions = await executeWithRetry(async (conn) => {
      const [rows] = await conn.query(
        `SELECT question_id, question_type, \`select\` 
         FROM teachers_selected_questions 
         WHERE teacher_id = ?`,
        [teacherId]
      );
      return rows;
    });
    
    // 构建结果映射
    const selectStatusMap = {};
    selectedQuestions.forEach(q => {
      const key = `${q.question_type}-${q.question_id}`;
      selectStatusMap[key] = {
        question_id: q.question_id,
        question_type: q.question_type,
        select: q.select,
        is_selected: q.select === '1'
      };
    });
    
    console.log(`【选择模块】获取到 ${selectedQuestions.length} 条记录`);
    
    return {
      message: `获取到 ${selectedQuestions.length} 条记录`,
      count: selectedQuestions.length,
      statusMap: selectStatusMap
    };
  } catch (error) {
    console.error('【选择模块】查询题目选中状态失败:', error);
    throw error;
  }
}

module.exports = {
  getSelectStatus
}; 