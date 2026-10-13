// 先加载私有运行配置，禁止在源码中保存凭据。
require('../config/runtime');
/**
 * 用户认证中间件 - 用于验证用户身份和角色
 */
const jwt = require('jsonwebtoken');
const userRoleMapping = require('../community-server/db/userRoleMapping');

// JWT密钥 - 应该与sever.js中保持一致
const JWT_SECRET = require('../config/runtime').requireEnv('JWT_SECRET');
// 教师端JWT密钥
const TEACHER_JWT_SECRET = require('../config/runtime').requireEnv('TEACHER_JWT_SECRET');

/**
 * 学生端认证中间件
 * 验证用户JWT令牌并将用户信息附加到请求对象
 */
const authenticateStudent = async (req, res, next) => {
  try {
    // 从请求头或查询参数中获取令牌
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    
    if (!token) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }
    
    // 首先尝试验证JWT令牌格式
    try {
      // 验证JWT令牌
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // 如果是新格式的JWT令牌
      if (decoded && decoded.id) {
        // 从数据库获取完整用户信息
        const [users] = await req.app.locals.pool.promise().query(
          'SELECT * FROM users WHERE id = ?',
          [decoded.id]
        );
        
        if (users.length > 0) {
          const { password, ...userWithoutPassword } = users[0];
          req.user = {
            ...userWithoutPassword,
            role: decoded.role || 'student',
            teacherUserId: decoded.teacherUserId
          };
          return next();
        }
      }
    } catch (jwtError) {
      // JWT验证失败，尝试旧版JSON格式
      if (token.startsWith('{') && token.endsWith('}')) {
        try {
          // 解析JSON令牌
          const tokenData = JSON.parse(token);
          if (tokenData.user) {
            req.user = tokenData.user;
            
            // 如果令牌中没有角色信息，尝试从映射表获取
            if (!req.user.role) {
              const roleInfo = await userRoleMapping.getTeacherUserIdByStudentUserId(req.user.id);
              if (roleInfo) {
                req.user.role = roleInfo.role;
                req.user.teacherUserId = roleInfo.teacherUserId;
              } else {
                req.user.role = 'student'; // 默认角色
              }
            }
            
            return next();
          }
        } catch (parseError) {
          return res.status(401).json({ error: '无效的令牌格式' });
        }
      }
      
      // 尝试验证旧版教师端JWT令牌
      try {
        const teacherDecoded = jwt.verify(token, TEACHER_JWT_SECRET);
        
        // 如果是教师端的令牌，需要获取对应的学生账号
        if (teacherDecoded.id && !teacherDecoded.studentUserId) {
          // 这是一个教师令牌，查找对应的学生账号
          const roleInfo = await userRoleMapping.getStudentUserIdByTeacherUserId(teacherDecoded.id);
          if (roleInfo && roleInfo.studentUserId) {
            // 查询学生信息
            const [students] = await req.app.locals.pool.promise().query(
              'SELECT * FROM users WHERE id = ?',
              [roleInfo.studentUserId]
            );
            
            if (students.length > 0) {
              req.user = {
                ...students[0],
                role: roleInfo.role,
                teacherUserId: teacherDecoded.id
              };
              return next();
            }
          }
          return res.status(401).json({ error: '找不到对应的学生账号' });
        }
        
        // 如果令牌中已包含学生ID信息
        if (teacherDecoded.studentUserId) {
          // 查询学生信息
          const [students] = await req.app.locals.pool.promise().query(
            'SELECT * FROM users WHERE id = ?',
            [teacherDecoded.studentUserId]
          );
          
          if (students.length > 0) {
            req.user = {
              ...students[0],
              role: teacherDecoded.role || 'student',
              teacherUserId: teacherDecoded.id
            };
            return next();
          }
        }
      } catch (teacherError) {
        // 所有验证方法都失败
        return res.status(401).json({ error: '无效或已过期的令牌' });
      }
    }
    
    return res.status(401).json({ error: '无效的用户信息' });
  } catch (error) {
    console.error('认证错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

/**
 * 教师端认证中间件
 * 验证教师JWT令牌
 */
const checkTeacherToken = async (req, res, next) => {
  try {
    // 从请求头或查询参数中获取令牌
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    
    if (!token) {
      return res.status(401).json({ error: '未提供访问令牌' });
    }
    
    try {
      // 验证教师端JWT令牌
      const decoded = jwt.verify(token, TEACHER_JWT_SECRET);
      
      if (decoded && decoded.id) {
        // 将教师信息附加到请求对象
        req.teacher = {
          id: decoded.id,
          name: decoded.name,
          email: decoded.email,
          roles: decoded.roles || []
        };
        
        return next();
      }
      
      return res.status(401).json({ error: '无效的教师令牌' });
    } catch (error) {
      console.error('教师令牌验证失败:', error);
      return res.status(401).json({ error: '无效或已过期的教师令牌' });
    }
  } catch (error) {
    console.error('教师认证错误:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
};

module.exports = {
  authenticateStudent,
  checkTeacherToken
};