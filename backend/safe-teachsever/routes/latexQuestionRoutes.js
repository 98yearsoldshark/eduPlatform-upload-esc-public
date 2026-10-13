// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../config/runtime');
const express = require('express');
const router = express.Router();
const latexQuestionController = require('../controllers/latexQuestionController');
const jwt = require('jsonwebtoken');
const { checkCanModifyQuestions } = require('../../config-city/server-nacos/middleware/permissionsMiddleware');

// 中间件：验证JWT令牌
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: '未提供访问令牌' });
  }
  
  jwt.verify(token, require('../../config/runtime').requireEnv('TEACHER_JWT_SECRET'), (err, teacher) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效或已过期' });
    }
    req.teacher = teacher;
    next();
  });
};

// 添加教师端验证中间件
router.use(authenticateToken);

// LaTeX题目路由
router.get('/', latexQuestionController.getAllLatexQuestions);
router.get('/:id', latexQuestionController.getLatexQuestion);
router.post('/', checkCanModifyQuestions, latexQuestionController.createLatexQuestion);
router.put('/:id', checkCanModifyQuestions, latexQuestionController.updateLatexQuestion);
router.delete('/:id', checkCanModifyQuestions, latexQuestionController.deleteLatexQuestion);

module.exports = router; 