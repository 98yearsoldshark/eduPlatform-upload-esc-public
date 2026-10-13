// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../../config/runtime');
/**
 * 题目管理路由 - 批量题目选择相关功能
 */
const { pool, executeWithRetry } = require('./questionUtils');

/**
 * 批量取消选择题目
 */
const batchDeselectQuestions = async (req, res) => {
  console.log('=+++++++++++++++++++++++++++++++++++++++++++++++++=');
  console.log('【后端】收到批量取消选入题目请求');
  console.log('【后端】时间:', new Date().toISOString());
  
  const { teacherId, questionIds, questionTypes } = req.body;
  
  console.log('【后端】解析的参数:', {
    teacherId: typeof teacherId === 'number' ? teacherId : typeof teacherId,
    questionIds: Array.isArray(questionIds) ? 
      `数组长度: ${questionIds.length}, 内容: [${questionIds.join(', ')}]` : 
      typeof questionIds,
    questionTypes: Array.isArray(questionTypes) ?
      `数组长度: ${questionTypes.length}, 内容: [${questionTypes.join(', ')}]` :
      typeof questionTypes
  });
  
  if (!teacherId || !questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
    console.log('【后端】缺少必要参数');
    return res.status(400).json({ message: '无效的请求参数' });
  }
  
  // 构建ID和类型的映射关系
  const typeMap = {};
  
  // 如果提供了questionTypes参数，则使用它
  if (Array.isArray(questionTypes) && questionTypes.length > 0) {
    console.log('【后端】使用前端提供的题目类型');
    
    // 确保类型数组长度与ID数组匹配
    const minLength = Math.min(questionIds.length, questionTypes.length);
    for (let i = 0; i < minLength; i++) {
      // 如果类型是'unknown'，不添加到映射表，后续会尝试从数据库查询
      if (questionTypes[i] && questionTypes[i] !== 'unknown') {
        typeMap[questionIds[i]] = questionTypes[i];
      } else {
        console.log(`【后端】题目ID ${questionIds[i]} 的类型未知或无效，将尝试从数据库查询`);
      }
    }
    
    console.log('【后端】题目类型映射:', typeMap);
  } else {
    console.log('【后端】未提供题目类型参数，将尝试查询类型');
  }
  
  let conn;
  try {
    console.log(`【后端】开始处理批量取消选入, 教师ID: ${teacherId}, 题目IDs:`, questionIds);
    
    conn = await pool.getConnection();
    
    // 开始事务
    await conn.beginTransaction();
    console.log('【后端】开始数据库事务');
    
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    let notSelectedCount = 0;
    let notFoundCount = 0;
    
    // 为每个题目ID更新select字段为0
    for (const questionId of questionIds) {
      try {
        // 如果有类型映射，直接使用它
        let questionType = typeMap[questionId];
        
        if (!questionType) {
          console.log(`【后端】题目ID ${questionId} 没有预设类型，查询数据库获取类型`);
          // 先获取题目类型
          const [questionRows] = await conn.query(
            `SELECT question_type, \`select\` FROM teachers_selected_questions 
             WHERE teacher_id = ? AND question_id = ?`,
            [teacherId, questionId]
          );
          
          if (questionRows.length === 0) {
            console.log(`【后端】未找到题目ID ${questionId} 的记录`);
            notFoundCount++;
            results.push({
              questionId,
              success: false,
              message: '未找到该题目记录'
            });
            continue;
          }
          
          questionType = questionRows[0].question_type;
          const currentSelectStatus = questionRows[0].select;
          
          console.log(`【后端】题目ID ${questionId}, 类型: ${questionType}, 当前select值: ${currentSelectStatus}`);
          
          // 只有当前select=1时才需要更新
          if (currentSelectStatus !== '1') {
            console.log(`【后端】题目ID ${questionId} 当前未被选入，无需取消`);
            notSelectedCount++;
            results.push({
              questionId,
              success: false,
              message: '该题目当前未被选入，无需取消',
              currentStatus: currentSelectStatus
            });
            continue;
          }
        } else {
          console.log(`【后端】使用预设的题目类型: ${questionId}=${questionType}`);
          
          // 检查记录是否存在
          const [checkRows] = await conn.query(
            `SELECT id, \`select\` FROM teachers_selected_questions 
             WHERE teacher_id = ? AND question_id = ? AND question_type = ?`,
            [teacherId, questionId, questionType]
          );
          
          if (checkRows.length === 0) {
            console.log(`【后端】未找到题目ID ${questionId} 类型 ${questionType} 的记录`);
            notFoundCount++;
            results.push({
              questionId,
              success: false,
              message: '未找到该题目记录'
            });
            continue;
          }
          
          // 只有当前select=1时才需要更新
          if (checkRows[0].select !== '1') {
            console.log(`【后端】题目ID ${questionId} 当前未被选入，无需取消`);
            notSelectedCount++;
            results.push({
              questionId,
              success: false,
              message: '该题目当前未被选入，无需取消',
              currentStatus: checkRows[0].select
            });
            continue;
          }
        }
        
        // 更新select字段为0，表示未选中
        console.log(`【后端】更新题目ID ${questionId}, 类型: ${questionType}, 设置select=0`);
        const [updateResult] = await conn.query(
          `UPDATE teachers_selected_questions SET
           \`select\` = '0'
           WHERE teacher_id = ? AND question_id = ? AND question_type = ?`,
          [teacherId, questionId, questionType]
        );
        
        const success = updateResult.affectedRows > 0;
        
        console.log(`【后端】题目ID ${questionId} 更新结果: ${success ? '成功' : '失败'}, 影响行数: ${updateResult.affectedRows}`);
        
        if (success) {
          successCount++;
        } else {
          failedCount++;
        }
        
        results.push({
          questionId,
          success,
          message: success ? '成功取消选择' : '更新失败',
          affectedRows: updateResult.affectedRows
        });
      } catch (error) {
        console.error(`【后端】处理题目ID ${questionId} 失败:`, error);
        failedCount++;
        results.push({
          questionId,
          success: false,
          message: error.message
        });
      }
    }
    
    // 提交事务
    await conn.commit();
    console.log('【后端】事务已提交');
    
    const response = {
      message: `成功取消选择 ${successCount}/${questionIds.length} 道题目`,
      successCount,
      totalCount: questionIds.length,
      notFoundCount,
      notSelectedCount,
      failedCount,
      results
    };
    
    res.json(response);
  } catch (error) {
    if (conn) {
      await conn.rollback();
    }
    console.error('【后端】批量取消选择题目失败:', error);
    res.status(500).json({ 
      message: '批量取消选择题目失败', 
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

/**
 * 获取题目选中状态
 */
const getSelectStatus = async (req, res) => {
  const { teacherId } = req.query;
  
  if (!teacherId) {
    return res.status(400).json({ message: '缺少必要参数: teacherId' });
  }
  
  try {
    console.log(`查询题目选中状态, 教师ID: ${teacherId}`);
    
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
    
    res.json({
      message: `获取到 ${selectedQuestions.length} 条记录`,
      count: selectedQuestions.length,
      statusMap: selectStatusMap
    });
    
  } catch (error) {
    console.error('查询题目选中状态失败:', error);
    res.status(500).json({ message: '查询题目选中状态失败', error: error.message });
  }
};

module.exports = {
  batchDeselectQuestions,
  getSelectStatus
}; 