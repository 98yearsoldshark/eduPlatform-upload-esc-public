// 先加载私有运行配置，禁止在源码中保存凭据。
require('../config/runtime');
// 使用用户答题相关路由
const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// 引入MongoDB用户答题记录模块
const mongoUserAnswers = require('../db/mongoDBserver/userAnswersDB');
// 引入MongoDB核心模块，用于获取启用状态
const mongodb = require('../db/mongoDBserver/index');

// 创建MySQL连接池（仅当MySQL启用时）
let pool = null;

// 在服务器启动时初始化MySQL连接池
function initMySQLPool() {
  // 检查MySQL是否启用
  if (!mongodb.isMySQLEnabled()) {
    console.log('userAnswers路由: MySQL已在配置中禁用，未创建连接池');
    pool = null;
    return false;
  }

  try {
    console.log('userAnswers路由: 正在创建MySQL连接池...');
    // 创建连接池
    pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'cxsjdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

    // 测试连接
    pool.query('SELECT 1', (err) => {
      if (err) {
        console.error('userAnswers路由: MySQL连接测试失败:', err);
        return;
      }
      console.log('userAnswers路由: MySQL连接测试成功');
    });
    
    console.log('userAnswers路由: MySQL连接池已创建');
    return true;
  } catch (error) {
    console.error('userAnswers路由: 创建MySQL连接池失败:', error);
    pool = null;
    return false;
  }
}

// 初始化MySQL连接池
initMySQLPool();

// 在服务器启动时初始化MongoDB
let mongoInitialized = false;
(async () => {
  try {
    console.log('=================================');
    console.log('MongoDB初始化开始...');
    // 初始化MongoDB连接
    const connected = await mongodb.initConnection();
    
    if (connected) {
      console.log('MongoDB初始化成功，准备初始化用户答题集合...');
      // 初始化用户答题集合
      await mongoUserAnswers.initUserAnswersCollection();
      mongoInitialized = true;
      
      // 再次检查MySQL连接池（防止MongoDB初始化期间配置变更）
      if (!pool && mongodb.isMySQLEnabled()) {
        console.log('MongoDB已初始化完成，再次检查MySQL连接池...');
        initMySQLPool();
      }
      
      // 根据配置的同步模式执行相应的同步操作
      const syncMode = mongodb.getSyncMode();
      console.log(`数据同步模式: ${syncMode}`);
      
      if (mongodb.shouldSyncFromMySQL()) {
        // 从MySQL同步到MongoDB
        console.log('正在从MySQL同步数据到MongoDB...');
        const syncResult = await mongoUserAnswers.syncAnswersFromMySQL();
        console.log('MySQL到MongoDB同步结果:', syncResult);
      } else if (mongodb.shouldSyncFromMongoDB()) {
        // 从MongoDB同步到MySQL
        console.log('正在从MongoDB同步数据到MySQL...');
        
        if (pool) {
          const syncResult = await mongoUserAnswers.syncAnswersToMySQL();
          console.log('MongoDB到MySQL同步结果:', syncResult);
          
          if (!syncResult.success) {
            console.error('MongoDB到MySQL同步失败:', syncResult.message);
          } else {
            console.log(`MongoDB到MySQL同步成功，共同步${syncResult.totalRecords}条记录`);
          }
        } else {
          console.error('MySQL连接池未初始化，无法执行同步');
        }
      } else if (mongodb.shouldSkipSync()) {
        console.log('根据配置跳过数据同步');
      }
      console.log('同步过程完成');
      console.log('=================================');
    } else {
      console.log('MongoDB未连接，将使用MySQL作为数据源');
    }
  } catch (error) {
    console.error('MongoDB初始化失败:', error);
    console.log('将使用MySQL作为数据源');
  }
})();

// 获取用户答题记录 - 支持MongoDB和MySQL
router.get('/:userId', async (req, res) => {
  const userId = req.params.userId;
  console.log('userId:', userId);
  
  if (!userId || userId === 'undefined') {
    return res.json([]);
  }
  
  try {
    // 确定优先使用哪个数据库
    const preferMongoDB = mongodb.shouldPreferMongoDB();
    const preferMySQL = mongodb.shouldPreferMySQL();
    
    console.log(`用户答题记录首选数据库: ${mongodb.getUserAnswersPreferredDb()}`);
    console.log(`- MongoDB优先: ${preferMongoDB}`);
    console.log(`- MySQL优先: ${preferMySQL}`);
    
    // 如果首选MongoDB且MongoDB初始化成功且启用
    if (preferMongoDB && mongoInitialized && mongodb.isEnabled()) {
      const answers = await mongoUserAnswers.getUserAnswers(userId);
      if (answers !== null) {
        // 转换格式以保持与原API兼容
        const formattedAnswers = answers.map(answer => ({
          id: answer.originalMySQLId || answer._id.toString(),
          question_path: answer.questionPath,
          attempt_count: answer.attempt_count,
          answer_content: answer.answer_content,
          correctness: answer.correctness,
          answer_time: answer.answer_time
        }));
        
        console.log(`成功从MongoDB获取用户(ID=${userId})的答题记录，共${formattedAnswers.length}条`);
        return res.json(formattedAnswers);
      }
      // 如果MongoDB获取失败但启用了降级且MySQL启用，尝试MySQL
      if (mongodb.isFallbackEnabled() && mongodb.isMySQLEnabled() && pool) {
        console.log('从MongoDB获取失败，降级使用MySQL');
      } else {
        // 未启用降级或MySQL被禁用或连接池不存在，直接返回空数组
        console.log('从MongoDB获取失败，未启用降级或MySQL被禁用，返回空数组');
        return res.json([]);
      }
    }
    
    // 如果首选MySQL且MySQL启用且连接池存在
    if (preferMySQL && mongodb.isMySQLEnabled() && pool) {
      // 从MySQL获取数据
      console.log('首选MySQL获取用户答题记录');
      return getMySQLUserAnswers(userId, res);
    }
    
    // 如果首选的数据库无法使用，但另一个数据库可用
    if (preferMongoDB && !mongodb.isEnabled() && mongodb.isMySQLEnabled() && pool) {
      // 首选MongoDB但不可用，降级使用MySQL
      console.log('首选MongoDB但不可用，降级使用MySQL');
      return getMySQLUserAnswers(userId, res);
    } else if (preferMySQL && (!mongodb.isMySQLEnabled() || !pool) && mongoInitialized && mongodb.isEnabled()) {
      // 首选MySQL但不可用，尝试使用MongoDB
      console.log('首选MySQL但不可用，尝试使用MongoDB');
      const answers = await mongoUserAnswers.getUserAnswers(userId);
      if (answers !== null) {
        // 转换格式以保持与原API兼容
        const formattedAnswers = answers.map(answer => ({
          id: answer.originalMySQLId || answer._id.toString(),
          question_path: answer.questionPath,
          attempt_count: answer.attempt_count,
          answer_content: answer.answer_content,
          correctness: answer.correctness,
          answer_time: answer.answer_time
        }));
        
        console.log(`首选MySQL但使用MongoDB获取用户(ID=${userId})的答题记录，共${formattedAnswers.length}条`);
        return res.json(formattedAnswers);
      }
    }
    
    // 如果尚未返回，尝试从MySQL获取（可能是从MongoDB降级或首次尝试）
    if (mongodb.isMySQLEnabled() && pool) {
      return getMySQLUserAnswers(userId, res);
    }
    
    // 两个数据库都不可用，返回空数组
    console.log('所有数据库都不可用，返回空数组');
    return res.json([]);
  } catch (error) {
    console.error('获取用户答题记录异常:', error);
    res.status(500).json({ error: '获取答题记录失败' });
  }
});

// 从MySQL获取用户答题记录的辅助函数
function getMySQLUserAnswers(userId, res) {
  // 从MySQL获取数据
  const query = `SELECT * FROM user_questions_${userId} ORDER BY answer_time DESC`;
  console.log('MySQL查询:', query);
  
  return new Promise((resolve) => {
  pool.query(query, (err, results) => {
    if (err) {
        console.error('MySQL获取用户答题记录失败:', err);
        res.status(500).json({ error: '获取答题记录失败' });
        resolve();
        return;
    }
    if (!results || results.length === 0) {
        res.json([]);
        resolve();
        return;
    }
      
      console.log(`成功从MySQL获取用户(ID=${userId})的答题记录，共${results.length}条`);
    res.json(results);
      resolve();
  });
  });
}

// 提交答案 - 支持MongoDB和MySQL
router.post('/submit', async (req, res) => {
  const { userId, questionPath, selectedOption, questionType, questionId } = req.body;
  
  if (!userId || !questionPath || !selectedOption) {
    return res.status(400).json({ error: '提交的数据不完整' });
  }

  try {
    // 确定优先使用哪个数据库
    const preferMongoDB = mongodb.shouldPreferMongoDB();
    const preferMySQL = mongodb.shouldPreferMySQL();
    const dualWriteEnabled = mongodb.isDualWriteEnabled();
    
    console.log(`用户答题记录首选数据库: ${mongodb.getUserAnswersPreferredDb()}`);
    console.log(`- MongoDB优先: ${preferMongoDB}`);
    console.log(`- MySQL优先: ${preferMySQL}`);
    console.log(`- 双写模式: ${dualWriteEnabled ? '已启用' : '已禁用'}`);
    
    // 获取正确答案
    let correctAnswer;
    
    // 尝试获取正确答案，首选MongoDB或MySQL根据配置决定
    if (mongoInitialized && mongodb.isEnabled() && (preferMongoDB || !mongodb.isMySQLEnabled() || !pool)) {
      correctAnswer = await mongoUserAnswers.getCorrectAnswer(questionPath, questionType, questionId);
    } else {
      // 使用原始方法获取正确答案
      correctAnswer = await getCorrectAnswer(questionPath, questionType, questionId);
    }
    
    // 检查答案是否正确
    const isCorrect = selectedOption === correctAnswer;
    const correctness = isCorrect ? 'correct' : 'incorrect';
    
    // 查询尝试次数
    let attempt_count = 1;
    
    try {
      // 优先使用配置的首选数据库查询尝试次数
      if (preferMongoDB && mongoInitialized && mongodb.isEnabled()) {
        // 从MongoDB查询之前的记录
        const collection = mongodb.getCollection('user_answers');
        if (collection) {
          const previousAnswers = await collection.find({ 
            userId: parseInt(userId), 
            questionPath 
          }).sort({ answer_time: -1 }).limit(1).toArray();
          
          if (previousAnswers.length > 0) {
            attempt_count = previousAnswers[0].attempt_count + 1;
          }
        }
      } else if (preferMySQL && mongodb.isMySQLEnabled() && pool) {
        // 从MySQL查询之前的记录
        const checkQuery = `SELECT attempt_count FROM user_questions_${userId} WHERE question_path = ? ORDER BY answer_time DESC LIMIT 1`;
        const [results] = await pool.promise().query(checkQuery, [questionPath]);
        if (results.length > 0) {
          attempt_count = results[0].attempt_count + 1;
        }
      } 
      // 如果首选的数据库不可用，尝试使用另一个
      else if (mongoInitialized && mongodb.isEnabled()) {
        // 尝试从MongoDB获取
        const collection = mongodb.getCollection('user_answers');
        if (collection) {
          const previousAnswers = await collection.find({ 
            userId: parseInt(userId), 
            questionPath 
          }).sort({ answer_time: -1 }).limit(1).toArray();
          
          if (previousAnswers.length > 0) {
            attempt_count = previousAnswers[0].attempt_count + 1;
          }
        }
      } else if (mongodb.isMySQLEnabled() && pool) {
        // 尝试从MySQL获取
        const checkQuery = `SELECT attempt_count FROM user_questions_${userId} WHERE question_path = ? ORDER BY answer_time DESC LIMIT 1`;
        const [results] = await pool.promise().query(checkQuery, [questionPath]);
        if (results.length > 0) {
          attempt_count = results[0].attempt_count + 1;
        }
      }
    } catch (attemptError) {
      console.error('查询尝试次数失败:', attemptError);
      // 出错时保持attempt_count为1
    }
    
    // 构建答题数据
    const answerData = {
      userId,
      questionPath,
      selectedOption,
      questionType,
      questionId,
      correctAnswer,
      isCorrect,
      correctness,
      attempt_count
    };
    
    // 如果双写模式启用且两个数据库都可用，尝试同时保存到两个数据库
    if (dualWriteEnabled && mongoInitialized && mongodb.isEnabled() && mongodb.isMySQLEnabled() && pool) {
      console.log('双写模式已启用，将同时保存到MongoDB和MySQL');
      
      // 准备结果对象
      const result = {
        message: '答案提交成功',
        correct: isCorrect,
        attempt_count,
        mongoSaved: false,
        mysqlSaved: false
      };
      
      // 保存到MongoDB
      try {
        const mongoResult = await mongoUserAnswers.submitUserAnswer(answerData);
        if (mongoResult !== null) {
          console.log('成功将答题记录保存到MongoDB（双写模式）');
          result.mongoSaved = true;
        }
      } catch (mongoError) {
        console.error('MongoDB保存失败（双写模式）:', mongoError);
      }
      
      // 保存到MySQL
      try {
        // 确保用户答题表存在
        await mongoUserAnswers.ensureUserQuestionsTable(userId);
        
        // 插入记录
        const insertQuery = `INSERT INTO user_questions_${userId} (question_path, answer_content, correctness, attempt_count) VALUES (?, ?, ?, ?)`;
        await pool.promise().query(insertQuery, [questionPath, selectedOption, correctness, attempt_count]);
        
        console.log('成功将答题记录保存到MySQL（双写模式）');
        result.mysqlSaved = true;
      } catch (mysqlError) {
        console.error('MySQL保存失败（双写模式）:', mysqlError);
      }
      
      // 检查是否至少有一个数据库保存成功
      if (result.mongoSaved || result.mysqlSaved) {
        result.database = result.mongoSaved && result.mysqlSaved ? 'both' : (result.mongoSaved ? 'mongodb' : 'mysql');
        return res.json(result);
      } else {
        return res.status(500).json({ error: '保存答案失败，所有数据库都不可用' });
      }
    }
    
    // 非双写模式，或双写模式但其中一个数据库不可用
    // 根据配置首选数据库保存记录
    // 如果首选MongoDB，优先保存到MongoDB
    if (preferMongoDB && mongoInitialized && mongodb.isEnabled()) {
      const mongoResult = await mongoUserAnswers.submitUserAnswer(answerData);
      if (mongoResult !== null) {
        console.log('成功将答题记录保存到MongoDB（首选）');
        return res.json({ 
          message: '答案提交成功',
          correct: isCorrect,
          attempt_count,
          database: 'mongodb'
        });
      }
      
      // 如果保存到MongoDB失败但启用了降级且MySQL可用
      if (mongodb.isFallbackEnabled() && mongodb.isMySQLEnabled() && pool) {
        console.log('保存到MongoDB失败，降级使用MySQL');
      } else {
        // 不降级或MySQL不可用，返回错误
        console.error('保存到MongoDB失败，未启用降级或MySQL被禁用');
        return res.status(500).json({ error: '保存答案失败' });
      }
    }
    
    // 如果首选MySQL或从MongoDB降级，保存到MySQL
    if ((preferMySQL || (!preferMongoDB && mongodb.isFallbackEnabled())) && mongodb.isMySQLEnabled() && pool) {
      // 保存到MySQL
      const insertQuery = `INSERT INTO user_questions_${userId} (question_path, answer_content, correctness, attempt_count) VALUES (?, ?, ?, ?)`;
      
      return new Promise((resolve) => {
        pool.query(insertQuery, [questionPath, selectedOption, correctness, attempt_count], (err, results) => {
          if (err) {
            console.error('MySQL保存答题记录失败:', err);
            res.status(500).json({ error: '保存答案失败' });
            resolve();
            return;
          }
          
          console.log('成功将答题记录保存到MySQL' + (preferMySQL ? '（首选）' : '（从MongoDB降级）'));
          res.json({ 
            message: '答案提交成功',
            correct: isCorrect,
            attempt_count,
            database: 'mysql'
          });
          resolve();
        });
      });
    }
    
    // 如果首选MySQL但不可用，且MongoDB可用，尝试保存到MongoDB
    if (preferMySQL && (!mongodb.isMySQLEnabled() || !pool) && mongoInitialized && mongodb.isEnabled()) {
      const mongoResult = await mongoUserAnswers.submitUserAnswer(answerData);
      if (mongoResult !== null) {
        console.log('首选MySQL不可用，成功将答题记录保存到MongoDB');
        return res.json({ 
          message: '答案提交成功',
          correct: isCorrect,
          attempt_count,
          database: 'mongodb'
        });
      }
    }
    
    // 所有数据库都不可用
    console.error('所有数据库都不可用，无法保存答题记录');
    return res.status(500).json({ error: '保存答案失败，所有数据库都不可用' });
  } catch (error) {
    console.error('提交答案过程中发生异常:', error);
    res.status(500).json({ error: '保存答案失败' });
  }
});

// 手动触发数据同步 - 从MySQL同步到MongoDB
router.post('/sync-to-mongodb', async (req, res) => {
  try {
    if (!mongoInitialized || !mongodb.isEnabled()) {
      return res.status(400).json({
        success: false,
        message: 'MongoDB未启用或初始化失败，无法同步数据'
      });
    }
    
    if (!mongodb.isMySQLEnabled()) {
      return res.status(400).json({
        success: false,
        message: 'MySQL已在配置中禁用，无法同步数据'
      });
    }
    
    const { userId } = req.body; // 可选，如果提供则只同步指定用户
    const result = await mongoUserAnswers.syncAnswersFromMySQL(userId);
    
    res.json(result);
  } catch (error) {
    console.error('同步数据到MongoDB失败:', error);
    res.status(500).json({
      success: false,
      message: '同步失败: ' + error.message
    });
  }
});

// 手动触发数据同步 - 从MongoDB同步到MySQL
router.post('/sync-to-mysql', async (req, res) => {
  try {
    console.log('=================================');
    console.log('收到手动触发从MongoDB同步到MySQL的请求');
    
    // 检查MongoDB是否已初始化
    if (!mongoInitialized || !mongodb.isEnabled()) {
      console.log('MongoDB未初始化或已禁用，无法执行同步');
      return res.status(400).json({
        success: false,
        message: 'MongoDB未初始化或已禁用，无法执行同步'
      });
    }
    
    // 检查MySQL是否启用
    if (!mongodb.isMySQLEnabled()) {
      console.log('MySQL已禁用，无法执行同步');
      return res.status(400).json({
        success: false,
        message: 'MySQL已禁用，无法执行同步'
      });
    }
    
    const userId = req.body.userId; // 可选，特定用户ID
    
    console.log(`开始手动执行从MongoDB到MySQL的同步${userId ? '，用户ID: ' + userId : '（所有用户）'}...`);
    const result = await mongoUserAnswers.syncAnswersToMySQL(userId);
    
    console.log('同步结果:', result);
    console.log('=================================');
    
    return res.json(result);
  } catch (error) {
    console.error('手动同步过程出错:', error);
    return res.status(500).json({
      success: false,
      message: '同步过程出错: ' + error.message
    });
  }
});

// 获取数据库配置信息
router.get('/db-config', async (req, res) => {
  try {
    const config = {
      mongodb: {
        enabled: mongodb.isEnabled(),
        status: mongoInitialized ? 'connected' : 'disconnected'
      },
      mysql: {
        enabled: mongodb.isMySQLEnabled(),
        status: (pool && mongodb.isMySQLEnabled()) ? 'connected' : 'disconnected'
      },
      preferences: {
        preferredDatabase: mongodb.getUserAnswersPreferredDb(),
        syncMode: mongodb.getSyncMode(),
        dualWrite: mongodb.isDualWriteEnabled()
      }
    };
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('获取数据库配置信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置信息失败: ' + error.message
    });
  }
});

// 管理MongoDB索引 - 仅限系统管理员使用
router.post('/manage-indexes', async (req, res) => {
  try {
    const { action, collection } = req.body;
    
    if (!mongoInitialized || !mongodb.isEnabled()) {
      return res.status(400).json({
        success: false,
        message: 'MongoDB未初始化或已禁用，无法操作索引'
      });
    }
    
    // 默认操作user_answers集合
    const targetCollection = collection || 'user_answers';
    
    // 列出索引
    if (action === 'list') {
      const indexes = await mongodb.listCollectionIndexes(targetCollection);
      if (indexes === null) {
        return res.status(500).json({
          success: false,
          message: '获取索引失败'
        });
      }
      
      return res.json({
        success: true,
        collection: targetCollection,
        indexes: indexes
      });
    }
    
    // 删除所有非_id索引
    if (action === 'drop') {
      const result = await mongodb.dropAllIndexes(targetCollection);
      return res.json({
        success: result,
        message: result ? `已成功删除集合 ${targetCollection} 的所有非_id索引` : '删除索引失败'
      });
    }
    
    // 重建索引
    if (action === 'rebuild') {
      // 先删除所有索引
      await mongodb.dropAllIndexes(targetCollection);
      
      // 然后重新创建必要的索引
      await mongoUserAnswers.initUserAnswersCollection();
      
      return res.json({
        success: true,
        message: `已重建集合 ${targetCollection} 的索引`
      });
    }
    
    return res.status(400).json({
      success: false,
      message: '不支持的操作，允许的操作有：list, drop, rebuild'
    });
  } catch (error) {
    console.error('管理索引失败:', error);
    return res.status(500).json({
      success: false,
      message: '管理索引失败: ' + error.message
    });
  }
});

// 从文件中获取正确答案 (保留原始实现供降级使用)
const getCorrectAnswer = (questionPath, questionType, questionId) => {
  return new Promise((resolve) => {
    if (questionType === 'latex' && questionId) {
      pool.query('SELECT correct_answer FROM latex_questions WHERE id = ?', [questionId], (err, results) => {
        if (err || !results.length) resolve('A');
        else resolve(results[0].correct_answer);
      });
    } else {
      try {
        const answerPath = path.join(__dirname, '..', questionPath, 'answer.txt');
        const metadataPath = path.join(__dirname, '..', questionPath, 'metadata.json');

        fs.access(answerPath, fs.constants.F_OK, (err) => {
          if (!err) {
            fs.readFile(answerPath, 'utf8', (err, data) => {
              resolve(err ? 'A' : data.trim());
            });
          } else {
            fs.access(metadataPath, fs.constants.F_OK, (err) => {
              if (!err) {
                fs.readFile(metadataPath, 'utf8', (err, data) => {
                  if (err) return resolve('A');
                  try {
                    const metadata = JSON.parse(data);
                    resolve(metadata.correct_answer || 'A');
                  } catch {
                    resolve('A');
                  }
                });
              } else {
                resolve('A');
              }
            });
          }
        });
      } catch (error) {
        resolve('A');
      }
    }
  });
};

module.exports = router;