/**
 * 角色认证中间件 - 用于验证用户角色权限
 */
const userRoleMapping = require('../community-server/db/userRoleMapping');

/**
 * 创建角色验证中间件
 * @param {Array} allowedRoles - 允许访问的角色数组
 * @param {Boolean} teacherSide - 是否为教师端验证
 * @returns {Function} 中间件函数
 */
function roleAuth(allowedRoles, teacherSide = false) {
  return async function(req, res, next) {
    try {
      // 获取用户信息
      const user = req.user || req.teacher;
      
      if (!user || !user.id) {
        return res.status(401).json({ 
          error: '未授权访问，请先登录',
          requiredAuth: true 
        });
      }
      
      // 根据不同端获取角色信息
      let role = 'student'; // 默认角色
      
      if (teacherSide) {
        // 教师端验证
        if (user.role) {
          // 如果令牌中已包含角色信息
          role = user.role;
        } else {
          // 否则从映射表中获取
          const roleInfo = await userRoleMapping.getStudentUserIdByTeacherUserId(user.id);
          if (roleInfo) {
            role = roleInfo.role;
          }
        }
      } else {
        // 学生端验证
        if (user.role) {
          // 如果令牌中已包含角色信息
          role = user.role;
        } else {
          // 否则从映射表中获取
          const roleInfo = await userRoleMapping.getTeacherUserIdByStudentUserId(user.id);
          if (roleInfo) {
            role = roleInfo.role;
          }
        }
      }
      
      // 确保角色信息被添加到请求对象中，无论权限是否足够
      if (teacherSide) {
        req.teacher.role = role;
      } else {
        req.user.role = role;
      }
      
      // 检查用户角色是否在允许的角色列表中
      if (allowedRoles.includes(role)) {
        next();
      } else {
        // 返回更详细的错误信息
        res.status(403).json({ 
          error: '权限不足，无法访问此资源',
          currentRole: role,
          allowedRoles: allowedRoles,
          endpoint: req.originalUrl,
          method: req.method,
          userInfo: {
            id: user.id,
            name: user.name || '未知',
            email: user.email
          }
        });
      }
    } catch (error) {
      console.error('角色验证失败:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  };
}

/**
 * 学生端角色验证中间件
 * @param {Array} allowedRoles - 允许访问的角色数组
 */
function studentRoleAuth(allowedRoles) {
  return roleAuth(allowedRoles, false);
}

/**
 * 教师端角色验证中间件
 * @param {Array} allowedRoles - 允许访问的角色数组
 */
function teacherRoleAuth(allowedRoles) {
  return roleAuth(allowedRoles, true);
}

module.exports = {
  roleAuth,
  studentRoleAuth,
  teacherRoleAuth
};