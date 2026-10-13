// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../config/runtime');
/**
 * MongoDB用户答题记录数据处理模块
 * 处理用户答题记录的存储、查询和同步
 */

const mongodb = require('./index');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

/**
 * 获取MySQL连接配置
 * @returns {Object|null} MySQL连接配置或null
 */
function getMySQLConfig() {
  // 检查MySQL是否启用
  if (!mongodb.isMySQLEnabled()) {
    console.log('MongoDB: MySQL已在配置中禁用，不创建MySQL连接');
    return null;
  }
  
  // 直接使用config.yaml中的MySQL配置
  try {
    const mongoConfig = mongodb.getConfig();
    console.log(`MongoDB: MySQL配置状态: ${JSON.stringify({
      enabled: mongoConfig.mysqlEnabled,
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
    })}`);
    
    return {
      host: process.env.MYSQL_HOST || '127.0.0.1', // 固定使用这个配置，避免从MongoDB配置中获取错误
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'cxsjdb',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
  } catch (error) {
    console.error('MongoDB: 获取MySQL配置失败:', error);
    // 使用硬编码的备用配置
    return {
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'cxsjdb',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
  }
}

// 创建MySQL连接池 - 如果MySQL启用
let mysqlPool = null;

// 初始化MySQL连接池的函数
async function initMySQLPool() {
  try {
    console.log('MongoDB: 初始化MySQL连接池...');
    // 获取MySQL配置
    const mysqlConfig = getMySQLConfig();
    
    // 如果MySQL已禁用，不创建连接池
    if (!mysqlConfig) {
      console.log('MongoDB: 未创建MySQL连接池，MySQL已禁用');
      return false;
    }
    
    // 创建连接池
    mysqlPool = mysql.createPool(mysqlConfig);
    
    // 测试连接
    console.log('MongoDB: 测试MySQL连接...');
    const connection = await mysqlPool.getConnection();
    await connection.ping();
    connection.release();
    
    console.log('MongoDB: MySQL连接池初始化成功');
    return true;
  } catch (error) {
    console.error('MongoDB: 创建MySQL连接池失败:', error);
    mysqlPool = null;
    return false;
  }
}

/**
 * 初始化用户答题记录集合
 * @returns {Promise<boolean>} 初始化是否成功
 */
async function initUserAnswersCollection() {
  try {
    console.log('MongoDB: 初始化用户答题记录集合...');
    
    // 获取集合
    const collection = mongodb.getCollection('user_answers');
    
    if (!collection) {
      console.error('MongoDB: 获取user_answers集合失败，MongoDB可能未连接');
      return false;
    }
    
    // 创建索引 - 不指定名称，避免名称冲突
    try {
      console.log('MongoDB: 创建userId和questionPath组合索引...');
      // 不再指定索引名称，让MongoDB自动生成索引名称
      await collection.createIndex(
        { userId: 1, questionPath: 1 }
      );
      console.log('MongoDB: userId和questionPath组合索引创建成功');
    } catch (indexError) {
      console.error('MongoDB: 创建userId和questionPath索引失败:', indexError.message);
      // 继续执行，不中断整个初始化流程
    }
    
    try {
      console.log('MongoDB: 创建userId和answer_time组合索引...');
      // 不再指定索引名称，让MongoDB自动生成索引名称
      await collection.createIndex(
        { userId: 1, answer_time: -1 }
      );
      console.log('MongoDB: userId和answer_time组合索引创建成功');
    } catch (indexError) {
      console.error('MongoDB: 创建userId和answer_time索引失败:', indexError.message);
      // 继续执行，不中断整个初始化流程
    }
    
    // 检查现有索引，输出日志便于调试
    try {
      console.log('MongoDB: 获取现有索引列表...');
      const indexes = await collection.indexes();
      console.log(`MongoDB: 集合现有索引: ${JSON.stringify(indexes.map(idx => ({
        name: idx.name,
        key: idx.key
      })))}`);
    } catch (error) {
      console.error('MongoDB: 获取索引列表失败:', error.message);
    }
    
    console.log('MongoDB: 用户答题记录集合初始化完成');
    
    // 初始化MySQL连接池 - 如果MySQL启用
    const mysqlInitialized = await initMySQLPool();
    console.log(`MongoDB: MySQL连接池初始化${mysqlInitialized ? '成功' : '失败或被禁用'}`);
    
    return true;
  } catch (error) {
    console.error('MongoDB: 初始化用户答题记录集合失败:', error);
    // 即使集合初始化失败，仍然尝试初始化MySQL连接池
    await initMySQLPool();
    return false;
  }
}

/**
 * 提交用户答题记录
 * @param {Object} answerData 答题数据对象
 * @returns {Promise<Object>} 提交结果
 */
async function submitUserAnswer(answerData) {
  try {
    const { userId, questionPath, selectedOption, questionType, questionId, correctAnswer, isCorrect, correctness, attempt_count } = answerData;
    
    // 检查MongoDB连接
    if (!mongodb.getCollection('user_answers')) {
      console.log('MongoDB: 未连接，降级使用MySQL');
      return null; // 调用方应该降级使用MySQL
    }
    
    // 获取collection对象
    const collection = mongodb.getCollection('user_answers');
    
    // 查找该用户最大的originalMySQLId
    let nextMySQLId = 1; // 默认从1开始
    
    try {
      // 查询该用户已有记录中最大的originalMySQLId
      const existingRecords = await collection.find({ userId: parseInt(userId) })
        .sort({ originalMySQLId: -1 })
        .limit(1)
        .toArray();
      
      if (existingRecords.length > 0 && existingRecords[0].originalMySQLId) {
        // 如果找到记录且有originalMySQLId字段，则新ID为最大值+1
        const maxId = parseInt(existingRecords[0].originalMySQLId);
        if (!isNaN(maxId)) {
          nextMySQLId = maxId + 1;
        }
      }
      
      console.log(`MongoDB: 用户${userId}的下一个originalMySQLId: ${nextMySQLId}`);
    } catch (idError) {
      console.error('MongoDB: 获取最大originalMySQLId失败，使用默认值1:', idError);
      // 出错时使用默认值1
    }
    
    // 构建记录数据
    const answerRecord = {
      userId: parseInt(userId), // 确保userId是数字
      questionPath,
      answer_content: selectedOption,
      correctness,
      attempt_count,
      answer_time: new Date(),
      questionType: questionType || 'image',
      questionId: questionId || null,
      correctAnswer,
      isCorrect,
      originalMySQLId: nextMySQLId // 设置生成的ID
    };
    
    // 插入记录
    const result = await collection.insertOne(answerRecord);
    
    console.log(`MongoDB: 用户答题记录已保存, userId=${userId}, insertedId=${result.insertedId}, originalMySQLId=${nextMySQLId}`);
    
    return {
      success: true,
      message: '答案提交成功',
      correct: isCorrect,
      attempt_count,
      insertedId: result.insertedId,
      originalMySQLId: nextMySQLId
    };
  } catch (error) {
    console.error('MongoDB: 保存用户答题记录失败:', error);
    return null; // 调用方应该降级使用MySQL
  }
}

/**
 * 获取用户答题记录
 * @param {number|string} userId 用户ID
 * @returns {Promise<Array|null>} 用户答题记录数组或null
 */
async function getUserAnswers(userId) {
  try {
    // 检查MongoDB连接
    if (!mongodb.getCollection('user_answers')) {
      console.log('MongoDB: 未连接，降级使用MySQL');
      return null; // 调用方应该降级使用MySQL
    }
    
    // 查询记录
    const collection = mongodb.getCollection('user_answers');
    const answers = await collection.find({ userId: parseInt(userId) })
      .sort({ answer_time: -1 })
      .toArray();
    
    console.log(`MongoDB: 获取用户答题记录成功, userId=${userId}, count=${answers.length}`);
    
    return answers;
  } catch (error) {
    console.error('MongoDB: 获取用户答题记录失败:', error);
    return null; // 调用方应该降级使用MySQL
  }
}

/**
 * 从MySQL同步用户答题记录到MongoDB
 * @param {number|string} userId 用户ID，如果不指定则同步所有用户
 * @returns {Promise<Object>} 同步结果
 */
async function syncAnswersFromMySQL(userId = null) {
  try {
    console.log(`MongoDB: 开始从MySQL同步用户答题记录${userId ? `(userId=${userId})` : '(所有用户)'}`);
    
    // 检查MySQL是否启用
    if (!mongodb.isMySQLEnabled() || !mysqlPool) {
      return { 
        success: false, 
        message: 'MySQL已禁用，无法同步数据' 
      };
    }
    
    // 检查MongoDB连接
    if (!mongodb.getCollection('user_answers')) {
      return { 
        success: false, 
        message: 'MongoDB未连接，无法同步' 
      };
    }
    
    // 获取要同步的用户列表
    let userIds = [];
    
    if (userId) {
      userIds = [parseInt(userId)];
    } else {
      // 查询所有用户ID
      const [users] = await mysqlPool.query('SELECT id FROM users');
      userIds = users.map(user => user.id);
    }
    
    console.log(`MongoDB: 准备同步 ${userIds.length} 个用户的答题记录`);
    let totalRecords = 0;
    let duplicateRecords = 0;
    
    // 获取MongoDB集合
    const collection = mongodb.getCollection('user_answers');
    
    // 逐个用户同步
    for (const id of userIds) {
      try {
        // 检查用户表是否存在
        const [tables] = await mysqlPool.query(
          `SELECT TABLE_NAME FROM information_schema.TABLES 
           WHERE TABLE_SCHEMA = 'cxsjdb' 
           AND TABLE_NAME = 'user_questions_${id}'`
        );
        
        if (tables.length === 0) {
          console.log(`MongoDB: 用户 ${id} 的答题表不存在，跳过`);
          continue;
        }
        
        // 查询MySQL中的答题记录
        const [records] = await mysqlPool.query(`SELECT * FROM user_questions_${id} ORDER BY answer_time DESC`);
        
        if (records.length === 0) {
          console.log(`MongoDB: 用户 ${id} 无答题记录，跳过`);
          continue;
        }
        
        // 删除MongoDB中该用户的现有记录
        await collection.deleteMany({ userId: id });
        
        // 进行去重处理
        console.log(`MongoDB: 对用户 ${id} 的 ${records.length} 条MySQL记录进行去重`);
        const uniqueRecords = await deduplicateRecords(records);
        const duplicates = records.length - uniqueRecords.length;
        
        if (duplicates > 0) {
          console.log(`MongoDB: 用户 ${id} 发现 ${duplicates} 条重复记录，将被跳过`);
          duplicateRecords += duplicates;
        }
        
        // 转换格式并插入MongoDB
        const mongoRecords = uniqueRecords.map(record => ({
          userId: id,
          questionPath: record.question_path,
          answer_content: record.answer_content,
          correctness: record.correctness,
          attempt_count: record.attempt_count,
          answer_time: record.answer_time,
          questionType: record.question_type || 'image',
          questionId: record.question_id || null,
          correctAnswer: record.correct_answer || null,
          isCorrect: record.correctness === 'correct',
          originalMySQLId: record.id // 使用MySQL记录的ID作为originalMySQLId
        }));
        
        // 批量插入MongoDB
        if (mongoRecords.length > 0) {
          const result = await collection.insertMany(mongoRecords);
          console.log(`MongoDB: 用户 ${id} 的 ${result.insertedCount} 条答题记录同步成功`);
          totalRecords += result.insertedCount;
        }
      } catch (userError) {
        console.error(`MongoDB: 同步用户 ${id} 的答题记录失败:`, userError);
      }
    }
    
    // 在同步完成后，对MongoDB中的数据进行重复检测和清理
    if (totalRecords > 0) {
      console.log(`MongoDB: 同步完成后，检测MongoDB中的重复数据...`);
      
      if (userId) {
        // 如果指定了用户ID，只清理该用户的数据
        const cleanResult = await detectAndCleanDuplicates(userId, 'mongodb');
        console.log(`MongoDB: 用户 ${userId} 的MongoDB重复数据清理结果: ${JSON.stringify(cleanResult)}`);
      } else {
        // 如果没有指定用户ID，清理所有同步过的用户的数据
        for (const id of userIds) {
          const cleanResult = await detectAndCleanDuplicates(id, 'mongodb');
          console.log(`MongoDB: 用户 ${id} 的MongoDB重复数据清理结果: ${JSON.stringify(cleanResult)}`);
        }
      }
    }
    
    return {
      success: true,
      message: `同步完成，共同步 ${totalRecords} 条答题记录${duplicateRecords > 0 ? `，跳过 ${duplicateRecords} 条重复记录` : ''}`,
      totalUsers: userIds.length,
      totalRecords,
      duplicateRecords
    };
  } catch (error) {
    console.error('MongoDB: 同步答题记录失败:', error);
    return {
      success: false,
      message: '同步失败: ' + error.message
    };
  }
}

/**
 * 对MySQL记录进行去重处理
 * @param {Array} records MySQL查询的记录数组
 * @returns {Promise<Array>} 去重后的记录数组
 */
async function deduplicateRecords(records) {
  // 用于检查完全相同记录的Map
  const uniqueMap = new Map();
  const uniqueRecords = [];
  
  // 创建一个Map来记录每条记录的唯一键和内容
  for (const record of records) {
    // 创建标识记录唯一性的键
    // 使用questionPath(题目路径)、answer_content(答案内容)和correctness(正确性)三个字段创建唯一键
    const contentKey = `${record.question_path}|${record.answer_content}|${record.correctness}`;
    
    // 格式化时间为"YYYY-MM-DD HH:MM:SS"，方便检查时间戳精确到秒的重复
    const formattedTime = new Date(record.answer_time).toISOString().replace('T', ' ').substring(0, 19);
    
    // 完全相同记录的键(包含时间)
    const exactKey = `${contentKey}|${formattedTime}`;
    
    // 检查是否有完全相同的记录(包括时间)
    if (uniqueMap.has(exactKey)) {
      console.log(`MongoDB: 发现完全相同的记录(包括时间): ${exactKey}`);
      continue; // 跳过完全重复的记录
    }
    
    // 检查是否有内容相同但时间不同的记录
    const contentDuplicates = [...uniqueMap.keys()].filter(key => key.startsWith(contentKey + '|'));
    
    if (contentDuplicates.length > 0) {
      // 只有时间不同的记录，打印警告但仍然保留
      console.log(`MongoDB: 警告 - 发现内容相同但时间不同的记录: 
        - 当前记录: ${exactKey}
        - 已存在记录: ${contentDuplicates[0]}`);
    }
    
    // 将此记录标记为已处理并添加到结果中
    uniqueMap.set(exactKey, record);
    uniqueRecords.push(record);
  }
  
  return uniqueRecords;
}

/**
 * 获取从文件中的正确答案
 * @param {string} questionPath 题目路径
 * @param {string} questionType 题目类型
 * @param {number|string} questionId 题目ID
 * @returns {Promise<string>} 正确答案
 */
async function getCorrectAnswer(questionPath, questionType, questionId) {
  return new Promise(async (resolve) => {
    if (questionType === 'latex' && questionId) {
      try {
        // 检查MySQL是否启用
        if (!mongodb.isMySQLEnabled() || !mysqlPool) {
          console.log('MongoDB: MySQL已禁用，无法从数据库获取Latex题目答案');
          return resolve('A'); // 默认返回A
        }
        
        const [results] = await mysqlPool.query('SELECT correct_answer FROM latex_questions WHERE id = ?', [questionId]);
        if (results.length > 0) {
          return resolve(results[0].correct_answer);
        }
        resolve('A');
      } catch (err) {
        console.error('获取Latex题目答案失败:', err);
        resolve('A');
      }
    } else {
      try {
        const answerPath = path.join(process.cwd(), questionPath, 'answer.txt');
        const metadataPath = path.join(process.cwd(), questionPath, 'metadata.json');

        // 尝试从answer.txt文件读取
        if (fs.existsSync(answerPath)) {
          const data = fs.readFileSync(answerPath, 'utf8');
          return resolve(data.trim());
        }
        
        // 尝试从metadata.json文件读取
        if (fs.existsSync(metadataPath)) {
          const data = fs.readFileSync(metadataPath, 'utf8');
          try {
            const metadata = JSON.parse(data);
            return resolve(metadata.correct_answer || 'A');
          } catch {
            return resolve('A');
          }
        }
        
        resolve('A');
      } catch (error) {
        console.error('获取文件答案失败:', error);
        resolve('A');
      }
    }
  });
}

/**
 * 从MongoDB同步用户答题记录到MySQL
 * @param {number|string} userId 用户ID，如果不指定则同步所有用户
 * @returns {Promise<Object>} 同步结果
 */
async function syncAnswersToMySQL(userId = null) {
  try {
    console.log(`MongoDB: 开始从MongoDB同步用户答题记录到MySQL ${userId ? `(userId=${userId})` : '(所有用户)'}`);
    
    // 检查MySQL是否启用
    if (!mongodb.isMySQLEnabled()) {
      console.log('MongoDB: MySQL已禁用，无法同步数据');
      return { 
        success: false, 
        message: 'MySQL已禁用，无法同步数据' 
      };
    }
    
    // 检查MySQL连接池
    if (!mysqlPool) {
      console.log('MongoDB: MySQL连接池未初始化，尝试初始化...');
      const initialized = await initMySQLPool();
      if (!initialized || !mysqlPool) {
        console.log('MongoDB: MySQL连接池初始化失败，无法同步数据');
        return {
          success: false,
          message: 'MySQL连接池初始化失败，无法同步数据'
        };
      }
    }
    
    // 检查MongoDB连接
    if (!mongodb.isEnabled() || !mongodb.getCollection('user_answers')) {
      console.log('MongoDB: MongoDB未启用或集合不存在，无法同步');
      return { 
        success: false, 
        message: 'MongoDB未连接，无法同步' 
      };
    }
    
    // 检查MySQL连接是否有效
    try {
      console.log('MongoDB: 测试MySQL连接...');
      const [pingResult] = await mysqlPool.query('SELECT 1 AS ping');
      console.log(`MongoDB: MySQL连接测试结果: ${JSON.stringify(pingResult)}`);
    } catch (pingError) {
      console.error('MongoDB: MySQL连接测试失败:', pingError);
      
      // 尝试重新初始化连接池
      console.log('MongoDB: 尝试重新初始化MySQL连接池...');
      const reinitialized = await initMySQLPool();
      if (!reinitialized || !mysqlPool) {
        return {
          success: false,
          message: `MySQL连接测试失败且重新初始化失败: ${pingError.message}`
        };
      }
      
      // 再次测试连接
      try {
        const [retryResult] = await mysqlPool.query('SELECT 1 AS ping');
        console.log(`MongoDB: MySQL重新连接测试结果: ${JSON.stringify(retryResult)}`);
      } catch (retryError) {
        return {
          success: false,
          message: `MySQL连接重试失败: ${retryError.message}`
        };
      }
    }
    
    let totalRecords = 0;
    
    // 获取MongoDB集合
    const collection = mongodb.getCollection('user_answers');
    
    // 构建查询条件
    const query = userId ? { userId: parseInt(userId) } : {};
    
    // 查询MongoDB中的记录
    console.log(`MongoDB: 查询条件: ${JSON.stringify(query)}`);
    const records = await collection.find(query).toArray();
    
    if (records.length === 0) {
      console.log('MongoDB: 未找到符合条件的记录，无需同步');
      return {
        success: true,
        message: '未找到需要同步的记录',
        totalRecords: 0
      };
    }
    
    console.log(`MongoDB: 找到 ${records.length} 条记录需要同步到MySQL`);
    console.log(`MongoDB: 首条记录示例: ${JSON.stringify(records[0], null, 2)}`);
    
    // 按用户ID分组记录
    const recordsByUser = {};
    
    records.forEach(record => {
      const userId = record.userId;
      if (!recordsByUser[userId]) {
        recordsByUser[userId] = [];
      }
      recordsByUser[userId].push(record);
    });
    
    console.log(`MongoDB: 记录按用户分组完成，共 ${Object.keys(recordsByUser).length} 个用户`);
    console.log(`MongoDB: 用户ID列表: ${Object.keys(recordsByUser).join(', ')}`);
    
    // 同步每个用户的记录
    for (const [userId, userRecords] of Object.entries(recordsByUser)) {
      try {
        console.log(`MongoDB: 开始同步用户 ${userId} 的记录，共 ${userRecords.length} 条`);
        
        // 确保用户表存在
        console.log(`MongoDB: 确保用户 ${userId} 的答题表存在...`);
        const tableCreated = await ensureUserQuestionsTable(userId);
        if (!tableCreated) {
          console.error(`MongoDB: 为用户 ${userId} 创建答题表失败，跳过同步`);
          continue;
        }
        
        // 获取MySQL中已有的记录
        console.log(`MongoDB: 查询用户 ${userId} 在MySQL中的现有记录...`);
        const [existingRecords] = await mysqlPool.query(
          `SELECT id, question_path, answer_time FROM user_questions_${userId}`
        );
        console.log(`MongoDB: 用户 ${userId} 在MySQL中有 ${existingRecords.length} 条现有记录`);
        
        // 创建索引用于快速查找
        const existingRecordsIndex = {};
        existingRecords.forEach(record => {
          const key = `${record.question_path}_${new Date(record.answer_time).getTime()}`;
          existingRecordsIndex[key] = record.id;
        });
        
        // 插入或更新记录
        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const record of userRecords) {
          try {
            const key = `${record.questionPath}_${new Date(record.answer_time).getTime()}`;
            
            if (existingRecordsIndex[key]) {
              // 记录已存在，更新
              const existingId = existingRecordsIndex[key];
              console.log(`MongoDB: 更新记录 ID=${existingId}, 题目路径=${record.questionPath}`);
              await mysqlPool.query(
                `UPDATE user_questions_${userId} SET 
                 answer_content = ?, 
                 correctness = ?, 
                 attempt_count = ?
                 WHERE id = ?`,
                [
                  record.answer_content,
                  record.correctness,
                  record.attempt_count,
                  existingId
                ]
              );
              updatedCount++;
            } else {
              // 记录不存在，插入
              console.log(`MongoDB: 插入新记录, 题目路径=${record.questionPath}`);
              await mysqlPool.query(
                `INSERT INTO user_questions_${userId} 
                 (question_path, answer_content, correctness, attempt_count, answer_time) 
                 VALUES (?, ?, ?, ?, ?)`,
                [
                  record.questionPath,
                  record.answer_content,
                  record.correctness,
                  record.attempt_count,
                  record.answer_time
                ]
              );
              insertedCount++;
            }
            
            // 每处理10条记录输出一次进度
            if ((insertedCount + updatedCount) % 10 === 0) {
              console.log(`MongoDB: 用户 ${userId} 同步进度: ${insertedCount + updatedCount}/${userRecords.length}`);
            }
            
          } catch (recordError) {
            console.error(`MongoDB: 同步记录到MySQL失败:`, recordError);
            console.error(`MongoDB: 失败的记录数据:`, JSON.stringify(record));
            skippedCount++;
          }
        }
        
        console.log(`MongoDB: 用户 ${userId} 的记录同步完成 - 插入: ${insertedCount}, 更新: ${updatedCount}, 跳过: ${skippedCount}`);
        totalRecords += (insertedCount + updatedCount);
      } catch (userError) {
        console.error(`MongoDB: 同步用户 ${userId} 的记录到MySQL失败:`, userError);
      }
    }
    
    // 在同步完成后，对MySQL中的数据进行重复检测和清理
    if (totalRecords > 0) {
      console.log(`MongoDB: 同步完成后，检测MySQL中的重复数据...`);
      
      const userIdsToCheck = userId ? [userId] : Object.keys(recordsByUser).map(id => parseInt(id));
      
      for (const id of userIdsToCheck) {
        const cleanResult = await detectAndCleanDuplicates(id, 'mysql');
        console.log(`MongoDB: 用户 ${id} 的MySQL重复数据清理结果: ${JSON.stringify(cleanResult)}`);
      }
    }
    
    console.log(`MongoDB: 所有用户数据同步完成，共同步 ${totalRecords} 条记录到MySQL`);
    return {
      success: true,
      message: `同步完成，共同步 ${totalRecords} 条记录到MySQL`,
      totalRecords
    };
  } catch (error) {
    console.error('MongoDB: 同步记录到MySQL失败:', error);
    return {
      success: false,
      message: '同步失败: ' + error.message
    };
  }
}

/**
 * 确保用户答题表存在
 * @param {number|string} userId 用户ID
 * @returns {Promise<boolean>} 表是否成功创建或已存在
 */
async function ensureUserQuestionsTable(userId) {
  try {
    // 检查表是否已存在
    console.log(`MongoDB: 检查用户 ${userId} 的答题表是否存在...`);
    const [tables] = await mysqlPool.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = 'cxsjdb' 
       AND TABLE_NAME = 'user_questions_${userId}'`
    );
    
    if (tables.length > 0) {
      // 表已存在
      console.log(`MongoDB: 用户 ${userId} 的答题表已存在`);
      return true;
    }
    
    // 创建表
    console.log(`MongoDB: 为用户 ${userId} 创建答题表...`);
    await mysqlPool.query(`
      CREATE TABLE user_questions_${userId} (
        id int NOT NULL AUTO_INCREMENT,
        question_path varchar(255) NOT NULL,
        attempt_count int DEFAULT '1',
        answer_content text,
        correctness enum('correct','partially_correct','incorrect') DEFAULT 'correct',
        answer_time timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    
    console.log(`MongoDB: 为用户 ${userId} 创建了答题表`);
    return true;
  } catch (error) {
    console.error(`MongoDB: 创建用户 ${userId} 的答题表失败:`, error);
    return false;
  }
}

/**
 * 增强的目标数据库重复数据检测和清理函数
 * @param {number|string} userId 用户ID
 * @param {string} targetDbType 目标数据库类型 ('mongodb' 或 'mysql')
 * @returns {Promise<Object>} 处理结果
 */
async function detectAndCleanDuplicates(userId, targetDbType = 'mongodb') {
  console.log(`MongoDB: 开始检测用户 ${userId} 在 ${targetDbType} 中的重复数据`);
  
  try {
    if (targetDbType === 'mongodb') {
      return await detectAndCleanMongoDBDuplicates(userId);
    } else if (targetDbType === 'mysql') {
      return await detectAndCleanMySQLDuplicates(userId);
    } else {
      return {
        success: false,
        message: `不支持的数据库类型: ${targetDbType}`,
        duplicatesFound: 0,
        duplicatesRemoved: 0
      };
    }
  } catch (error) {
    console.error(`MongoDB: 检测和清理 ${targetDbType} 中的重复数据失败:`, error);
    return {
      success: false,
      message: `检测失败: ${error.message}`,
      duplicatesFound: 0,
      duplicatesRemoved: 0
    };
  }
}

/**
 * 检测和清理MongoDB中的重复数据
 * @param {number|string} userId 用户ID
 * @returns {Promise<Object>} 处理结果
 */
async function detectAndCleanMongoDBDuplicates(userId) {
  console.log(`MongoDB: 检测用户 ${userId} 在MongoDB中的重复数据`);
  
  // 检查MongoDB连接
  if (!mongodb.getCollection('user_answers')) {
    return {
      success: false,
      message: 'MongoDB未连接',
      duplicatesFound: 0,
      duplicatesRemoved: 0
    };
  }
  
  const collection = mongodb.getCollection('user_answers');
  
  // 获取该用户的所有记录
  const records = await collection.find({ userId: parseInt(userId) }).toArray();
  
  if (records.length === 0) {
    return {
      success: true,
      message: `用户 ${userId} 在MongoDB中无答题记录`,
      duplicatesFound: 0,
      duplicatesRemoved: 0
    };
  }
  
  console.log(`MongoDB: 用户 ${userId} 在MongoDB中有 ${records.length} 条记录`);
  
  // 用于标记完全相同记录的Map
  const uniqueMap = new Map();
  // 用于标记内容相同但时间不同记录的Map
  const contentMap = new Map();
  // 存储要删除的记录ID
  const duplicateIds = [];
  // 存储内容相同但时间不同的记录组
  const contentDuplicates = [];
  
  for (const record of records) {
    // 创建内容键（不含时间）
    const contentKey = `${record.questionPath}|${record.answer_content || ''}|${record.correctness || ''}`;
    
    // 创建完全相同记录的键（包含时间）
    const timeStr = record.answer_time ? new Date(record.answer_time).toISOString() : '';
    const exactKey = `${contentKey}|${timeStr}`;
    
    // 检查是否有完全相同的记录
    if (uniqueMap.has(exactKey)) {
      // 发现完全相同的记录
      console.log(`MongoDB: 用户 ${userId} - 发现完全相同的记录，将删除重复: ${exactKey}`);
      duplicateIds.push(record._id);
    } else {
      // 标记此记录
      uniqueMap.set(exactKey, record._id);
      
      // 检查是否有内容相同但时间不同的记录
      if (!contentMap.has(contentKey)) {
        contentMap.set(contentKey, [{ id: record._id, time: timeStr }]);
      } else {
        // 存在内容相同的记录，添加到列表并记录警告
        const duplicates = contentMap.get(contentKey);
        duplicates.push({ id: record._id, time: timeStr });
        contentMap.set(contentKey, duplicates);
        
        // 如果是首次发现这组内容相同的记录，添加到警告列表
        if (duplicates.length === 2) {
          contentDuplicates.push({
            contentKey,
            records: duplicates
          });
        }
      }
    }
  }
  
  // 输出内容相同但时间不同的记录警告
  if (contentDuplicates.length > 0) {
    console.log(`MongoDB: 警告 - 用户 ${userId} 在MongoDB中发现 ${contentDuplicates.length} 组内容相同但时间不同的记录:`);
    
    for (const group of contentDuplicates) {
      console.log(`  内容键: ${group.contentKey}`);
      console.log(`  记录数: ${group.records.length}`);
      console.log(`  时间列表: ${group.records.map(r => r.time).join(', ')}`);
    }
  }
  
  // 删除完全重复的记录
  let deletedCount = 0;
  if (duplicateIds.length > 0) {
    const deleteResult = await collection.deleteMany({
      _id: { $in: duplicateIds }
    });
    
    deletedCount = deleteResult.deletedCount;
    console.log(`MongoDB: 已从MongoDB删除用户 ${userId} 的 ${deletedCount} 条完全重复记录`);
  }
  
  return {
    success: true,
    message: `检测完成，发现 ${duplicateIds.length} 条完全重复记录，已删除 ${deletedCount} 条`,
    contentDuplicatesGroupCount: contentDuplicates.length,
    duplicatesFound: duplicateIds.length,
    duplicatesRemoved: deletedCount
  };
}

/**
 * 检测和清理MySQL中的重复数据
 * @param {number|string} userId 用户ID
 * @returns {Promise<Object>} 处理结果
 */
async function detectAndCleanMySQLDuplicates(userId) {
  console.log(`MongoDB: 检测用户 ${userId} 在MySQL中的重复数据`);
  
  // 检查MySQL连接
  if (!mysqlPool) {
    // 尝试初始化MySQL连接池
    const initialized = await initMySQLPool();
    if (!initialized || !mysqlPool) {
      return {
        success: false,
        message: 'MySQL连接失败',
        duplicatesFound: 0,
        duplicatesRemoved: 0
      };
    }
  }
  
  try {
    // 检查用户表是否存在
    const [tables] = await mysqlPool.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = 'cxsjdb' 
       AND TABLE_NAME = 'user_questions_${userId}'`
    );
    
    if (tables.length === 0) {
      return {
        success: true,
        message: `用户 ${userId} 的MySQL答题表不存在`,
        duplicatesFound: 0,
        duplicatesRemoved: 0
      };
    }
    
    // 获取所有记录
    const [records] = await mysqlPool.query(`SELECT * FROM user_questions_${userId}`);
    
    if (records.length === 0) {
      return {
        success: true,
        message: `用户 ${userId} 在MySQL中无答题记录`,
        duplicatesFound: 0,
        duplicatesRemoved: 0
      };
    }
    
    console.log(`MongoDB: 用户 ${userId} 在MySQL中有 ${records.length} 条记录`);
    
    // 用于标记完全相同记录的Map
    const uniqueMap = new Map();
    // 用于标记内容相同但时间不同记录的Map
    const contentMap = new Map();
    // 存储要删除的记录ID
    const duplicateIds = [];
    // 存储内容相同但时间不同的记录组
    const contentDuplicates = [];
    
    for (const record of records) {
      // 创建内容键（不含时间）
      const contentKey = `${record.question_path}|${record.answer_content || ''}|${record.correctness || ''}`;
      
      // 创建完全相同记录的键（包含时间）
      const timeStr = record.answer_time ? new Date(record.answer_time).toISOString() : '';
      const exactKey = `${contentKey}|${timeStr}`;
      
      // 检查是否有完全相同的记录
      if (uniqueMap.has(exactKey)) {
        // 发现完全相同的记录
        console.log(`MongoDB: 用户 ${userId} - 发现MySQL中完全相同的记录，将删除重复: ${exactKey}`);
        duplicateIds.push(record.id);
      } else {
        // 标记此记录
        uniqueMap.set(exactKey, record.id);
        
        // 检查是否有内容相同但时间不同的记录
        if (!contentMap.has(contentKey)) {
          contentMap.set(contentKey, [{ id: record.id, time: timeStr }]);
        } else {
          // 存在内容相同的记录，添加到列表并记录警告
          const duplicates = contentMap.get(contentKey);
          duplicates.push({ id: record.id, time: timeStr });
          contentMap.set(contentKey, duplicates);
          
          // 如果是首次发现这组内容相同的记录，添加到警告列表
          if (duplicates.length === 2) {
            contentDuplicates.push({
              contentKey,
              records: duplicates
            });
          }
        }
      }
    }
    
    // 输出内容相同但时间不同的记录警告
    if (contentDuplicates.length > 0) {
      console.log(`MongoDB: 警告 - 用户 ${userId} 在MySQL中发现 ${contentDuplicates.length} 组内容相同但时间不同的记录:`);
      
      for (const group of contentDuplicates) {
        console.log(`  内容键: ${group.contentKey}`);
        console.log(`  记录数: ${group.records.length}`);
        console.log(`  时间列表: ${group.records.map(r => r.time).join(', ')}`);
      }
    }
    
    // 删除完全重复的记录
    let deletedCount = 0;
    if (duplicateIds.length > 0) {
      for (const id of duplicateIds) {
        try {
          const [result] = await mysqlPool.query(`DELETE FROM user_questions_${userId} WHERE id = ?`, [id]);
          deletedCount += result.affectedRows;
        } catch (deleteError) {
          console.error(`MongoDB: 删除MySQL重复记录 ID=${id} 失败:`, deleteError);
        }
      }
      
      console.log(`MongoDB: 已从MySQL删除用户 ${userId} 的 ${deletedCount} 条完全重复记录`);
    }
    
    return {
      success: true,
      message: `检测完成，发现 ${duplicateIds.length} 条完全重复记录，已删除 ${deletedCount} 条`,
      contentDuplicatesGroupCount: contentDuplicates.length,
      duplicatesFound: duplicateIds.length,
      duplicatesRemoved: deletedCount
    };
  } catch (error) {
    console.error(`MongoDB: 检测MySQL重复数据失败:`, error);
    return {
      success: false,
      message: `检测失败: ${error.message}`,
      duplicatesFound: 0,
      duplicatesRemoved: 0
    };
  }
}

// 导出模块函数
module.exports = {
  initUserAnswersCollection,
  submitUserAnswer,
  getUserAnswers,
  syncAnswersFromMySQL,
  getCorrectAnswer,
  syncAnswersToMySQL,
  ensureUserQuestionsTable,
  detectAndCleanDuplicates
}; 