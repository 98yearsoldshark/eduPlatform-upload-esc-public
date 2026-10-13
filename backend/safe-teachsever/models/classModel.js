// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../config/runtime');
/**
 * 班级模型定义和数据库操作模块
 * 该模块负责处理与班级相关的所有数据库操作，包括班级的创建、查询、更新、删除，
 * 以及学生与班级之间的关联关系管理
 */
const mysql = require('mysql2');

/**
 * 创建数据库连接池
 * 使用连接池可以有效管理数据库连接，提高性能和可靠性
 */
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'cxsjdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();

/**
 * 班级表结构定义
 * 定义班级表的字段、类型和约束条件
 */
const classSchema = {
  id: { type: 'INT', primaryKey: true, autoIncrement: true },
  name: { type: 'VARCHAR(100)', notNull: true },
  description: { type: 'TEXT' },
  class_code: { type: 'VARCHAR(10)', notNull: true, unique: true },
  teacher_id: { type: 'INT', notNull: true },
  created_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
  updated_at: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }
};

/**
 * 学生-班级关联表结构定义
 * 定义学生与班级之间多对多关系的中间表结构
 */
const studentClassSchema = {
  id: { type: 'INT', primaryKey: true, autoIncrement: true },
  student_id: { type: 'INT', notNull: true },
  class_id: { type: 'INT', notNull: true },
  join_date: { type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
};

/**
 * 创建班级表的SQL语句
 * 根据班级表结构定义生成创建表的SQL语句
 */
const createClassTableSQL = `CREATE TABLE IF NOT EXISTS classes (
  ${Object.entries(classSchema)
    .map(([key, value]) => `${key} ${value.type}${value.primaryKey ? ' PRIMARY KEY' : ''}${value.autoIncrement ? ' AUTO_INCREMENT' : ''}${value.notNull ? ' NOT NULL' : ''}${value.unique ? ' UNIQUE' : ''}${value.default ? ` DEFAULT ${value.default}` : ''}${value.onUpdate ? ` ON UPDATE ${value.onUpdate}` : ''}`)
    .join(',\n  ')}
)`;

/**
 * 创建学生-班级关联表的SQL语句
 * 根据学生-班级关联表结构定义生成创建表的SQL语句
 */
const createStudentClassTableSQL = `CREATE TABLE IF NOT EXISTS student_classes (
  ${Object.entries(studentClassSchema)
    .map(([key, value]) => `${key} ${value.type}${value.primaryKey ? ' PRIMARY KEY' : ''}${value.autoIncrement ? ' AUTO_INCREMENT' : ''}${value.notNull ? ' NOT NULL' : ''}${value.default ? ` DEFAULT ${value.default}` : ''}`)
    .join(',\n  ')},
  UNIQUE KEY student_class_unique (student_id, class_id)
)`;

/**
 * 初始化数据库表
 * 在应用启动时创建必要的数据库表（如果不存在）
 * @returns {Promise<boolean>} 初始化成功返回true，失败返回false
 */
const initTables = async () => {
  try {
    await pool.query(createClassTableSQL);
    console.log('Classes table created or already exists');
    
    await pool.query(createStudentClassTableSQL);
    console.log('Student-Class relationship table created or already exists');
    
    return true;
  } catch (error) {
    console.error('Error initializing tables:', error);
    return false;
  }
};

/**
 * 生成唯一的班级码
 * 生成6位随机字符的班级邀请码，并确保其在数据库中唯一
 * @returns {Promise<string>} 返回生成的唯一班级码
 */
const generateUniqueClassCode = async () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let classCode;
  let isUnique = false;
  
  while (!isUnique) {
    // 生成6位随机字符的班级码
    classCode = '';
    for (let i = 0; i < 6; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      classCode += characters.charAt(randomIndex);
    }
    
    // 检查班级码是否已存在
    const [rows] = await pool.query('SELECT id FROM classes WHERE class_code = ?', [classCode]);
    if (rows.length === 0) {
      isUnique = true;
    }
  }
  
  return classCode;
};

/**
 * 创建新班级
 * 根据提供的班级数据创建新的班级记录，并自动生成唯一班级码
 * @param {Object} classData - 班级数据对象
 * @param {string} classData.name - 班级名称
 * @param {string} classData.description - 班级描述
 * @param {number} classData.teacher_id - 创建班级的教师ID
 * @returns {Promise<Object>} 返回创建的班级对象，包含生成的ID和班级码
 */
const createClass = async (classData) => {
  try {
    // 生成唯一班级码
    const classCode = await generateUniqueClassCode();
    
    // 插入班级记录
    const [result] = await pool.query(
      'INSERT INTO classes (name, description, class_code, teacher_id) VALUES (?, ?, ?, ?)',
      [classData.name, classData.description, classCode, classData.teacher_id]
    );
    
    return {
      id: result.insertId,
      name: classData.name,
      description: classData.description,
      class_code: classCode,
      teacher_id: classData.teacher_id
    };
  } catch (error) {
    console.error('Error creating class:', error);
    throw error;
  }
};

/**
 * 获取教师创建的所有班级
 * 查询指定教师创建的所有班级，按创建时间降序排列
 * @param {number} teacherId - 教师ID
 * @returns {Promise<Array>} 返回班级对象数组
 */
const getTeacherClasses = async (teacherId) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM classes WHERE teacher_id = ? ORDER BY created_at DESC',
      [teacherId]
    );
    
    return rows;
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    throw error;
  }
};

/**
 * 获取班级详情
 * 根据班级ID和教师ID查询班级详细信息，确保只有班级的创建者才能访问
 * @param {number} classId - 班级ID
 * @param {number} teacherId - 教师ID
 * @returns {Promise<Object|null>} 返回班级对象，如果班级不存在或不属于该教师则返回null
 */
const getClassById = async (classId, teacherId) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM classes WHERE id = ? AND teacher_id = ?',
      [classId, teacherId]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return rows[0];
  } catch (error) {
    console.error('Error fetching class details:', error);
    throw error;
  }
};

/**
 * 更新班级信息
 * 更新指定班级的名称和描述信息，确保只有班级的创建者才能更新
 * @param {number} classId - 班级ID
 * @param {number} teacherId - 教师ID
 * @param {Object} classData - 班级更新数据
 * @param {string} classData.name - 班级名称
 * @param {string} classData.description - 班级描述
 * @returns {Promise<Object|null>} 返回更新后的班级对象，如果班级不存在或不属于该教师则返回null
 */
const updateClass = async (classId, teacherId, classData) => {
  try {
    const [result] = await pool.query(
      'UPDATE classes SET name = ?, description = ? WHERE id = ? AND teacher_id = ?',
      [classData.name, classData.description, classId, teacherId]
    );
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    return {
      id: classId,
      name: classData.name,
      description: classData.description,
      teacher_id: teacherId
    };
  } catch (error) {
    console.error('Error updating class:', error);
    throw error;
  }
};

/**
 * 删除班级
 * 删除指定的班级及其所有学生关联记录，使用事务确保数据一致性
 * @param {number} classId - 班级ID
 * @param {number} teacherId - 教师ID
 * @returns {Promise<boolean>} 删除成功返回true，如果班级不存在或不属于该教师则返回false
 */
const deleteClass = async (classId, teacherId) => {
  try {
    // 开始事务
    await pool.query('START TRANSACTION');
    
    // 删除班级中的所有学生关联
    await pool.query('DELETE FROM student_classes WHERE class_id = ?', [classId]);
    
    // 删除班级
    const [result] = await pool.query(
      'DELETE FROM classes WHERE id = ? AND teacher_id = ?',
      [classId, teacherId]
    );
    
    // 提交事务
    await pool.query('COMMIT');
    
    return result.affectedRows > 0;
  } catch (error) {
    // 回滚事务
    await pool.query('ROLLBACK');
    console.error('Error deleting class:', error);
    throw error;
  }
};

/**
 * 通过班级码查找班级
 * 根据班级邀请码查询班级信息，用于学生加入班级
 * @param {string} classCode - 班级邀请码
 * @returns {Promise<Object|null>} 返回班级对象，如果班级码无效则返回null
 */
const findClassByCode = async (classCode) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM classes WHERE class_code = ?',
      [classCode]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return rows[0];
  } catch (error) {
    console.error('Error finding class by code:', error);
    throw error;
  }
};

/**
 * 学生加入班级
 * 将学生添加到指定班级中，如果学生已经在班级中则不重复添加
 * @param {number} studentId - 学生ID
 * @param {number} classId - 班级ID
 * @returns {Promise<Object>} 返回加入结果，包含是否已经加入的标志
 */
const joinClass = async (studentId, classId) => {
  try {
    // 检查学生是否已经加入该班级
    const [existingRows] = await pool.query(
      'SELECT id FROM student_classes WHERE student_id = ? AND class_id = ?',
      [studentId, classId]
    );
    
    if (existingRows.length > 0) {
      return { alreadyJoined: true };
    }
    
    // 添加学生到班级
    const [result] = await pool.query(
      'INSERT INTO student_classes (student_id, class_id) VALUES (?, ?)',
      [studentId, classId]
    );
    
    return {
      id: result.insertId,
      student_id: studentId,
      class_id: classId,
      alreadyJoined: false
    };
  } catch (error) {
    console.error('Error joining class:', error);
    throw error;
  }
};

/**
 * 获取班级学生列表
 * 获取指定班级中的所有学生信息，按加入时间降序排列，确保只有班级的创建者才能查看
 * @param {number} classId - 班级ID
 * @param {number} teacherId - 教师ID
 * @returns {Promise<Array|null>} 返回学生对象数组，如果班级不存在或不属于该教师则返回null
 */
const getClassStudents = async (classId, teacherId) => {
  try {
    // 首先验证班级是否属于该教师
    const [classRows] = await pool.query(
      'SELECT id FROM classes WHERE id = ? AND teacher_id = ?',
      [classId, teacherId]
    );
    
    if (classRows.length === 0) {
      return null; // 班级不存在或不属于该教师
    }
    
    // 获取班级中的学生列表
    const [rows] = await pool.query(
      `SELECT u.*, sc.join_date 
       FROM users u 
       JOIN student_classes sc ON u.id = sc.student_id 
       WHERE sc.class_id = ? 
       ORDER BY sc.join_date DESC`,
      [classId]
    );
    
    return rows;
  } catch (error) {
    console.error('Error fetching class students:', error);
    throw error;
  }
};

/**
 * 从班级中移除学生
 * 将指定学生从班级中移除，确保只有班级的创建者才能执行此操作
 * @param {number} studentId - 学生ID
 * @param {number} classId - 班级ID
 * @param {number} teacherId - 教师ID
 * @returns {Promise<boolean>} 移除成功返回true，如果班级不存在、不属于该教师或学生不在班级中则返回false
 */
const removeStudentFromClass = async (studentId, classId, teacherId) => {
  try {
    // 首先验证班级是否属于该教师
    const [classRows] = await pool.query(
      'SELECT id FROM classes WHERE id = ? AND teacher_id = ?',
      [classId, teacherId]
    );
    
    if (classRows.length === 0) {
      return false; // 班级不存在或不属于该教师
    }
    
    // 从班级中移除学生
    const [result] = await pool.query(
      'DELETE FROM student_classes WHERE student_id = ? AND class_id = ?',
      [studentId, classId]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error removing student from class:', error);
    throw error;
  }
};

/**
 * 获取学生已加入的班级列表
 * 根据学生ID查询该学生加入的所有班级信息
 * @param {number} studentId - 学生ID
 * @returns {Promise<Array>} 返回班级对象数组
 */
const getStudentClasses = async (studentId) => {
  try {
    // 查询学生加入的所有班级
    const [rows] = await pool.query(
      `SELECT c.* 
       FROM classes c 
       JOIN student_classes sc ON c.id = sc.class_id 
       WHERE sc.student_id = ? 
       ORDER BY sc.join_date DESC`,
      [studentId]
    );
    
    return rows;
  } catch (error) {
    console.error('Error fetching student classes:', error);
    throw error;
  }
};

/**
 * 导出模块中的所有函数，供其他模块使用
 */
module.exports = {
  initTables,                // 初始化数据库表
  createClass,               // 创建新班级
  getTeacherClasses,         // 获取教师创建的所有班级
  getClassById,              // 获取班级详情
  updateClass,               // 更新班级信息
  deleteClass,               // 删除班级
  findClassByCode,           // 通过班级码查找班级
  joinClass,                 // 学生加入班级
  getClassStudents,          // 获取班级学生列表
  removeStudentFromClass,    // 从班级中移除学生
  generateUniqueClassCode,   // 生成唯一的班级码
  getStudentClasses          // 获取学生已加入的班级列表
};