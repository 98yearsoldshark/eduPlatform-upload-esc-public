// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../config/runtime');
/**
 * 社区用户角色管理相关路由
 * 
 * 功能列表：
 * 1. 角色查询：获取用户角色、检查用户是否有特定角色
 * 2. 角色分配：管理员可分配任意角色，教师只能分配助教角色
 * 3. 角色移除：管理员可移除任意角色，教师只能移除助教角色
 * 4. 用户管理：按角色查询用户、搜索用户
 * 5. 最高管理员：系统初始化时创建，拥有最高权限
 * 6. 教师端账号：自动创建对应的教师端账号
 * 7. 账号管理：处理教师端账号删除请求
 * 
 * 权限层级：最高管理员 > 普通管理员 > 教师 > 助教 > 学生
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // 用于密码加密
const userRoleMapping = require('../db/userRoleMapping'); // 导入用户角色映射模块
const { checkCanAssignAssistant } = require('../../config-city/server-nacos/middleware/permissionsMiddleware');

// 使用server.js中的连接池和executeWithRetry函数
const { pool, executeWithRetry } = require('../server');

// 角色类型常量
const ROLE_TYPES = {
  SUPER_ADMIN: 'super_admin', // 最高管理员
  ADMIN: 'admin',      // 管理员
  ASSISTANT: 'assistant', // 助教
  TEACHER: 'teacher',   // 教师
  STUDENT: 'student'    // 普通学生用户
};

// 获取用户角色
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { isTeacher } = req.query; // 添加isTeacher查询参数，用于区分是否为教师ID
    
    if (!userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    let roles;
    
    if (isTeacher === 'true') {
      // 通过teacher_id查询角色
      [roles] = await pool.execute(
        'SELECT role FROM community_user_roles WHERE teacher_id = ?',
        [userId]
      );
      console.log('通过teacher_id查询用户角色:', roles);
    } else {
      // 通过user_id查询角色（学生端ID）
      [roles] = await pool.execute(
        'SELECT role FROM community_user_roles WHERE user_id = ?',
        [userId]
      );
      console.log('通过user_id查询用户角色:', roles);
    }
    
    // 如果没有角色记录，默认为学生角色
    if (roles.length === 0) {
      return res.json({
        userId: userId,
        roles: [ROLE_TYPES.STUDENT]
      });
    }
    
    // 返回用户所有角色
    res.json({
      userId: userId,
      roles: roles.map(r => r.role)
    });
  } catch (error) {
    console.error('获取用户角色失败:', error);
    res.status(500).json({ error: '获取用户角色失败' });
  }
});

// 检查用户是否有特定角色
router.get('/check/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.query;
    
    if (!userId || !role) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查角色是否有效
    if (!Object.values(ROLE_TYPES).includes(role)) {
      return res.status(400).json({ error: '无效的角色类型' });
    }
    
    // 查询用户是否有指定角色
    const [roles] = await pool.execute(
      'SELECT 1 FROM community_user_roles WHERE user_id = ? AND role = ?',
      [userId, role]
    );
    
    res.json({
      hasRole: roles.length > 0
    });
  } catch (error) {
    console.error('检查用户角色失败:', error);
    res.status(500).json({ error: '检查用户角色失败' });
  }
});

// 分配角色给用户（需要管理员或教师权限）
router.post('/assign', async (req, res) => {
  try {
    const { operatorId, targetUserId, role } = req.body;
    
    if (!operatorId || !targetUserId || !role) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查角色是否有效
    if (!Object.values(ROLE_TYPES).includes(role)) {
      return res.status(400).json({ error: '无效的角色类型' });
    }
    
    // 检查操作者权限
    const [operatorRoles] = await pool.execute(
      'SELECT role FROM community_user_roles WHERE user_id = ? AND (role = ? OR role = ?)',
      [operatorId, ROLE_TYPES.ADMIN, ROLE_TYPES.TEACHER]
    );
    
    if (operatorRoles.length === 0) {
      return res.status(403).json({ error: '您没有分配角色的权限' });
    }
    
    // 教师只能分配助教角色
    const isTeacher = operatorRoles.some(r => r.role === ROLE_TYPES.TEACHER);
    const isAdmin = operatorRoles.some(r => r.role === ROLE_TYPES.ADMIN);
    
    if (isTeacher && !isAdmin && role !== ROLE_TYPES.ASSISTANT) {
      return res.status(403).json({ error: '教师只能分配助教角色' });
    }
    
    // 检查目标用户是否存在
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [targetUserId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: '目标用户不存在' });
    }
    
    // 检查是否已有该角色
    const [existingRoles] = await pool.execute(
      'SELECT * FROM community_user_roles WHERE user_id = ? AND role = ?',
      [targetUserId, role]
    );
    
    if (existingRoles.length > 0) {
      return res.status(400).json({ error: `用户已经拥有${role}角色` });
    }
    
    // 分配角色
    // 检查是否有对应的教师端账号
    let teacherId = null;
    try {
      const teacherMapping = await userRoleMapping.getTeacherUserIdByStudentUserId(targetUserId);
      if (teacherMapping) {
        teacherId = teacherMapping.teacherUserId;
      }
    } catch (error) {
      console.error('获取教师端账号映射失败:', error);
    }
    
    await pool.execute(
      'INSERT INTO community_user_roles (user_id, role, teacher_id) VALUES (?, ?, ?)',
      [targetUserId, role, teacherId]
    );
    
    // 发送通知给目标用户
    await pool.execute(
      'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
      [targetUserId, 'role_assigned', `您被授予了${getRoleDisplayName(role)}角色`, operatorId]
    );
    
    res.status(201).json({ message: `成功将${getRoleDisplayName(role)}角色分配给用户` });
  } catch (error) {
    console.error('分配角色失败:', error);
    res.status(500).json({ error: '分配角色失败' });
  }
});

// 移除用户角色（需要管理员权限）
router.delete('/remove', async (req, res) => {
  try {
    const { operatorId, targetUserId, role } = req.body;
    
    if (!operatorId || !targetUserId || !role) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查角色是否有效
    if (!Object.values(ROLE_TYPES).includes(role)) {
      return res.status(400).json({ error: '无效的角色类型' });
    }
    
    // 检查操作者权限
    const [operatorRoles] = await pool.execute(
      'SELECT role FROM community_user_roles WHERE user_id = ? AND (role = ? OR role = ?)',
      [operatorId, ROLE_TYPES.ADMIN, ROLE_TYPES.TEACHER]
    );
    
    if (operatorRoles.length === 0) {
      return res.status(403).json({ error: '您没有移除角色的权限' });
    }
    
    // 教师只能移除助教角色
    const isTeacher = operatorRoles.some(r => r.role === ROLE_TYPES.TEACHER);
    const isAdmin = operatorRoles.some(r => r.role === ROLE_TYPES.ADMIN);
    
    if (isTeacher && !isAdmin && role !== ROLE_TYPES.ASSISTANT) {
      return res.status(403).json({ error: '教师只能移除助教角色' });
    }
    
    // 不能移除管理员角色（除非是管理员自己）
    if (role === ROLE_TYPES.ADMIN && !isAdmin) {
      return res.status(403).json({ error: '只有管理员可以移除管理员角色' });
    }
    
    // 移除角色
    const [result] = await pool.execute(
      'DELETE FROM community_user_roles WHERE user_id = ? AND role = ?',
      [targetUserId, role]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '用户没有该角色' });
    }
    
    // 发送通知给目标用户
    await pool.execute(
      'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
      [targetUserId, 'role_removed', `您的${getRoleDisplayName(role)}角色已被移除`, operatorId]
    );
    
    res.json({ message: `成功移除用户的${getRoleDisplayName(role)}角色` });
  } catch (error) {
    console.error('移除角色失败:', error);
    res.status(500).json({ error: '移除角色失败' });
  }
});

// 获取所有具有特定角色的用户
router.get('/users-by-role', async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    
    if (!role) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查角色是否有效
    if (!Object.values(ROLE_TYPES).includes(role)) {
      return res.status(400).json({ error: '无效的角色类型' });
    }
    
    // 确保分页参数是整数
    const limitNum = Number(limit);
    const pageNum = Number(page);
    const offset = (pageNum - 1) * limitNum;
    
    // 查询具有特定角色的用户
    const [users] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.school, u.classNumber, u.studentId, u.registerTime
       FROM community_user_roles r
       JOIN users u ON r.user_id = u.id
       WHERE r.role = ?
       ORDER BY u.registerTime DESC
       LIMIT ? OFFSET ?`,
      [role, limitNum, offset]
    );
    
    // 获取总数
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) AS total FROM community_user_roles WHERE role = ?',
      [role]
    );
    
    const total = countResult[0].total;
    
    res.json({
      users,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error(`获取${role}用户列表失败:`, error);
    res.status(500).json({ error: `获取${role}用户列表失败` });
  }
});

// 教师查找学生并分配助教角色
router.post('/assign-assistant', checkCanAssignAssistant, async (req, res) => {
  try {
    const { teacherId, studentId } = req.body;
    
    if (!teacherId || !studentId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查操作者是否为教师或管理员
    const [userRoles] = await executeWithRetry(async (conn) => {
      return await conn.query(
        'SELECT role FROM community_user_roles WHERE teacher_id = ? AND (role = ? OR role = ?)',
        [teacherId, ROLE_TYPES.TEACHER, ROLE_TYPES.ADMIN]
      );
    });
    
    console.log('操作者角色:', userRoles);
    
    // 检查用户是否有教师或管理员角色
    const isTeacher = userRoles.some(r => r.role === ROLE_TYPES.TEACHER);
    const isAdmin = userRoles.some(r => r.role === ROLE_TYPES.ADMIN);
    
    // 如果既不是教师也不是管理员，则没有权限
    if (!isTeacher && !isAdmin) {
      return res.status(403).json({ error: '您没有分配助教的权限' });
    }
    
    // 通过学号查找学生
    const [students] = await executeWithRetry(async (conn) => {
      return await conn.query(
        'SELECT * FROM users WHERE studentId = ?',
        [studentId]
      );
    });
    
    if (students.length === 0) {
      return res.status(404).json({ error: '未找到该学号的学生' });
    }
    
    const student = students[0];
    
    // 检查学生是否已经是助教（严格检查，避免重复分配）
    const [existingRoles] = await executeWithRetry(async (conn) => {
      return await conn.query(
        'SELECT * FROM community_user_roles WHERE user_id = ? AND role = ?',
        [student.id, ROLE_TYPES.ASSISTANT]
      );
    });
    
    if (existingRoles.length > 0) {
      // 如果已经是助教，返回成功但明确提示已经是助教
      return res.status(200).json({ 
        message: '该学生已经是助教，无需重复分配',
        student: {
          id: student.id,
          name: student.name,
          studentId: student.studentId,
          alreadyAssistant: true
        }
      });
    }
    
    // 开始事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // 检查是否已有教师端账号映射
      const teacherMapping = await userRoleMapping.getTeacherUserIdByStudentUserId(student.id);
      console.log('查询教师端账号映射结果:', teacherMapping);
      
      let teacherUserId;
      let accountAlreadyExists = false;
      
      if (!teacherMapping) {
        // 从邮箱中提取密码，或使用学号作为备选
        let initialPassword = student.studentId;
        if (student.email && student.email.includes('@')) {
          initialPassword = student.email.split('@')[0];
          console.log(`从邮箱(${student.email})中提取密码: ${initialPassword}`);
        } else {
          console.log(`邮箱格式不正确或为空，使用学号作为默认密码: ${initialPassword}`);
        }
        
        // 生成唯一的教师ID - 暂时不使用时间戳以避免重复
        const rolePrefix = "TA";
        // const timestamp = Date.now().toString().slice(-6);
        const timestamp = "";
        const uniqueTeacherId = `${rolePrefix}${student.studentId}${timestamp}`;
        console.log(`生成唯一教师ID: ${uniqueTeacherId}`);
        
        const axios = require('axios');
        
        try {
          // 调用教师端API创建助教账号，但不创建重复的学生端账号
          // 使用isFromStudent标记表示这是从学生端创建的账号，不要创建学生端账号
          const teacherResponse = await axios.post('http://localhost:3002/register', {
            name: `${rolePrefix}-${student.name}`,
            gender: '男',
            teacher_id: uniqueTeacherId,
            phone: '',
            email: `${rolePrefix}${student.email}`,
            wechat: '',
            school: student.school || '未知学校',
            password: initialPassword,
            role: 'assistant',
            isFromStudent: true,  // 添加标记，表示是从学生端创建的账号
            studentUserId: student.id  // 传递已有的学生用户ID
          });
          
          console.log('教师端API响应:', teacherResponse.data);
          
          if (teacherResponse.data && teacherResponse.data.teacherId) {
            teacherUserId = teacherResponse.data.teacherId;
            console.log(`成功创建教师端账号，ID: ${teacherUserId}`);
            
            // 创建用户映射关系
            await userRoleMapping.createUserRoleMapping(teacherUserId, student.id, 'assistant');
            console.log(`成功创建学生(${student.id})和教师(${teacherUserId})的映射关系`);
          } else {
            throw new Error('教师端账号创建失败，返回数据不完整: ' + JSON.stringify(teacherResponse.data));
          }
        } catch (error) {
          console.error('创建教师端账号详细错误:', error);
          
          if (error.response && error.response.data) {
            throw new Error(`教师端账号创建失败: ${error.message}, 详情: ${JSON.stringify(error.response.data)}`);
          } else {
            throw new Error(`教师端账号创建失败: ${error.message}`);
          }
        }
      } else {
        // 如果已有教师端账号，直接使用
        teacherUserId = teacherMapping.teacherUserId;
        accountAlreadyExists = true;
        console.log(`学生已有教师端账号(${teacherUserId})，直接使用该账号`);
      }
      
      // 再次检查角色是否已存在（双重检查，防止事务过程中有其他操作）
      const [checkAgain] = await connection.query(
        'SELECT 1 FROM community_user_roles WHERE user_id = ? AND role = ?',
        [student.id, ROLE_TYPES.ASSISTANT]
      );
      
      if (checkAgain.length > 0) {
        // 如果已存在，回滚事务并通知前端
        await connection.rollback();
        return res.status(200).json({
          message: '该学生已经是助教，无需重复分配',
          student: {
            id: student.id,
            name: student.name,
            studentId: student.studentId,
            alreadyAssistant: true
          }
        });
      }
      
      // 分配助教角色
      await connection.query(
        'INSERT INTO community_user_roles (user_id, role, teacher_id) VALUES (?, ?, ?)',
        [student.id, ROLE_TYPES.ASSISTANT, teacherUserId]
      );
      
      // 发送通知
      let notificationMessage = '您被授予了助教角色';
      if (accountAlreadyExists) {
        notificationMessage += '，使用您现有的教师端账号';
      } else {
        notificationMessage += '，已自动为您创建教师端助教账号';
      }
      
      await connection.query(
        'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
        [student.id, 'role_assigned', notificationMessage, teacherId]
      );
      
      await connection.commit();
      
      res.status(201).json({
        message: '成功将助教角色分配给学生',
        student: {
          id: student.id,
          name: student.name,
          studentId: student.studentId,
          accountCreated: !accountAlreadyExists
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('分配助教角色失败:', error);
    res.status(500).json({ error: `分配助教角色失败: ${error.message}` });
  }
});

// 创建管理员账号（仅在系统初始化时调用）
router.post('/create-admin', async (req, res) => {
  try {
    const { secretKey } = req.body;
    
    // 验证密钥（这里使用一个简单的密钥，实际应用中应该更安全）
    if (!process.env.COMMUNITY_ADMIN_INIT_KEY || secretKey !== process.env.COMMUNITY_ADMIN_INIT_KEY) {
      return res.status(403).json({ error: '无效的密钥' });
    }
    
    // 检查是否已存在管理员
    const [existingAdmins] = await pool.execute(
      'SELECT COUNT(*) as count FROM community_user_roles WHERE role = ?',
      [ROLE_TYPES.ADMIN]
    );
    
    if (existingAdmins[0].count > 0) {
      return res.status(400).json({ error: '管理员账号已存在' });
    }
     
    const password = process.env.DEFAULT_ADMIN_PASSWORD;
    if (!password) {
      return res.status(503).json({ error: '未配置管理员初始密码' });
    }
    // 加密密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    // 创建管理员用户
    const adminData = {
      name: '系统管理员',
      email: 'admin@community.system',
      school: '系统',
      studentId: 'ADMIN001',
      password: hashedPassword, // 请确保密码足够安全
    };
    
    // 检查用户是否已存在
    const [existingUsers] = await pool.execute(
      'SELECT * FROM users WHERE email = ? OR studentId = ?',
      [adminData.email, adminData.studentId]
    );
    
    let adminUserId;
    
    if (existingUsers.length > 0) {
      // 使用现有用户
      adminUserId = existingUsers[0].id;
    } else {
      // 创建新用户
      const [result] = await pool.execute(
        'INSERT INTO users (name, email, school, studentId) VALUES (?, ?, ?, ?)',
        [adminData.name, adminData.email, adminData.school, adminData.studentId]
      );
      
      adminUserId = result.insertId;
    }
    
    // 创建教师端对应的管理员账号
    let teacherUserId = null;
    try {
      // 检查教师端是否已存在相同的管理员账号
      const teacherResponse = await axios.post('http://localhost:3002/register', {
        name: adminData.name,
        gender: '男',
        teacher_id: adminData.studentId,
        phone: '',
        email: adminData.email,
        wechat: '',
        school: adminData.school,
        password: password, // 使用明文密码，因为教师端会自己加密
        role: 'admin' // 指定为管理员角色
      });
      
      if (teacherResponse.data && teacherResponse.data.teacherId) {
        teacherUserId = teacherResponse.data.teacherId;
        
        // 创建用户角色映射关系
        await userRoleMapping.createUserRoleMapping(teacherUserId, adminUserId, 'admin');
        
        console.log(`创建了教师端管理员账号，ID: ${teacherUserId}，并建立了映射关系`);
      }
    } catch (teacherError) {
      console.error('在教师端创建管理员账号失败:', teacherError.message);
      // 继续执行，不影响社区服务器的启动
    }
    
    // 分配最高管理员角色
    await pool.execute(
      'INSERT INTO community_user_roles (user_id, role, teacher_id) VALUES (?, ?, ?)',
      [adminUserId, ROLE_TYPES.SUPER_ADMIN, teacherUserId]
    );
    
    // 同时也分配普通管理员角色
    await pool.execute(
      'INSERT INTO community_user_roles (user_id, role, teacher_id) VALUES (?, ?, ?)',
      [adminUserId, ROLE_TYPES.ADMIN, teacherUserId]
    );
    
    res.status(201).json({
      message: '管理员账号创建成功',
      adminId: adminUserId
    });
  } catch (error) {
    console.error('创建管理员账号失败:', error);
    res.status(500).json({ error: '创建管理员账号失败' });
  }
});

// 检查当前用户是否为最高管理员（拥有super_admin角色）
router.get('/check-suprem-admin', async (req, res) => {
  try {
    const { teacherid } = req.query;
    // console.log('req.query--teacherid:', teacherid);
    if (!teacherid) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 直接检查用户是否拥有super_admin角色
    const [superAdminRoles] = await pool.execute(
      `SELECT 1 FROM community_user_roles 
      WHERE teacher_id = ? AND role = ?`,
      [teacherid, ROLE_TYPES.SUPER_ADMIN]
    );
    //      WHERE (user_id = ? OR teacher_id = ?) AND role = ?`,

    // 判断用户是否拥有super_admin角色
    const isSupremAdmin = superAdminRoles.length > 0;
    // console.log('//superAdminRoles:', superAdminRoles);
    console.log('isSupremAdmin (super_admin role):', isSupremAdmin);
    return res.json({ isSupremAdmin });
  
  } catch (error) {
    console.error('检查最高管理员权限失败:', error);
    res.status(500).json({ error: '检查最高管理员权限失败' });
  }
});

// 获取所有用户列表（支持搜索）
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', searchType = 'name' } = req.query;
    
    // 确保分页参数是整数
    const limitNum = Number(limit);
    const pageNum = Number(page);
    const offset = (pageNum - 1) * limitNum;
    
    let query = `
      SELECT u.id, u.name, u.email, u.school, u.classNumber, u.studentId, u.registerTime
      FROM users u
    `;
    
    const queryParams = [];
    
    // 添加搜索条件
    if (search) {
      if (searchType === 'name') {
        query += ` WHERE u.name LIKE ? `;
        queryParams.push(`%${search}%`);
      } else if (searchType === 'email') {
        query += ` WHERE u.email LIKE ? `;
        queryParams.push(`%${search}%`);
      } else if (searchType === 'studentId') {
        query += ` WHERE u.studentId LIKE ? `;
        queryParams.push(`%${search}%`);
      } else if (searchType === 'school') {
        query += ` WHERE u.school LIKE ? `;
        queryParams.push(`%${search}%`);
      }
    }
    
    // 添加排序和分页
    query += ` ORDER BY u.registerTime DESC LIMIT ? OFFSET ?`;
    queryParams.push(limitNum, offset);
    
    // 执行查询
    const [users] = await pool.execute(query, queryParams);
    
    // 获取每个用户的角色
    for (const user of users) {
      const [roles] = await pool.execute(
        'SELECT role FROM community_user_roles WHERE user_id = ?',
        [user.id]
      );
      
      user.roles = roles.length > 0 ? roles.map(r => r.role) : [ROLE_TYPES.STUDENT];
    }
    
    // 获取总数
    let countQuery = `SELECT COUNT(*) AS total FROM users u`;
    const countParams = [];
    
    if (search) {
      if (searchType === 'name') {
        countQuery += ` WHERE u.name LIKE ? `;
        countParams.push(`%${search}%`);
      } else if (searchType === 'email') {
        countQuery += ` WHERE u.email LIKE ? `;
        countParams.push(`%${search}%`);
      } else if (searchType === 'studentId') {
        countQuery += ` WHERE u.studentId LIKE ? `;
        countParams.push(`%${search}%`);
      } else if (searchType === 'school') {
        countQuery += ` WHERE u.school LIKE ? `;
        countParams.push(`%${search}%`);
      }
    }
    
    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;
    
    res.json({
      users,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
}); 

// 初始化角色删除请求表
// 这个函数应该在系统初始化时调用
async function initAccountDeleteRequestsTable() {
  try {
    console.log('初始化教师端账号删除请求表...');
    
    await executeWithRetry(async (conn) => {
      return await conn.query(`
        CREATE TABLE IF NOT EXISTS community_account_delete_requests (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          teacher_id INT NOT NULL,
          previous_roles TEXT NOT NULL,
          request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
          processed_time TIMESTAMP NULL,
          processed_by INT NULL,
          INDEX(user_id),
          INDEX(teacher_id),
          INDEX(status)
        )
      `);
    });
    
    console.log('教师端账号删除请求表初始化成功');
    return true;
  } catch (error) {
    console.error('初始化教师端账号删除请求表失败:', error);
    return false;
  }
}

// 更新用户角色前检查是否需要创建删除请求
async function checkAndCreateDeleteRequest(userId, previousRoles, newRoles) {
  try {
    // 检查是否从有特殊角色变为只有学生角色
    const hasSpecialRoleBefore = previousRoles.some(role => 
      role === ROLE_TYPES.ADMIN || role === ROLE_TYPES.TEACHER || role === ROLE_TYPES.ASSISTANT
    );
    
    const hasSpecialRoleAfter = newRoles.some(role => 
      role === ROLE_TYPES.ADMIN || role === ROLE_TYPES.TEACHER || role === ROLE_TYPES.ASSISTANT
    );
    
    // 如果之前有特殊角色，现在没有了，需要创建删除请求
    if (hasSpecialRoleBefore && !hasSpecialRoleAfter) {
      console.log(`用户 ${userId} 删除了所有特殊角色，准备创建教师端账号删除请求`);
      
      // 查询用户对应的教师端账号
      const teacherMapping = await userRoleMapping.getTeacherUserIdByStudentUserId(userId);
      if (!teacherMapping || !teacherMapping.teacherUserId) {
        console.log(`用户 ${userId} 没有教师端账号，无需创建删除请求`);
        return;
      }
      
      const teacherId = teacherMapping.teacherUserId;
      
      // 检查是否已有未处理的删除请求
      const [existingRequests] = await executeWithRetry(async (conn) => {
        return await conn.query(
          `SELECT id FROM community_account_delete_requests 
           WHERE user_id = ? AND teacher_id = ? AND status = 'pending'`,
          [userId, teacherId]
        );
      });
      
      if (existingRequests && existingRequests.length > 0) {
        console.log(`用户 ${userId} 已有未处理的删除请求，无需重复创建`);
        return;
      }
      
      // 创建删除请求
      await executeWithRetry(async (conn) => {
        return await conn.query(
          `INSERT INTO community_account_delete_requests 
           (user_id, teacher_id, previous_roles) VALUES (?, ?, ?)`,
          [userId, teacherId, JSON.stringify(previousRoles)]
        );
      });
      
      console.log(`成功为用户 ${userId} 创建教师端账号删除请求`);
    }
  } catch (error) {
    console.error('检查和创建删除请求失败:', error);
  }
}

// 获取教师端账号删除请求列表
router.get('/account-delete-requests', async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'pending' } = req.query;
    
    // 确保分页参数是整数
    const limitNum = parseInt(limit, 10);
    const pageNum = parseInt(page, 10);
    const offset = (pageNum - 1) * limitNum;
    
    // 查询请求列表
    const [requests] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT r.*, u.name as userName, u.studentId, t.name as teacherName
         FROM community_account_delete_requests r
         JOIN users u ON r.user_id = u.id
         LEFT JOIN teachers t ON r.teacher_id = t.id
         WHERE r.status = ?
         ORDER BY r.request_time DESC
         LIMIT ? OFFSET ?`,
        [status, limitNum, offset]
      );
    });
    
    // 获取每个请求的角色信息
    for (const request of requests) {
      try {
        request.roles = JSON.parse(request.previous_roles);
      } catch (e) {
        request.roles = [];
      }
    }
    
    // 获取总数
    const [countResult] = await executeWithRetry(async (conn) => {
      return await conn.query(
        'SELECT COUNT(*) AS total FROM community_account_delete_requests WHERE status = ?',
        [status]
      );
    });
    
    const total = countResult[0].total;
    
    res.json({
      requests,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('获取账号删除请求失败:', error);
    res.status(500).json({ error: '获取账号删除请求失败' });
  }
});

// 批准删除教师端账号
router.post('/delete-teacher-account', async (req, res) => {
  try {
    const { operatorId, requestId, userId, teacherId } = req.body;
    
    if (!operatorId || !requestId || !userId || !teacherId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查操作者是否为最高管理员
    const [adminRoles] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT 1 FROM community_user_roles 
         WHERE (user_id = ? OR teacher_id = ?) AND role = ?`,
        [operatorId, operatorId, ROLE_TYPES.SUPER_ADMIN]
      );
    });
    
    if (adminRoles.length === 0) {
      return res.status(403).json({ error: '只有最高管理员可以执行此操作' });
    }
    
    // 检查请求状态
    const [requestInfo] = await executeWithRetry(async (conn) => {
      return await conn.query(
        'SELECT * FROM community_account_delete_requests WHERE id = ?',
        [requestId]
      );
    });
    
    if (requestInfo.length === 0) {
      return res.status(404).json({ error: '删除请求不存在' });
    }
    
    if (requestInfo[0].status !== 'pending') {
      return res.status(400).json({ error: '该请求已处理' });
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // 1. 删除教师端账号
      try {
        const axios = require('axios');
        // 调用教师端API删除账号
        await axios.delete(`http://localhost:3002/api/teachers/${teacherId}`, {
          headers: { 
            Authorization: req.headers.authorization 
          }
        });
        console.log(`成功删除教师端账号: ${teacherId}`);
      } catch (error) {
        console.error('删除教师端账号失败:', error);
        console.error('详细错误信息:', error.response ? error.response.data : '无响应数据');
        // 继续执行，因为我们仍然需要清理社区系统中的记录
      }
      
      // 2. 更新删除请求状态
      await connection.query(
        `UPDATE community_account_delete_requests 
         SET status = 'approved', processed_time = NOW(), processed_by = ?
         WHERE id = ?`,
        [operatorId, requestId]
      );
      
      // 3. 删除角色表中的相关记录
      await connection.query(
        'DELETE FROM community_user_roles WHERE teacher_id = ?',
        [teacherId]
      );
      
      // 4. 发送通知给用户
      await connection.query(
        'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
        [userId, 'account_deleted', '您的教师端账号已被删除', operatorId]
      );
      
      await connection.commit();
      res.json({ message: '教师端账号已成功删除' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('删除教师端账号失败:', error);
    res.status(500).json({ error: '删除教师端账号失败' });
  }
});

// 拒绝删除请求
router.post('/reject-delete-request', async (req, res) => {
  try {
    const { operatorId, requestId } = req.body;
    
    if (!operatorId || !requestId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查操作者是否为管理员
    const [adminRoles] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT 1 FROM community_user_roles 
         WHERE (user_id = ? OR teacher_id = ?) AND (role = ? OR role = ?)`,
        [operatorId, operatorId, ROLE_TYPES.ADMIN, ROLE_TYPES.SUPER_ADMIN]
      );
    });
    
    if (adminRoles.length === 0) {
      return res.status(403).json({ error: '只有管理员可以执行此操作' });
    }
    
    // 检查请求状态
    const [requestInfo] = await executeWithRetry(async (conn) => {
      return await conn.query(
        'SELECT * FROM community_account_delete_requests WHERE id = ?',
        [requestId]
      );
    });
    
    if (requestInfo.length === 0) {
      return res.status(404).json({ error: '删除请求不存在' });
    }
    
    if (requestInfo[0].status !== 'pending') {
      return res.status(400).json({ error: '该请求已处理' });
    }
    
    // 更新请求状态
    await executeWithRetry(async (conn) => {
      return await conn.query(
        `UPDATE community_account_delete_requests 
         SET status = 'rejected', processed_time = NOW(), processed_by = ?
         WHERE id = ?`,
        [operatorId, requestId]
      );
    });
    
    // 发送通知给用户
    await executeWithRetry(async (conn) => {
      return await conn.query(
        'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
        [requestInfo[0].user_id, 'account_preserved', '您的教师端账号删除请求已被拒绝，账号将被保留', operatorId]
      );
    });
    
    res.json({ message: '已拒绝删除请求' });
  } catch (error) {
    console.error('拒绝删除请求失败:', error);
    res.status(500).json({ error: '拒绝删除请求失败' });
  }
});

// 修改updateUserRole函数中的部分，添加删除请求检查
// 修改update-roles路由的部分代码
router.put('/update-roles', async (req, res) => {
  try {
    const { operatorId, targetUserId, roles } = req.body;
    
    if (!operatorId || !targetUserId || !roles || !Array.isArray(roles)) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    console.log('body:', req.body);
    
    // 检查操作者是否为管理员
    const [operatorRoles] = await pool.execute(
      'SELECT role FROM community_user_roles WHERE teacher_id = ? AND (role = ? OR role = ?)',
      [operatorId, ROLE_TYPES.ADMIN, ROLE_TYPES.SUPER_ADMIN]
    );
    console.log('operatorRoles:', operatorRoles);
    if (operatorRoles.length === 0) {
      return res.status(403).json({ error: '您没有管理角色的权限' });
    }
    
    // 检查操作者是否为最高管理员
    const [admins] = await pool.execute(
      `SELECT user_id, teacher_id FROM community_user_roles 
       WHERE role = ? 
       ORDER BY created_at ASC 
       LIMIT 1`,
      [ROLE_TYPES.SUPER_ADMIN]
    );
    
    // 如果没有最高管理员，则检查第一个创建的普通管理员
    let isSupremAdmin = false;
    if (admins.length > 0) {
      isSupremAdmin = admins[0].user_id === Number(operatorId) || 
                     (admins[0].teacher_id && admins[0].teacher_id === Number(operatorId));
    } else {
      const [regularAdmins] = await pool.execute(
        `SELECT user_id, teacher_id FROM community_user_roles 
         WHERE role = ? 
         ORDER BY created_at ASC 
         LIMIT 1`,
        [ROLE_TYPES.ADMIN]
      );
      
      if (regularAdmins.length > 0) {
        isSupremAdmin = regularAdmins[0].user_id === Number(operatorId) || 
                       (regularAdmins[0].teacher_id && regularAdmins[0].teacher_id === Number(operatorId));
      }
    }
    
    // 检查目标用户是否为管理员
    const [targetAdminRoles] = await pool.execute(
      'SELECT 1 FROM community_user_roles WHERE user_id = ? AND role = ?',
      [targetUserId, ROLE_TYPES.ADMIN]
    );
    
    const targetIsAdmin = targetAdminRoles.length > 0;
    
    // 如果目标用户是管理员，且操作者不是最高管理员，则不允许修改
    if (targetIsAdmin && !isSupremAdmin && targetUserId !== operatorId) {
      return res.status(403).json({ error: '只有最高管理员才能修改其他管理员的角色' });
    }
    
    // 开始事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // 获取用户当前角色
      const [currentRoles] = await connection.execute(
        'SELECT role FROM community_user_roles WHERE user_id = ?',
        [targetUserId]
      );
      
      const currentRoleArray = currentRoles.map(r => r.role);
      const currentRoleSet = new Set(currentRoleArray);
      const newRoleSet = new Set(roles);
      
      // 要添加的角色
      const rolesToAdd = roles.filter(role => !currentRoleSet.has(role));
      
      // 要删除的角色
      const rolesToRemove = Array.from(currentRoleSet).filter(role => !newRoleSet.has(role));
      
      // 检查是否需要创建删除请求
      await checkAndCreateDeleteRequest(targetUserId, currentRoleArray, roles);
      
      // 如果不是最高管理员，不能添加或删除管理员角色
      if (!isSupremAdmin && 
          (rolesToAdd.includes(ROLE_TYPES.ADMIN) || rolesToRemove.includes(ROLE_TYPES.ADMIN))) {
        await connection.rollback();
        return res.status(403).json({ error: '只有最高管理员才能添加或删除管理员角色' });
      }
      
      // 删除要移除的角色
      for (const role of rolesToRemove) {
        await connection.execute(
          'DELETE FROM community_user_roles WHERE user_id = ? AND role = ?',
          [targetUserId, role]
        );
        
        // 发送通知 - 注意这里的通知内容有问题，应该是role_removed而非role_assigned，后面会修复
        await connection.execute(
          'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
          [targetUserId, 'role_removed', `您的${getRoleDisplayName(role)}角色已被移除`, operatorId]
        );
      }
      
      // 添加新角色
      let createdTeacherUserId = null; // 用于跟踪是否已创建教师端账号
      let accountAlreadyExists = false; // 用于标记是否已存在教师端账号
      
      // 首先检查是否已有教师端账号映射
      const [studentInfo] = await connection.execute(
        'SELECT * FROM users WHERE id = ?',
        [targetUserId]
      );
      
      if (studentInfo.length > 0) {
        const student = studentInfo[0];
        // 检查是否已有教师端账号映射
        const teacherMapping = await userRoleMapping.getTeacherUserIdByStudentUserId(student.id);
        
        if (teacherMapping) {
          createdTeacherUserId = teacherMapping.teacherUserId;
          accountAlreadyExists = true;
          console.log(`学生(${student.id})已有教师端账号(${createdTeacherUserId})，保持原账号不变，仅添加新角色`);
          
          // 获取已有教师账号的详细信息，确保不覆盖原有信息
          try {
            // 这里可以添加获取教师端账号详情的API调用，但为了不修改太多，暂时不实现
            // 重要的是我们记录了账号已存在的状态
            console.log(`使用现有教师端账号ID: ${createdTeacherUserId}`);
          } catch (error) {
            console.error('获取教师端账号详情失败:', error);
          }
        } else {
          // 如果没有教师端账号，则先检查是否需要创建（如果包含TEACHER, ADMIN或ASSISTANT角色）
          const needsTeacherAccount = rolesToAdd.some(r => 
            r === ROLE_TYPES.TEACHER || r === ROLE_TYPES.ADMIN || r === ROLE_TYPES.ASSISTANT
          );
          
          if (needsTeacherAccount) {
            // 创建一个教师端账号
            try {
              const axios = require('axios');
              
              // 从邮箱中提取密码
              let initialPassword = student.studentId; // 默认使用学号作为备选
              if (student.email && student.email.includes('@')) {
                // 提取邮箱@符号前的部分作为密码
                initialPassword = student.email.split('@')[0];
                console.log(`从邮箱(${student.email})中提取密码: ${initialPassword}`);
              } else {
                console.log(`邮箱格式不正确或为空，使用学号作为默认密码: ${initialPassword}`);
              }
              
              // 确定角色类型前缀
              let rolePrefix = "TA"; // 默认用TA前缀
              let roleType = "assistant"; // 默认角色类型
              
              // 根据添加的角色确定前缀和类型
              if (rolesToAdd.includes(ROLE_TYPES.ADMIN)) {
                rolePrefix = "ADM"; // 管理员前缀
                roleType = "admin";
              } else if (rolesToAdd.includes(ROLE_TYPES.TEACHER)) {
                rolePrefix = "T"; // 教师前缀
                roleType = "teacher";
              }
              
              // 调用教师端API创建账号
              const teacherResponse = await axios.post('http://localhost:3002/register', {
                name: `${rolePrefix}-${student.name}`, // 角色前缀加名称
                gender: '男', // 默认值，可以后续修改
                teacher_id: `${rolePrefix}${student.studentId}`, // 角色前缀+学号
                phone: '',
                email: `${rolePrefix}${student.email}`,
                wechat: '',
                school: student.school,
                password: initialPassword,
                role: roleType, // 指定角色类型
                isFromStudent: true,  // 添加标记，表示是从学生端创建的账号
                studentUserId: student.id  // 传递已有的学生用户ID
              });
              
              if (teacherResponse.data && teacherResponse.data.teacherId) {
                createdTeacherUserId = teacherResponse.data.teacherId;
                console.log(`成功为学生创建教师端账号(角色: ${roleType})，ID: ${createdTeacherUserId}`);
                
                // 创建用户映射关系
                try {
                  await userRoleMapping.createUserRoleMapping(createdTeacherUserId, student.id, roleType);
                  console.log(`成功创建学生ID(${student.id})和教师ID(${createdTeacherUserId})的映射关系`);
                } catch (mappingError) {
                  console.error('创建用户映射关系失败:', mappingError);
                }
              } else {
                console.error('教师端账号创建失败，响应数据不完整：', JSON.stringify(teacherResponse.data));
              }
            } catch (accountError) {
              console.error('创建教师端账号失败:', accountError);
            }
          }
        }
      }
      
      // 添加每个角色到数据库
      for (const role of rolesToAdd) {
        await connection.execute(
          'INSERT INTO community_user_roles (user_id, role, teacher_id) VALUES (?, ?, ?)',
          [targetUserId, role, createdTeacherUserId]
        );
        
        let notificationMessage = `您被授予了${getRoleDisplayName(role)}角色`;
        if (createdTeacherUserId && !accountAlreadyExists && 
            (role === ROLE_TYPES.TEACHER || role === ROLE_TYPES.ADMIN || role === ROLE_TYPES.ASSISTANT)) {
          notificationMessage += '，已自动为您创建教师端账号';
        } else if (createdTeacherUserId && accountAlreadyExists && 
                  (role === ROLE_TYPES.TEACHER || role === ROLE_TYPES.ADMIN || role === ROLE_TYPES.ASSISTANT)) {
          notificationMessage += '，使用您现有的教师端账号';
        }
        
        // 发送通知
        await connection.execute(
          'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
          [targetUserId, 'role_assigned', notificationMessage, operatorId]
        );
      }
      
      await connection.commit();
      
      res.json({ message: '用户角色更新成功' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('更新用户角色失败:', error);
    res.status(500).json({ error: '更新用户角色失败' });
  }
});

// 获取所有用户及其角色（管理员使用）
router.get('/all-users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', searchType = 'name' } = req.query;
    
    // 确保分页参数是整数
    const limitNum = parseInt(limit, 10);
    const pageNum = parseInt(page, 10);
    const offset = (pageNum - 1) * limitNum;
    
    let query = `
      SELECT u.id, u.name, u.email, u.school, u.classNumber, u.studentId, u.registerTime
      FROM users u
    `;
    
    const queryParams = [];
    
    // 添加搜索条件
    if (search) {
      if (searchType === 'name') {
        query += ` WHERE u.name LIKE ? `;
        queryParams.push(`%${search}%`);
      } else if (searchType === 'email') {
        query += ` WHERE u.email LIKE ? `;
        queryParams.push(`%${search}%`);
      } else if (searchType === 'studentId') {
        query += ` WHERE u.studentId LIKE ? `;
        queryParams.push(`%${search}%`);
      } else if (searchType === 'school') {
        query += ` WHERE u.school LIKE ? `;
        queryParams.push(`%${search}%`);
      }
    }
    
    // 添加排序和分页
    query += ` ORDER BY u.registerTime DESC LIMIT ? OFFSET ?`;
    queryParams.push(limitNum, offset);
    
    // 执行查询
    console.log('SQL查询:', query);
    console.log('查询参数:', queryParams);
    
    // 使用connection.query代替pool.execute，避免参数类型问题
    const connection = await pool.getConnection();
    try {
      const [users] = await connection.query(query, queryParams);
      
      // 获取每个用户的角色
      for (const user of users) {
        const [roles] = await connection.query(
          'SELECT role FROM community_user_roles WHERE user_id = ?',
          [user.id]
        );
        
        user.roles = roles.length > 0 ? roles.map(r => r.role) : [ROLE_TYPES.STUDENT];
      }
      
      // 获取总数
      let countQuery = `SELECT COUNT(*) AS total FROM users u`;
      const countParams = [];
      
      if (search) {
        if (searchType === 'name') {
          countQuery += ` WHERE u.name LIKE ? `;
          countParams.push(`%${search}%`);
        } else if (searchType === 'email') {
          countQuery += ` WHERE u.email LIKE ? `;
          countParams.push(`%${search}%`);
        } else if (searchType === 'studentId') {
          countQuery += ` WHERE u.studentId LIKE ? `;
          countParams.push(`%${search}%`);
        } else if (searchType === 'school') {
          countQuery += ` WHERE u.school LIKE ? `;
          countParams.push(`%${search}%`);
        }
      }
      
      const [countResult] = await connection.query(countQuery, countParams);
      const total = countResult[0].total;
      
      res.json({
        users,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('获取用户列表失败:', error);
      res.status(500).json({ error: '获取用户列表失败' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 辅助函数：获取角色的显示名称
function getRoleDisplayName(role) {
  switch (role) {
   case ROLE_TYPES.SUPER_ADMIN:
     return '最高管理员';
    case ROLE_TYPES.ADMIN:
      return '管理员';
    case ROLE_TYPES.ASSISTANT:
      return '助教';
    case ROLE_TYPES.TEACHER:
      return '教师';
    case ROLE_TYPES.STUDENT:
      return '学生';
    default:
      return role;
  }
}

// 在主数据库初始化函数中添加删除请求表的初始化
// 这个调用应该在社区服务器启动时进行
initAccountDeleteRequestsTable()
  .then(() => {
    console.log('教师端账号删除请求表初始化成功');
  })
  .catch(error => {
    console.error('教师端账号删除请求表初始化失败:', error);
  });

module.exports = router;