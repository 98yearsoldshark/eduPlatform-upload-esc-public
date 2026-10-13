/**
 * 社区用户相关路由
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // 用于密码加密

// 使用server.js中的连接池和executeWithRetry函数
const { pool, executeWithRetry } = require('../server');

// 注意：具体路由必须在参数路由之前定义，以避免路由冲突

// 搜索用户
router.get('/search', async (req, res) => {
  try {
    const { query, userId } = req.query;
    
    if (!query || !userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 搜索用户（排除自己）
    const [users] = await pool.execute(
      `SELECT id, name, email, school, classNumber, studentId
       FROM users 
       WHERE id != ? AND (name LIKE ? OR email LIKE ? OR school LIKE ?)
       LIMIT 10`,
      [userId, `%${query}%`, `%${query}%`, `%${query}%`]
    );
     
    // 获取每个用户的角色信息
    const usersWithRoles = await Promise.all(users.map(async (user) => {
      // 查询用户是否有助教角色
      const [roles] = await pool.execute(
        'SELECT role FROM community_user_roles WHERE user_id = ? AND role = "assistant"',
        [user.id]
      );
      
      return {
        ...user,
        isAssistant: roles.length > 0 // 如果有助教角色，则设置为true
      };
    }));
    
    res.json(usersWithRoles);
  } catch (error) {
    console.error('搜索用户失败:', error);
    res.status(500).json({ error: '搜索用户失败' });
  }
});

// 修改密码
router.put('/:id/change-password', async (req, res) => {
  try {
    const userId = req.params.id;
    const { oldPassword, newPassword, confirmPassword } = req.body;
    
    if (!userId || !oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: '两次输入的新密码不一致' });
    }
    
    // 验证旧密码
    const [users] = await pool.execute(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const isPasswordValid = await bcrypt.compare(oldPassword, users[0].password);
    
    if (!isPasswordValid) {
      return res.status(400).json({ error: '当前密码不正确' });
    }
    
    // 加密新密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // 更新密码
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );
    
    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// 更新用户信息
router.put('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, school, studentId, operatorId, isTeacher } = req.body;
    console.log('userId', userId, 'operatorId', operatorId);
    
    if (!userId || !operatorId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 验证操作者权限
    if (String(userId) !== String(operatorId)) {
      // 如果不是自己，检查是否有管理员权限
      const [adminRoles] = await pool.execute(
        'SELECT 1 FROM community_user_roles WHERE user_id = ? AND role IN ("admin", "super_admin")',
        [operatorId]
      );
      
      if (adminRoles.length === 0) {
        return res.status(403).json({ error: '您没有权限修改其他用户的信息' });
      }
    }
    
    // 更新用户信息
    await pool.execute(
      'UPDATE users SET name = ?, email = ?, school = ?, studentId = ? WHERE id = ?',
      [name, email, school, studentId, userId]
    );
    
    res.json({ message: '用户信息更新成功' });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({ error: '更新用户信息失败' });
  }
});

// 获取单个用户信息（必须放在具体路由如/search之后）
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { isTeacher } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    let userQuery;
    let userParams;
    
    if (isTeacher === 'true') {
      // 通过teacher_id查询用户
      userQuery = `
        SELECT u.id, u.name, u.email, u.school, u.classNumber, u.studentId
        FROM users u
        JOIN community_user_roles r ON r.teacher_id = ?
        WHERE r.teacher_id = ?
        LIMIT 1
      `;
      userParams = [userId, userId];
    } else {
      // 通过user_id查询用户
      userQuery = `
        SELECT id, name, email, school, classNumber, studentId
        FROM users
        WHERE id = ?
      `;
      userParams = [userId];
    }
    
    const [users] = await pool.execute(userQuery, userParams);
    
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = users[0];
    
    // 获取用户角色
    const [roles] = await pool.execute(
      'SELECT role FROM community_user_roles WHERE user_id = ?',
      [user.id]
    );
    
    res.json({
      ...user,
      roles: roles.map(r => r.role)
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

module.exports = router;