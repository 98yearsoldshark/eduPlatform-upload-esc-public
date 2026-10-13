// 先加载私有运行配置，禁止在源码中保存凭据。
require('./config/runtime');
// 从环境变量加载本地运行配置，公开仓库不保存真实凭据。

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const bcrypt = require('bcrypt'); // 用于密码加密
const jwt = require('jsonwebtoken'); // 用于生成JWT令牌

// 路径前缀常量，方便统一管理和调试
const PATH_PREFIXES = {
  LATEX: ['/latex/', 'latex/'],
  PRTSC: ['/prtsc/', 'prtsc/'],
  // 可以在此添加其他类型的前缀
};

// 路径工具函数
const pathUtils = {
  // 将各种格式的路径标准化为litepath（轻量路径）
  toLitePath: (originalPath) => {
    if (!originalPath) return '';
    
    console.log('标准化路径前:', originalPath);
    
    // 计算斜杠数量
    const slashCount = (originalPath.match(/\//g) || []).length;
    let litePath = originalPath;
    
    // 处理起始没有斜杠的情况
    const hasLeadingSlash = originalPath.startsWith('/');
    
    // 案例1: "prtsc/数学/大一/2022/期中考试/20220320T115848" - 无前导斜杠，5个斜杠
    if (!hasLeadingSlash && slashCount >= 5) {
      // 删除第一个字段（通常是prtsc或latex）
      const firstSlashIndex = litePath.indexOf('/');
      if (firstSlashIndex !== -1) {
        litePath = '/' + litePath.substring(firstSlashIndex + 1);
      }
    } 
    // 案例2: "/prtsc/电磁场/大一/2019/A卷/20250418T200144" - 有前导斜杠，6个斜杠
    else if (hasLeadingSlash && slashCount >= 6) {
      // 删除前两个字段（通常是/prtsc或/latex）
      const secondSlashIndex = litePath.indexOf('/', 1);
      if (secondSlashIndex !== -1) {
        litePath = litePath.substring(secondSlashIndex);
      }
    }
    // 案例3: "/线性代数/大一/2019/A卷/20250320T151711" - 已经是标准格式，无需处理
    
    // 确保开头有斜杠
    if (!litePath.startsWith('/')) {
      litePath = '/' + litePath;
    }
    
    console.log('标准化路径后:', litePath);
    return litePath;
  },
  
  // 从litepath生成可能的完整路径格式（用于查询）
  getPossiblePaths: (litePath) => {
    if (!litePath) return [];
    
    const paths = [];
    // 添加原始的litePath
    paths.push(litePath);
    
    // 添加可能的LATEX前缀路径
    PATH_PREFIXES.LATEX.forEach(prefix => {
      // 添加前缀，确保路径格式正确
      const latexPath = prefix + (litePath.startsWith('/') ? litePath.substring(1) : litePath);
      paths.push(latexPath);
    });
    
    // 添加可能的PRTSC前缀路径
    PATH_PREFIXES.PRTSC.forEach(prefix => {
      // 添加前缀，确保路径格式正确
      const prtscPath = prefix + (litePath.startsWith('/') ? litePath.substring(1) : litePath);
      paths.push(prtscPath);
    });
    
    return paths;
  }
};

const app = express();

// JWT密钥配置 - 在实际生产环境中应使用环境变量存储此密钥
const JWT_SECRET = require('./config/runtime').requireEnv('JWT_SECRET');

// 引入swagger文档
const swagger = require('./swagger');
const uploadHandler = require('./uploadHandler');
// 引入LaTeX数据库操作模块
const latexQueries = require('./db/latexQueries');
// 引入腾讯OCR路由
const questionTXocrRouter = require('./routes/questionTXocr');
// 引入测试功能路由
const testFunctionRouter = require('./safe-teachsever/test-function/routes');

swagger(app);
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// 注册腾讯OCR路由
app.use('/api/tx-ocr', questionTXocrRouter);
app.use('/api/doubao', require('./routes/doubao'));

// 注册测试功能路由
app.use('/api/test-function', testFunctionRouter);

// 提供静态文件访问
app.use('/prtsc', express.static(path.join(__dirname, 'prtsc')));

// 创建数据库连接池
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'cxsjdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 将连接池设置为应用程序的局部变量，以便在中间件中使用
app.locals.pool = pool;

// 用户模型
const userSchema = {
  id: { type: 'INT', primaryKey: true, autoIncrement: true },
  phone: { type: 'VARCHAR(20)' },
  email: { type: 'VARCHAR(255)' },
  school: { type: 'VARCHAR(255)' },
  classNumber: { type: 'VARCHAR(50)' },
  studentId: { type: 'VARCHAR(50)', unique: true },
  name: { type: 'VARCHAR(100)' },
  wechat: { type: 'VARCHAR(100)' },
  password: { type: 'VARCHAR(255)' }, // 添加密码字段
  registerTime: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
  lastLoginTime: { type: 'TIMESTAMP' }
};

// 创建用户表
const createUserTable = `CREATE TABLE IF NOT EXISTS users (
  ${Object.entries(userSchema)
    .map(([key, value]) => `${key} ${value.type}${value.primaryKey ? ' PRIMARY KEY' : ''}${value.autoIncrement ? ' AUTO_INCREMENT' : ''}${value.unique ? ' UNIQUE' : ''}${value.default ? ` DEFAULT ${value.default}` : ''}
`)
    .join(',')}
)`;

pool.query(createUserTable, (err) => {
  if (err) {
    console.error('Error creating users table:', err);
  } else {
    console.log('Users table created or already exists');
  }
});

// 初始化LaTeX题目表
latexQueries.initLatexTable()
  .then(() => {
    console.log('LaTeX questions table initialized');
  })
  .catch(err => {
    console.error('Failed to initialize LaTeX questions table:', err);
  });

// 设置服务器端口，优先使用环境变量中的PORT，否则使用3001
const PORT = process.env.PORT || 3001;

// 导入用户角色映射模块
const userRoleMapping = require('./community-server/db/userRoleMapping');

// 初始化用户角色映射表
userRoleMapping.initUserRoleMappingTable()
  .then(() => {
    console.log('用户角色映射表初始化成功');
  })
  .catch(err => {
    console.error('用户角色映射表初始化失败:', err);
  });

// 导入注册中间件
const { studentRegisterMiddleware, postRegistrationHandler } = require('./middleware/registerMiddleware');

// 用户登录
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }
  
  try {
    // 使用Promise版本的查询
    const [results] = await pool.promise().query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (results.length === 0) {
      return res.status(401).json({ error: '用户不存在' });
    }
    
    const user = results[0];
    
    // 验证密码
    // 如果用户没有密码字段（旧账户），则无法登录
    if (!user.password) {
      return res.status(401).json({ error: '账户未设置密码，请联系管理员重置' });
    }
    
    // 使用bcrypt验证密码
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: '密码错误' });
    }
    
    // 更新最后登录时间
    await pool.promise().query(
      'UPDATE users SET lastLoginTime = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );
    
    // 检查用户是否有特殊角色（教师、助教、管理员）
    const roleInfo = await userRoleMapping.getTeacherUserIdByStudentUserId(user.id);
    let role = 'student'; // 默认角色
    let teacherUserId = null;
    
    if (roleInfo) {
      role = roleInfo.role;
      teacherUserId = roleInfo.teacherUserId;
    }
    
    // 创建用户信息对象，用于JWT payload
    const userForToken = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: role,
      teacherUserId: teacherUserId
    };
    
    // 创建JWT令牌
    const jwtToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '24h' });
    
    // 为了兼容原有系统，同时创建旧版JSON格式的令牌
    const legacyToken = JSON.stringify({ 
      user: {
        ...user,
        role: role,
        teacherUserId: teacherUserId
      } 
    });
    
    // 不返回密码字段
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({ 
      message: '登录成功', 
      token: jwtToken, // 使用新的JWT令牌
      legacyToken: legacyToken, // 保留旧令牌供兼容
      user: {
        ...userWithoutPassword,
        role: role,
        teacherUserId: teacherUserId
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败', details: error.message });
  }
});

// 用户注册
app.post('/register', studentRegisterMiddleware, async (req, res) => {
  const { phone, email, password, school, classNumber, studentId, name, wechat, isFromTeacher = false } = req.body;
  
  // 对从教师端创建的账号使用不同的验证规则
  if (!isFromTeacher && (!phone || !email || !password)) {
    return res.status(400).json({ error: '手机号、邮箱和密码不能为空' });
  }
  
  // 对所有账号都要求密码
  if (!password) {
    return res.status(400).json({ error: '密码不能为空' });
  }
  
  try {
    // 检查是否已存在相同studentId的用户
    if (studentId) {
      const [existingUsers] = await pool.promise().query(
        'SELECT id FROM users WHERE studentId = ?',
        [studentId]
      );
      
      if (existingUsers.length > 0) {
        return res.status(400).json({ error: '该学号已被注册，请使用其他学号' });
      }
    }
    
    // 加密密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // 使用Promise版本的查询
    const [result] = await pool.promise().query(
      'INSERT INTO users SET ?', 
      { phone, email, school, classNumber, studentId, name, wechat, password: hashedPassword }
    );
    
    // 获取新创建用户的ID
    const userId = result.insertId;
    
    // 为新用户创建题库表
    const createUserQuestionTable = `CREATE TABLE IF NOT EXISTS user_questions_${userId} (
      id INT PRIMARY KEY AUTO_INCREMENT,
      question_path VARCHAR(255) NOT NULL,
      attempt_count INT DEFAULT 1,
      answer_content TEXT,
      correctness ENUM('correct', 'partially_correct', 'incorrect') DEFAULT 'correct',
      answer_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
    
    await pool.promise().query(createUserQuestionTable);
    console.log(`Question table for user ${userId} created successfully`);
    
    // 如果不是由教师端自动创建的账号，则设置为普通学生角色
    // 注意：教师端创建的账号会在教师端注册时自动设置角色
    if (!isFromTeacher) {
      // 检查是否有教师账号使用相同的邮箱或学号
      try {
        const [teachers] = await pool.promise().query(
          'SELECT id FROM teachers WHERE email = ? OR teacher_id = ?',
          [email, studentId]
        );
        
        if (teachers.length > 0) {
          // 如果找到了匹配的教师账号，创建映射关系
          await userRoleMapping.createUserRoleMapping(teachers[0].id, userId, 'teacher');
        }
      } catch (mappingError) {
        console.error('检查教师账号失败:', mappingError);
        // 不影响主流程，继续执行
      }
    }
    
    // 应用注册后处理中间件逻辑
    req.registeredUserId = userId;
    postRegistrationHandler(req, res, () => {
      res.json({ message: '注册成功', userId: userId });
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '注册失败', details: error.message });
  }
});

// 导入认证中间件
const { authenticateStudent } = require('./middleware/authMiddleware');
const { studentRoleAuth } = require('./middleware/roleAuth');

// 获取所有用户 - 需要管理员或教师权限
app.get('/users', authenticateStudent, studentRoleAuth(['admin', 'teacher', 'assistant']), async (req, res) => {
  try {
    const [results] = await pool.promise().query('SELECT * FROM users');
    res.json(results);
  } catch (err) {
    console.error('获取用户列表失败:', err);
    return res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 重置用户密码 - 需要管理员权限
app.post('/users/:id/reset-password', authenticateStudent, studentRoleAuth(['admin', 'teacher']), async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ error: '新密码不能为空' });
    }
    
    // 检查用户是否存在
    const [users] = await pool.promise().query('SELECT * FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 加密新密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // 更新密码
    await pool.promise().query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );
    
    res.json({ message: '用户密码重置成功' });
  } catch (err) {
    console.error('重置用户密码失败:', err);
    return res.status(500).json({ error: '重置用户密码失败' });
  }
});

// 删除用户 - 需要管理员权限
app.delete('/users/:id', authenticateStudent, studentRoleAuth(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 检查是否尝试删除映射用户（教师、助教、管理员）
    const roleInfo = await userRoleMapping.getTeacherUserIdByStudentUserId(userId);
    if (roleInfo) {
      return res.status(403).json({ error: '无法删除教师、助教或管理员账号，请在教师端操作' });
    }
    
    const [results] = await pool.promise().query('DELETE FROM users WHERE id = ?', [userId]);
    
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 删除用户的题库表
    try {
      await pool.promise().query(`DROP TABLE IF EXISTS user_questions_${userId}`);
    } catch (dropError) {
      console.error(`删除用户题库表失败: ${dropError.message}`);
      // 不影响主流程
    }
    
    // 返回成功信息，并包含操作者身份和允许的角色列表
    res.json({ 
      message: '用户删除成功',
      operator: {
        id: req.user.id,
        role: req.user.role,
        name: req.user.name
      },
      allowedRoles: ['admin']
    });
  } catch (err) {
    console.error('删除用户失败:', err);
    return res.status(500).json({ error: '删除用户失败' });
  }
});

// 更新用户信息 - 需要认证，普通用户只能更新自己的信息
app.put('/users/:id', authenticateStudent, async (req, res) => {
  try {
    const userId = req.params.id;
    const { phone, email, school, classNumber, studentId, name, wechat } = req.body;
    
    // 检查权限：只有管理员、教师或本人可以更新用户信息
    const isAdmin = req.user.role === 'admin';
    const isTeacher = req.user.role === 'teacher';
    const isOwnAccount = req.user.id === parseInt(userId);
    
    if (!isAdmin && !isTeacher && !isOwnAccount) {
      return res.status(403).json({ error: '权限不足，您只能更新自己的信息' });
    }
    
    // 检查是否尝试更新映射用户（教师、助教、管理员）的关键信息
    if (!isOwnAccount) {
      const roleInfo = await userRoleMapping.getTeacherUserIdByStudentUserId(userId);
      if (roleInfo && (email || studentId)) {
        return res.status(403).json({ 
          error: '无法修改教师、助教或管理员的关键信息，请在教师端操作',
          allowedFields: ['phone', 'school', 'classNumber', 'name', 'wechat']
        });
      }
    }
    
    const [results] = await pool.promise().query(
      'UPDATE users SET ? WHERE id = ?', 
      [{ phone, email, school, classNumber, studentId, name, wechat }, userId]
    );
    
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ message: '用户信息更新成功' });
  } catch (err) {
    console.error('更新用户信息失败:', err);
    return res.status(500).json({ error: '更新用户信息失败' });
  }
});

// 引入用户答题相关路由
const userAnswersRouter = require('./routes/userAnswers');
// 引入打印正确答案相关路由
const printCorrectAnswerRouter = require('./routes/printCorrectAnswer');
// 引入用户个人资料相关路由
const userProfileRouter = require('./routes/userProfile');

// 使用用户答题相关路由
app.use('/user-answers', userAnswersRouter);

// 使用打印正确答案相关路由
app.use('/print-correct-answer', printCorrectAnswerRouter);

// 使用用户个人资料相关路由
app.use('/profile', userProfileRouter);

// 修改密码
app.put('/change-password', authenticateStudent, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '当前密码和新密码不能为空' });
  }
  
  try {
    // 获取当前用户信息
    const [users] = await pool.promise().query(
      'SELECT * FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = users[0];
    
    // 如果用户没有密码字段（旧账户），无法验证旧密码
    if (!user.password) {
      return res.status(400).json({ error: '账户未设置密码，请联系管理员重置' });
    }
    
    // 验证当前密码
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: '当前密码错误' });
    }
    
    // 加密新密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // 更新密码
    await pool.promise().query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, req.user.id]
    );
    
    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ error: '修改密码失败', details: error.message });
  }
});

// LaTeX题目相关API
// 获取所有LaTeX题目
app.get('/latex-questions', (req, res) => {
  const { subject, grade, year, type, id } = req.query;
  
  // 如果提供了id参数，尝试通过id查询
  if (id) {
    const queryId = parseInt(id, 10);
    pool.query('SELECT * FROM latex_questions WHERE id = ?', [queryId], (err, results) => {
      if (err) {
        console.error('Error fetching LaTeX question by ID:', err);
        return res.status(500).json({ error: '获取LaTeX题目失败' });
      }
      return res.json(results);
    });
    return;
  }
  
  // 如果有筛选条件，使用筛选查询
  if (subject || grade || year || type) {
    latexQueries.getLatexQuestionsByFilter({ subject, grade, year, type })
      .then(questions => {
        res.json(questions);
      })
      .catch(err => {
        console.error('Error fetching filtered LaTeX questions:', err);
        res.status(500).json({ error: '获取LaTeX题目失败' });
      });
  } else {
    // 否则获取所有题目
    latexQueries.getAllLatexQuestions()
      .then(questions => {
        res.json(questions);
      })
      .catch(err => {
        console.error('Error fetching all LaTeX questions:', err);
        res.status(500).json({ error: '获取LaTeX题目失败' });
      });
  }
});

// 检查LaTeX题目是否存在
app.get('/check-latex-exists', (req, res) => {
  const { path, id, litepath } = req.query;
  console.log('检查LaTeX题目是否存在, 参数:', { path, litepath, id });
  
  let pathsToTry = [];
  let standardLitePath = '';
  
  // 如果提供了path或litepath参数
  if (path || litepath) {
    // 优先使用litepath，如果没有则从path生成
    if (litepath) {
      standardLitePath = litepath.startsWith('/') ? litepath : `/${litepath}`;
      console.log('使用提供的litepath:', standardLitePath);
    } else if (path) {
      standardLitePath = pathUtils.toLitePath(path);
      console.log('从path生成litepath:', standardLitePath);
    }
    
    // 生成可能的完整路径列表
    pathsToTry = pathUtils.getPossiblePaths(standardLitePath);
    console.log('将尝试查询以下路径:', pathsToTry);
    
    // 首先尝试原始路径(如果提供了path)
    if (path && !pathsToTry.includes(path)) {
      pathsToTry.unshift(path); // 原始路径优先
    }
    
    // 开始查询流程
    queryLatexQuestionsByPaths(pathsToTry, id, standardLitePath)
      .then(result => {
        if (result.exists) {
          res.json({
            exists: true,
            id: result.id,
            data: result.data,
            litepath: standardLitePath,
            matchedPath: result.matchedPath
          });
        } else {
          res.json({
            exists: false,
            litepath: standardLitePath,
            triedPaths: pathsToTry
          });
        }
      })
      .catch(err => {
        console.error('检查LaTeX题目失败:', err);
        res.status(500).json({
          error: '检查LaTeX题目失败',
          details: err.message,
          litepath: standardLitePath
        });
      });
  }
  // 如果只提供了ID参数
  else if (id) {
    const queryId = parseInt(id, 10);
    pool.query('SELECT * FROM latex_questions WHERE id = ?', [queryId], (err, results) => {
      if (err) {
        console.error('通过ID查询LaTeX题目失败:', err);
        return res.status(500).json({ error: '获取LaTeX题目失败' });
      }
      
      if (results.length > 0) {
        console.log(`通过ID ${id}找到LaTeX题目`);
        // 生成litepath并返回
        const question = results[0];
        const generatedLitePath = pathUtils.toLitePath(question.latex_path);
        
        res.json({
          exists: true,
          id: question.id,
          data: question,
          litepath: generatedLitePath,
          matchedPath: question.latex_path
        });
      } else {
        console.log(`未找到ID为${id}的LaTeX题目`);
        res.json({ exists: false });
      }
    });
  } 
  // 如果没有提供任何参数
  else {
    res.status(400).json({ error: '请提供path、litepath或id参数' });
  }
});

// 辅助函数：按路径列表顺序查询LaTeX题目
async function queryLatexQuestionsByPaths(paths, id, litepath) {
  // 按顺序尝试所有路径
  for (const currentPath of paths) {
    try {
      console.log(`尝试查询路径: ${currentPath}`);
      const question = await latexQueries.getLatexQuestionByPath(currentPath);
      
      if (question) {
        console.log(`在路径 ${currentPath} 找到LaTeX题目，ID: ${question.id}`);
        return {
          exists: true,
          id: question.id,
          data: question,
          matchedPath: currentPath
        };
      }
    } catch (err) {
      console.error(`查询路径 ${currentPath} 失败:`, err);
      // 继续尝试下一个路径
    }
  }
  
  // 如果所有路径都没找到，尝试使用ID查询
  if (id) {
    try {
      const queryId = parseInt(id, 10);
      const [rows] = await pool.promise().query('SELECT * FROM latex_questions WHERE id = ?', [queryId]);
      
      if (rows && rows.length > 0) {
        console.log(`通过ID ${id}找到LaTeX题目`);
        return {
          exists: true,
          id: rows[0].id,
          data: rows[0],
          matchedPath: rows[0].latex_path
        };
      }
    } catch (err) {
      console.error(`通过ID ${id}查询失败:`, err);
      // ID查询失败，继续到返回未找到结果
    }
  }
  
  // 未找到任何匹配
  console.log(`未找到匹配的LaTeX题目 (litepath: ${litepath})`);
  return { exists: false };
}

// 根据路径获取特定LaTeX题目
app.get('/latex-questions/:path', (req, res) => {
  const latexPath = req.params.path;
  
  latexQueries.getLatexQuestionByPath(latexPath)
    .then(question => {
      if (!question) {
        return res.status(404).json({ error: 'LaTeX题目不存在' });
      }
      res.json(question);
    })
    .catch(err => {
      console.error('Error fetching LaTeX question:', err);
      res.status(500).json({ error: '获取LaTeX题目失败' });
    });
});
app.post('/submit-answer', (req, res) => {
  // 重定向到新的路由处理程序
  userAnswersRouter.handle({ ...req, url: '/submit', method: 'POST' }, res);
});

// 获取文件夹列表的路由处理程序
app.get('/folders', (req, res) => {
  // 从请求查询参数中解构获取科目、年份、类型和年级信息
  const { subject, year, type, grade } = req.query;
  // 构建基础路径，指向prtsc目录
  const basePath = path.join(__dirname, 'prtsc');
  console.log('请求参数:', { subject, year, type, grade });
  
  try {
    // 初始化存储文件夹信息的数组
    const folders = [];
    // 如果提供了特定科目参数
    if (subject) {
      // 构建特定科目的完整路径 - 按照目录结构：subject/grade/year/type
      const subjectPath = path.join(basePath, subject);
      // 检查科目路径是否存在
      if (fs.existsSync(subjectPath)) {
        // console.log('2:', subjectPath);
        // 如果提供了年级参数
        if (grade) {
          const gradePath = path.join(subjectPath, grade);
          if (fs.existsSync(gradePath)) {
            // console.log('3:', gradePath);
            // 如果提供了年份参数
            if (year) {
              const yearPath = path.join(gradePath, year);
              if (fs.existsSync(yearPath)) {
                // console.log('4:', yearPath);
                // 如果提供了类型参数
                if (type) {
                //   console.log('5:', type);
                  const typePath = path.join(yearPath, type);
                  if (fs.existsSync(typePath)) {
                    // 读取该类型目录下的所有文件夹
                    const subFolders = fs.readdirSync(typePath);
                    // console.log('subFolders:', subFolders);
                    // 遍历每个子文件夹
                    subFolders.forEach(folder => {
                      // 检查是否为目录
                      if (fs.statSync(path.join(typePath, folder)).isDirectory()) {
                        // 将文件夹信息添加到结果数组中
                        folders.push({
                          name: folder,
                          type: 'folder'
                        });
                      }
                    });
                  }
                } else {
                  // 如果没有提供类型参数，列出年份目录下的所有类型
                  const yearFolders = fs.readdirSync(yearPath);
                  yearFolders.forEach(folder => {
                    if (fs.statSync(path.join(yearPath, folder)).isDirectory()) {
                      folders.push({
                        name: folder,
                        type: 'folder'
                      });
                    }
                  });
                }
              }
            } else {
              // 如果没有提供年份参数，列出年级目录下的所有年份
              const gradeFolders = fs.readdirSync(gradePath);
              gradeFolders.forEach(folder => {
                if (fs.statSync(path.join(gradePath, folder)).isDirectory()) {
                  folders.push({
                    name: folder,
                    type: 'folder'
                  });
                }
              });
            }
          }
        } else {
          // 如果没有提供年级参数，列出科目目录下的所有年级
          const subjectFolders = fs.readdirSync(subjectPath);
          subjectFolders.forEach(folder => {
            if (fs.statSync(path.join(subjectPath, folder)).isDirectory()) {
              folders.push({
                name: folder,
                type: 'folder'
              });
            }
          });
        }
      }
    } else {
      // 如果没有提供科目参数，则读取所有科目目录
      if (fs.existsSync(basePath)) {
        const subjects = fs.readdirSync(basePath);
        console.log('所有科目目录:', subjects);
        // 遍历所有科目目录
        subjects.forEach(subject => {
          // 检查是否为目录
          const subjectFullPath = path.join(basePath, subject);
          if (fs.existsSync(subjectFullPath) && fs.statSync(subjectFullPath).isDirectory()) {
            // 将科目目录信息添加到结果数组中
            folders.push({
              name: subject,
              type: 'folder'
            });
          }
        });
      } else {
        console.error('基础路径不存在:', basePath);
      }
    }
    // 将文件夹列表作为JSON响应返回
    console.log('返回文件夹列表:', folders);
    res.json(folders);
  } catch (error) {
    // 如果发生错误，返回500状态码和错误信息
    console.error('获取文件夹列表失败:', error);
    res.status(500).json({ error: '获取文件夹列表失败', details: error.message });
  }
});

// 获取图片列表
app.get('/images', (req, res) => {
  const { folderPath } = req.query;
  console.log('请求图片路径:', folderPath);
  
  if (!folderPath) {
    return res.status(400).json({ error: '缺少必要参数 folderPath' });
  }
  
  const fullPath = path.join(__dirname, 'prtsc', folderPath);
  console.log('完整图片目录路径:', fullPath);

  try {
    if (fs.existsSync(fullPath)) {
      const allFiles = fs.readdirSync(fullPath);
      const images = allFiles.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));
      
      console.log(`目录 ${folderPath} 中找到 ${images.length} 张图片`);
      
      // 为每个图片添加完整的URL路径
      const imagesWithPaths = images.map(image => ({
        name: image,
        url: `/prtsc/${folderPath}/${image}`
      }));
      
      res.json(imagesWithPaths);
    } else {
      console.warn('请求的文件夹不存在:', fullPath);
      res.status(404).json({ error: '文件夹不存在', path: folderPath });
    }
  } catch (error) {
    console.error('获取图片列表失败:', error);
    res.status(500).json({ error: '获取图片列表失败', details: error.message });
  }
});

// 文件上传
app.post('/upload', uploadHandler);

// 加载路由模块
// 从config-city/server-nacos加载权限配置路由
const permissionsRoutes = require('./config-city/server-nacos/permissionsRoutes');

// 注册路由
// API路由注册
// 权限配置相关API
app.use('/api/config/permissions', permissionsRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`); // 服务器启动成功提示
});