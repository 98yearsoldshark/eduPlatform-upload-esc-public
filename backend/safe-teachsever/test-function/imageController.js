const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);
const exists = fs.existsSync; // 直接使用同步版本简化代码

// 修改基础路径设置为正确的prtsc目录
const BASE_PATH = path.join(__dirname, '../../../backend/prtsc');
// 设置缩略图缓存目录
const THUMBNAIL_CACHE_PATH = path.join(__dirname, '../../../backend/prtsc/thumbnails');

// 确保缩略图缓存目录存在
const ensureThumbnailDir = () => {
  try {
    if (!exists(THUMBNAIL_CACHE_PATH)) {
      fs.mkdirSync(THUMBNAIL_CACHE_PATH, { recursive: true });
      console.log('缩略图缓存目录已创建:', THUMBNAIL_CACHE_PATH);
    }
  } catch (error) {
    console.error('创建缩略图目录失败:', error);
  }
};

// 在模块初始化时确保缩略图目录存在
ensureThumbnailDir();

// 检查文件是否为图片
const isImageFile = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext);
};

// 获取图片缩略图 - 由于没有sharp，直接返回原图
exports.getImageThumbnail = async (req, res) => {
  try {
    const { path: requestedPath } = req.query;
    
    if (!requestedPath) {
      return res.status(400).json({ error: '缺少图片路径' });
    }
    
    // 确保路径在prtsc目录下，防止目录遍历攻击
    const fullPath = path.resolve(BASE_PATH, requestedPath);
    if (!fullPath.startsWith(BASE_PATH)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }
    
    console.log('正在获取图片:', fullPath);
    
    // 检查文件是否存在
    if (!exists(fullPath)) {
      return res.status(404).json({ error: '文件不存在', path: fullPath });
    }
    
    // 检查是否为图片
    if (!isImageFile(fullPath)) {
      return res.status(400).json({ error: '文件不是图片' });
    }
    
    // 直接发送文件作为缩略图
    res.sendFile(fullPath);
    
  } catch (error) {
    console.error('获取图片缩略图失败:', error);
    res.status(500).json({ error: '获取图片缩略图失败', details: error.message });
  }
};

// 获取图片元数据
exports.getImageMetadata = async (req, res) => {
  try {
    const requestedPath = req.query.path;
    
    if (!requestedPath) {
      return res.status(400).json({ error: '缺少图片路径' });
    }
    
    // 确保路径在prtsc目录下，防止目录遍历攻击
    const fullPath = path.resolve(BASE_PATH, requestedPath);
    if (!fullPath.startsWith(BASE_PATH)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }
    
    console.log('正在获取图片元数据:', fullPath);
    
    // 检查文件是否存在
    if (!exists(fullPath)) {
      return res.status(404).json({ error: '文件不存在', path: fullPath });
    }
    
    // 检查是否为图片
    if (!isImageFile(fullPath)) {
      return res.status(400).json({ error: '文件不是图片' });
    }
    
    // 获取文件信息
    const fileStats = await stat(fullPath);
    
    // 由于没有sharp，只返回基本元数据
    res.json({
      name: path.basename(fullPath),
      path: requestedPath,
      size: fileStats.size,
      created: fileStats.birthtime,
      modified: fileStats.mtime,
      width: "未知", // 由于没有sharp，无法获取这些信息
      height: "未知",
      format: path.extname(fullPath).replace('.', '').toUpperCase(),
      hasAlpha: null,
      space: null
    });
    
  } catch (error) {
    console.error('获取图片元数据失败:', error);
    res.status(500).json({ error: '获取图片元数据失败', details: error.message });
  }
};

// 直接获取图片
exports.getImage = async (req, res) => {
  try {
    const requestedPath = req.query.path;
    
    if (!requestedPath) {
      return res.status(400).json({ error: '缺少图片路径' });
    }
    
    // 确保路径在prtsc目录下，防止目录遍历攻击
    const fullPath = path.resolve(BASE_PATH, requestedPath);
    if (!fullPath.startsWith(BASE_PATH)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }
    
    console.log('正在获取图片:', fullPath);
    
    // 检查文件是否存在
    if (!exists(fullPath)) {
      return res.status(404).json({ error: '文件不存在', path: fullPath });
    }
    
    // 检查是否为图片
    if (!isImageFile(fullPath)) {
      return res.status(400).json({ error: '文件不是图片' });
    }
    
    // 直接发送文件
    res.sendFile(fullPath);
    
  } catch (error) {
    console.error('获取图片失败:', error);
    res.status(500).json({ error: '获取图片失败', details: error.message });
  }
}; 