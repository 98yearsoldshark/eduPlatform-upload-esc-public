const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

// prtsc目录的基础路径
const BASE_PATH = path.join(__dirname, '../../../backend/prtsc');

/**
 * 生成题目ID - 使用与community-server相同的算法
 * @param {string} folderName 文件夹名称
 * @returns {number} 生成的题目ID
 */
function generateQuestionId(folderName) {
  // 使用文件夹名称的哈希值作为ID
  let hash = 0;
  for (let i = 0; i < folderName.length; i++) {
    const char = folderName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  // 确保ID为正数
  return Math.abs(hash);
}

// 递归读取目录
async function readDirRecursive(dir, baseDir = '') {
  const items = [];
  const entries = await readdir(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const relativePath = path.join(baseDir, entry).replace(/\\/g, '/');
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      // 递归处理子目录
      const subItems = await readDirRecursive(fullPath, relativePath);
      
      // 检查目录结构是否符合题目要求
      // 期望的结构：/学科/年级/年份/类型/时间戳ID
      const pathParts = relativePath.split('/');
      
      // 至少有5层时，才可能是一个完整的题目目录
      if (pathParts.length >= 5) {
        // 检查该目录是否包含metadata.json文件
        const metadataPath = path.join(fullPath, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
          try {
            // 读取metadata.json
            const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
            
            // 最后一个部分应该是时间戳ID (例如: 20250319T154706)
            const timeid = pathParts[pathParts.length - 1];
            // 前面的部分分别是学科、年级、年份、类型
            const subject = pathParts[0] || '';
            const grade = pathParts[1] || '';
            const year = pathParts[2] || '';
            const type = pathParts[3] || '';
            
            // 重要：使用最后一个文件夹名称（时间戳ID）生成题目ID，而非整个路径
            // 这样可以确保与community-server中的ID生成方式一致
            const question_id = generateQuestionId(timeid);
            
            console.log(`目录: ${relativePath}`);
            console.log(`文件夹名: ${timeid}`);
            console.log(`生成ID: ${question_id}`);
            
            // 添加题目信息
            items.push({
              path: relativePath,
              question_id,
              question_type: metadata.upload_type || 'image',
              subject,
              grade,
              year,
              type,
              timeid,
              question_folder_or_id: `fold_${question_id}`,
              correct_answer: metadata.correct_answer || '',
              metadata
            });
          } catch (error) {
            console.error(`读取元数据文件失败: ${metadataPath}`, error);
          }
        }
      }
      
      // 添加子目录的项目
      items.push(...subItems);
    }
  }
  
  return items;
}

// 导出所有数据
exports.exportAllData = async (req, res) => {
  try {
    console.log('开始导出prtsc目录下的所有数据...');
    
    // 递归读取prtsc目录下的所有文件夹
    const items = await readDirRecursive(BASE_PATH);
    
    // 过滤出有效的题目目录（有metadata.json的目录）
    const questionItems = items.filter(item => item.question_id);
    
    // 获取导出字段信息
    const exportData = {
      timestamp: new Date().toISOString(),
      total: questionItems.length,
      items: questionItems
    };
    
    console.log(`导出完成，共找到 ${questionItems.length} 个题目目录`);
    
    res.json(exportData);
  } catch (error) {
    console.error('导出数据失败:', error);
    res.status(500).json({ error: '导出数据失败', details: error.message });
  }
};

// 导出基础数据（仅包含路径和ID信息，不包含完整元数据）
exports.exportBasicData = async (req, res) => {
  try {
    console.log('开始导出prtsc目录下的基础数据...');
    
    // 递归读取prtsc目录下的所有文件夹
    const items = await readDirRecursive(BASE_PATH);
    
    // 过滤出有效的题目目录（有metadata.json的目录）
    const questionItems = items.filter(item => item.question_id);
    
    // 简化导出字段，仅包含必要信息
    const basicData = questionItems.map(item => ({
      path: item.path,
      question_id: item.question_id,
      question_type: item.question_type,
      subject: item.subject,
      grade: item.grade,
      year: item.year,
      type: item.type,
      timeid: item.timeid,
      question_folder_or_id: item.question_folder_or_id,
      correct_answer: item.correct_answer
    }));
    
    // 导出字段信息
    const exportData = {
      timestamp: new Date().toISOString(),
      total: basicData.length,
      items: basicData
    };
    
    console.log(`导出完成，共找到 ${basicData.length} 个题目目录`);
    
    res.json(exportData);
  } catch (error) {
    console.error('导出基础数据失败:', error);
    res.status(500).json({ error: '导出基础数据失败', details: error.message });
  }
}; 