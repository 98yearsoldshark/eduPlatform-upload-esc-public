/**
 * 用户个人资料相关路由
 */
const express = require('express');
const router = express.Router();
const { authenticateStudent } = require('../middleware/authMiddleware');
const userRoleMapping = require('../community-server/db/userRoleMapping');

// 获取当前用户信息
router.get('/me', authenticateStudent, async (req, res) => {
  try {
    // 用户信息已经在认证中间件中添加到req.user
    const { password, ...userWithoutPassword } = req.user;
    
    // 返回不包含密码的用户信息
    res.json({
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 更新当前用户信息
router.put('/me', authenticateStudent, async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone, school, classNumber, name, wechat } = req.body;
    
    // 不允许直接更新email和studentId，这些是关键标识
    const updateData = { phone, school, classNumber, name, wechat };
    
    // 检查是否是映射用户（教师、助教、管理员）
    const roleInfo = await userRoleMapping.getTeacherUserIdByStudentUserId(userId);
    
    if (roleInfo) {
      // 如果是映射用户，某些字段的更新应该在教师端进行
      const [results] = await req.app.locals.pool.promise().query(
        'UPDATE users SET ? WHERE id = ?', 
        [updateData, userId]
      );
      
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      
      res.json({ 
        message: '用户信息更新成功', 
        note: '您是教师/助教/管理员账号，某些信息只能在教师端更新'
      });
    } else {
      // 普通学生用户可以更新所有允许的字段
      const [results] = await req.app.locals.pool.promise().query(
        'UPDATE users SET ? WHERE id = ?', 
        [updateData, userId]
      );
      
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      
      res.json({ message: '用户信息更新成功' });
    }
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({ error: '更新用户信息失败' });
  }
});

// 获取用户角色信息
router.get('/role', authenticateStudent, async (req, res) => {
  try {
    const userId = req.user.id;
    let role = req.user.role || 'student';
    let teacherUserId = req.user.teacherUserId;
    
    // 如果请求中没有角色信息，尝试从映射表获取
    if (!role || role === 'student') {
      const roleInfo = await userRoleMapping.getTeacherUserIdByStudentUserId(userId);
      if (roleInfo) {
        role = roleInfo.role;
        teacherUserId = roleInfo.teacherUserId;
      }
    }
    
    res.json({
      userId,
      role,
      teacherUserId,
      // 在学生端，特殊角色用户只有普通权限
      permissions: ['student_basic'],
      isSpecialRole: role !== 'student'
    });
  } catch (error) {
    console.error('获取用户角色失败:', error);
    res.status(500).json({ error: '获取用户角色失败' });
  }
});

module.exports = router;