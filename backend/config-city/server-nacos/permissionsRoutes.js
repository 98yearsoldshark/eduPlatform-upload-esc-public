/**
 * 权限配置路由
 * 定义权限配置相关的API端点
 */
const express = require('express');
const router = express.Router();
const permissionsController = require('./permissionsController');

// 中间件：检查是否为最高管理员
const checkSupremAdmin = async (req, res, next) => {
  try {
    console.log('【权限检查】开始进行权限验证...');
    console.log('【权限检查】请求头信息:', JSON.stringify(req.headers));
    console.log('【权限检查】认证头:', req.headers.authorization);
    console.log('【权限检查】请求参数:', req.query);
    console.log('【权限检查】Cookie信息:', req.headers.cookie);
    console.log('【权限检查】req.teacher:', req.teacher);
    
    // 临时禁用权限检查，方便测试
    // 在生产环境中应取消下面这行注释并启用实际权限检查
    // return next();
    
    // 判断用户是否已经通过认证
    if (!req.teacher || !req.teacher.id) {
      console.log('【权限检查】未找到认证用户信息, req.teacher为空');
      
      // 临时解决方案：检查请求中是否包含token参数
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        console.log('【权限检查】从Authorization头提取的令牌:', token.substring(0, 10) + '...');
        
        // 这里可以添加临时的令牌验证逻辑
        try {
          // 如果有JWT模块，可以尝试解析令牌
          // const jwt = require('jsonwebtoken');
          // const decoded = jwt.verify(token, 'your-secret-key');
          // console.log('【权限检查】解析的令牌内容:', decoded);
          
          // 临时调试：为了排查问题，可以尝试设置一个模拟用户
          // req.teacher = { id: 1 };
          // return next();
        } catch (tokenError) {
          console.error('【权限检查】令牌解析失败:', tokenError.message);
        }
      }
      
      return res.status(401).json({
        success: false,
        error: '未授权访问',
        requiredAuth: true,
        debug: '请求未包含有效的用户认证信息'
      });
    }
    
    console.log('【权限检查】用户ID:', req.teacher.id);
    
    // 查询用户是否具有super_admin角色
    // 注意：这应该使用你已有的角色检查逻辑
    const hasSupremRole = await isSupremAdmin(req.teacher.id);
    console.log('【权限检查】用户是否具有最高管理员权限:', hasSupremRole);
    
    if (!hasSupremRole) {
      return res.status(403).json({
        success: false,
        error: '权限不足，只有最高管理员可以管理权限配置',
        requiredRole: 'super_admin'
      });
    }
    
    console.log('【权限检查】权限验证通过，进入下一步处理');
    next();
  } catch (error) {
    console.error('【权限检查】权限检查过程发生错误:', error);
    console.error('【权限检查】错误详情:', error.stack);
    res.status(500).json({
      success: false,
      error: '权限检查过程发生错误',
      message: error.message
    });
  }
};

// 中间件：检查用户是否已认证（用于公共读取配置的接口）
const checkAuthenticated = (req, res, next) => {
  try {
    console.log('【用户认证】检查用户是否已认证...');
    
    // 判断用户是否已经通过认证
    if (!req.teacher || !req.teacher.id) {
      console.log('【用户认证】未找到认证用户信息, req.teacher为空');
      
      return res.status(401).json({
        success: false,
        error: '未授权访问',
        requiredAuth: true
      });
    }
    
    console.log('【用户认证】用户ID:', req.teacher.id);
    console.log('【用户认证】用户认证通过，进入下一步处理');
    next();
  } catch (error) {
    console.error('【用户认证】认证检查过程发生错误:', error);
    res.status(500).json({
      success: false,
      error: '用户认证过程发生错误',
      message: error.message
    });
  }
};

// 角色检查函数（应与你的系统集成）
async function isSupremAdmin(teacherId) {
  try {
    console.log('【权限查询】开始查询用户是否为最高管理员, 教师ID:', teacherId);
    
    // 此处应使用你实际的数据库查询
    // 示例实现，实际应替换为你的代码
    const mysql = require('mysql2/promise');
    const pool = require('../../../backend/community-server/server').pool;
    
    if (!pool) {
      console.error('【权限查询】数据库连接池不可用');
      throw new Error('数据库连接不可用');
    }
    
    console.log('【权限查询】数据库连接池可用，执行角色查询');
    
    // 查询用户是否拥有super_admin角色
    const [superAdminRoles] = await pool.execute(
      `SELECT 1 FROM community_user_roles 
      WHERE teacher_id = ? AND role = ?`,
      [teacherId, 'super_admin']
    );
    
    console.log('【权限查询】查询结果:', superAdminRoles);
    const isAdmin = superAdminRoles.length > 0;
    console.log('【权限查询】是否为最高管理员:', isAdmin);
    
    return isAdmin;
  } catch (error) {
    console.error('【权限查询】检查最高管理员权限失败:', error);
    console.error('【权限查询】错误详情:', error.stack);
    // 发生错误时，安全起见拒绝访问
    return false;
  }
}

// 公共权限配置获取路由 - 所有已认证用户都可访问，不需要管理员权限
router.get('/config/public', checkAuthenticated, permissionsController.getPermissionsConfig);

// 管理权限配置 - 需要最高管理员权限
router.get('/config', checkSupremAdmin, permissionsController.getPermissionsConfig);

// 更新角色权限
router.post('/roles/:role', checkSupremAdmin, permissionsController.updateRolePermissions);

// 更新策略配置
router.post('/policies', checkSupremAdmin, permissionsController.updatePolicies);

// 更新社区配置
router.post('/community', checkSupremAdmin, permissionsController.updateCommunityConfig);

// 校验配置
router.post('/validate', checkSupremAdmin, permissionsController.validateConfig);

// 获取配置历史
router.get('/history', checkSupremAdmin, permissionsController.getConfigHistory);

// 获取注册配置
router.get('/register-config', checkSupremAdmin, permissionsController.getRegisterConfig);

// 更新学生端注册配置
router.post('/register-config/student', checkSupremAdmin, permissionsController.updateStudentRegisterConfig);

// 更新教师端注册配置
router.post('/register-config/teacher', checkSupremAdmin, permissionsController.updateTeacherRegisterConfig);

// 更新注册安全配置
router.post('/register-config/security', checkSupremAdmin, permissionsController.updateSecurityConfig);

// 添加一个简单的路由来测试JWT认证配置
router.get('/auth-test', (req, res) => {
  console.log('【认证测试】请求头信息:', JSON.stringify(req.headers));
  console.log('【认证测试】认证头:', req.headers.authorization);
  console.log('【认证测试】req.teacher:', req.teacher);
  
  res.json({
    success: true,
    message: '认证测试API响应成功',
    authHeader: req.headers.authorization ? '存在' : '不存在',
    teacherInfo: req.teacher || '未找到'
  });
});

module.exports = router; 