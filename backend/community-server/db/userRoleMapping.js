// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../config/runtime');
/**
 * 用户角色映射服务模块
 * 
 * 本模块负责处理学生端用户和教师端用户之间的映射关系
 * 原先使用user_role_mapping表，现改为使用community_user_roles表
 */
const mysql = require('mysql2/promise');

// 创建独立的数据库连接池，避免循环依赖
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'cxsjdb',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,
  multipleStatements: true,
});

// 通用数据库操作函数，带有重试机制
async function executeWithRetry(operation, maxRetries = 3) {
  let retries = maxRetries;
  let lastError = null;
  
  while (retries > 0) {
    let connection;
    try {
      // 获取连接
      connection = await pool.getConnection();
      
      // 执行操作
      const result = await operation(connection);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`数据库操作失败 (剩余重试次数: ${retries-1}):`, error);
      
      // 检查是否是连接相关错误
      if (error.code === 'PROTOCOL_CONNECTION_LOST' || 
          error.code === 'ECONNREFUSED' || 
          error.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR') {
        retries--;
        if (retries > 0) {
          // 等待一段时间再重试
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      } else {
        // 非连接错误，不再重试
        break;
      }
    } finally {
      // 确保连接被释放回连接池
      if (connection) connection.release();
    }
  }
  
  // 所有重试都失败了
  throw lastError;
}

/**
 * 初始化用户角色映射表
 * 注意：此函数仅为保持API兼容性，实际上community_user_roles表已在系统初始化时创建
 * @returns {Promise<boolean>} 初始化成功返回true
 */
async function initUserRoleMappingTable() {
  try {
    console.log('用户角色映射使用community_user_roles表，检查表是否存在...');
    
    // 检查community_user_roles表是否存在
    const [tables] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SHOW TABLES LIKE 'community_user_roles'`
      );
    });
    
    if (tables && tables.length > 0) {
      console.log('community_user_roles表已存在，无需初始化');
      
      // 检查表结构，确保有必要的字段
      const [columns] = await executeWithRetry(async (conn) => {
        return await conn.query(
          `SHOW COLUMNS FROM community_user_roles`
        );
      });
      
      // 检查是否有teacher_id字段
      const hasTeacherId = columns.some(col => col.Field === 'teacher_id');
      if (!hasTeacherId) {
        console.log('添加teacher_id字段到community_user_roles表');
        await executeWithRetry(async (conn) => {
          return await conn.query(
            `ALTER TABLE community_user_roles 
             ADD COLUMN teacher_id INT AFTER role`
          );
        });
      }
      
      // 检查是否有created_at字段
      const hasCreatedAt = columns.some(col => col.Field === 'created_at');
      if (!hasCreatedAt) {
        console.log('添加created_at字段到community_user_roles表');
        await executeWithRetry(async (conn) => {
          return await conn.query(
            `ALTER TABLE community_user_roles 
             ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
          );
        });
      }
      
      console.log('已确保community_user_roles表结构完整');
      return true;
    }
    
    // 如果表不存在，创建表
    console.log('创建community_user_roles表...');
    await executeWithRetry(async (conn) => {
      return await conn.query(`
        CREATE TABLE IF NOT EXISTS community_user_roles (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          role VARCHAR(50) NOT NULL,
          teacher_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX(user_id),
          INDEX(teacher_id),
          INDEX(role)
        )
      `);
    });
    
    console.log('community_user_roles表初始化成功');
    return true;
  } catch (error) {
    console.error('初始化用户角色映射表失败:', error);
    return false;
  }
}

/**
 * 根据学生用户ID获取对应的教师用户ID
 * @param {number} studentUserId 学生用户ID
 * @returns {Promise<{teacherUserId: number, roleType: string}|null>} 返回教师用户ID和角色类型，如果不存在则返回null
 */
async function getTeacherUserIdByStudentUserId(studentUserId) {
  try {
    console.log(`查询学生ID(${studentUserId})对应的教师端账号...`);
    
    // 查询community_user_roles表中是否有该用户的教师端ID
    // 注意：一个用户可能有多个角色，所以可能返回多条记录
    const [rows] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT teacher_id, role FROM community_user_roles 
         WHERE user_id = ? AND teacher_id IS NOT NULL AND teacher_id > 0
         ORDER BY created_at DESC LIMIT 1`,
        [studentUserId]
      );
    });
    
    if (rows && rows.length > 0) {
      console.log(`找到学生ID(${studentUserId})对应的教师端账号:`, rows[0]);
      return {
        teacherUserId: rows[0].teacher_id,
        roleType: rows[0].role
      };
    }
    
    console.log(`未找到学生ID(${studentUserId})对应的教师端账号`);
    return null;
  } catch (error) {
    console.error('根据学生ID查询教师账号时出错:', error);
    throw error;
  }
}

/**
 * 创建用户角色映射关系
 * @param {number} teacherUserId 教师用户ID
 * @param {number} studentUserId 学生用户ID
 * @param {string} roleType 角色类型
 * @returns {Promise<boolean>} 创建成功返回true
 */
async function createUserRoleMapping(teacherUserId, studentUserId, roleType) {
  try {
    console.log(`创建学生ID(${studentUserId})和教师ID(${teacherUserId})的映射关系，角色:${roleType}`);
    
    // 检查是否已存在该映射关系
    const [existingRows] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT 1 FROM community_user_roles
         WHERE user_id = ? AND teacher_id = ? AND role = ?`,
        [studentUserId, teacherUserId, roleType]
      );
    });
    
    if (existingRows && existingRows.length > 0) {
      console.log(`映射关系已存在，无需创建`);
      return true;
    }
    
    // 创建映射关系（插入新记录）
    await executeWithRetry(async (conn) => {
      return await conn.query(
        `INSERT INTO community_user_roles (user_id, role, teacher_id)
         VALUES (?, ?, ?)`,
        [studentUserId, roleType, teacherUserId]
      );
    });
    
    console.log(`成功创建映射关系`);
    return true;
  } catch (error) {
    console.error('创建用户角色映射关系时出错:', error);
    throw error;
  }
}

/**
 * 更新用户角色
 * @param {number} teacherUserId 教师用户ID
 * @param {string} newRoleType 新角色类型
 * @returns {Promise<boolean>} 更新成功返回true
 */
async function updateUserRole(teacherUserId, newRoleType) {
  try {
    console.log(`更新教师ID(${teacherUserId})的角色为:${newRoleType}`);
    
    // 此函数需要重新设计
    // 在新方案中，一个用户可以有多个角色，所以不应该更新角色，而是添加新角色
    // 我们可以通过添加新记录来实现
    
    // 查询是否已存在该角色
    const [existingRows] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT 1 FROM community_user_roles
         WHERE teacher_id = ? AND role = ?`,
        [teacherUserId, newRoleType]
      );
    });
    
    if (existingRows && existingRows.length > 0) {
      console.log(`教师(${teacherUserId})已拥有角色:${newRoleType}，无需添加`);
      return true;
    }
    
    // 查找该教师关联的学生ID
    const [userRows] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT DISTINCT user_id FROM community_user_roles
         WHERE teacher_id = ? LIMIT 1`,
        [teacherUserId]
      );
    });
    
    if (userRows && userRows.length > 0) {
      const studentUserId = userRows[0].user_id;
      
      // 添加新角色
      await executeWithRetry(async (conn) => {
        return await conn.query(
          `INSERT INTO community_user_roles (user_id, role, teacher_id)
           VALUES (?, ?, ?)`,
          [studentUserId, newRoleType, teacherUserId]
        );
      });
      
      console.log(`成功为教师(${teacherUserId})添加新角色:${newRoleType}`);
      return true;
    }
    
    console.error(`未找到教师(${teacherUserId})关联的学生用户`);
    return false;
  } catch (error) {
    console.error('更新用户角色时出错:', error);
    throw error;
  }
}

/**
 * 根据教师用户ID获取对应的学生用户ID
 * @param {number} teacherUserId 教师用户ID
 * @returns {Promise<{studentUserId: number, roleType: string}|null>} 返回学生用户ID和角色类型，如果不存在则返回null
 */
async function getStudentUserIdByTeacherUserId(teacherUserId) {
  try {
    console.log(`查询教师ID(${teacherUserId})对应的学生端账号...`);
    
    const [rows] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT user_id, role FROM community_user_roles
         WHERE teacher_id = ? 
         ORDER BY created_at DESC LIMIT 1`,
        [teacherUserId]
      );
    });
    
    if (rows && rows.length > 0) {
      console.log(`找到教师ID(${teacherUserId})对应的学生端账号:`, rows[0]);
      return {
        studentUserId: rows[0].user_id,
        roleType: rows[0].role
      };
    }
    
    console.log(`未找到教师ID(${teacherUserId})对应的学生端账号`);
    return null;
  } catch (error) {
    console.error('根据教师ID查询学生账号时出错:', error);
    throw error;
  }
}

/**
 * 添加用户角色（不覆盖现有角色）
 * 为保持API兼容性而添加的函数
 * @param {number} teacherUserId 教师用户ID
 * @param {string} role 角色类型
 * @returns {Promise<boolean>} 添加成功返回true
 */
async function addUserRole(teacherUserId, role) {
  // 直接调用updateUserRole，因为它已经实现了添加新角色的功能
  return await updateUserRole(teacherUserId, role);
}

/**
 * 根据教师用户ID删除用户角色映射关系
 * @param {number} teacherUserId 教师用户ID
 * @returns {Promise<boolean>} 删除成功返回true
 */
async function deleteUserRoleMappingByTeacherUserId(teacherUserId) {
  try {
    console.log(`删除教师ID(${teacherUserId})的所有角色映射关系...`);
    
    // 删除community_user_roles表中该教师ID的所有记录
    const [result] = await executeWithRetry(async (conn) => {
      return await conn.query(
        'DELETE FROM community_user_roles WHERE teacher_id = ?',
        [teacherUserId]
      );
    });
    
    console.log(`删除结果: 影响了${result.affectedRows}行记录`);
    return result.affectedRows > 0;
  } catch (error) {
    console.error('删除用户角色映射关系时出错:', error);
    throw error;
  }
}

/**
 * 检查用户是否有特定角色
 * 为保持API兼容性而添加的函数
 * @param {number} studentUserId 学生用户ID
 * @param {string} role 角色类型
 * @returns {Promise<boolean>} 如果用户有该角色，返回true
 */
async function checkUserRole(studentUserId, role) {
  try {
    const [rows] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT 1 FROM community_user_roles
         WHERE user_id = ? AND role = ?`,
        [studentUserId, role]
      );
    });
    
    return rows && rows.length > 0;
  } catch (error) {
    console.error('检查用户角色失败:', error);
    return false;
  }
}

/**
 * 获取所有特定角色的用户
 * 为保持API兼容性而添加的函数
 * @param {string} role 角色类型
 * @returns {Promise<Array>} 用户列表
 */
async function getUsersByRole(role) {
  try {
    const [rows] = await executeWithRetry(async (conn) => {
      return await conn.query(
        `SELECT r.*, u.name as student_name, u.email as student_email
         FROM community_user_roles r
         JOIN users u ON r.user_id = u.id
         WHERE r.role = ?`,
        [role]
      );
    });
    
    return rows || [];
  } catch (error) {
    console.error(`获取${role}角色用户失败:`, error);
    return [];
  }
}

module.exports = {
  initUserRoleMappingTable,
  getTeacherUserIdByStudentUserId,
  createUserRoleMapping,
  updateUserRole,
  getStudentUserIdByTeacherUserId,
  addUserRole,
  deleteUserRoleMappingByTeacherUserId,
  checkUserRole,
  getUsersByRole
}; 