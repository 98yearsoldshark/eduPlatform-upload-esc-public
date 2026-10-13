// 先加载私有运行配置，禁止在源码中保存凭据。
require('../config/runtime');
const mysql = require('mysql2');

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

// 初始化LaTeX题目表
const initLatexTable = () => {
  // 创建表的SQL语句
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS latex_questions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      latex_path VARCHAR(255) NOT NULL,
      subject VARCHAR(50) NOT NULL,
      grade VARCHAR(20) NOT NULL,
      year VARCHAR(10) NOT NULL,
      type VARCHAR(20) NOT NULL,
      folder_name VARCHAR(50) NOT NULL,
      correct_answer VARCHAR(50) NOT NULL,
      note TEXT,
      latex_code TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  
  // 创建索引的SQL语句 - 移除IF NOT EXISTS语法
  const createIndexesSQL = [
    "CREATE INDEX idx_latex_path ON latex_questions(latex_path)",
    "CREATE INDEX idx_subject ON latex_questions(subject)",
    "CREATE INDEX idx_grade ON latex_questions(grade)",
    "CREATE INDEX idx_year ON latex_questions(year)",
    "CREATE INDEX idx_type ON latex_questions(type)"
  ];
  
  return new Promise((resolve, reject) => {
    // 首先创建表
    pool.query(createTableSQL, (err) => {
      if (err) {
        console.error('Error creating latex_questions table:', err);
        reject(err);
        return;
      }
      
      console.log('LaTeX questions table created successfully');
      
      // 检查索引是否存在并创建索引
      const checkAndCreateIndexes = async () => {
        try {
          // 获取现有索引
          const [rows] = await pool.promise().query(
            "SHOW INDEX FROM latex_questions WHERE Key_name IN ('idx_latex_path', 'idx_subject', 'idx_grade', 'idx_year', 'idx_type')"
          );
          
          // 将现有索引名称存入集合中
          const existingIndexes = new Set();
          rows.forEach(row => existingIndexes.add(row.Key_name));
          
          // 创建不存在的索引
          const indexPromises = [];
          
          for (const indexSQL of createIndexesSQL) {
            const indexName = indexSQL.match(/CREATE INDEX (\w+)/)[1];
            if (!existingIndexes.has(indexName)) {
              indexPromises.push(
                pool.promise().query(indexSQL)
                  .then(() => console.log(`Index ${indexName} created successfully`))
                  .catch(err => {
                    // 如果索引已存在，忽略错误
                    if (err.code === 'ER_DUP_KEYNAME') {
                      // console.log(`Index ${indexName} already exists`);
                      return;
                    }
                    throw err;
                  })
              );
            } else {
              // console.log(`Index ${indexName} already exists`);
            }
          }
          
          await Promise.all(indexPromises);
          console.log('All indexes created or already exist');
          resolve();
        } catch (err) {
          console.error('Error creating indexes:', err);
          reject(err);
        }
      };
      
      checkAndCreateIndexes();
    });
  });
};


// 保存LaTeX题目到数据库
const saveLatexQuestion = (latexData) => {
  return new Promise((resolve, reject) => {
    pool.query('INSERT INTO latex_questions SET ?', latexData, (err, results) => {
      if (err) {
        console.error('Error saving LaTeX question:', err);
        reject(err);
      } else {
        console.log('LaTeX question saved successfully, ID:', results.insertId);
        resolve(results.insertId);
      }
    });
  });
};

// 根据路径查询LaTeX题目
const getLatexQuestionByPath = (latexPath) => {
  return new Promise((resolve, reject) => {
    pool.query('SELECT * FROM latex_questions WHERE latex_path = ?', [latexPath], (err, results) => {
      if (err) {
        console.error('Error fetching LaTeX question:', err);
        reject(err);
      } else {
        resolve(results[0] || null);
      }
    });
  });
};

// 获取所有LaTeX题目
const getAllLatexQuestions = () => {
  return new Promise((resolve, reject) => {
    pool.query('SELECT * FROM latex_questions ORDER BY created_at DESC', (err, results) => {
      if (err) {
        console.error('Error fetching all LaTeX questions:', err);
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// 根据条件筛选LaTeX题目
const getLatexQuestionsByFilter = (filters) => {
  let query = 'SELECT * FROM latex_questions WHERE 1=1';
  const params = [];
  
  if (filters.subject) {
    query += ' AND subject = ?';
    params.push(filters.subject);
  }
  
  if (filters.grade) {
    query += ' AND grade = ?';
    params.push(filters.grade);
  }
  
  if (filters.year) {
    query += ' AND year = ?';
    params.push(filters.year);
  }
  
  if (filters.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }
  
  query += ' ORDER BY created_at DESC';
  
  return new Promise((resolve, reject) => {
    pool.query(query, params, (err, results) => {
      if (err) {
        console.error('Error fetching filtered LaTeX questions:', err);
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

module.exports = {
  initLatexTable,
  saveLatexQuestion,
  getLatexQuestionByPath,
  getAllLatexQuestions,
  getLatexQuestionsByFilter
};