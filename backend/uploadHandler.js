const fs = require('fs');
const path = require('path');
const multer = require('multer');
const express = require('express');
const app = express();

// 引入LaTeX数据库操作模块
const latexQueries = require('./db/latexQueries');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // console.log('Request body:', JSON.stringify(req.body, null, 2));
    // console.log('File info:', {
    //   fieldname: file.fieldname,
    //   originalname: file.originalname,
    //   encoding: file.encoding,
    //   mimetype: file.mimetype,
    //   size: file.size
    // });
    // console.log('Request headers:', req.headers);
    // console.log('Full request details:', {
    //   subject: req.body.subject || 'defaultSubject',
    //   grade: req.body.grade || 'defaultGrade',
    //   year: req.body.year || 'defaultYear',
    //   type: req.body.type 
    // });
    const dir = path.join(__dirname, 'prtsc', 'defaultSubject', 'defaultGrade', 'defaultYear', 'defaultType');
    // console.log('Multer upload process started:', new Date().toISOString());
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const bodyParser = require('body-parser');

const upload = multer({ storage });
app.use(bodyParser.urlencoded({ extended: true }));

const uploadHandler = (req, res) => {
  // 使用multer处理上传，但不指定特定字段名，而是处理所有文件字段
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(500).json({ error: '文件上传失败' });
    }
    bodyParser.urlencoded({ extended: true })(req, res, () => {

      const finishTime = new Date();

      // 格式化为中国时区的ISO字符串
      const isoString = new Date(finishTime.getTime() + (8 * 60 * 60 * 1000)).toISOString();
      console.log('文件上传完成时间（北京时间ISO）:', isoString);
   
      // 处理本地时间格式（用于目录名）
      const localTimeString = finishTime.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const formattedTime = localTimeString
        .replace(/\//g, '')  // 去掉 /
        .replace(/ /g, 'T')  // 将空格替换为T
        .replace(/:/g, '');  // 去掉 :
      console.log('格式化后的目录时间:', formattedTime);

      // console.log('Parsed body:', req.body);
      const subject = req.body.subject || 'defaultSubject';
      const grade = req.body.grade || 'defaultGrade';
      const year = req.body.year || 'defaultYear';
      const type = req.body.type || 'defaultType';
      const uploadType = req.body.upload_type || 'image';
      const correctAnswer = req.body.correct_answer || 'A';
      
      // 仅图片类型需要创建物理目录
      let newDir = '';
      if (uploadType === 'image') {
        newDir = path.join(__dirname, 'prtsc', 
          subject, grade, year, type, formattedTime);
        // console.log('Creating new directory:', newDir);
        fs.mkdirSync(newDir, { recursive: true });
      }
      
      // 将note内容写入文件
      
      if (uploadType === 'latex') {
        // 处理LaTeX代码上传
        if (req.body.latex_code) {
          // const latexPath = path.join(newDir, 'question.tex');
          // fs.writeFileSync(latexPath, req.body.latex_code, 'utf8');
          
          // 将LaTeX题目信息保存到数据库
          // 生成虚拟路径代替物理路径
      const relativePath = uploadType === 'latex' 
        ? `latex/${subject}/${grade}/${year}/${type}/${formattedTime}`
        : path.relative(__dirname, newDir);
          const latexData = {
            latex_path: relativePath,
            subject: subject,
            grade: grade,
            year: year,
            type: type,
            folder_name: formattedTime,
            correct_answer: correctAnswer,
            note: req.body.note || '',
            latex_code: req.body.latex_code
          };
          
          // 异步保存到数据库
          latexQueries.saveLatexQuestion(latexData)
            .then(id => {
              console.log(`LaTeX question saved to database with ID: ${id}`);
            })
            .catch(err => {
              console.error('Failed to save LaTeX question to database:', err);
            });
        }
      } else {
        // 处理图片上传
        if (req.body.note) {
          const notePath = path.join(newDir, 'note.txt');
          fs.writeFileSync(notePath, req.body.note, 'utf8');
          console.log('笔记已保存:', notePath);
        }
        
        // 将正确答案写入文件
        if (correctAnswer) {
          const answerPath = path.join(newDir, 'answer.txt');
          fs.writeFileSync(answerPath, correctAnswer, 'utf8');
          console.log('正确答案已保存:', answerPath, '内容:', correctAnswer);
        }
        
        // 移动上传的文件
        req.files.forEach(file => {
          const oldPath = path.join(file.destination, file.originalname);
          const newPath = path.join(newDir, file.originalname);
          console.log('正在移动文件:', oldPath, '->', newPath);
          try {
            fs.renameSync(oldPath, newPath);
            console.log('文件移动成功:', newPath);
          } catch (err) {
            console.error('移动文件失败:', err);
            throw err;
          }
        });
        
        // 创建元数据文件（仅图片类型需要）
        const metadata = {
          created_at: isoString,
          updated_at: isoString,
          upload_type: uploadType,
          correct_answer: correctAnswer,
          path: newDir
        };
        
        const metadataPath = path.join(newDir, 'metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
        console.log('元数据文件已创建:', metadataPath);
      }
      
      console.log('上传处理完成');
      res.status(200).json({ message: '文件上传成功' });
    });
  });
};

module.exports = uploadHandler;