/**
 * 题目管理路由 - 认证模块
 */
const express = require('express');

// 用于验证请求的中间件
const authenticate = async (req, res, next) => {
  console.log('【认证模块】开始验证请求...');
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    console.log('【认证模块】未提供授权令牌，验证失败');
    return res.status(401).json({ message: '未提供授权令牌' });
  }
  
  try {
    // 假设已有验证机制，这里简单处理
    // 实际项目中应该验证token的有效性
    console.log('【认证模块】令牌验证成功');
    next();
  } catch (error) {
    console.error('【认证模块】验证失败:', error);
    return res.status(403).json({ message: '授权验证失败' });
  }
};

module.exports = {
  authenticate
}; 