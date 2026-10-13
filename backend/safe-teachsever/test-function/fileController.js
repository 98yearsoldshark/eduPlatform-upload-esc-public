const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const multer = require('multer');
const express = require('express');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// 修改基础路径设置为正确的prtsc目录
const BASE_PATH = path.join(__dirname, '../../../backend/prtsc');

// 打印实际路径，用于调试
console.log('prtsc目录路径:', BASE_PATH);

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
    
    // 确保路径在prtsc目录下，防止目录遍历攻击
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
    
    // 确保路径在prtsc目录下，防止目录遍历攻击
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
    
    // 确保路径在prtsc目录下，防止目录遍历攻击
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
    const isoString = new Date(now.getTime() + (8 * 60 * 60 * 1000)).toISOString();
    
    // 尝试读取answer.txt获取正确答案
    let correctAnswer = 'A'; // 默认值
    const answerPath = path.join(dirPath, 'answer.txt');
    
    try {
      if (fs.existsSync(answerPath)) {
        const answerContent = await readFile(answerPath, 'utf8');
        if (answerContent && answerContent.trim()) {
          correctAnswer = answerContent.trim();
          console.log('从answer.txt读取到正确答案:', correctAnswer);
        }
      } else {
        console.log('answer.txt不存在，使用默认值A');
      }
    } catch (error) {
      console.error('读取answer.txt失败:', error);
      // 出错时使用默认值
    }
    
    // 元数据内容
    const metadata = {
      created_at: isoString,
      updated_at: isoString,
      upload_type: "image",
      correct_answer: correctAnswer,
      path: dirPath
    };
    
    // 创建元数据文件路径
    const metadataPath = path.join(dirPath, 'metadata.json');
    
    console.log('正在生成元数据文件:', metadataPath);
    
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

// 配置multer进行文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 临时目录存储
    const uploadDir = path.join(BASE_PATH, 'temp');
    
    // 确保临时目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 使用原始文件名
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// 替换图片文件
exports.replaceImage = (req, res) => {
  // 使用multer处理单个文件上传
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('文件上传失败:', err);
      return res.status(500).json({ error: '文件上传失败', details: err.message });
    }
    
    try {
      const { targetPath } = req.body;
      
      if (!targetPath) {
        return res.status(400).json({ error: '缺少目标文件路径' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: '未找到上传文件' });
      }
      
      // 确保目标路径在prtsc目录下，防止目录遍历攻击
      const fullTargetPath = path.resolve(BASE_PATH, targetPath);
      if (!fullTargetPath.startsWith(BASE_PATH)) {
        return res.status(403).json({ error: '访问被拒绝' });
      }
      
      // 检查目标文件是否存在
      if (!fs.existsSync(fullTargetPath)) {
        return res.status(404).json({ error: '目标文件不存在', path: fullTargetPath });
      }
      
      // 上传的临时文件路径
      const tempFilePath = req.file.path;
      
      console.log('正在替换图片:', fullTargetPath);
      console.log('临时文件路径:', tempFilePath);
      
      // 复制文件替换原文件
      await promisify(fs.copyFile)(tempFilePath, fullTargetPath);
      
      // 删除临时文件
      await promisify(fs.unlink)(tempFilePath);
      
      res.json({ 
        success: true, 
        message: '图片已替换' 
      });
    } catch (error) {
      console.error('替换图片失败:', error);
      res.status(500).json({ error: '替换图片失败', details: error.message });
    }
  });
}; 