// 先加载私有运行配置，禁止在源码中保存凭据。
require('../config/runtime');
// 从环境变量加载本地运行配置，公开仓库不保存真实凭据。

/**
 * 社区系统服务器
 */
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt'); // 用于密码加密

const app = express();

// 系统配置选项
const CONFIG = {
  // 是否允许用户重复评分同一题目
  ALLOW_DUPLICATE_RATINGS: true,
  // 添加其他全局配置项...
};

// 中间件配置
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// 导入认证中间件
const { checkTeacherToken } = require('../middleware/authMiddleware');

// 创建数据库连接池
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'cxsjdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true, // 启用连接保活
  keepAliveInitialDelay: 10000, // 10秒后开始发送保活包
  connectTimeout: 10000, // 连接超时时间
  // acquireTimeout: 10000, // 获取连接超时时间
  // timeout: 60000, // 查询超时时间
  // 自动重连设置
  multipleStatements: true,
});

// 定期执行心跳查询，保持连接活跃
setInterval(async () => {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.query('SELECT 1');
      console.log('心跳查询成功');
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('心跳查询失败:', error);
  }
}, 30000); // 每30秒执行一次心跳查询

// 通用数据库操作函数，带有重试机制
async function executeWithRetry(operation, maxRetries = 3) {
  let retries = maxRetries;
  let lastError = null;
  
  while (retries > 0) {
    let connection;
    try {
      // 获取连接
      connection = await pool.getConnection();
      
      // 执行操作
      const result = await operation(connection);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`数据库操作失败 (剩余重试次数: ${retries-1}):`, error);
      
      // 检查是否是连接相关错误
      if (error.code === 'PROTOCOL_CONNECTION_LOST' || 
          error.code === 'ECONNREFUSED' || 
          error.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR') {
        retries--;
        if (retries > 0) {
          // 等待一段时间再重试
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      } else {
        // 非连接错误，不再重试
        break;
      }
    } finally {
      // 确保连接被释放回连接池
      if (connection) connection.release();
    }
  }
  
  // 所有重试都失败了
  throw lastError;
}

// 导出连接池和executeWithRetry函数，供路由文件使用
module.exports = { pool, executeWithRetry };

// 导入路由
const postRoutes = require('./routes/postRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const friendshipRoutes = require('./routes/friendshipRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const questionRoutes = require('./routes/questionconsole'); // 改用拆分后的题目管理路由

// 导入权限配置路由
const permissionsRoutes = require('../config-city/server-nacos/permissionsRoutes');

// 应用路由 - 确保认证中间件在权限配置路由之前应用
app.use('/api/config/permissions', checkTeacherToken, permissionsRoutes);

// 初始化数据库表
async function initDatabase() {
  const connection = await pool.getConnection();
  try {
    // 帖子表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS community_posts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        visibility ENUM('public', 'friends_only', 'teacher_hidden') DEFAULT 'public',
        is_anonymous TINYINT(1) DEFAULT 0,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved',
        has_sensitive_content TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX(user_id),
        INDEX(category),
        INDEX(created_at)
      )
    `);
    
    // 评论表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS community_comments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        parent_id INT,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(post_id),
        INDEX(user_id),
        INDEX(parent_id)
      )
    `);
    
    // 互动表（点赞、收藏、投币、推荐）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS community_interactions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        post_id INT NOT NULL,
        type ENUM('like', 'favorite', 'coin', 'recommend') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY(user_id, post_id, type),
        INDEX(post_id),
        INDEX(type)
      )
    `);
    
    // 好友关系表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS community_friendships (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        friend_id INT NOT NULL,
        nickname VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY(user_id, friend_id),
        INDEX(friend_id)
      )
    `);
    
    // 好友申请表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS community_friend_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message VARCHAR(255),
        nickname VARCHAR(50),
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(sender_id),
        INDEX(receiver_id),
        INDEX(status)
      )
    `);
    
    // 私信表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS community_private_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        content TEXT NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(sender_id),
        INDEX(receiver_id),
        INDEX(created_at)
      )
    `);
    
    // 通知表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS community_notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        related_id INT,
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(user_id),
        INDEX(type),
        INDEX(is_read)
      )
    `);
    
    // 用户角色表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS community_user_roles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        teacher_id INT,
        role ENUM('super_admin', 'admin', 'assistant', 'teacher', 'student') DEFAULT 'student',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY(user_id, role)
      )
    `);
    
    // 添加teacher_id字段（如果表已存在）
    try {
      // 检查teacher_id列是否存在
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'cxsjdb' 
        AND TABLE_NAME = 'community_user_roles' 
        AND COLUMN_NAME = 'teacher_id'
      `);
      
      // 如果teacher_id列不存在，则添加它
      if (columns.length === 0) {
        await connection.query(`
          ALTER TABLE community_user_roles
          ADD COLUMN teacher_id INT NULL
        `);
        console.log('已添加teacher_id字段到community_user_roles表');
      }
      
      // 修改role列的枚举值
      await connection.query(`
        ALTER TABLE community_user_roles
        MODIFY COLUMN role ENUM('super_admin', 'admin', 'assistant', 'teacher', 'student') DEFAULT 'student'
      `);
      
      console.log('已更新community_user_roles表结构');
    } catch (error) {
      console.error('更新community_user_roles表结构失败:', error);
    }
    
    // 用户限制表（发帖、评论、好友申请等限制）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS community_user_limits (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        posts_today INT DEFAULT 0,
        comments_today INT DEFAULT 0,
        friend_requests_today INT DEFAULT 0,
        last_reset_date DATE,
        UNIQUE KEY(user_id)
      )
    `);
    
    // 苹果币表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS community_apple_coins (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        current_amount INT DEFAULT 0,
        total_collected INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY(user_id)
      )
    `);
    
    // 举报表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS community_reports (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        post_id INT,
        comment_id INT,
        reason TEXT NOT NULL,
        status ENUM('pending', 'processed', 'ignored') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(user_id),
        INDEX(post_id),
        INDEX(comment_id),
        INDEX(status)
      )
    `);
    
    // 帖子引用题目表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS community_post_questions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        post_id INT NOT NULL,
        question_type ENUM('image', 'latex') NOT NULL,
        question_id INT,
        question_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(post_id),
        INDEX(question_id),
        INDEX(question_path)
      )
    `);
    
    // 更新教师已选择题目表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS teachers_selected_questions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        teacher_id INT NOT NULL,
        question_id INT NOT NULL,
        question_type ENUM('image', 'latex') NOT NULL,
        subject VARCHAR(50),
        grade VARCHAR(50),
        year VARCHAR(10),
        question_folder_or_id VARCHAR(255) NOT NULL,
        selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        star_count INT DEFAULT 0,
        post_count INT DEFAULT 0,
        comment_count INT DEFAULT 0,
        like_count INT DEFAULT 0,
        recommend_count INT DEFAULT 0,
        coin_count INT DEFAULT 0,
        favorite_count INT DEFAULT 0,
        last_refreshed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        student_rating_total FLOAT DEFAULT 0,
        student_rating_count INT DEFAULT 0,
        average_rating FLOAT DEFAULT 0,
        UNIQUE KEY(teacher_id, question_id, question_type),
        INDEX(teacher_id),
        INDEX(question_type),
        INDEX(selected_at)
      )
    `);
    
    // 检查统计字段是否存在，如果不存在则添加
    try {
      const columnsToCheck = [
        'star_count', 'post_count', 'comment_count', 'like_count', 
        'recommend_count', 'coin_count', 'favorite_count', 'last_refreshed',
        'student_rating_total', 'student_rating_count', 'average_rating'
      ];
      
      for (const column of columnsToCheck) {
        const [columns] = await connection.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = 'cxsjdb' 
          AND TABLE_NAME = 'teachers_selected_questions' 
          AND COLUMN_NAME = ?
        `, [column]);
        
        if (columns.length === 0) {
          // 根据字段类型添加适当的默认值和类型
          let columnType = 'INT DEFAULT 0';
          if (column === 'last_refreshed') {
            columnType = 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
          } else if (column === 'student_rating_total' || column === 'average_rating') {
            columnType = 'FLOAT DEFAULT 0';
          }
          
          await connection.query(`
            ALTER TABLE teachers_selected_questions
            ADD COLUMN ${column} ${columnType}
          `);
          console.log(`已添加 ${column} 字段到 teachers_selected_questions 表`);
        }
      }
    } catch (error) {
      console.error('更新 teachers_selected_questions 表结构失败:', error);
    }
    
    // 题目苹果币表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS community_question_apples (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        question_id INT NOT NULL,
        question_type ENUM('image', 'latex') NOT NULL,
        apples_count INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED,
        INDEX(user_id, created_date),
        INDEX(question_id, question_type)
      )
    `);
    
    // 确保教师表存在
    await connection.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        subject VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(email)
      )
    `);
    
    // 确保至少有一个默认教师
    const [existingTeachers] = await connection.query(
      'SELECT COUNT(*) as count FROM teachers'
    );
    
    if (existingTeachers[0].count === 0) {
      await connection.query(
        'INSERT INTO teachers (name, email, subject) VALUES (?, ?, ?)',
        ['系统默认教师', 'default@teacher.system', '系统']
      );
      console.log('已添加默认教师');
    }
    
    console.log('社区系统数据库表初始化完成');
  } catch (error) {
    console.error('初始化数据库表失败:', error);
  } finally {
    connection.release();
  }
}

// 注册路由
app.use('/api/community/posts', postRoutes);
app.use('/api/community/interactions', interactionRoutes);
app.use('/api/community/friendships', friendshipRoutes);
app.use('/api/community/users', userRoutes);
app.use('/api/community/roles', roleRoutes);
app.use('/api/questions', questionRoutes); // 添加题目管理路由

// 获取通知列表
app.get('/api/community/notifications', async (req, res) => {
  try {
    const { userId, page = 1, limit = 20, unreadOnly = false } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 确保分页参数是整数
    const limitNum = Number(limit);
    const pageNum = Number(page);
    const offset = (pageNum - 1) * limitNum;
    
    let query = `
      SELECT * FROM community_notifications
      WHERE user_id = ?
    `;
    
    const queryParams = [userId];
    
    if (unreadOnly === 'true') {
      query += ' AND is_read = 0';
    }
    
    // 直接在SQL中使用数字值而不是参数占位符
    query += ` ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;
    
    // 使用通用重试函数执行数据库操作
    const result = await executeWithRetry(async (connection) => {
      // 执行查询
      const [notifications] = await connection.execute(query, queryParams);
      
      // 获取未读通知数量
      const [unreadCount] = await connection.execute(
        'SELECT COUNT(*) AS count FROM community_notifications WHERE user_id = ? AND is_read = 0',
        [userId]
      );
      
      return {
        notifications,
        unreadCount: unreadCount[0].count
      };
    });
    
    res.json(result);
  } catch (error) {
    console.error('获取通知列表失败:', error);
    res.status(500).json({ error: '获取通知列表失败，请稍后再试' });
  }
});

// 标记通知为已读
app.put('/api/community/notifications/:id/read', async (req, res) => {
  try {
    const notificationId = req.params.id;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 使用通用重试函数执行数据库操作
    const result = await executeWithRetry(async (connection) => {
      // 验证通知所有权
      const [notifications] = await connection.execute(
        'SELECT * FROM community_notifications WHERE id = ?',
        [notificationId]
      );
      
      if (notifications.length === 0) {
        throw { status: 404, message: '通知不存在' };
      }
      
      if (notifications[0].user_id !== userId) {
        throw { status: 403, message: '无权操作此通知' };
      }
      
      // 标记为已读
      await connection.execute(
        'UPDATE community_notifications SET is_read = 1 WHERE id = ?',
        [notificationId]
      );
      
      return { message: '已标记为已读' };
    });
    
    res.json(result);
  } catch (error) {
    // 处理自定义错误状态
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    
    console.error('标记通知失败:', error);
    res.status(500).json({ error: '标记通知失败，请稍后再试' });
  }
});

// 标记所有通知为已读
app.put('/api/community/notifications/read-all', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 使用通用重试函数执行数据库操作
    const result = await executeWithRetry(async (connection) => {
      // 标记所有为已读
      await connection.execute(
        'UPDATE community_notifications SET is_read = 1 WHERE user_id = ?',
        [userId]
      );
      
      return { message: '已标记所有通知为已读' };
    });
    
    res.json(result);
  } catch (error) {
    console.error('标记所有通知失败:', error);
    res.status(500).json({ error: '标记所有通知失败，请稍后再试' });
  }
});

// 获取用户苹果币信息
app.get('/api/community/apple-coins', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查服务器当前时区和时间
    const serverTime = new Date();
    const serverTimeZone = -serverTime.getTimezoneOffset() / 60;
    const todayDateStr = serverTime.toISOString().split('T')[0]; // 'YYYY-MM-DD'
    
    console.log(`【时间检查】服务器时间: ${serverTime.toISOString()}`);
    console.log(`【时间检查】服务器时区: UTC${serverTimeZone >= 0 ? '+' : ''}${serverTimeZone}`);
    console.log(`【时间检查】今日日期字符串: ${todayDateStr}`);
    
    // 使用事务确保数据一致性
    const result = await executeWithRetry(async (connection) => {
      await connection.beginTransaction();
      
      try {
        // 使用MySQL的DATE函数在数据库层面直接格式化日期，并确保获取的是字符串格式
        const [coins] = await connection.query(
          'SELECT *, DATE_FORMAT(updated_at, "%Y-%m-%d") AS last_update_date FROM community_apple_coins WHERE user_id = ?',
          [userId]
        );
        
        let coinData;
        
        if (coins.length === 0) {
          // 如果没有记录，创建一个新记录
          const [insertResult] = await connection.query(
            'INSERT INTO community_apple_coins (user_id, current_amount, total_collected, updated_at) VALUES (?, 5, 5, NOW())',
            [userId]
          );
          
          coinData = {
            user_id: userId,
            current_amount: 5,
            total_collected: 5,
            updated_at: serverTime,
            last_update_date: todayDateStr // 确保新用户今天不再获得苹果币
          };
          
          console.log(`【新用户】${userId} 获得初始5个苹果币, 时间: ${serverTime.toISOString()}`);
        } else {
          // 检查上次更新日期，如果不是今天则更新苹果币
          const lastUpdateDate = coins[0].last_update_date;
          let currentAmount = coins[0].current_amount;
          let totalCollected = coins[0].total_collected;
          
          // 打印详细的日期时间信息，帮助调试
          console.log(`【苹果币】用户 ${userId} 的信息:`);
          console.log(`【苹果币】数据库上次更新日期: ${lastUpdateDate}`);
          console.log(`【苹果币】当前日期: ${todayDateStr}`);
          console.log(`【苹果币】比较: lastUpdateDate(${lastUpdateDate}) === todayDateStr(${todayDateStr}): ${lastUpdateDate === todayDateStr}`);
          console.log(`【苹果币】当前苹果币数量: ${currentAmount}`);
          
          if (lastUpdateDate !== todayDateStr) {
            // 更新苹果币数量和更新时间，明确使用NOW()函数
            const [updateResult] = await connection.query(
              'UPDATE community_apple_coins SET current_amount = current_amount + 5, total_collected = total_collected + 5, updated_at = NOW() WHERE user_id = ?',
              [userId]
            );
            
            currentAmount += 5;
            totalCollected += 5;
            
            console.log(`【苹果币更新】用户 ${userId} 获得了每日5个苹果币，当前总数: ${currentAmount}`);
            console.log(`【苹果币更新】影响行数: ${updateResult.affectedRows}`);
          } else {
            console.log(`【苹果币未更新】用户 ${userId} 今天(${todayDateStr})已经获得过苹果币，当前总数: ${currentAmount}`);
          }
          
          // 在返回数据中加入上次更新日期，方便前端显示
          coinData = {
            ...coins[0],
            current_amount: currentAmount,
            total_collected: totalCollected,
            updated_at: coins[0].updated_at, // 保持原始时间戳不变
            last_update_date: lastUpdateDate // 返回给前端
          };
        }
        
        await connection.commit();
        return coinData;
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });
    
    res.json(result);
  } catch (error) {
    console.error('获取苹果币信息失败:', error);
    res.status(500).json({ error: '获取苹果币信息失败' });
  }
});

// 获取题目苹果数量
app.get('/api/community/question-apples', async (req, res) => {
  try {
    const { questionId, questionType } = req.query;
    
    if (!questionId || !questionType) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const result = await executeWithRetry(async (connection) => {
      const [rows] = await connection.query(
        `SELECT SUM(apples_count) AS totalApples 
         FROM community_question_apples 
         WHERE question_id = ? AND question_type = ?`,
        [questionId, questionType]
      );
      
      return { totalApples: rows[0]?.totalApples || 0 };
    });
    
    res.json(result);
  } catch (error) {
    console.error('获取题目苹果数量失败:', error);
    res.status(500).json({ error: '获取题目苹果数量失败' });
  }
});

// 投喂苹果
app.post('/api/community/feed-apples', async (req, res) => {
  try {
    const { userId, questionId, questionType, applesCount } = req.body;
    
    if (!userId || !questionId || !questionType || !applesCount) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查数量是否有效
    if (applesCount <= 0 || applesCount > 5) {
      return res.status(400).json({ error: '苹果数量无效，必须在1-5之间' });
    }
    
    // 检查服务器当前时区和时间
    const serverTime = new Date();
    const serverTimeZone = -serverTime.getTimezoneOffset() / 60;
    const todayDateStr = serverTime.toISOString().split('T')[0]; // 'YYYY-MM-DD'
    
    console.log(`【feed-apples】服务器时间: ${serverTime.toISOString()}`);
    console.log(`【feed-apples】服务器时区: UTC${serverTimeZone >= 0 ? '+' : ''}${serverTimeZone}`);
    console.log(`【feed-apples】今日日期字符串: ${todayDateStr}`);
    
    // 执行事务操作
    const result = await executeWithRetry(async (connection) => {
      await connection.beginTransaction();
      
      try {
        // 检查用户苹果币余额，使用DATE_FORMAT确保获取的是字符串格式
        const [userCoins] = await connection.query(
          'SELECT current_amount, DATE_FORMAT(updated_at, "%Y-%m-%d") AS last_update_date FROM community_apple_coins WHERE user_id = ?',
          [userId]
        );
        
        let currentAmount = 0;
        let lastUpdateDate = null;
        
        if (userCoins.length === 0) {
          // 如果用户没有苹果币记录，创建一个
          await connection.query(
            'INSERT INTO community_apple_coins (user_id, current_amount, total_collected, updated_at) VALUES (?, 5, 5, NOW())',
            [userId]
          );
          currentAmount = 5; // 新用户有5个初始苹果币
          console.log(`【feed-apples】新用户 ${userId} 获得初始5个苹果币`);
        } else {
          // 获取上次更新日期和当前金额
          currentAmount = userCoins[0].current_amount;
          lastUpdateDate = userCoins[0].last_update_date;
          
          // console.log(`【feed-apples】用户 ${userId} 的苹果币信息:`);
          console.log(`【feed-apples】数据库上次更新日期: ${lastUpdateDate}`);
          console.log(`【feed-apples】当前日期: ${todayDateStr}`);
          console.log(`【feed-apples】比较结果: ${lastUpdateDate === todayDateStr}`);
          // console.log(`【feed-apples】当前苹果币数量: ${currentAmount}`);
          
          // 如果最后更新时间不是今天，增加5个苹果币
          if (lastUpdateDate !== todayDateStr) {
            // 如果不是今天，增加5个苹果币并更新时间戳
            const [updateResult] = await connection.query(
              'UPDATE community_apple_coins SET current_amount = current_amount + 5, total_collected = total_collected + 5, updated_at = NOW() WHERE user_id = ?',
              [userId]
            );
            currentAmount += 5;
            console.log(`【feed-apples】用户 ${userId} 获得了每日5个苹果币，当前总数: ${currentAmount}`);
            // console.log(`【feed-apples】影响行数: ${updateResult.affectedRows}`);
          } else {
            console.log(`【feed-apples】用户 ${userId} 今天(${todayDateStr})已经获得过苹果币，当前总数: ${currentAmount}`);
          }
        }
        
        // 检查用户是否有足够的苹果币
        if (currentAmount < applesCount) {
          await connection.rollback();
          return { error: '苹果币不足' };
        }
        
        // 更新用户苹果币数量
        await connection.query(
          'UPDATE community_apple_coins SET current_amount = current_amount - ? WHERE user_id = ?',
          [applesCount, userId]
        );
        currentAmount -= applesCount;
        console.log(`【feed-apples】用户 ${userId} 消耗${applesCount}个苹果币投喂，剩余: ${currentAmount}`);
        
        // 记录苹果币使用
        const [appleResult] = await connection.query(
          `INSERT INTO community_question_apples 
           (user_id, question_id, question_type, apples_count) 
           VALUES (?, ?, ?, ?)`,
          [userId, questionId, questionType, applesCount]
        );
        console.log(`【feed-apples】记录投喂到community_question_apples, ID: ${appleResult.insertId}, 数量: ${applesCount}`);
        
        // 提交事务
        await connection.commit();
        
        // 查询最新的题目苹果总数
        const [newTotal] = await connection.query(
          `SELECT SUM(apples_count) AS totalApples 
           FROM community_question_apples 
           WHERE question_id = ? AND question_type = ?`,
          [questionId, questionType]
        );
        
        return {
          success: true,
          message: '投喂成功',
          remainingApples: currentAmount,
          totalApples: newTotal[0]?.totalApples || applesCount
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });
    
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('投喂苹果失败:', error);
    res.status(500).json({ error: '投喂苹果失败' });
  }
});

// 题目评分接口
app.post('/api/community/rate-question', async (req, res) => {
  try {
    // 获取请求参数
    const { userId, questionId, questionType, rating, teacherId } = req.body;
    
    // 检查必要参数
    if (!userId || !questionId || !questionType || !rating) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查评分范围 (1-5)
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: '评分必须在1-5之间' });
    }
    
    // 检查服务器当前时区和时间
    const serverTime = new Date();
    const serverTimeZone = -serverTime.getTimezoneOffset() / 60;
    const todayDateStr = serverTime.toISOString().split('T')[0]; // 'YYYY-MM-DD'
    
    console.log(`【rate-question】服务器时间: ${serverTime.toISOString()}`);
    console.log(`【rate-question】服务器时区: UTC${serverTimeZone >= 0 ? '+' : ''}${serverTimeZone}`);
    console.log(`【rate-question】今日日期字符串: ${todayDateStr}`);
    // console.log(`【rate-question】请求参数: userId=${userId}, questionId=${questionId}, questionType=${questionType}, rating=${rating}, teacherId=${teacherId || '未指定'}`);
    
    // 执行事务操作
    const result = await executeWithRetry(async (connection) => {
      await connection.beginTransaction();
      
      try {
        // 检查用户苹果币余额，使用DATE_FORMAT确保获取的是字符串格式
        const [userCoins] = await connection.query(
          'SELECT current_amount, DATE_FORMAT(updated_at, "%Y-%m-%d") AS last_update_date FROM community_apple_coins WHERE user_id = ?',
          [userId]
        );
        
        let currentAmount = 0;
        let lastUpdateDate = null;
        
        if (userCoins.length === 0) {
          // 如果用户没有苹果币记录，创建一个
          await connection.query(
            'INSERT INTO community_apple_coins (user_id, current_amount, total_collected, updated_at) VALUES (?, 5, 5, NOW())',
            [userId]
          );
          currentAmount = 5; // 新用户有5个初始苹果币
          // console.log(`【rate-question】新用户 ${userId} 获得初始5个苹果币`);
        } else {
          // 获取上次更新日期和当前金额
          currentAmount = userCoins[0].current_amount;
          lastUpdateDate = userCoins[0].last_update_date;
          
          // console.log(`【rate-question】用户 ${userId} 的苹果币信息:`);
          // console.log(`【rate-question】数据库上次更新日期: ${lastUpdateDate}`);
          // console.log(`【rate-question】当前日期: ${todayDateStr}`);
          // console.log(`【rate-question】比较结果: ${lastUpdateDate === todayDateStr}`);
          // console.log(`【rate-question】当前苹果币数量: ${currentAmount}`);
          
          // 如果最后更新时间不是今天，增加5个苹果币
          if (lastUpdateDate !== todayDateStr) {
            // 如果不是今天，增加5个苹果币并更新时间戳
            const [updateResult] = await connection.query(
              'UPDATE community_apple_coins SET current_amount = current_amount + 5, total_collected = total_collected + 5, updated_at = NOW() WHERE user_id = ?',
              [userId]
            );
            currentAmount += 5;
            console.log(`【rate-question】用户 ${userId} 获得了每日5个苹果币，当前总数: ${currentAmount}`);
            console.log(`【rate-question】影响行数: ${updateResult.affectedRows}`);
          } else {
            console.log(`【rate-question】用户 ${userId} 今天(${todayDateStr})已经获得过苹果币，当前总数: ${currentAmount}`);
          }
        }
        
        // 检查用户是否有足够的苹果币
        if (currentAmount < 1) {
          await connection.rollback();
          return { error: '苹果币不足，需要至少1个苹果币进行评分' };
        }
        
        // 检查用户是否已经评分过这个题目（根据配置决定是否允许重复评分）
        if (!CONFIG.ALLOW_DUPLICATE_RATINGS) {
          const [existingUserRating] = await connection.query(
            `SELECT id FROM community_question_apples 
             WHERE user_id = ? AND question_id = ? AND question_type = ?`,
            [userId, questionId, questionType]
          );
          
          if (existingUserRating.length > 0) {
            await connection.rollback();
            return { error: '您已经评分过此题目' };
          }
        }
        
        // 更新用户苹果币数量（每次评分消耗1个苹果币）
        await connection.query(
          'UPDATE community_apple_coins SET current_amount = current_amount - 1 WHERE user_id = ?',
          [userId]
        );
        currentAmount -= 1; // 减去使用的1个苹果币
        console.log(`【rate-question】用户 ${userId} 消耗1个苹果币评分，剩余: ${currentAmount}`);
        
        // 记录这次评分到community_question_apples表
        const [appleResult] = await connection.query(
          `INSERT INTO community_question_apples 
           (user_id, question_id, question_type, apples_count) 
           VALUES (?, ?, ?, ?)`,
          [userId, questionId, questionType, rating]
        );
        console.log(`【rate-question】记录评分到community_question_apples, ID: ${appleResult.insertId}, 评分: ${rating}`);
        
        // 查询指定教师ID或获取默认教师ID
        let targetTeacherId = teacherId;
        if (!targetTeacherId) {
          console.log(`【rate-question】未指定教师ID，获取默认教师ID`);
          const [defaultTeacher] = await connection.query(`SELECT id FROM teachers LIMIT 1`);
          if (defaultTeacher.length > 0) {
            targetTeacherId = defaultTeacher[0].id;
            console.log(`【rate-question】使用默认教师ID: ${targetTeacherId}`);
          } else {
            targetTeacherId = 11; // 如果没有找到教师，使用ID为11的教师作为默认值
            console.log(`【rate-question】未找到教师记录，使用硬编码的教师ID: ${targetTeacherId}`);
          }
        }
        
        // 获取该题目的评分统计数据，确保拿到的是最新的数据
        const [ratings] = await connection.query(
          `SELECT 
             COUNT(*) as student_count,
             SUM(apples_count) as apple_count,
             AVG(apples_count) as avg_rating
           FROM community_question_apples 
           WHERE question_id = ? AND question_type = ?`,
          [questionId, questionType]
        );
        
        const totalRating = parseInt(ratings[0]?.apple_count || 0);
        const ratingCount = parseInt(ratings[0]?.student_count || 0);
        const averageRating = parseFloat(ratings[0]?.avg_rating || 0);
        
        console.log(`【rate-question】题目评分统计 - 总评分: ${totalRating}, 评分人数: ${ratingCount}, 平均分: ${averageRating}`);
        
        // 查询该题目在teachers_selected_questions表中是否存在指定教师的记录
        const [existingRating] = await connection.query(
          `SELECT id, student_rating_total, student_rating_count, average_rating 
           FROM teachers_selected_questions 
           WHERE teacher_id = ? AND question_id = ? AND question_type = ?`,
          [targetTeacherId, questionId, questionType]
        );
        
        // 记录新的评分
        if (existingRating.length > 0) {
          // 该题目存在记录，更新评分
          const recordId = existingRating[0].id;
          
          // 更新数据库，使用从community_question_apples获取的最新数据
          const [updateResult] = await connection.query(
            `UPDATE teachers_selected_questions 
             SET student_rating_total = ?, 
                 student_rating_count = ?, 
                 average_rating = ?,
                 last_refreshed = NOW()
             WHERE id = ?`,
            [totalRating, ratingCount, averageRating, recordId]
          );
          // console.log(`【rate-question】更新题目评分, 记录ID: ${recordId}, 教师ID: ${targetTeacherId}, 新总分: ${totalRating}, 新评分人数: ${ratingCount}, 新平均分: ${averageRating}`);
          // console.log(`【rate-question】影响行数: ${updateResult.affectedRows}`);
        } else {
          // 没有找到记录，创建新记录
          const [insertResult] = await connection.query(
            `INSERT INTO teachers_selected_questions 
             (teacher_id, question_id, question_type, student_rating_total, 
              student_rating_count, average_rating, subject, grade, year, question_folder_or_id) 
             VALUES (?, ?, ?, ?, ?, ?, '', '', '', ?)`,
            [targetTeacherId, questionId, questionType, totalRating, ratingCount, averageRating, questionId.toString()]
          );
          // console.log(`【rate-question】为教师ID: ${targetTeacherId} 创建题目评分记录, ID: ${insertResult.insertId}`);
        }
        
        // 提交事务
        await connection.commit();
        
        return {
          success: true,
          message: '评分成功',
          remainingApples: currentAmount
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });
    
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('评分失败:', error);
    res.status(500).json({ error: '评分失败，请稍后再试' });
  }
});

// 获取题目评分
app.get('/api/community/question-rating', async (req, res) => {
  try {
    const { questionId, questionType, userId } = req.query;
    
    if (!questionId || !questionType) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 查询评分数据（直接从community_question_apples表获取）
    const [ratings] = await pool.execute(
      `SELECT 
         COUNT(*) as rating_count,
         AVG(apples_count) as rating
       FROM community_question_apples 
       WHERE question_id = ? AND question_type = ?`,
      [questionId, questionType]
    );
    
    let hasRated = false;
    
    // 如果提供了userId，检查用户是否已评分
    if (userId) {
      const [userRating] = await pool.execute(
        `SELECT COUNT(*) as count 
         FROM community_question_apples 
         WHERE question_id = ? AND question_type = ? AND user_id = ?`,
        [questionId, questionType, userId]
      );
      hasRated = userRating[0].count > 0;
    }
    
    // 格式化评分结果
    const rating = parseFloat(ratings[0]?.rating || 0);
    const ratingCount = parseInt(ratings[0]?.rating_count || 0);
    
    // 记录查询结果
    console.log(`【question-rating】查询题目评分, 题目ID: ${questionId}, 类型: ${questionType}`);
    console.log(`【question-rating】平均评分: ${rating}, 评分人数: ${ratingCount}`);
    console.log(`【question-rating】用户ID: ${userId || '未提供'}, 是否已评分: ${hasRated}`);
    
    res.json({
      rating: rating,
      ratingCount: ratingCount,
      hasRated
    });
  } catch (error) {
    console.error('获取题目评分失败:', error);
    res.status(500).json({ error: '获取题目评分失败' });
  }
});

// 获取系统配置
app.get('/api/community/config', async (req, res) => {
  try {
    res.json({
      allowDuplicateRatings: CONFIG.ALLOW_DUPLICATE_RATINGS
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    res.status(500).json({ error: '获取配置失败' });
  }
});

// 更新系统配置（需要管理员权限）
app.post('/api/community/config', async (req, res) => {
  try {
    const { allowDuplicateRatings } = req.body;
    const authHeader = req.headers.authorization;
    
    // 简单的管理员权限检查
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权操作' });
    }
    
    // 在实际项目中应该验证token并检查管理员权限
    // 这里为了演示简化处理
    if (typeof allowDuplicateRatings === 'boolean') {
      CONFIG.ALLOW_DUPLICATE_RATINGS = allowDuplicateRatings;
      console.log(`系统配置已更新: ALLOW_DUPLICATE_RATINGS = ${allowDuplicateRatings}`);
      
      return res.json({
        success: true,
        message: '配置已更新',
        config: {
          allowDuplicateRatings: CONFIG.ALLOW_DUPLICATE_RATINGS
        }
      });
    }
    
    res.status(400).json({ error: '无效的配置参数' });
  } catch (error) {
    console.error('更新配置失败:', error);
    res.status(500).json({ error: '更新配置失败' });
  }
});

// 导入用户角色映射模块和axios
const userRoleMapping = require('./db/userRoleMapping');
const axios = require('axios');

// 初始化管理员账号
async function initAdminAccount() {
  try {
    // 检查是否已存在管理员
    const [existingAdmins] = await pool.execute(
      'SELECT COUNT(*) as count FROM community_user_roles WHERE role = "admin"'
    );
    
    if (existingAdmins[0].count > 0) {
      console.log('管理员账号已存在，无需创建');
      return;
    }
    
    const password = process.env.DEFAULT_ADMIN_PASSWORD;
    if (!password) {
      console.warn('未配置 DEFAULT_ADMIN_PASSWORD，跳过管理员初始化');
      return;
    }
    const adminData = {
      name: '系统管理员',
      email: 'admin@community.system',
      school: '系统',
      studentId: 'ADMIN001',
      gender: '男',
      phone: '',
      wechat: ''
    };
    
    let teacherUserId = null;
    let adminUserId = null;
    
    // 先检查学生端用户是否已存在，避免后续创建失败
    try {
      const [existingUsers] = await pool.execute(
        'SELECT * FROM users WHERE email = ? OR studentId = ?',
        [adminData.email, adminData.studentId]
      );
      
      if (existingUsers.length > 0) {
        // 使用现有用户
        adminUserId = existingUsers[0].id;
        console.log(`使用现有用户ID ${adminUserId} 作为管理员`);
      }
    } catch (error) {
      console.error('检查学生端管理员账号失败:', error);
      // 继续执行，尝试创建教师端账号
    }
    
    // 尝试创建或获取教师端管理员账号
    try {
      // 如果已经有学生端账号，尝试查找对应的教师端账号
      if (adminUserId) {
        const teacherMapping = await userRoleMapping.getTeacherUserIdByStudentUserId(adminUserId);
        if (teacherMapping && teacherMapping.teacherUserId) {
          teacherUserId = teacherMapping.teacherUserId;
          console.log(`找到学生端用户ID ${adminUserId} 对应的教师端用户ID: ${teacherUserId}`);
        }
      }
      
      // 如果没有找到对应的教师端账号，尝试创建新账号
      if (!teacherUserId) {
        try {
          const teacherResponse = await axios.post('http://localhost:3002/register', {
            name: adminData.name,
            gender: adminData.gender,
            teacher_id: adminData.studentId,
            phone: adminData.phone,
            email: adminData.email,
            wechat: adminData.wechat,
            school: adminData.school,
            password: password, // 使用明文密码，因为教师端会自己加密
            role: 'admin' // 指定为管理员角色
          });
          
          if (teacherResponse.data && teacherResponse.data.id) {
            teacherUserId = teacherResponse.data.id;
            console.log(`创建了教师端管理员账号，ID: ${teacherUserId}`);
          }
        } catch (teacherError) {
          // 如果错误信息包含重复键的提示，可能是账号已存在
          if (teacherError.response && teacherError.response.data && 
              (teacherError.response.data.error.includes('已存在') || 
               teacherError.response.data.error.includes('duplicate'))) {
            console.log('教师端管理员账号已存在，尝试获取现有账号ID');
            // 这里可以添加获取现有教师账号ID的逻辑，但目前简化处理
          } else {
            console.error('在教师端创建管理员账号失败:', teacherError.message);
          }
        }
      }
    } catch (error) {
      console.error('处理教师端管理员账号失败:', error);
      // 继续执行，尝试创建或使用学生端账号
    }
    
    // 如果还没有学生端账号，尝试创建
    if (!adminUserId) {
      try {
        // 加密密码用于学生端账号
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        try {
          const [result] = await pool.execute(
            'INSERT INTO users (name, email, school, studentId, password) VALUES (?, ?, ?, ?, ?)',
            [adminData.name, adminData.email, adminData.school, adminData.studentId, hashedPassword]
          );
          
          adminUserId = result.insertId;
          console.log(`创建了新管理员用户，ID: ${adminUserId}`);
        } catch (insertError) {
          // 如果插入失败（例如因为重复键），再次尝试获取现有用户
          if (insertError.code === 'ER_DUP_ENTRY') {
            console.log(`创建管理员账号失败，可能是并发操作导致的重复键，尝试获取现有账号`);
            const [users] = await pool.execute(
              'SELECT * FROM users WHERE studentId = ?',
              [adminData.studentId]
            );
            
            if (users.length > 0) {
              adminUserId = users[0].id;
              console.log(`找到并使用现有用户ID ${adminUserId} 作为管理员`);
            } else {
              console.error(`无法创建或找到管理员账号: ${insertError.message}`);
              return; // 如果无法获取学生端账号，则退出初始化
            }
          } else {
            console.error(`创建学生端账号失败: ${insertError.message}`);
            return; // 如果是其他错误，退出初始化
          }
        }
      } catch (error) {
        console.error('创建学生端管理员账号失败:', error);
        return; // 如果创建失败，退出初始化
      }
    }
    
    // 确保我们有有效的学生端账号ID才继续处理
    if (!adminUserId) {
      console.error('无法获取有效的学生端管理员账号ID，无法完成初始化');
      return;
    }
    
    try {
      // 检查该用户是否已经在community_user_roles表中有管理员角色
      const [existingRoles] = await pool.execute(
        'SELECT * FROM community_user_roles WHERE user_id = ? AND role = "admin"',
        [adminUserId]
      );
      
      if (existingRoles.length > 0) {
        console.log(`用户ID ${adminUserId} 已有管理员角色，无需重新分配`);
        
        // 如果需要更新teacher_id，可以在这里进行
        if (teacherUserId && existingRoles[0].teacher_id !== teacherUserId) {
          await pool.execute(
            'UPDATE community_user_roles SET teacher_id = ? WHERE id = ?',
            [teacherUserId, existingRoles[0].id]
          );
          console.log(`已更新管理员角色记录的teacher_id为 ${teacherUserId}`);
        }
      } else {
        // 分配管理员角色，同时存储学生端ID和教师端ID
        await pool.execute(
          'INSERT INTO community_user_roles (user_id, role, teacher_id) VALUES (?, ?, ?)',
          [adminUserId, 'admin', teacherUserId]
        );
        console.log(`为用户ID ${adminUserId} 分配了管理员角色`);
      }
      
      // 检查用户角色映射关系是否已存在
      if (teacherUserId && adminUserId) {
        try {
          // 先检查映射是否已存在
          const mappingExists = await userRoleMapping.getStudentUserIdByTeacherUserId(teacherUserId) || 
                                await userRoleMapping.getTeacherUserIdByStudentUserId(adminUserId);
          
          if (mappingExists) {
            console.log(`教师端ID和学生端ID的映射关系已存在，无需创建`);
          } else {
            // 创建用户角色映射关系
            await userRoleMapping.createUserRoleMapping(teacherUserId, adminUserId, 'admin');
            console.log(`建立了教师端ID ${teacherUserId} 和学生端ID ${adminUserId} 的映射关系`);
          }
        } catch (mappingError) {
          console.error('创建用户角色映射关系失败:', mappingError);
          // 映射失败不影响整体流程
        }
      } else {
        console.log('缺少教师端ID或学生端ID，无法创建映射关系');
      }
    } catch (roleError) {
      console.error('设置管理员角色失败:', roleError);
      // 角色设置失败，但账号可能已创建
    }
    
    console.log('管理员账号初始化成功');
  } catch (error) {
    console.error('初始化管理员账号失败:', error);
  }
}

// 初始化数据库并启动服务器
initDatabase()
  .then(initAdminAccount)
  .then(() => {
    const PORT = process.env.COMMUNITY_PORT || 3003;
    app.listen(PORT, () => {
      console.log(`社区服务器运行在端口 ${PORT}`);
    });
  })
  .catch(err => {
    console.error('启动社区服务器失败:', err);
  });