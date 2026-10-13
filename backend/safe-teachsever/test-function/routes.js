const express = require('express');
const router = express.Router();
const fileController = require('./fileController');
const imageController = require('./imageController');

// 使用简单的无验证路由
router.get('/files', (req, res, next) => {
  console.log('处理文件列表请求');
  // 可以在这里添加简单的验证逻辑
  next();
}, fileController.getFiles);

router.get('/file-content', (req, res, next) => {
  console.log('处理文件内容请求');
  // 可以在这里添加简单的验证逻辑
  next();
}, fileController.getFileContent);

// 添加图片处理相关路由
router.get('/image', (req, res, next) => {
  console.log('处理图片请求');
  next();
}, imageController.getImage);

router.get('/image-thumbnail', (req, res, next) => {
  console.log('处理图片缩略图请求');
  next();
}, imageController.getImageThumbnail);

router.get('/image-metadata', (req, res, next) => {
  console.log('处理图片元数据请求');
  next();
}, imageController.getImageMetadata);

// 文件操作相关路由
router.post('/update-file', (req, res, next) => {
  console.log('处理文件更新请求');
  next();
}, fileController.updateFileContent);

router.post('/create-text-file', (req, res, next) => {
  console.log('处理文本文件创建请求');
  next();
}, fileController.createTextFile);

router.post('/generate-metadata', (req, res, next) => {
  console.log('处理元数据生成请求');
  next();
}, fileController.generateMetadata);

router.post('/replace-image', (req, res, next) => {
  console.log('处理图片替换请求');
  next();
}, fileController.replaceImage);

module.exports = router; 