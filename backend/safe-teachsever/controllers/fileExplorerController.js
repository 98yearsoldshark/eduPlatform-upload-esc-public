// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../config/runtime');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const multer = require('multer');
const express = require('express');
const jwt = require('jsonwebtoken');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// 修改基础路径设置为教师端题目资源目录
const BASE_PATH = path.join(__dirname, '../../../backend/prtsc');

// 打印实际路径，用于调试
console.log('题目资源目录路径:', BASE_PATH);

// 获取文件列表
exports.getFiles = async (req, res) => {
  try {
    const requestedPath = req.query.path || '';
    
    // 确保路径在prtsc目录下，防止目录遍历攻击
    const fullPath = path.resolve(BASE_PATH, requestedPath);
    if (!fullPath.startsWith(BASE_PATH)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }
    
    console.log('正在访问目录:', fullPath);
    
    // 检查目录是否存在
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '目录不存在', path: fullPath });
    }
    
    // 读取目录内容
    const files = await readdir(fullPath);
    
    // 获取文件/目录信息
    const filePromises = files.map(async (file) => {
      const filePath = path.join(fullPath, file);
      const stats = await stat(filePath);
      
      // 计算相对于BASE_PATH的路径
      const relativePath = path.relative(BASE_PATH, filePath);
      
      return {
        name: file,
        isDirectory: stats.isDirectory(),
        path: relativePath.replace(/\\/g, '/') // 统一使用正斜杠
      };
    });
    
    const fileInfos = await Promise.all(filePromises);
    
    // 排序：先文件夹，再文件
    fileInfos.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    console.log(`找到 ${fileInfos.length} 个文件/目录`);
    res.json({ files: fileInfos });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    res.status(500).json({ error: '获取文件列表失败', details: error.message });
  }
};

// 获取文件内容
exports.getFileContent = async (req, res) => {
  try {
    const requestedPath = req.query.path || '';
    
    // 确保路径在question-resources目录下，防止目录遍历攻击
    const fullPath = path.resolve(BASE_PATH, requestedPath);
    if (!fullPath.startsWith(BASE_PATH)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }
    
    console.log('正在访问文件:', fullPath);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件不存在', path: fullPath });
    }
    
    // 检查是否为文件
    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: '不能读取目录内容' });
    }
    
    // 读取文件内容
    const content = await readFile(fullPath, 'utf8');
    
    res.json({ content });
  } catch (error) {
    console.error('获取文件内容失败:', error);
    res.status(500).json({ error: '获取文件内容失败', details: error.message });
  }
};

// 获取图片
exports.getImage = async (req, res) => {
  try {
    const requestedPath = req.query.path || '';
    const token = req.query.token; // 从查询参数获取令牌
    
    // 确保路径在prtsc目录下，防止目录遍历攻击
    const fullPath = path.resolve(BASE_PATH, requestedPath);
    if (!fullPath.startsWith(BASE_PATH)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }
    
    console.log('正在访问图片:', fullPath);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '图片不存在', path: fullPath });
    }
    
    // 检查是否为文件
    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: '不能读取目录作为图片' });
    }
    
    // 如果有令牌参数，则验证令牌
    if (token) {
      try {
        // 验证令牌
        jwt.verify(token, require('../../config/runtime').requireEnv('TEACHER_JWT_SECRET'));
        // 令牌有效，继续处理
      } catch (err) {
        console.error('令牌验证失败:', err);
        return res.status(403).json({ error: '无效的访问令牌' });
      }
    }
    
    // 直接发送文件
    res.sendFile(fullPath);
  } catch (error) {
    console.error('获取图片失败:', error);
    res.status(500).json({ error: '获取图片失败', details: error.message });
  }
};

// 更新文件内容
exports.updateFileContent = async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: '缺少文件路径' });
    }
    
    if (typeof content !== 'string') {
      return res.status(400).json({ error: '缺少文件内容或类型不正确' });
    }
    
    // 确保路径在question-resources目录下，防止目录遍历攻击
    const fullPath = path.resolve(BASE_PATH, filePath);
    if (!fullPath.startsWith(BASE_PATH)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }
    
    console.log('正在更新文件:', fullPath);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件不存在', path: fullPath });
    }
    
    // 检查是否为文件
    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: '不能更新目录' });
    }
    
    // 写入文件内容
    await writeFile(fullPath, content, 'utf8');
    
    res.json({ success: true, message: '文件内容已更新' });
  } catch (error) {
    console.error('更新文件内容失败:', error);
    res.status(500).json({ error: '更新文件内容失败', details: error.message });
  }
};

// 创建文本文件
exports.createTextFile = async (req, res) => {
  try {
    const { directory, filename, content } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: '缺少目录路径' });
    }
    
    if (!filename) {
      return res.status(400).json({ error: '缺少文件名' });
    }
    
    if (typeof content !== 'string') {
      return res.status(400).json({ error: '缺少文件内容或类型不正确' });
    }
    
    // 确保路径在question-resources目录下，防止目录遍历攻击
    const dirPath = path.resolve(BASE_PATH, directory);
    if (!dirPath.startsWith(BASE_PATH)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }
    
    // 检查目录是否存在
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: '目录不存在', path: dirPath });
    }
    
    // 创建完整的文件路径
    const fullPath = path.join(dirPath, filename);
    
    // 检查文件是否已存在
    if (fs.existsSync(fullPath)) {
      return res.status(400).json({ error: '文件已存在', path: fullPath });
    }
    
    console.log('正在创建文件:', fullPath);
    
    // 写入文件内容
    await writeFile(fullPath, content, 'utf8');
    
    // 返回相对路径
    const relativePath = path.relative(BASE_PATH, fullPath).replace(/\\/g, '/');
    
    res.json({ 
      success: true, 
      message: '文件已创建', 
      file: {
        name: filename,
        path: relativePath,
        isDirectory: false
      }
    });
  } catch (error) {
    console.error('创建文件失败:', error);
    res.status(500).json({ error: '创建文件失败', details: error.message });
  }
};

// 生成元数据文件
exports.generateMetadata = async (req, res) => {
  try {
    const { directory } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: '缺少目录路径' });
    }
    
    // 确保路径在prtsc目录下，防止目录遍历攻击
    const dirPath = path.resolve(BASE_PATH, directory);
    if (!dirPath.startsWith(BASE_PATH)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }
    
    // 检查目录是否存在
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: '目录不存在', path: dirPath });
    }
    
    // 使用中国地区时间
    const now = new Date();
    // 格式化为中国时区的ISO字符串
    const chinaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const isoString = chinaTime.toISOString();
    
    // 获取目录结构信息，用于分析学科、年级等信息
    const pathParts = directory.split('/').filter(Boolean);
    
    // 分析目录路径，尝试提取学科、年级、年份、类型等信息
    const subject = pathParts.length > 0 ? pathParts[0] : '待定';
    const grade = pathParts.length > 1 ? pathParts[1] : '待定';
    const year = pathParts.length > 2 ? pathParts[2] : '';
    const type = pathParts.length > 3 ? pathParts[3] : '待定';
    
    // 使用时间戳命名格式：年月日T时分秒（中国时间）
    const timestamp = `${chinaTime.getFullYear()}${(chinaTime.getMonth()+1).toString().padStart(2, '0')}${chinaTime.getDate().toString().padStart(2, '0')}T${chinaTime.getHours().toString().padStart(2, '0')}${chinaTime.getMinutes().toString().padStart(2, '0')}${chinaTime.getSeconds().toString().padStart(2, '0')}`;
    
    // 从answer.txt文件中读取正确答案，如果文件不存在则使用默认值A
    let correctAnswer = "A"; // 默认值
    const answerFilePath = path.join(dirPath, 'answer.txt');
    console.log('正在检查答案文件:', answerFilePath);
    
    if (fs.existsSync(answerFilePath)) {
      try {
        // 读取answer.txt文件内容
        const answerContent = await readFile(answerFilePath, 'utf8');
        // 去除空白字符并获取答案
        correctAnswer = answerContent.trim();
        console.log('从answer.txt读取到正确答案:', correctAnswer);
      } catch (error) {
        console.error('读取answer.txt文件失败:', error);
        // 读取失败时使用默认值A
      }
    } else {
      console.log('answer.txt文件不存在，使用默认值A');
    }
    
    // 元数据模板，参考提供的格式
    const metadata = {
      created_at: isoString,
      updated_at: isoString,
      upload_type: "image", // 默认为图片类型，可根据实际情况修改
      correct_answer: correctAnswer, // 使用从answer.txt读取的值或默认值
      path: dirPath // 保存完整路径信息
    };
    
    const metadataPath = path.join(dirPath, 'metadata.json');
    console.log('正在创建元数据文件:', metadataPath);
    
    // 写入元数据文件
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    
    // 返回相对路径
    const relativePath = path.relative(BASE_PATH, metadataPath).replace(/\\/g, '/');
    
    res.json({ 
      success: true, 
      message: '元数据文件已生成', 
      file: {
        name: 'metadata.json',
        path: relativePath,
        isDirectory: false
      }
    });
  } catch (error) {
    console.error('生成元数据文件失败:', error);
    res.status(500).json({ error: '生成元数据文件失败', details: error.message });
  }
};

// 替换图片
exports.replaceImage = async (req, res) => {
  try {
    // 在处理上传前先调试输出请求信息
    console.log('接收到图片上传请求，请求体:', req.body);
    console.log('接收到图片上传请求，查询参数:', req.query);
    
    // 从URL参数中获取目录信息
    const uploadDirectory = req.query.directory || '';
    console.log('从URL参数获取的上传目录:', uploadDirectory);
    
    if (!uploadDirectory) {
      return res.status(400).json({ error: '上传目录参数为空，无法处理上传' });
    }
    
    // 验证上传目录
    const uploadPath = path.resolve(BASE_PATH, uploadDirectory);
    console.log('解析后的完整上传路径:', uploadPath);
    
    // 检查目录是否存在
    if (!fs.existsSync(uploadPath)) {
      console.error('上传目录不存在:', uploadPath);
      return res.status(400).json({ error: '上传目录不存在' });
    }
    
    // 确认上传目录存在且在BASE_PATH内
    if (!uploadPath.startsWith(BASE_PATH)) {
      console.error('上传路径不在允许范围内:', uploadPath);
      return res.status(403).json({ error: '上传路径不在允许范围内' });
    }
    
    // 自定义存储配置
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        console.log('Multer使用的上传目录:', uploadPath);
        cb(null, uploadPath);
      },
      filename: function (req, file, cb) {
        // 获取图片扩展名
        const ext = path.extname(file.originalname).toLowerCase();
        // 固定文件名为A，保留原始扩展名
        const newFilename = 'A' + ext;
        console.log('设置新文件名:', newFilename);
        cb(null, newFilename);
      }
    });
    
    const upload = multer({ 
      storage: storage,
      fileFilter: function(req, file, cb) {
        // 检查是否为图片文件
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
        if (!allowedTypes.includes(ext)) {
          return cb(new Error('只允许上传图片文件'), false);
        }
        cb(null, true);
      }
    }).single('file');
    
    upload(req, res, async function(err) {
      if (err) {
        console.error('文件上传失败:', err);
        return res.status(400).json({ error: '文件上传失败', details: err.message });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: '没有上传文件' });
      }
      
      console.log('文件上传成功:', req.file);
      console.log('上传文件保存位置:', req.file.path);
      
      // 检查目录中是否已存在其他图片文件（除了刚上传的）
      try {
        const files = await readdir(uploadPath);
        const imageFiles = files.filter(filename => {
          // 获取文件扩展名
          const ext = path.extname(filename).toLowerCase();
          const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext);
          // 不包括刚上传的图片
          const isNotCurrent = filename !== req.file.filename;
          return isImage && isNotCurrent;
        });
        
        // 如果存在其他图片文件，删除它们
        for (const filename of imageFiles) {
          const imagePath = path.join(uploadPath, filename);
          console.log('删除已存在的图片:', imagePath);
          await promisify(fs.unlink)(imagePath);
        }
      } catch (error) {
        console.error('处理目录中的其他图片文件失败:', error);
      }
      
      const filePath = path.relative(BASE_PATH, req.file.path).replace(/\\/g, '/');
      
      res.json({
        success: true,
        message: '图片已替换为"A"',
        file: {
          name: req.file.filename,
          path: filePath,
          isDirectory: false
        }
      });
    });
  } catch (error) {
    console.error('替换图片失败:', error.message, error.stack);
    res.status(500).json({ error: '替换图片失败', details: error.message });
  }
};

// 删除文件
exports.deleteFile = async (req, res) => {
  try {
    const { path: filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: '缺少文件路径' });
    }
    
    // 确保路径在prtsc目录下，防止目录遍历攻击
    const fullPath = path.resolve(BASE_PATH, filePath);
    if (!fullPath.startsWith(BASE_PATH)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }
    
    console.log('正在删除文件:', fullPath);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件不存在', path: fullPath });
    }
    
    // 检查是否为文件
    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: '不能删除目录，仅支持删除文件' });
    }
    
    // 删除文件
    await promisify(fs.unlink)(fullPath);
    
    res.json({ 
      success: true, 
      message: '文件已删除',
      deletedPath: filePath
    });
  } catch (error) {
    console.error('删除文件失败:', error);
    res.status(500).json({ error: '删除文件失败', details: error.message });
  }
}; 