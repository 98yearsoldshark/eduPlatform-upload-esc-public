// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../config/runtime');
const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileExplorerController');
const jwt = require('jsonwebtoken');
const { checkCanModifyQuestions } = require('../../config-city/server-nacos/middleware/permissionsMiddleware');

// 公开直接访问图片的路由(不需要身份验证)
router.get('/public-image', fileController.getImage);

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

// 添加教师端验证中间件 - 以下路由都需要验证
router.use(authenticateToken);

// 文件浏览器路由
router.get('/files', fileController.getFiles);
router.get('/file-content', fileController.getFileContent);
router.get('/image', fileController.getImage);
// 下面是修改文件操作，需要canModifyQuestions权限
router.post('/update-file', checkCanModifyQuestions, fileController.updateFileContent);
router.post('/create-text-file', checkCanModifyQuestions, fileController.createTextFile);
router.post('/generate-metadata', checkCanModifyQuestions, fileController.generateMetadata);
router.post('/replace-image', checkCanModifyQuestions, fileController.replaceImage);
router.post('/delete-file', checkCanModifyQuestions, fileController.deleteFile);

module.exports = router; 