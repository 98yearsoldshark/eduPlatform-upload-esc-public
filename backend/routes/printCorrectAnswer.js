// 先加载私有运行配置，禁止在源码中保存凭据。
require('../config/runtime');
// 使用打印正确答案相关路由

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
const { spawn } = require('child_process');

// 创建数据库连接池
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'cxsjdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 从文件中获取正确答案
const getCorrectAnswerFromFile = (questionPath) => {
  try {
    // 首先尝试从answer.txt文件中读取答案
    const answerPath = path.join(__dirname, '..', questionPath, 'answer.txt');
    if (fs.existsSync(answerPath)) {
      const answer = fs.readFileSync(answerPath, 'utf8').trim();
      return answer;
    }
    
    // 如果answer.txt不存在，尝试从metadata.json文件中读取答案
    const metadataPath = path.join(__dirname, '..', questionPath, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      if (metadata.correct_answer) {
        return metadata.correct_answer;
      }
    }
    
    // 如果都没有找到，返回默认答案A
    console.log(`正确答案：A{======异常情况：未找到答案文件======}`);
    return 'A';
  } catch (error) {
    console.error('Error reading correct answer:', error);
    console.log(`正确答案：A{======异常情况：读取答案文件出错======}`);
    return 'A'; // 默认返回A
  }
};

// 从数据库中获取LaTeX题目的正确答案
const getCorrectAnswerFromDB = (questionId) => {
  return new Promise((resolve, reject) => {
    pool.query('SELECT correct_answer FROM latex_questions WHERE id = ?', [questionId], (err, results) => {
      if (err) {
        console.error('Error fetching correct answer from DB:', err);
        console.log(`正确答案：A{======异常情况：数据库查询出错======}`);
        resolve('A'); // 使用resolve而不是reject，确保流程继续
      } else if (results.length === 0) {
        console.log(`正确答案：A{======异常情况：未找到ID为${questionId}的题目======}`);
        resolve('A'); // 默认返回A
      } else {
        resolve(results[0].correct_answer);
      }
    });
  });
};

// 打印正确答案的路由
router.get('/', async (req, res) => {
  const { questionPath, questionId, questionType } = req.query;
  
  try {
    let correctAnswer;
    
    // 根据题目类型获取正确答案
    if (questionType === 'latex' && questionId) {
      // 如果是LaTeX题目，从数据库获取答案
      correctAnswer = await getCorrectAnswerFromDB(questionId);
    } else if (questionPath) {
      // 如果是图片题目，从文件获取答案
      correctAnswer = getCorrectAnswerFromFile(questionPath);
    } else {
      console.log(`正确答案：A{======异常情况：缺少必要参数======}`);
      return res.status(400).json({ error: '缺少必要参数', correctAnswer: 'A' });
    }
    
    // 在控制台打印正确答案
    if (correctAnswer !== 'A') {
      console.log('正确答案:', correctAnswer);
    }
    // 如果是'A'，在前面的函数中已经打印了带有异常信息的日志
    
    // 返回正确答案
    res.json({ correctAnswer });
  } catch (error) {
    console.error('获取正确答案失败:', error);
    console.log(`正确答案：A{======异常情况：路由处理出错======}`);
    res.status(500).json({ error: '获取正确答案失败', correctAnswer: 'A' });
  }
});

module.exports = router;