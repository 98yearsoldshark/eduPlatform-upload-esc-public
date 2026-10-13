// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../config/runtime');
const mysql = require('mysql2/promise');
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

// 获取所有LaTeX题目
exports.getAllLatexQuestions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      subject,
      grade, 
      year,
      type,
      search
    } = req.query;
    
    console.log('查询LaTeX题目参数:', req.query);
    
    // 转换参数为正确类型
    const pageInt = parseInt(page, 10) || 1;
    const limitInt = parseInt(limit, 10) || 10;
    const offset = (pageInt - 1) * limitInt;
    
    // 构建基础查询
    let query = 'SELECT * FROM latex_questions WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM latex_questions WHERE 1=1';
    const params = [];
    const countParams = [];
    
    // 添加筛选条件，严格检查参数存在性
    if (subject && subject !== '') {
      query += ' AND subject = ?';
      countQuery += ' AND subject = ?';
      params.push(String(subject));
      countParams.push(String(subject));
    }
    
    if (grade && grade !== '') {
      query += ' AND grade = ?';
      countQuery += ' AND grade = ?';
      params.push(String(grade));
      countParams.push(String(grade));
    }
    
    if (year && year !== '') {
      query += ' AND year = ?';
      countQuery += ' AND year = ?';
      params.push(String(year));
      countParams.push(String(year));
    }
    
    if (type && type !== '') {
      query += ' AND type = ?';
      countQuery += ' AND type = ?';
      params.push(String(type));
      countParams.push(String(type));
    }
    
    // 搜索功能，匹配latex_code或note字段
    if (search && search !== '') {
      query += ' AND (latex_code LIKE ? OR note LIKE ? OR folder_name LIKE ?)';
      countQuery += ' AND (latex_code LIKE ? OR note LIKE ? OR folder_name LIKE ?)';
      const searchParam = `%${String(search)}%`;
      params.push(searchParam, searchParam, searchParam);
      countParams.push(searchParam, searchParam, searchParam);
    }
    
    // 添加排序
    query += ' ORDER BY id DESC';
    
    // 使用字符串直接拼接LIMIT和OFFSET，避免参数化查询的类型问题
    query += ` LIMIT ${limitInt} OFFSET ${offset}`;
    
    console.log('执行查询:', query);
    console.log('查询参数:', params);
    console.log('参数类型:', params.map(p => typeof p));
    
    // 先获取总数
    const [countRows] = await pool.execute(countQuery, countParams);
    const total = countRows[0]?.total || 0;
    
    console.log('查询到的总记录数:', total);
    
    // 然后获取分页数据，不使用参数化查询处理LIMIT和OFFSET
    const [rows] = await pool.execute(query, params);
    
    console.log(`获取到 ${rows.length} 条记录`);
    
    // 返回结果
    res.json({
      questions: rows,
      total,
      page: pageInt,
      limit: limitInt,
      pages: Math.ceil(total / limitInt)
    });
  } catch (error) {
    console.error('获取LaTeX题目失败:', error);
    res.status(500).json({ error: '获取LaTeX题目失败', details: error.message });
  }
};

// 获取单个LaTeX题目
exports.getLatexQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: '缺少ID参数' });
    }
    
    // 使用parseInt直接获取数字，不使用Number构造函数
    const idInt = parseInt(id, 10);
    if (isNaN(idInt)) {
      return res.status(400).json({ error: 'ID参数无效' });
    }
    
    console.log('查询单个LaTeX题目，ID:', idInt, '类型:', typeof idInt);
    
    const [rows] = await pool.execute(
      'SELECT * FROM latex_questions WHERE id = ?',
      [idInt]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '未找到LaTeX题目' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('获取LaTeX题目失败:', error);
    res.status(500).json({ error: '获取LaTeX题目失败', details: error.message });
  }
};

// 创建LaTeX题目
exports.createLatexQuestion = async (req, res) => {
  try {
    const {
      subject,
      grade,
      year,
      type,
      folder_name,
      correct_answer,
      note,
      latex_code
    } = req.body;
    
    // 验证必要字段
    if (!subject || !grade || !year || !type || !folder_name || !correct_answer || !latex_code) {
      return res.status(400).json({ error: '缺少必要字段' });
    }
    
    // 构建latex_path
    const latex_path = `latex/${subject}/${grade}/${year}/${type}/${folder_name}`;
    
    // 执行插入
    const [result] = await pool.execute(
      `INSERT INTO latex_questions 
       (latex_path, subject, grade, year, type, folder_name, correct_answer, note, latex_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [latex_path, subject, grade, year, type, folder_name, correct_answer, note || null, latex_code]
    );
    
    res.status(201).json({
      success: true,
      message: '创建LaTeX题目成功',
      id: result.insertId
    });
  } catch (error) {
    console.error('创建LaTeX题目失败:', error);
    res.status(500).json({ error: '创建LaTeX题目失败', details: error.message });
  }
};

// 更新LaTeX题目
exports.updateLatexQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subject,
      grade,
      year,
      type,
      folder_name,
      correct_answer,
      note,
      latex_code
    } = req.body;
    
    // 验证必要字段
    if (!id || !subject || !grade || !year || !type || !folder_name || !correct_answer || !latex_code) {
      return res.status(400).json({ error: '缺少必要字段' });
    }
    
    const idInt = parseInt(id, 10);
    if (isNaN(idInt)) {
      return res.status(400).json({ error: 'ID参数无效' });
    }
    
    // 构建latex_path
    const latex_path = `latex/${subject}/${grade}/${year}/${type}/${folder_name}`;
    
    // 执行更新
    const [result] = await pool.execute(
      `UPDATE latex_questions 
       SET latex_path = ?, subject = ?, grade = ?, year = ?, type = ?, 
           folder_name = ?, correct_answer = ?, note = ?, latex_code = ?
       WHERE id = ?`,
      [latex_path, subject, grade, year, type, folder_name, correct_answer, note || null, latex_code, idInt]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '未找到LaTeX题目' });
    }
    
    res.json({
      success: true,
      message: '更新LaTeX题目成功',
      id: idInt
    });
  } catch (error) {
    console.error('更新LaTeX题目失败:', error);
    res.status(500).json({ error: '更新LaTeX题目失败', details: error.message });
  }
};

// 删除LaTeX题目
exports.deleteLatexQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: '缺少ID参数' });
    }
    
    const idInt = parseInt(id, 10);
    if (isNaN(idInt)) {
      return res.status(400).json({ error: 'ID参数无效' });
    }
    
    // 执行删除
    const [result] = await pool.execute(
      'DELETE FROM latex_questions WHERE id = ?',
      [idInt]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '未找到LaTeX题目' });
    }
    
    res.json({
      success: true,
      message: '删除LaTeX题目成功',
      id: idInt
    });
  } catch (error) {
    console.error('删除LaTeX题目失败:', error);
    res.status(500).json({ error: '删除LaTeX题目失败', details: error.message });
  }
}; 