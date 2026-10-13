// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../../config/runtime');
/**
 * 题目管理路由 - 题目选择相关功能
 */
const { pool, executeWithRetry, generateQuestionId } = require('./questionUtils');

/**
 * 选择题目
 */
const selectQuestions = async (req, res) => {
  console.log('===================================');
  console.log('【后端】收到批量选入题目请求');
  
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
  
  // 检查参数有效性
  if (!teacherId) {
    console.log('【后端】缺少teacherId参数');
    return res.status(400).json({ message: '无效的请求参数: 缺少teacherId' });
  }
  
  if (!questionIds) {
    console.log('【后端】缺少questionIds参数');
    return res.status(400).json({ message: '无效的请求参数: 缺少questionIds' });
  }
  
  if (!Array.isArray(questionIds)) {
    console.log('【后端】questionIds不是数组');
    return res.status(400).json({ message: '无效的请求参数: questionIds必须是数组' });
  }
  
  if (questionIds.length === 0) {
    console.log('【后端】questionIds数组为空');
    return res.status(400).json({ message: '无效的请求参数: questionIds数组为空' });
  }
  
  try {
    // 验证questionIds是否都是数字
    const validQuestionIds = questionIds.filter(id => !isNaN(Number(id))).map(id => Number(id));
    
    if (validQuestionIds.length === 0) {
      console.log('【后端】没有有效的题目ID');
      return res.status(400).json({ message: '没有有效的题目ID' });
    }
    
    if (validQuestionIds.length !== questionIds.length) {
      console.log('【后端】部分题目ID无效，已过滤');
      console.log('【后端】原始IDs:', questionIds);
      console.log('【后端】有效IDs:', validQuestionIds);
    }
    
    // 构建ID和类型的映射关系
    const typeMap = {};
    
    // 如果提供了questionTypes参数，则使用它
    if (Array.isArray(questionTypes) && questionTypes.length > 0) {
      // 确保类型数组长度与ID数组匹配
      const minLength = Math.min(validQuestionIds.length, questionTypes.length);
      for (let i = 0; i < minLength; i++) {
        typeMap[validQuestionIds[i]] = questionTypes[i];
      }
      
      console.log('【后端】题目类型映射:', typeMap);
    } else {
      console.log('【后端】未提供题目类型参数，将尝试查询类型');
    }
    
    // 获取题目详情
    const questions = [];
    
    // 获取LaTeX题目
    try {
      // 直接从数据库获取LaTeX题目信息
      const [latexQuestions] = await executeWithRetry(async (conn) => {
        return await conn.query(
          `SELECT id, subject, grade, year, type, folder_name 
           FROM latex_questions 
           WHERE id IN (?)`,
          [validQuestionIds]
        );
      });
      
      console.log(`【后端】查询到 ${latexQuestions.length} 个LaTeX题目`);
       
      questions.push(...latexQuestions.map(q => ({
        id: parseInt(q.id),
        type: 'latex',
        subject: q.subject || '',
        grade: q.grade || '',
        year: q.year || '',
        questionType: q.type || '',  // 使用questionType避免名称冲突
        timeid: q.folder_name || '',
        question_folder_or_id: q.id.toString()
      })));
    } catch (error) {
      console.error('【后端】获取LaTeX题目详情失败:', error);
    }

    // 对于图片题目，检查前端提供的类型信息
    const imageIds = validQuestionIds.filter(id => {
      // 如果有类型映射且类型为'image'，或者在LaTeX题目中找不到
      return (typeMap[id] === 'image') || !questions.some(q => q.id === id);
    });
    
    console.log('【后端】需要处理的图片题目IDs:', imageIds);
    
    if (imageIds.length > 0) {
      try {
        // 从已选择的题目表中查询已存在的图片题目信息
        const [existingImageQuestions] = await executeWithRetry(async (conn) => {
          return await conn.query(
            `SELECT question_id, subject, grade, year, type, timeid, question_folder_or_id 
             FROM teachers_selected_questions 
             WHERE teacher_id = ? AND question_id IN (?) AND question_type = 'image'`,
            [teacherId, imageIds]
          );
        });
        
        console.log(`【后端】从已选择表中找到 ${existingImageQuestions.length} 个图片题目`);
        
        // 添加已存在的图片题目
        questions.push(...existingImageQuestions.map(q => ({
          id: parseInt(q.question_id),
          type: 'image',
          subject: q.subject || '',
          grade: q.grade || '',
          year: q.year || '',
          questionType: q.type || '',
          timeid: q.timeid || '',
          question_folder_or_id: q.question_folder_or_id || `${q.question_id}`
        })));
        
        // 对于剩余未找到的图片题目，使用文件夹名称查询
        const foundIds = questions.map(q => q.id);
        const remainingImageIds = imageIds.filter(id => !foundIds.includes(id));
        
        // 尝试直接插入图片题目
        if (remainingImageIds.length > 0) {
          console.log('【后端】将剩余图片题目直接插入数据库');
          for (const id of remainingImageIds) {
            questions.push({
              id: id,
              type: 'image',
              subject: '',
              grade: '',
              year: '',
              questionType: '',
              timeid: '',
              question_folder_or_id: `folder_${id}`
            });
          }
        }
      } catch (error) {
        console.error('【后端】获取图片题目信息失败:', error);
      }
    }
    
    // 匹配找到的题目
    const matchedQuestions = questions.filter(q => validQuestionIds.includes(q.id));
    
    // 处理未匹配到的题目，使用类型映射创建题目对象
    const unmatchedIds = validQuestionIds.filter(id => !matchedQuestions.some(q => q.id === id));
    if (unmatchedIds.length > 0) {
      console.log('【后端】有未匹配到的题目，将使用类型映射创建:', unmatchedIds);
      
      for (const id of unmatchedIds) {
        // 使用映射中的类型，默认为'image'
        const type = typeMap[id] || 'image';
        
        matchedQuestions.push({
          id: id,
          type: type,
          subject: '',
          grade: '',
          year: '',
          questionType: '',
          timeid: '',
          question_folder_or_id: type === 'latex' ? id.toString() : `folder_${id}`
        });
      }
    }
    
    console.log(`【后端】匹配到 ${matchedQuestions.length}/${validQuestionIds.length} 个题目需要选入`);
    console.log('【后端】剩余未匹配题目:', unmatchedIds);
    
    if (matchedQuestions.length === 0) {
      console.log('【后端】未找到指定的题目');
      return res.status(404).json({ message: '未找到指定的题目' });
    }
    
    const results = [];
    let successCount = 0;
    
    // 插入选中的题目记录
    for (const question of matchedQuestions) {
      let conn;
      try {
        conn = await pool.getConnection();
        
        // 先检查是否存在记录
        const [existingRows] = await conn.query(
          `SELECT id, \`select\` FROM teachers_selected_questions 
           WHERE teacher_id = ? AND question_id = ? AND question_type = ?`,
          [teacherId, question.id, question.type]
        );
        
        console.log(`【后端】题目ID ${question.id} 查询结果: 找到 ${existingRows.length} 条记录`);
        if (existingRows.length > 0) {
          console.log(`【后端】现有记录ID: ${existingRows[0].id}, 当前select值: ${existingRows[0].select}`);
        }
        
        let success = false;
        
        if (existingRows.length === 0) {
          // 如果记录不存在，创建新记录并设置select = 1（已选中）
          console.log(`【后端】题目ID ${question.id} 不存在记录，创建新记录`);
          
          try {
            const insertSql = `
              INSERT INTO teachers_selected_questions 
              (teacher_id, question_id, question_type, subject, grade, year, type, timeid, question_folder_or_id, \`select\`)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '1')`;
              
            console.log('【后端】执行SQL:', insertSql);
            
            const insertParams = [
              teacherId, 
              question.id, 
              question.type,
              question.subject || null,
              question.grade || null,
              question.year || null,
              question.questionType || null,  // 这里使用questionType
              question.timeid || null,
              question.question_folder_or_id || `${question.id}`
            ];
            
            console.log('【后端】SQL参数:', insertParams);
            
            const insertResult = await conn.query(insertSql, insertParams);
            
            console.log(`【后端】题目ID ${question.id} 插入结果:`, {
              affectedRows: insertResult[0]?.affectedRows,
              insertId: insertResult[0]?.insertId
            });
            
            success = insertResult[0]?.affectedRows > 0 || insertResult[0]?.insertId > 0;
          } catch (dbError) {
            console.error(`【后端】题目ID ${question.id} 插入错误:`, dbError);
            success = false;
          }
        } else {
          // 如果记录存在，只更新select字段为1（已选中）和其他元数据
          console.log(`【后端】题目ID ${question.id} 已存在记录，更新select=1`);
          
          try {
            const updateSql = `
              UPDATE teachers_selected_questions SET
              subject = COALESCE(?, subject),
              grade = COALESCE(?, grade),
              year = COALESCE(?, year),
              type = COALESCE(?, type),
              timeid = COALESCE(?, timeid),
              \`select\` = '1',
              selected_at = CURRENT_TIMESTAMP
              WHERE teacher_id = ? AND question_id = ? AND question_type = ?`;
              
            console.log('【后端】执行SQL:', updateSql);
            
            const updateParams = [
              question.subject || null,
              question.grade || null,
              question.year || null,
              question.questionType || null,  // 这里使用questionType
              question.timeid || null,
              teacherId,
              question.id,
              question.type
            ];
            
            console.log('【后端】SQL参数:', updateParams);
            
            const updateResult = await conn.query(updateSql, updateParams);
            
            console.log(`【后端】题目ID ${question.id} 更新结果:`, {
              affectedRows: updateResult[0]?.affectedRows,
              changedRows: updateResult[0]?.changedRows
            });
            
            success = updateResult[0]?.affectedRows > 0 || updateResult[0]?.changedRows > 0;
          } catch (dbError) {
            console.error(`【后端】题目ID ${question.id} 更新错误:`, dbError);
            success = false;
          }
        }
        
        if (success) {
          successCount++;
          console.log(`【后端】题目ID ${question.id} 操作成功`);
        } else {
          console.log(`【后端】题目ID ${question.id} 操作失败`);
        }
        
        results.push({
          questionId: question.id,
          questionType: question.type,
          success: success,
          message: success ? '成功选入' : '选入失败'
        });
      } catch (error) {
        console.error(`【后端】处理题目ID ${question.id} 失败:`, error);
        results.push({
          questionId: question.id,
          questionType: question.type,
          success: false,
          message: error.message || '未知错误'
        });
      } finally {
        if (conn) {
          conn.release();
        }
      }
    }
    
    console.log(`【后端】批量选入完成: 成功 ${successCount}/${matchedQuestions.length} 道题目`);
    
    const response = { 
      message: `成功选择${successCount}道题目`, 
      selectedCount: successCount,
      totalCount: matchedQuestions.length,
      results: results
    };
    
    console.log('【后端】返回响应:', response);
    console.log('===================================');
    
    res.json(response);
    
  } catch (error) {
    console.error('【后端】选择题目失败:', error);
    res.status(500).json({ message: '选择题目失败', error: error.message });
  }
};

/**
 * 取消选择题目
 */
const deselectQuestion = async (req, res) => {
  console.log('=+++++++++++++++++++++++++++++++++++++++++++++++++=');
  console.log('【后端】收到取消选入题目请求');
  
  const { teacherId, questionId, questionType } = req.body;
  
  console.log('【后端】解析的参数:', {
    teacherId: typeof teacherId === 'number' ? teacherId : typeof teacherId,
    questionId: questionId,
    questionType: questionType || '未提供'
  });
  
  if (!teacherId || !questionId) {
    console.log('【后端】缺少必要参数');
    return res.status(400).json({ message: '无效的请求参数' });
  }
  
  try {
    console.log(`【后端】开始处理取消选入请求, 教师ID: ${teacherId}, 题目ID: ${questionId}, 类型: ${questionType || '未提供'}`);
    
    let conn;
    try {
      conn = await pool.getConnection();
      
      // 如果未提供questionType或类型为'unknown'，先查询获取
      let actualQuestionType = questionType;
      if (!actualQuestionType || actualQuestionType === 'unknown') {
        const [typeRows] = await conn.query(
          `SELECT question_type FROM teachers_selected_questions 
           WHERE teacher_id = ? AND question_id = ?`,
          [teacherId, questionId]
        );
        
        if (typeRows.length === 0) {
          console.log('【后端】未找到该选中记录');
          return res.status(404).json({ 
            message: '未找到该选中记录',
            details: {
              teacherId,
              questionId,
              questionType
            }
          });
        }
        
        actualQuestionType = typeRows[0].question_type;
        console.log(`【后端】已查询题目类型: ${actualQuestionType}`);
      }
      
      // 检查记录是否存在并且select=1
      const [checkRows] = await conn.query(
        `SELECT id, \`select\` FROM teachers_selected_questions 
         WHERE teacher_id = ? AND question_id = ? AND question_type = ?`,
        [teacherId, questionId, actualQuestionType]
      );
      
      if (checkRows.length === 0) {
        console.log('【后端】未找到该题目记录');
        return res.status(404).json({ 
          message: '未找到该题目记录',
          details: {
            teacherId,
            questionId,
            questionType: actualQuestionType
          }
        });
      }
      
      console.log(`【后端】找到题目记录, ID: ${checkRows[0].id}, 当前select值: ${checkRows[0].select}`);
      
      // 检查当前是否已选中
      if (checkRows[0].select !== '1') {
        console.log(`【后端】题目ID ${questionId} 当前未被选入，无需取消`);
        return res.status(400).json({ 
          message: '该题目当前未被选入，无需取消',
          currentStatus: checkRows[0].select,
          details: {
            teacherId,
            questionId,
            questionType: actualQuestionType
          }
        });
      }
      
      // 更新select字段为0，表示未选中
      console.log(`【后端】更新题目ID ${questionId}, 类型: ${actualQuestionType}, 设置select=0`);
      const [updateResult] = await conn.query(
        `UPDATE teachers_selected_questions SET
         \`select\` = '0'
         WHERE teacher_id = ? AND question_id = ? AND question_type = ?`,
        [teacherId, questionId, actualQuestionType]
      );
      
      if (updateResult.affectedRows === 0) {
        console.log('【后端】更新失败，受影响行数为0');
        return res.status(400).json({ 
          message: '更新失败，请检查参数是否正确',
          details: {
            teacherId,
            questionId,
            questionType: actualQuestionType
          }
        });
      }
      
      console.log(`【后端】成功更新记录, 受影响行数: ${updateResult.affectedRows}`);
      
      const response = { 
        message: '成功取消选择题目',
        affectedRows: updateResult.affectedRows,
        previousStatus: checkRows[0].select,
        details: {
          teacherId,
          questionId,
          questionType: actualQuestionType
        }
      };
      
      console.log('【后端】返回响应:', response);
      console.log('=+++++++++++++++++++++++++++++++++++++++++++++++++=');
      
      res.json(response);
    } finally {
      if (conn) conn.release();
    }
  } catch (error) {
    console.error('【后端】取消选择题目失败:', error);
    // 确保返回详细的错误信息以便调试
    res.status(500).json({ 
      message: '取消选择题目失败',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};

module.exports = {
  selectQuestions,
  deselectQuestion
}; 