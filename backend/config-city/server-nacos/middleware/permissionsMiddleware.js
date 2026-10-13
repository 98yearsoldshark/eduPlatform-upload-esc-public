// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../../config/runtime');
/**
 * 权限验证中间件
 * 用于验证用户是否有权限执行特定操作
 */
const { getConfig } = require('../nacosClient');

// 权限配置文件ID
const PERMISSIONS_DATA_ID = 'permissions.yaml';

/**
 * 获取最新权限配置数据
 * @returns {Promise<Object>} 权限配置对象
 */
const getPermissionsConfig = async () => {
  try {
    console.log('【权限中间件】获取权限配置...');
    const config = await getConfig(PERMISSIONS_DATA_ID);
    return config;
  } catch (error) {
    console.error('【权限中间件】获取权限配置失败:', error);
    throw error;
  }
};

/**
 * 检查教师是否可以分配助教
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 * @param {Function} next - Express下一个中间件函数
 */
const checkCanAssignAssistant = async (req, res, next) => {
  try {
    // 确保用户已经通过认证
    if (!req.teacher || !req.teacher.id) {
      return res.status(401).json({ error: '未授权访问', detail: '请先登录' });
    }

    // 获取权限配置
    const config = await getPermissionsConfig();
    
    console.log('【权限验证】正在检查canAssignAssistant权限');
    console.log('【权限验证】教师ID:', req.teacher.id);
    console.log('【权限验证】权限配置:', config.roles?.teacher);

    // 检查教师角色权限
    if (!config.roles?.teacher?.canAssignAssistant) {
      console.log('【权限验证】canAssignAssistant权限检查失败');
      return res.status(403).json({ 
        error: '权限不足', 
        detail: '您没有分配助教的权限' 
      });
    }

    // 权限验证通过
    console.log('【权限验证】canAssignAssistant权限检查通过');
    next();
  } catch (error) {
    console.error('【权限验证】canAssignAssistant权限检查错误:', error);
    res.status(500).json({ error: '权限验证过程发生错误', message: error.message });
  }
};

/**
 * 检查教师是否可以查看所有学生
 */
const checkCanViewAllStudents = async (req, res, next) => {
  try {
    // 确保用户已经通过认证
    if (!req.teacher || !req.teacher.id) {
      return res.status(401).json({ error: '未授权访问', detail: '请先登录' });
    }

    // 获取权限配置
    const config = await getPermissionsConfig();
    
    console.log('【权限验证】正在检查canViewAllStudents权限');
    console.log('【权限验证】教师ID:', req.teacher.id);

    // 检查教师角色权限
    if (!config.roles?.teacher?.canViewAllStudents) {
      console.log('【权限验证】canViewAllStudents权限检查失败');
      return res.status(403).json({ 
        error: '权限不足', 
        detail: '您没有查看所有学生的权限' 
      });
    }

    // 权限验证通过
    console.log('【权限验证】canViewAllStudents权限检查通过');
    next();
  } catch (error) {
    console.error('【权限验证】canViewAllStudents权限检查错误:', error);
    res.status(500).json({ error: '权限验证过程发生错误', message: error.message });
  }
};

/**
 * 检查教师是否可以修改题目
 */
const checkCanModifyQuestions = async (req, res, next) => {
  try {
    // 确保用户已经通过认证
    if (!req.teacher || !req.teacher.id) {
      return res.status(401).json({ error: '未授权访问', detail: '请先登录' });
    }

    // 获取权限配置
    const config = await getPermissionsConfig();
    
    console.log('【权限验证】正在检查canModifyQuestions权限');
    console.log('【权限验证】教师ID:', req.teacher.id);

    // 检查教师角色权限
    if (!config.roles?.teacher?.canModifyQuestions) {
      console.log('【权限验证】canModifyQuestions权限检查失败');
      return res.status(403).json({ 
        error: '权限不足', 
        detail: '您没有修改题库的权限' 
      });
    }

    // 权限验证通过
    console.log('【权限验证】canModifyQuestions权限检查通过');
    next();
  } catch (error) {
    console.error('【权限验证】canModifyQuestions权限检查错误:', error);
    res.status(500).json({ error: '权限验证过程发生错误', message: error.message });
  }
};

/**
 * 检查教师创建班级的数量限制
 */
const checkMaxClassCount = async (req, res, next) => {
  try {
    // 确保用户已经通过认证
    if (!req.teacher || !req.teacher.id) {
      return res.status(401).json({ error: '未授权访问', detail: '请先登录' });
    }

    // 获取权限配置
    const config = await getPermissionsConfig();
    
    console.log('【权限验证】正在检查maxClassCount限制');
    console.log('【权限验证】教师ID:', req.teacher.id);
    
    // 获取最大班级数量配置
    const maxClassCount = config.roles?.teacher?.maxClassCount || 10; // 默认为10
    
    // 获取教师当前班级数量
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
    }).promise();
    
    const [rows] = await pool.query(
      'SELECT COUNT(*) as classCount FROM classes WHERE teacher_id = ?',
      [req.teacher.id]
    );
    
    const currentClassCount = rows[0].classCount;
    
    console.log('【权限验证】当前班级数量:', currentClassCount);
    console.log('【权限验证】最大允许班级数量:', maxClassCount);
    
    // 检查是否超过最大班级数量限制
    if (currentClassCount >= maxClassCount) {
      console.log('【权限验证】maxClassCount权限检查失败，已达到最大班级数量限制');
      return res.status(403).json({ 
        error: '权限不足', 
        detail: `您最多只能创建${maxClassCount}个班级，当前已有${currentClassCount}个` 
      });
    }

    // 权限验证通过
    console.log('【权限验证】maxClassCount权限检查通过');
    next();
  } catch (error) {
    console.error('【权限验证】maxClassCount权限检查错误:', error);
    res.status(500).json({ error: '权限验证过程发生错误', message: error.message });
  }
};

module.exports = {
  checkCanAssignAssistant,
  checkCanViewAllStudents,
  checkCanModifyQuestions,
  checkMaxClassCount
}; 