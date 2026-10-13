// 先加载私有运行配置，禁止在源码中保存凭据。
require('../config/runtime');
// 从环境变量加载本地运行配置，公开仓库不保存真实凭据。

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt'); // 用于密码加密
const jwt = require('jsonwebtoken'); // 用于生成JWT令牌
const swaggerSetup = require('./swagger'); // 导入Swagger配置

// 导入路由模块
const classRoutes = require('./routes/classRoutes'); // 班级管理路由
const fileExplorerRoutes = require('./routes/fileExplorer'); // 导入文件浏览器路由
const exportRoutes = require('./routes/exportRoutes');
const latexQuestionRoutes = require('./routes/latexQuestionRoutes'); // 导入LaTeX题目管理路由

const app = express();

// 中间件配置
app.use(cors());
app.use(bodyParser.json());

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

// 教师模型
const teacherSchema = {
  id: { type: 'INT', primaryKey: true, autoIncrement: true },
  name: { type: 'VARCHAR(100)', notNull: true },
  gender: { type: 'ENUM(\'男\',\'女\')', default: '\'男\'' },
  teacher_id: { type: 'VARCHAR(50)', notNull: true },
  phone: { type: 'VARCHAR(20)' },
  email: { type: 'VARCHAR(255)' },
  wechat: { type: 'VARCHAR(100)' },
  school: { type: 'VARCHAR(255)', notNull: true },
  password: { type: 'VARCHAR(255)', notNull: true },
  register_time: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
  last_login_time: { type: 'TIMESTAMP', null: true }
};

// 教师身份码注册次数表模型
const teacherIdCountSchema = {
  teacher_id: { type: 'VARCHAR(50)', primaryKey: true },
  register_count: { type: 'INT', default: 1 },
  last_register_time: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
};

// 创建教师表
const createTeacherTable = `CREATE TABLE IF NOT EXISTS teachers (
  ${Object.entries(teacherSchema)
    .map(([key, value]) => `${key} ${value.type}${value.primaryKey ? ' PRIMARY KEY' : ''}${value.autoIncrement ? ' AUTO_INCREMENT' : ''}${value.notNull ? ' NOT NULL' : ''}${value.default ? ` DEFAULT ${value.default}` : ''}${value.null ? ' NULL' : ''}
`)
    .join(',')}
)`;

// 创建教师身份码注册次数表
const createTeacherIdCountTable = `CREATE TABLE IF NOT EXISTS teacher_id_counts (
  ${Object.entries(teacherIdCountSchema)
    .map(([key, value]) => `${key} ${value.type}${value.primaryKey ? ' PRIMARY KEY' : ''}${value.default ? ` DEFAULT ${value.default}` : ''}
`)
    .join(',')}
)`;

// 初始化数据库表
pool.query(createTeacherTable, (err) => {
  if (err) {
    console.error('Error creating teachers table:', err);
  } else {
    console.log('Teachers table created or already exists');
  }
});

pool.query(createTeacherIdCountTable, (err) => {
  if (err) {
    console.error('Error creating teacher_id_counts table:', err);
  } else {
    console.log('Teacher ID counts table created or already exists');
  }
});

// JWT密钥
const JWT_SECRET = require('../config/runtime').requireEnv('TEACHER_JWT_SECRET');

// 中间件：验证JWT令牌
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: '未提供访问令牌' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, teacher) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效或已过期' });
    }
    req.teacher = teacher;
    next();
  });
};

// 导入用户角色映射模块
const userRoleMapping = require('../community-server/db/userRoleMapping');
const axios = require('axios');

// 初始化用户角色映射表
userRoleMapping.initUserRoleMappingTable()
  .then(() => {
    console.log('用户角色映射表初始化成功');
  })
  .catch(err => {
    console.error('用户角色映射表初始化失败:', err);
  });

// 导入注册中间件
const { teacherRegisterMiddleware } = require('../middleware/registerMiddleware');

// 教师注册
app.post('/register', teacherRegisterMiddleware, async (req, res) => {
  const { name, gender, teacher_id, phone, email, wechat, school, password, role = 'teacher', isFromStudent = false, studentUserId = null } = req.body;
  
  // 验证必填字段
  if (!name || !teacher_id || !school || !password) {
    return res.status(400).json({ error: '姓名、教师身份码、学校和密码为必填项' });
  }
  
  try {
    // 检查教师身份码注册次数
    const [idCountRows] = await pool.promise().query(
      'SELECT register_count FROM teacher_id_counts WHERE teacher_id = ?',
      [teacher_id]
    );
    
    let registerCount = 0;
    
    if (idCountRows.length > 0) {
      registerCount = idCountRows[0].register_count;
      
      // 获取注册配置中的教师ID最大注册次数限制
      const maxRegisterPerTeacherId = req.registerConfig?.teacherRegister?.maxRegisterPerTeacherId || 5;
      
      // 检查是否超过最大注册次数限制
      if (registerCount >= maxRegisterPerTeacherId) {
        return res.status(400).json({ 
          error: `该教师身份码已达到最大注册次数限制（${maxRegisterPerTeacherId}次）`,
          code: 'MAX_TEACHER_ID_REGISTRATIONS'
        });
      }
      
      // 更新注册次数
      await pool.promise().query(
        'UPDATE teacher_id_counts SET register_count = register_count + 1, last_register_time = CURRENT_TIMESTAMP WHERE teacher_id = ?',
        [teacher_id]
      );
    } else {
      // 创建新的教师身份码记录
      await pool.promise().query(
        'INSERT INTO teacher_id_counts (teacher_id, register_count) VALUES (?, 1)',
        [teacher_id]
      );
    }
    
    // 加密密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // 插入教师记录
    const [result] = await pool.promise().query(
      'INSERT INTO teachers (name, gender, teacher_id, phone, email, wechat, school, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, gender, teacher_id, phone, email, wechat, school, hashedPassword]
    );
    
    const teacherUserId = result.insertId;
    
    // 检查是否需要管理员审核
    const requireApproval = req.registerConfig?.teacherRegister?.requireApproval || false;
    let status = requireApproval ? 'pending' : 'active';
    
    // 检查是否从学生端创建账号（即分配角色时创建的教师端账号）
    if (isFromStudent && studentUserId) {
      console.log(`从学生端创建教师账号，跳过学生端账号创建，直接创建用户角色映射关系`);
      
      // 检查是否已存在角色映射关系
      try {
        const existingMapping = await userRoleMapping.getTeacherUserIdByStudentUserId(studentUserId);
        
        if (existingMapping) {
          console.log(`学生ID(${studentUserId})已有教师端映射关系，教师ID: ${existingMapping.teacherUserId}`);
          
          // 检查是否与当前创建的教师ID相同
          if (existingMapping.teacherUserId === teacherUserId) {
            console.log(`映射关系正是当前创建的教师账号，无需额外创建映射`);
          } else {
            console.log(`发现现有映射使用不同的教师ID(${existingMapping.teacherUserId})，添加新的角色映射`);
            // 创建新的用户角色映射
            await userRoleMapping.createUserRoleMapping(teacherUserId, studentUserId, role);
          }
        } else {
          // 不存在映射关系，创建新的
          console.log(`未找到学生ID(${studentUserId})的映射关系，创建新映射`);
          await userRoleMapping.createUserRoleMapping(teacherUserId, studentUserId, role);
        }
      } catch (mappingError) {
        console.error('检查或创建用户映射关系时出错:', mappingError);
        // 尝试创建映射，即使检查失败
        try {
          await userRoleMapping.createUserRoleMapping(teacherUserId, studentUserId, role);
          console.log(`已创建学生ID(${studentUserId})和教师ID(${teacherUserId})的映射关系`);
        } catch (createError) {
          console.error('创建用户映射关系失败:', createError);
        }
      }
      
      // 如果是管理员或助教，在社区服务器中也设置相应角色（这部分可能是冗余的，因为角色已经由社区服务器设置）
      // try {
      //   await axios.post('http://localhost:3003/api/community/roles/assign', {
      //     operatorId: 1, // 使用系统ID作为操作者
      //     targetUserId: studentUserId,
      //     role: role
      //   });
      // } catch (communityError) {
      //   console.error('设置社区角色失败:', communityError);
      //   // 不影响主流程，继续执行
      // }
      
      res.status(201).json({
        message: '教师端账号创建成功，关联已有学生端账号',
        teacherId: teacherUserId,
        studentId: studentUserId,
        role: role,
        status: status
      });
      return; // 直接返回，不创建学生端账号
    }
    
    // 在学生端创建对应账号（只有不是从学生端创建的教师账号才执行）
    try {
      // 调用学生端API创建对应账号
      const studentResponse = await axios.post('http://localhost:3001/register', {
        phone: phone || '', // 确保提供值，即使为空
        email: email || '', // 确保提供值，即使为空
        password, // 密码是必填项
        school,
        classNumber: '',  // 教师没有班级
        studentId: teacher_id, // 使用教师ID作为学生ID
        name,
        wechat: wechat || '', // 确保提供值，即使为空
        isFromTeacher: true // 标记这是从教师端创建的账号
      });
      
      if (studentResponse.data && studentResponse.data.userId) {
        const studentUserId = studentResponse.data.userId;
        
        // 创建用户角色映射前检查是否已存在
        const existingMapping = await userRoleMapping.getTeacherUserIdByStudentUserId(studentUserId);
        
        if (existingMapping) {
          console.log(`学生ID(${studentUserId})已有教师端映射关系，教师ID: ${existingMapping.teacherUserId}`);
          
          // 检查是否与当前创建的教师ID相同
          if (existingMapping.teacherUserId === teacherUserId) {
            console.log(`映射关系正是当前创建的教师账号，无需额外创建映射`);
          } else {
            console.log(`发现现有映射使用不同的教师ID(${existingMapping.teacherUserId})，添加新的角色映射`);
            // 创建新的用户角色映射
            await userRoleMapping.createUserRoleMapping(teacherUserId, studentUserId, role);
          }
        } else {
          // 不存在映射关系，创建新的
          console.log(`未找到学生ID(${studentUserId})的映射关系，创建新映射`);
          await userRoleMapping.createUserRoleMapping(teacherUserId, studentUserId, role);
        }
        
        // 如果是管理员或助教，在社区服务器中也设置相应角色
        if (role === 'admin' || role === 'assistant') {
          try {
            await axios.post('http://localhost:3003/api/community/roles/assign', {
              operatorId: 1, // 使用系统ID作为操作者
              targetUserId: studentUserId,
              role: role
            });
          } catch (communityError) {
            console.error('设置社区角色失败:', communityError);
            // 不影响主流程，继续执行
          }
        }
        
        res.status(201).json({
          message: requireApproval ? '教师注册成功，等待管理员审核' : '教师注册成功，已自动创建学生端账号',
          teacherId: teacherUserId,
          studentId: studentUserId,
          role: role,
          status: status
        });
      } else {
        // 学生账号创建失败，但教师账号已创建
        res.status(201).json({
          message: requireApproval ? '教师注册成功，等待管理员审核' : '教师注册成功，但学生端账号创建失败',
          teacherId: teacherUserId,
          warning: '学生端账号创建失败',
          status: status
        });
      }
    } catch (studentError) {
      console.error('创建学生端账号失败:', studentError);
      // 学生账号创建失败，但教师账号已创建
      res.status(201).json({
        message: requireApproval ? '教师注册成功，等待管理员审核' : '教师注册成功，但学生端账号创建失败',
        teacherId: teacherUserId,
        warning: '学生端账号创建失败',
        status: status
      });
    }
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '注册失败', details: error.message });
  }
});

// 教师登录
app.post('/login', async (req, res) => {
  const { teacher_id, password } = req.body;
  
  if (!teacher_id || !password) {
    return res.status(400).json({ error: '教师身份码和密码不能为空' });
  }
  
  try {
    // 查询教师记录
    const [teachers] = await pool.promise().query(
      'SELECT * FROM teachers WHERE teacher_id = ?',
      [teacher_id]
    );
    
    if (teachers.length === 0) {
      return res.status(401).json({ error: '教师不存在' });
    }
    
    // 验证密码 - 确保密码是字符串类型
    const passwordStr = String(password);
    console.log('登录尝试 - 教师ID:', teacher_id, '找到账号数量:', teachers.length);
    // 遍历所有账号验证密码
    let passwordMatch = false;
    let matchedTeacher = null;
    
    for (const teacher of teachers) {
      try {
        const isMatch = await bcrypt.compare(passwordStr, teacher.password);
        if (isMatch) {
          passwordMatch = true;
          matchedTeacher = teacher;
          break;
        }
      } catch (error) {
        console.error('密码比较错误:', error);
        // 继续检查下一个账号
      }
    }
    
    if (!passwordMatch || !matchedTeacher) {
      return res.status(401).json({ error: '密码错误' });
    }
    
    // 更新最后登录时间
    await pool.promise().query(
      'UPDATE teachers SET last_login_time = CURRENT_TIMESTAMP WHERE id = ?',
      [matchedTeacher.id]
    );
    
    // 获取用户角色信息
    let roleInfo = await userRoleMapping.getStudentUserIdByTeacherUserId(matchedTeacher.id);
    let role = 'teacher'; // 默认角色
    let studentUserId = null;
    
    if (roleInfo) {
      role = roleInfo.role;
      studentUserId = roleInfo.studentUserId;
    } else {
      // 如果没有找到映射关系，尝试创建一个
      try {
        // 查询是否有同名的学生账号
        const [students] = await pool.promise().query(
          'SELECT id FROM users WHERE email = ? OR studentId = ?',
          [matchedTeacher.email, matchedTeacher.teacher_id]
        );
        
        if (students.length > 0) {
          // 如果找到了匹配的学生账号，创建映射关系
          await userRoleMapping.createUserRoleMapping(matchedTeacher.id, students[0].id, role);
          studentUserId = students[0].id;
        }
      } catch (mappingError) {
        console.error('创建用户映射失败:', mappingError);
        // 不影响主流程，继续执行
      }
    }
    
    // 生成JWT令牌，包含角色信息
    const token = jwt.sign(
      { 
        id: matchedTeacher.id, 
        name: matchedTeacher.name, 
        school: matchedTeacher.school,
        role: role,
        studentUserId: studentUserId
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // 返回不包含密码的教师信息和令牌
    const { password: _, ...teacherWithoutPassword } = matchedTeacher;
    
    res.json({
      message: '登录成功',
      teacher: {
        ...teacherWithoutPassword,
        role: role,
        studentUserId: studentUserId
      },
      token
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败', details: error.message });
  }
});

// 获取当前教师信息
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [teachers] = await pool.promise().query(
      'SELECT id, name, gender, teacher_id, phone, email, wechat, school, register_time, last_login_time FROM teachers WHERE id = ?',
      [req.teacher.id]
    );
    
    if (teachers.length === 0) {
      return res.status(404).json({ error: '教师不存在' });
    }
    
    res.json(teachers[0]);
  } catch (error) {
    console.error('获取教师信息错误:', error);
    res.status(500).json({ error: '获取教师信息失败', details: error.message });
  }
});

// 更新教师信息
app.put('/profile', authenticateToken, async (req, res) => {
  const { name, gender, phone, email, wechat, school } = req.body;
  
  try {
    await pool.promise().query(
      'UPDATE teachers SET name = ?, gender = ?, phone = ?, email = ?, wechat = ?, school = ? WHERE id = ?',
      [name, gender, phone, email, wechat, school, req.teacher.id]
    );
    
    res.json({ message: '教师信息更新成功' });
  } catch (error) {
    console.error('更新教师信息错误:', error);
    res.status(500).json({ error: '更新教师信息失败', details: error.message });
  }
});

// 修改密码
app.put('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '当前密码和新密码不能为空' });
  }
  
  try {
    // 获取当前教师信息
    const [teachers] = await pool.promise().query(
      'SELECT * FROM teachers WHERE id = ?',
      [req.teacher.id]
    );
    
    if (teachers.length === 0) {
      return res.status(404).json({ error: '教师不存在' });
    }
    
    const teacher = teachers[0];
    
    // 验证当前密码
    const passwordMatch = await bcrypt.compare(currentPassword, teacher.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: '当前密码错误' });
    }
    
    // 加密新密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // 更新密码
    await pool.promise().query(
      'UPDATE teachers SET password = ? WHERE id = ?',
      [hashedPassword, req.teacher.id]
    );
    
    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ error: '修改密码失败', details: error.message });
  }
});

// 获取所有教师列表（仅供管理员使用）
app.get('/teachers', async (req, res) => {
  try {
    const [teachers] = await pool.promise().query(
      'SELECT id, name, gender, teacher_id, phone, email, wechat, school, register_time, last_login_time FROM teachers'
    );
    
    res.json(teachers);
  } catch (error) {
    console.error('获取教师列表错误:', error);
    res.status(500).json({ error: '获取教师列表失败', details: error.message });
  }
});

// 删除教师账号（提供API接口供社区服务器调用）
app.delete('/api/teachers/:id', async (req, res) => {
  try {
    const teacherId = req.params.id;
    
    console.log(`收到删除教师账号请求，教师ID: ${teacherId}`);
    
    // 查询教师账号是否存在
    const [teachers] = await pool.promise().query(
      'SELECT id FROM teachers WHERE id = ?',
      [teacherId]
    );
    
    if (teachers.length === 0) {
      console.log(`教师账号不存在: ${teacherId}`);
      return res.status(404).json({ error: '教师账号不存在' });
    }
    
    // 获取关联的学生账号信息（以便后续清理映射关系）
    const studentIds = [];
    try {
      const mappingInfo = await userRoleMapping.getStudentUserIdByTeacherUserId(teacherId);
      if (mappingInfo && mappingInfo.studentUserId) {
        studentIds.push(mappingInfo.studentUserId);
      }
    } catch (mappingError) {
      console.error('获取账号映射信息失败:', mappingError);
      // 继续执行，不影响主流程
    }
    
    // 开始事务
    const connection = await pool.promise().getConnection();
    await connection.beginTransaction();
    
    try {
      // 1. 删除教师账号
      await connection.query('DELETE FROM teachers WHERE id = ?', [teacherId]);
      
      // 2. 删除角色映射关系（如果存在）
      if (studentIds.length > 0) {
        try {
          await userRoleMapping.deleteUserRoleMappingByTeacherUserId(teacherId);
          console.log(`成功删除教师ID ${teacherId} 的角色映射关系`);
        } catch (deleteError) {
          console.error('删除角色映射关系失败:', deleteError);
          // 继续执行，不影响主流程
        }
      }
      
      await connection.commit();
      console.log(`成功删除教师账号: ${teacherId}`);
      res.json({ message: '教师账号删除成功' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('删除教师账号失败:', error);
    res.status(500).json({ error: '删除教师账号失败', details: error.message });
  }
});

// 注册班级管理路由
app.use('/classes', classRoutes);

// 注册API路由
app.use('/api/file-explorer', fileExplorerRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/latex-questions', latexQuestionRoutes); // 注册LaTeX题目管理路由

// 设置Swagger文档
swaggerSetup(app);

// 设置服务器端口
const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`教师端安全服务器运行在端口 ${PORT}`);
  console.log(`API文档可在 http://localhost:${PORT}/api-docs 访问`);
});

module.exports = app;