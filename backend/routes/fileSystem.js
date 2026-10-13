const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// 获取文件夹列表的路由处理程序
router.get('/folders', (req, res) => {
  // 从请求查询参数中解构获取科目、年份、类型和年级信息
  const { subject, year, type, grade } = req.query;
  // 构建基础路径，指向prtsc目录
  const basePath = path.join(__dirname, '..', 'prtsc');
  
  try {
    // 初始化存储文件夹信息的数组
    const folders = [];
    // 检查是否提供了科目参数
    if (subject) {
      // 构建特定科目的完整路径 - 按照目录结构：subject/grade/year/type
      const subjectPath = path.join(basePath, subject);
      // 检查科目路径是否存在
      if (fs.existsSync(subjectPath)) {
        // 如果提供了年级参数
        if (grade) {
          const gradePath = path.join(subjectPath, grade);
          if (fs.existsSync(gradePath)) {
            // 如果提供了年份参数
            if (year) {
              const yearPath = path.join(gradePath, year);
              if (fs.existsSync(yearPath)) {
                // 如果提供了类型参数
                if (type) {
                  const typePath = path.join(yearPath, type);
                  if (fs.existsSync(typePath)) {
                    // 读取该类型目录下的所有文件夹
                    const subFolders = fs.readdirSync(typePath);
                    // 遍历每个子文件夹
                    subFolders.forEach(folder => {
                      // 检查是否为目录
                      if (fs.statSync(path.join(typePath, folder)).isDirectory()) {
                        // 将文件夹信息添加到结果数组中
                        folders.push({
                          name: folder,
                          type: 'folder'
                        });
                      }
                    });
                  } else {
                    console.log(`类型路径不存在: ${typePath}`);
                  }
                } else {
                  // 如果没有提供类型参数，列出年份目录下的所有类型
                  const yearFolders = fs.readdirSync(yearPath);
                  yearFolders.forEach(folder => {
                    if (fs.statSync(path.join(yearPath, folder)).isDirectory()) {
                      folders.push({
                        name: folder,
                        type: 'folder'
                      });
                    }
                  });
                }
              } else {
                console.log(`年份路径不存在: ${yearPath}`);
              }
            } else {
              // 如果没有提供年份参数，列出年级目录下的所有年份
              const gradeFolders = fs.readdirSync(gradePath);
              gradeFolders.forEach(folder => {
                if (fs.statSync(path.join(gradePath, folder)).isDirectory()) {
                  folders.push({
                    name: folder,
                    type: 'folder'
                  });
                }
              });
            }
          } else {
            console.log(`年级路径不存在: ${gradePath}`);
          }
        } else {
          // 如果没有提供年级参数，列出科目目录下的所有年级
          const subjectFolders = fs.readdirSync(subjectPath);
          subjectFolders.forEach(folder => {
            if (fs.statSync(path.join(subjectPath, folder)).isDirectory()) {
              folders.push({
                name: folder,
                type: 'folder'
              });
            }
          });
        }
      } else {
        console.log(`科目路径不存在: ${subjectPath}`);
        res.status(404).json({ 
          error: `科目路径不存在: ${subject}`,
          requiredParams: {
            subject: subject || '未提供',
            grade: grade || '未提供',
            year: year || '未提供',
            type: type || '未提供'
          }
        });
        return;
      }
    } else {
      // 如果没有提供科目参数，则读取所有科目目录
      const subjects = fs.readdirSync(basePath);
      // 遍历所有科目目录
      subjects.forEach(subject => {
        // 检查是否为目录
        if (fs.statSync(path.join(basePath, subject)).isDirectory()) {
          // 将科目目录信息添加到结果数组中
          folders.push({
            name: subject,
            type: 'folder'
          });
        }
      });
    }
    
    // 添加请求参数到响应中，方便调试
    const response = {
      folders,
      params: {
        subject: subject || '未提供',
        grade: grade || '未提供',
        year: year || '未提供',
        type: type || '未提供'
      }
    };
    
    // 将文件夹列表作为JSON响应返回
    res.json(response);
  } catch (error) {
    // 如果发生错误，返回500状态码和错误信息
    console.error('获取文件夹列表失败:', error);
    res.status(500).json({ 
      error: '获取文件夹列表失败', 
      message: error.message,
      params: {
        subject: subject || '未提供',
        grade: grade || '未提供',
        year: year || '未提供',
        type: type || '未提供'
      }
    });
  }
});

// 获取图片列表
router.get('/images', (req, res) => {
  const { folderPath } = req.query;
  const fullPath = path.join(__dirname, '..', 'prtsc', folderPath);

  try {
    if (fs.existsSync(fullPath)) {
      const images = fs.readdirSync(fullPath)
        .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));
      
      // 为每个图片添加完整的URL路径
      const imagesWithPaths = images.map(image => ({
        name: image,
        url: `/prtsc/${folderPath}/${image}`
      }));
      
      res.json(imagesWithPaths);
    } else {
      res.status(404).json({ error: '文件夹不存在' });
    }
  } catch (error) {
    console.error('获取图片列表失败:', error);
    res.status(500).json({ error: '获取图片列表失败' });
  }
});

module.exports = router;