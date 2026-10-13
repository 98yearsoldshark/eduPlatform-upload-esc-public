// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../config/runtime');
/**
 * MongoDB连接服务入口文件
 * 提供MongoDB连接服务和集合管理
 */

const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
const yaml = require('yaml');


// 加载环境变量


// 默认配置
const DEFAULT_CONFIG = {
  enabled: true,
  connectionString: process.env.MONGODB_URI || '',
  dbName: 'student_learning_db',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10
  },
  fallbackToMySQL: true,
  collections: {
    userAnswers: 'user_answers',
    fileMetadata: 'file_metadata',
    statistics: 'statistics',
    posts: 'posts',
    comments: 'comments'
  }
};

// 存储配置和连接实例
let config = { ...DEFAULT_CONFIG };
let client = null;
let db = null;
let isConnected = false;
let connectionError = null;

/**
 * 加载配置文件
 * @returns {Object} 加载的配置对象
 */
function loadConfig() {
  try {
    const configPath = path.join(__dirname, '../../config.yaml');
    
    // 检查配置文件是否存在
    if (!fs.existsSync(configPath)) {
      console.log('MongoDB: 配置文件不存在，使用默认配置创建');
      const defaultConfig = {
        databases: {
          mongodb: { ...DEFAULT_CONFIG },
          mysql: {
            enabled: true
          }
        },
        features: {
          userAnswers: {
            preferredDatabase: "mongodb",
            syncMode: "mysql_to_mongodb",
            dualWrite: true
          }
        }
      };
      
      // 创建默认配置文件
      fs.writeFileSync(configPath, yaml.stringify(defaultConfig), 'utf8');
      return { 
        ...DEFAULT_CONFIG, 
        mysqlEnabled: true, 
        userAnswersPreferredDb: "mongodb",
        syncMode: "mysql_to_mongodb",
        dualWrite: true
      };
    }
    
    // 读取并解析配置文件
    const fileContents = fs.readFileSync(configPath, 'utf8');
    console.log(`MongoDB: 读取配置文件内容 (前50字符): ${fileContents.substring(0, 50)}...`);
    
    const yamlConfig = yaml.parse(fileContents);
    console.log('MongoDB: 配置文件解析完成，检查配置结构');
    
    // 打印关键配置信息
    if (yamlConfig && yamlConfig.databases) {
      console.log(`MongoDB: 数据库配置: MongoDB=${yamlConfig.databases.mongodb?.enabled}, MySQL=${yamlConfig.databases.mysql?.enabled}`);
    }
    if (yamlConfig && yamlConfig.features && yamlConfig.features.userAnswers) {
      console.log(`MongoDB: 用户答题配置: 首选=${yamlConfig.features.userAnswers.preferredDatabase}, 同步模式=${yamlConfig.features.userAnswers.syncMode}`);
    }
    
    // 获取MongoDB配置
    if (yamlConfig && yamlConfig.databases && yamlConfig.databases.mongodb) {
      console.log('MongoDB: 成功加载配置文件');
      
      // 获取MySQL启用状态 - 简化判断逻辑，避免嵌套属性访问可能导致的错误
      let mysqlEnabled = false;
      if (yamlConfig.databases && 
          yamlConfig.databases.mysql && 
          yamlConfig.databases.mysql.enabled === true) {
        mysqlEnabled = true;
      }
      
      console.log(`MongoDB: MySQL启用状态: ${mysqlEnabled ? '已启用' : '已禁用'}`);
      
      // 获取用户答题记录首选数据库
      let userAnswersPreferredDb = "mongodb"; // 默认使用MongoDB
      let syncMode = "mysql_to_mongodb"; // 默认从MySQL同步到MongoDB
      let dualWrite = true; // 默认启用双写
      
      if (yamlConfig.features && yamlConfig.features.userAnswers) {
        if (yamlConfig.features.userAnswers.preferredDatabase) {
          userAnswersPreferredDb = yamlConfig.features.userAnswers.preferredDatabase.toLowerCase();
        }
        
        if (yamlConfig.features.userAnswers.syncMode) {
          syncMode = yamlConfig.features.userAnswers.syncMode.toLowerCase();
        }
        
        if (yamlConfig.features.userAnswers.dualWrite !== undefined) {
          dualWrite = !!yamlConfig.features.userAnswers.dualWrite;
        }
      }
      
      console.log(`MongoDB: 用户答题记录首选数据库: ${userAnswersPreferredDb}`);
      console.log(`MongoDB: 数据同步模式: ${syncMode}`);
      console.log(`MongoDB: 数据双写模式: ${dualWrite ? '已启用' : '已禁用'}`);
      
      return { 
        ...DEFAULT_CONFIG, 
        ...yamlConfig.databases.mongodb,
        mysqlEnabled, // 添加MySQL启用状态
        userAnswersPreferredDb, // 添加用户答题记录首选数据库
        syncMode, // 添加数据同步模式
        dualWrite // 添加数据双写设置
      };
    } else {
      console.log('MongoDB: 配置文件中未找到MongoDB配置，使用默认配置');
      return { 
        ...DEFAULT_CONFIG, 
        mysqlEnabled: true,
        userAnswersPreferredDb: "mongodb",
        syncMode: "mysql_to_mongodb",
        dualWrite: true
      };
    }
  } catch (error) {
    console.error('MongoDB: 加载配置文件出错:', error);
    return { 
      ...DEFAULT_CONFIG, 
      mysqlEnabled: true,
      userAnswersPreferredDb: "mongodb",
      syncMode: "mysql_to_mongodb",
      dualWrite: true
    };
  }
}

/**
 * 初始化MongoDB连接
 * @returns {Promise<boolean>} 连接是否成功
 */
async function initConnection() {
  try {
    // 加载配置
    config = loadConfig();
    
    // 检查是否启用MongoDB
    if (!config.enabled) {
      console.log('MongoDB: 已禁用，使用MySQL');
      isConnected = false;
      return false;
    }
    
    // 获取连接字符串
    let connectionString = config.connectionString;
    
    // 使用环境变量中的连接字符串(如果存在)
    if (process.env.MONGODB_URI) {
      connectionString = process.env.MONGODB_URI;
    }

    if (!connectionString) {
      console.warn('MongoDB: 未设置 MONGODB_URI，跳过连接');
      isConnected = false;
      return false;
    }

    console.log('MongoDB: 开始连接数据库...');
    
    // 创建MongoDB客户端
    client = new MongoClient(connectionString, config.options);
    
    // 连接到MongoDB
    await client.connect();
    
    // 获取数据库
    db = client.db(config.dbName);
    
    // 验证连接
    await db.command({ ping: 1 });
    
    console.log('MongoDB: 连接成功');
    isConnected = true;
    connectionError = null;
    
    return true;
  } catch (error) {
    console.error('MongoDB: 连接失败:', error);
    isConnected = false;
    connectionError = error;
    
    // 尝试关闭连接
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('MongoDB: 关闭连接失败:', closeError);
      }
    }
    
    return false;
  }
}

/**
 * 获取MongoDB连接状态
 * @returns {Object} 连接状态对象
 */
function getConnectionStatus() {
  return {
    isConnected,
    error: connectionError ? connectionError.message : null,
    config: { ...config, connectionString: '***HIDDEN***' } // 隐藏敏感信息
  };
}

/**
 * 获取指定集合
 * @param {string} collectionName 集合名称
 * @returns {Object|null} 集合对象或null
 */
function getCollection(collectionName) {
  if (!isConnected || !db) {
    return null;
  }
  
  return db.collection(collectionName);
}

/**
 * 列出集合的所有索引
 * @param {string} collectionName 集合名称
 * @returns {Promise<Array|null>} 索引数组或null
 */
async function listCollectionIndexes(collectionName) {
  try {
    if (!isConnected || !db) {
      console.error('MongoDB: 未连接，无法列出索引');
      return null;
    }
    
    const collection = db.collection(collectionName);
    const indexes = await collection.indexes();
    return indexes;
  } catch (error) {
    console.error(`MongoDB: 列出集合 ${collectionName} 的索引失败:`, error);
    return null;
  }
}

/**
 * 删除集合的所有非_id索引
 * @param {string} collectionName 集合名称
 * @returns {Promise<boolean>} 是否成功
 */
async function dropAllIndexes(collectionName) {
  try {
    if (!isConnected || !db) {
      console.error('MongoDB: 未连接，无法删除索引');
      return false;
    }
    
    const collection = db.collection(collectionName);
    await collection.dropIndexes();
    console.log(`MongoDB: 已删除集合 ${collectionName} 的所有非_id索引`);
    return true;
  } catch (error) {
    console.error(`MongoDB: 删除集合 ${collectionName} 的索引失败:`, error);
    return false;
  }
}

/**
 * 关闭MongoDB连接
 * @returns {Promise<void>}
 */
async function closeConnection() {
  if (client) {
    try {
      await client.close();
      console.log('MongoDB: 连接已关闭');
    } catch (error) {
      console.error('MongoDB: 关闭连接失败:', error);
    } finally {
      client = null;
      db = null;
      isConnected = false;
    }
  }
}

// 将MongoDB中的用户答题记录同步到MySQL
async function syncToMysql(userId = null) {
  if (!client || !db) {
    return { 
      success: false, 
      message: 'MongoDB未连接，无法同步数据' 
    };
  }
  
  if (!mysqlPool) {
    return { 
      success: false, 
      message: 'MySQL未连接，无法同步数据' 
    };
  }
  
  try {
    console.log(`MongoDB: 开始向MySQL同步用户答题记录 ${userId ? `(userId=${userId})` : '(所有用户)'}`);
    const collection = db.collection('user_answers');
    
    // 确定要同步的用户
    let userIds = [];
    if (userId) {
      userIds = [parseInt(userId)];
    } else {
      // 获取所有有答题记录的用户ID
      const distinctUsers = await collection.distinct('userId');
      userIds = distinctUsers.map(id => parseInt(id));
    }
    
    console.log(`MongoDB: 将同步 ${userIds.length} 个用户的答题记录到MySQL`);
    let totalRecords = 0;
    let duplicateRecords = 0;
    
    // 逐个用户同步
    for (const id of userIds) {
      try {
        // 获取MongoDB中该用户的答题记录
        const records = await collection.find({ userId: id }).sort({ answer_time: -1 }).toArray();
        
        if (!records || records.length === 0) {
          console.log(`MongoDB: 用户 ${id} 在MongoDB中无答题记录，跳过`);
          continue;
        }
        
        console.log(`MongoDB: 用户 ${id} 在MongoDB中有 ${records.length} 条答题记录`);
        
        // 确保用户表存在
        await createUserQuestionTableIfNotExists(id);
        
        // 获取MySQL中该用户现有的答题记录
        const [existingRecords] = await mysqlPool.query(`SELECT * FROM user_questions_${id}`);
        
        console.log(`MongoDB: 用户 ${id} 在MySQL中有 ${existingRecords.length} 条现有记录`);
        
        // 去重处理
        const recordsToInsert = await deduplicateForMysql(records, existingRecords, id);
        const duplicates = records.length - recordsToInsert.length;
        
        if (duplicates > 0) {
          console.log(`MongoDB: 用户 ${id} 发现 ${duplicates} 条重复记录，将被跳过`);
          duplicateRecords += duplicates;
        }
        
        if (recordsToInsert.length === 0) {
          console.log(`MongoDB: 用户 ${id} 所有记录都已存在于MySQL，无需同步`);
          continue;
        }
        
        // 批量插入到MySQL
        if (recordsToInsert.length > 0) {
          // 每500条记录一批插入，避免数据包过大
          const batchSize = 500;
          for (let i = 0; i < recordsToInsert.length; i += batchSize) {
            const batch = recordsToInsert.slice(i, i + batchSize);
            
            const values = batch.map(record => [
              record.questionPath,
              record.attempt_count || 1,
              record.answer_content || '',
              record.correctness || 'incorrect',
              record.answer_time ? new Date(record.answer_time) : new Date(),
              record.questionType || 'image',
              record.questionId || null,
              record.correctAnswer || null
            ]);
            
            const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
            
            const sql = `INSERT INTO user_questions_${id} 
              (question_path, attempt_count, answer_content, correctness, answer_time, question_type, question_id, correct_answer) 
              VALUES ${placeholders}`;
            
            const [result] = await mysqlPool.query(sql, values.flat());
            console.log(`MongoDB: 用户 ${id} 的 ${result.affectedRows} 条答题记录已同步到MySQL (批次 ${Math.floor(i/batchSize)+1}/${Math.ceil(recordsToInsert.length/batchSize)})`);
            totalRecords += result.affectedRows;
          }
        }
      } catch (userError) {
        console.error(`MongoDB: 同步用户 ${id} 答题记录到MySQL失败:`, userError);
      }
    }
    
    return {
      success: true,
      message: `同步完成，共同步 ${totalRecords} 条答题记录到MySQL${duplicateRecords > 0 ? `，跳过 ${duplicateRecords} 条重复记录` : ''}`,
      totalRecords,
      duplicateRecords
    };
  } catch (error) {
    console.error('MongoDB: 同步答题记录到MySQL失败:', error);
    return {
      success: false,
      message: '同步失败: ' + error.message
    };
  } finally {
    // 在同步完成或失败后尝试清理MySQL中的重复数据
    if (userId) {
      // 如果指定了用户ID，只清理该用户的数据
      try {
        console.log(`MongoDB: 同步结束后，清理用户 ${userId} 在MySQL中的重复数据`);
        const cleanResult = await cleanMySQLDuplicates(userId);
        console.log(`MongoDB: 清理结果: ${JSON.stringify(cleanResult)}`);
      } catch (cleanError) {
        console.error(`MongoDB: 清理用户 ${userId} 在MySQL中的重复数据时出错:`, cleanError);
      }
    } else if (userIds && userIds.length > 0) {
      // 如果没有指定用户ID，清理所有同步过的用户的数据
      console.log(`MongoDB: 同步结束后，清理所有用户在MySQL中的重复数据`);
      for (const id of userIds) {
        try {
          const cleanResult = await cleanMySQLDuplicates(id);
          console.log(`MongoDB: 用户 ${id} 的清理结果: ${JSON.stringify(cleanResult)}`);
        } catch (cleanError) {
          console.error(`MongoDB: 清理用户 ${id} 在MySQL中的重复数据时出错:`, cleanError);
        }
      }
    }
  }
}

/**
 * 在MySQL中检测和清理重复数据
 * @param {number} userId 用户ID
 * @returns {Promise<Object>} 处理结果
 */
async function cleanMySQLDuplicates(userId) {
  console.log(`MongoDB: 开始检测和清理用户 ${userId} 在MySQL中的重复数据`);
  try {
    // 检查MySQL连接
    if (!mysqlPool) {
      return {
        success: false,
        message: 'MySQL未连接，无法清理重复数据',
        duplicatesFound: 0,
        duplicatesRemoved: 0
      };
    }
    
    // 检查用户表是否存在
    const [tables] = await mysqlPool.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = 'cxsjdb' 
       AND TABLE_NAME = 'user_questions_${userId}'`
    );
    
    if (tables.length === 0) {
      console.log(`MongoDB: 用户 ${userId} 的MySQL答题表不存在，无需清理`);
      return {
        success: true,
        message: '用户表不存在，无需清理',
        duplicatesFound: 0,
        duplicatesRemoved: 0
      };
    }
    
    // 查找完全相同的记录（除ID外）
    const [duplicates] = await mysqlPool.query(`
      SELECT q1.id, q1.question_path, q1.answer_content, q1.correctness, q1.answer_time,
             COUNT(*) as count
      FROM user_questions_${userId} q1
      JOIN user_questions_${userId} q2 ON 
          q1.question_path = q2.question_path AND
          q1.answer_content = q2.answer_content AND
          q1.correctness = q2.correctness AND
          q1.answer_time = q2.answer_time AND
          q1.id > q2.id
      GROUP BY q1.question_path, q1.answer_content, q1.correctness, q1.answer_time
    `);
    
    if (duplicates.length === 0) {
      console.log(`MongoDB: 用户 ${userId} 在MySQL中未发现完全重复的记录`);
      
      // 查找内容相同但时间不同的记录
      const [contentDuplicates] = await mysqlPool.query(`
        SELECT q1.id, q1.question_path, q1.answer_content, q1.correctness, q1.answer_time
        FROM user_questions_${userId} q1
        JOIN user_questions_${userId} q2 ON 
            q1.question_path = q2.question_path AND
            q1.answer_content = q2.answer_content AND
            q1.correctness = q2.correctness AND
            q1.answer_time != q2.answer_time AND
            q1.id < q2.id
        GROUP BY q1.id
      `);
      
      if (contentDuplicates.length > 0) {
        console.log(`MongoDB: 警告 - 用户 ${userId} 在MySQL中发现 ${contentDuplicates.length} 条内容相同但时间不同的记录`);
        
        for (const record of contentDuplicates) {
          console.log(`  记录: ID=${record.id}, 路径=${record.question_path}, 内容=${record.answer_content}, 正确性=${record.correctness}, 时间=${record.answer_time}`);
        }
      }
      
      return {
        success: true,
        message: '未发现完全重复记录，但可能存在内容相同时间不同的记录',
        duplicatesFound: 0,
        duplicatesRemoved: 0,
        contentDuplicatesFound: contentDuplicates.length
      };
    }
    
    console.log(`MongoDB: 用户 ${userId} 在MySQL中发现 ${duplicates.length} 条完全重复的记录，准备删除`);
    
    // 收集要删除的ID
    const idsToDelete = duplicates.map(d => d.id);
    console.log(`MongoDB: 将删除ID: ${idsToDelete.join(', ')}`);
    
    // 删除重复记录
    const [deleteResult] = await mysqlPool.query(`
      DELETE FROM user_questions_${userId} 
      WHERE id IN (${idsToDelete.join(',')})
    `);
    
    console.log(`MongoDB: 清理结果 - 删除了 ${deleteResult.affectedRows} 条重复记录`);
    
    return {
      success: true,
      message: `清理完成，删除了 ${deleteResult.affectedRows} 条重复记录`,
      duplicatesFound: idsToDelete.length,
      duplicatesRemoved: deleteResult.affectedRows
    };
  } catch (error) {
    console.error(`MongoDB: 清理MySQL重复数据失败:`, error);
    return {
      success: false,
      message: `清理失败: ${error.message}`,
      duplicatesFound: 0,
      duplicatesRemoved: 0
    };
  }
}

/**
 * 对MongoDB记录进行去重处理，避免插入MySQL时出现重复
 * @param {Array} mongoRecords MongoDB查询的记录数组
 * @param {Array} mysqlRecords MySQL中已存在的记录数组
 * @param {number} userId 用户ID
 * @returns {Array} 去重后需要插入的记录数组
 */
async function deduplicateForMysql(mongoRecords, mysqlRecords, userId) {
  console.log(`MongoDB: 对用户 ${userId} 的记录进行去重处理`);
  
  // 创建一个集合来存储MySQL中已有记录的唯一键
  const existingKeysMap = new Map();
  
  // 检查MySQL中已有的记录
  for (const record of mysqlRecords) {
    // 创建唯一键
    const contentKey = `${record.question_path}|${record.answer_content}|${record.correctness}`;
    
    // 格式化时间为"YYYY-MM-DD HH:MM:SS"
    const formattedTime = new Date(record.answer_time).toISOString().replace('T', ' ').substring(0, 19);
    
    // 完全相同记录的键(包含时间)
    const exactKey = `${contentKey}|${formattedTime}`;
    
    // 存储到映射
    existingKeysMap.set(exactKey, record.id);
    
    // 也存储不含时间的内容键，用于检测内容相同的记录
    if (!existingKeysMap.has(contentKey)) {
      existingKeysMap.set(contentKey, [record.id]);
    } else {
      existingKeysMap.get(contentKey).push(record.id);
    }
  }
  
  // 用于MongoDB记录去重的Map
  const uniqueMongoMap = new Map();
  const recordsToInsert = [];
  
  // 检查MongoDB中的记录，去除重复并与MySQL比较
  for (const record of mongoRecords) {
    // 创建唯一键
    const contentKey = `${record.questionPath}|${record.answer_content}|${record.correctness}`;
    
    // 格式化时间为"YYYY-MM-DD HH:MM:SS"
    const formattedTime = new Date(record.answer_time).toISOString().replace('T', ' ').substring(0, 19);
    
    // 完全相同记录的键(包含时间)
    const exactKey = `${contentKey}|${formattedTime}`;
    
    // 先检查MongoDB内部是否有完全相同的记录
    if (uniqueMongoMap.has(exactKey)) {
      console.log(`MongoDB: 用户 ${userId} - 发现MongoDB内完全相同的记录: ${exactKey}`);
      continue; // 跳过MongoDB内部重复
    }
    
    // 检查是否已存在于MySQL
    if (existingKeysMap.has(exactKey)) {
      console.log(`MongoDB: 用户 ${userId} - 记录已存在于MySQL: ${exactKey} (MySQL ID: ${existingKeysMap.get(exactKey)})`);
      continue; // 跳过已存在于MySQL的记录
    }
    
    // 检查是否有内容相同但时间不同的记录(MongoDB内部)
    const mongoContentDuplicates = [...uniqueMongoMap.keys()].filter(key => key.startsWith(contentKey + '|'));
    
    if (mongoContentDuplicates.length > 0) {
      console.log(`MongoDB: 警告 - 用户 ${userId} - MongoDB内发现内容相同但时间不同的记录: 
        - 当前记录: ${exactKey}
        - 已存在记录: ${mongoContentDuplicates[0]}`);
    }
    
    // 检查MySQL中是否有内容相同但时间不同的记录
    if (existingKeysMap.has(contentKey)) {
      const mysqlIds = existingKeysMap.get(contentKey);
      if (Array.isArray(mysqlIds) && mysqlIds.length > 0) {
        console.log(`MongoDB: 警告 - 用户 ${userId} - MySQL中发现内容相同但时间不同的记录: 
          - 当前记录: ${exactKey}
          - MySQL已存在ID: ${mysqlIds.join(', ')}`);
        console.log(`内容键: ${contentKey}`);
      }
    }
    
    // 标记为已处理并添加到结果
    uniqueMongoMap.set(exactKey, record);
    recordsToInsert.push(record);
  }
  
  console.log(`MongoDB: 用户 ${userId} - 去重后需插入 ${recordsToInsert.length} 条记录 (原始: ${mongoRecords.length})`);
  return recordsToInsert;
}

// 导出模块函数和变量
module.exports = {
  // 连接管理
  initConnection,
  closeConnection,
  getConnectionStatus,
  getCollection,
  
  // 索引管理
  listCollectionIndexes,
  dropAllIndexes,
  
  // 配置访问
  getConfig: () => ({ ...config }),
  
  // 状态查询
  isEnabled: () => config.enabled,
  isFallbackEnabled: () => config.fallbackToMySQL,
  isMySQLEnabled: () => config.mysqlEnabled,
  
  // 同步设置
  getSyncMode: () => config.syncMode,
  shouldSyncFromMySQL: () => {
    const should = config.syncMode === "mysql_to_mongodb" && config.mysqlEnabled;
    console.log(`MongoDB: 检查是否应从MySQL同步到MongoDB - syncMode=${config.syncMode}, mysqlEnabled=${config.mysqlEnabled}, 结果=${should}`);
    return should;
  },
  shouldSyncFromMongoDB: () => {
    const should = config.syncMode === "mongodb_to_mysql" && config.mysqlEnabled && config.enabled;
    console.log(`MongoDB: 检查是否应从MongoDB同步到MySQL - syncMode=${config.syncMode}, mysqlEnabled=${config.mysqlEnabled}, mongodbEnabled=${config.enabled}, 结果=${should}`);
    return should;
  },
  shouldSkipSync: () => {
    const should = config.syncMode === "none";
    console.log(`MongoDB: 检查是否应跳过同步 - syncMode=${config.syncMode}, 结果=${should}`);
    return should;
  },
  
  // 双写设置
  isDualWriteEnabled: () => {
    const should = config.dualWrite && config.mysqlEnabled && config.enabled;
    console.log(`MongoDB: 检查是否启用双写 - dualWrite=${config.dualWrite}, mysqlEnabled=${config.mysqlEnabled}, mongodbEnabled=${config.enabled}, 结果=${should}`);
    return should;
  },
  
  // 用户答题记录首选数据库
  getUserAnswersPreferredDb: () => config.userAnswersPreferredDb,
  shouldPreferMongoDB: () => {
    const should = config.userAnswersPreferredDb === "mongodb" && config.enabled;
    console.log(`MongoDB: 检查是否应优先使用MongoDB - preferredDB=${config.userAnswersPreferredDb}, mongodbEnabled=${config.enabled}, 结果=${should}`);
    return should;
  },
  shouldPreferMySQL: () => {
    const should = config.userAnswersPreferredDb === "mysql" && config.mysqlEnabled;
    console.log(`MongoDB: 检查是否应优先使用MySQL - preferredDB=${config.userAnswersPreferredDb}, mysqlEnabled=${config.mysqlEnabled}, 结果=${should}`);
    return should;
  },
  
  // 数据清理和同步
  syncToMysql,
  cleanMySQLDuplicates
}; 