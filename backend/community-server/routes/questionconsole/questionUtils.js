/**
 * 题目管理路由 - 工具函数
 */
const { executeWithRetry, pool } = require('../../server');
const axios = require('axios');

/**
 * 工具函数：为图片题目生成唯一ID
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

/**
 * 处理文件夹的递归函数
 * @param {Object} folder 文件夹对象
 * @param {Object} params 查询参数
 * @param {Map} selectedMap 已选择题目映射
 * @param {Array} imageQuestions 图片题目列表
 * @param {string} currentPath 当前路径
 */
async function handleFolderRecursively(folder, params, selectedMap, imageQuestions, currentPath = '') {
  const newPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
  console.log(`处理文件夹路径: ${newPath}`);
  
  try {
    // 尝试读取文件夹内的图片
    const imageResponse = await axios.get('http://localhost:3001/images', {
      params: { folderPath: newPath }
    });
    
    if (imageResponse.data && imageResponse.data.length > 0) {
      // 这是一个包含图片的文件夹，创建题目对象
      const questionId = generateQuestionId(folder.name);
      console.log(`找到包含图片的文件夹: ${newPath}, 图片数量: ${imageResponse.data.length}`);
      
      // 从路径解析科目、年级、年份和类型
      const pathParts = newPath.split('/');
      // 至少需要5个部分: subject/grade/year/type/folder_name
      if (pathParts.length >= 5) {
        const subject = pathParts[0];
        const grade = pathParts[1];
        const year = pathParts[2];
        const type = pathParts[3];
        
        imageQuestions.push({
          id: questionId,
          type: 'image',
          subject: subject,
          grade: grade,
          year: year,
          question_type: type,
          folder_name: folder.name,
          path: newPath,
          images: imageResponse.data,
          is_selected: selectedMap.has(`image-${questionId}`)
        });
      } else {
        // 路径部分不足5个时，尝试从不同的部分提取信息
        let extractedInfo = {
          subject: '',
          grade: '',
          year: '',
          type: ''
        };
        
        // 根据路径长度分配信息
        if (pathParts.length === 1) {
          extractedInfo.subject = pathParts[0];
        } else if (pathParts.length === 2) {
          extractedInfo.subject = pathParts[0];
          extractedInfo.grade = pathParts[1];
        } else if (pathParts.length === 3) {
          extractedInfo.subject = pathParts[0];
          extractedInfo.grade = pathParts[1];
          extractedInfo.year = pathParts[2];
        } else if (pathParts.length === 4) {
          extractedInfo.subject = pathParts[0];
          extractedInfo.grade = pathParts[1];
          extractedInfo.year = pathParts[2];
          extractedInfo.type = pathParts[3];
        }
        
        // 使用提取的信息或参数中的信息
        imageQuestions.push({
          id: questionId,
          type: 'image',
          subject: extractedInfo.subject || params.subject || '',
          grade: extractedInfo.grade || params.grade || '',
          year: extractedInfo.year || params.year || '',
          question_type: extractedInfo.type || params.type || '',
          folder_name: folder.name,
          path: newPath,
          images: imageResponse.data,
          is_selected: selectedMap.has(`image-${questionId}`)
        });
      }
    } else {
      // 如果当前文件夹没有图片，继续递归查找子文件夹
      console.log(`${newPath} 不包含图片，尝试查找子文件夹...`);
      
      // 构建适合当前层级的新参数
      const pathParts = newPath.split('/');
      const newParams = { ...params };
      
      // 根据当前路径的层级设置查询参数
      if (pathParts.length === 1) {
        // 当前是科目层级
        newParams.subject = folder.name;
        delete newParams.grade;
        delete newParams.year;
        delete newParams.type;
      } else if (pathParts.length === 2) {
        // 当前是年级层级
        newParams.subject = pathParts[0];
        newParams.grade = pathParts[1];
        delete newParams.year;
        delete newParams.type;
      } else if (pathParts.length === 3) {
        // 当前是年份层级
        newParams.subject = pathParts[0];
        newParams.grade = pathParts[1];
        newParams.year = pathParts[2];
        delete newParams.type;
      } else if (pathParts.length === 4) {
        // 当前是类型层级
        newParams.subject = pathParts[0];
        newParams.grade = pathParts[1];
        newParams.year = pathParts[2];
        newParams.type = pathParts[3];
      }
      
      // 获取子文件夹
      const subFolderResponse = await axios.get('http://localhost:3001/folders', {
        params: newParams
      });
      
      // 提取文件夹列表，兼容两种响应格式
      let subFolders = [];
      if (subFolderResponse.data) {
        if (Array.isArray(subFolderResponse.data.folders)) {
          // 格式: { folders: [...] }
          subFolders = subFolderResponse.data.folders;
        } else if (Array.isArray(subFolderResponse.data)) {
          // 格式: [...] 
          subFolders = subFolderResponse.data;
        }
      }
      
      console.log(`在路径 ${newPath} 下获取到 ${subFolders.length} 个子文件夹`);
      
      // 递归处理每个子文件夹
      for (const subFolder of subFolders) {
        await handleFolderRecursively(subFolder, params, selectedMap, imageQuestions, newPath);
      }
    }
  } catch (error) {
    console.error(`处理路径 ${newPath} 时出错:`, error);
  }
}

module.exports = {
  generateQuestionId,
  handleFolderRecursively,
  executeWithRetry,
  pool
}; 