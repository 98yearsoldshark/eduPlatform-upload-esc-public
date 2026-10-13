/**
 * 注册配置中间件
 * 用于在用户注册时应用配置中的规则
 */

const nacosClient = require('../config-city/server-nacos/nacosClient');
const REGISTER_CONFIG_DATA_ID = 'register-config.yaml';

// IP注册计数器和冷却时间跟踪
const ipRegistrationCounts = {};
const ipCooldownTimers = {};

// 清理过期的IP计数，定期运行以防止内存泄漏
setInterval(() => {
  const now = Date.now();
  // 清理超过24小时的IP记录
  Object.keys(ipRegistrationCounts).forEach(ip => {
    if (now - ipRegistrationCounts[ip].lastUpdate > 24 * 60 * 60 * 1000) {
      delete ipRegistrationCounts[ip];
    }
  });
  
  // 清理已过期的冷却计时器
  Object.keys(ipCooldownTimers).forEach(ip => {
    if (now > ipCooldownTimers[ip]) {
      delete ipCooldownTimers[ip];
    }
  });
}, 3600000); // 每小时运行一次

/**
 * 学生注册中间件
 * 检查学生注册配置并应用相应规则
 */
async function studentRegisterMiddleware(req, res, next) {
  try {
    const clientIp = req.ip || req.connection.remoteAddress;
    console.log(`检查学生注册请求 - IP: ${clientIp}`);
    
    // 从Nacos获取注册配置
    const config = await nacosClient.getConfig(REGISTER_CONFIG_DATA_ID);
    const studentConfig = config.studentRegister || {};
    
    // 检查是否启用了学生注册功能
    if (studentConfig.enabled === false) {
      return res.status(403).json({
        error: '学生注册功能已关闭',
        code: 'STUDENT_REGISTRATION_DISABLED'
      });
    }
    
    // 检查是否允许开放注册
    if (studentConfig.allowOpenRegistration === false) {
      return res.status(403).json({
        error: '当前不允许开放注册，请联系管理员获取邀请码',
        code: 'OPEN_REGISTRATION_DISABLED'
      });
    }
    
    // 检查IP注册冷却时间
    if (studentConfig.registerCooldown > 0 && ipCooldownTimers[clientIp]) {
      const remainingTime = Math.ceil((ipCooldownTimers[clientIp] - Date.now()) / 1000);
      if (remainingTime > 0) {
        return res.status(429).json({
          error: `请求过于频繁，请等待 ${remainingTime} 秒后再试`,
          remainingTime,
          code: 'REGISTRATION_COOLDOWN'
        });
      }
    }
    
    // 检查IP注册次数限制
    if (studentConfig.maxAccountsPerIp > 0) {
      if (!ipRegistrationCounts[clientIp]) {
        ipRegistrationCounts[clientIp] = { count: 0, lastUpdate: Date.now() };
      }
      
      if (ipRegistrationCounts[clientIp].count >= studentConfig.maxAccountsPerIp) {
        return res.status(403).json({
          error: `该IP已达到最大注册账号数限制 (${studentConfig.maxAccountsPerIp})`,
          code: 'MAX_ACCOUNTS_PER_IP_REACHED'
        });
      }
    }
    
    // 检查必填字段
    const { email, phone } = req.body;
    if (studentConfig.requireEmail && !email) {
      return res.status(400).json({
        error: '邮箱地址为必填项',
        code: 'EMAIL_REQUIRED'
      });
    }
    
    if (studentConfig.requirePhone && !phone) {
      return res.status(400).json({
        error: '手机号码为必填项',
        code: 'PHONE_REQUIRED'
      });
    }
    
    // 检查密码长度
    const { password } = req.body;
    const securityConfig = config.security || {};
    if (securityConfig.minimumPasswordLength > 0 && 
        (!password || password.length < securityConfig.minimumPasswordLength)) {
      return res.status(400).json({
        error: `密码长度不能少于 ${securityConfig.minimumPasswordLength} 个字符`,
        code: 'PASSWORD_TOO_SHORT'
      });
    }
    
    // 检查受限域名
    if (email && Array.isArray(securityConfig.restrictedDomains) && securityConfig.restrictedDomains.length > 0) {
      const domain = email.split('@')[1];
      if (domain && securityConfig.restrictedDomains.includes(domain)) {
        return res.status(403).json({
          error: `不允许使用该邮箱域名 (${domain})`,
          code: 'RESTRICTED_DOMAIN'
        });
      }
    }
    
    // 检查受限邮箱
    if (email && Array.isArray(securityConfig.restrictedEmails) && securityConfig.restrictedEmails.includes(email)) {
      return res.status(403).json({
        error: '该邮箱地址已被禁用',
        code: 'RESTRICTED_EMAIL'
      });
    }
    
    // 在原始请求对象上附加配置信息，以便后续处理
    req.registerConfig = config;
    
    // 如果通过了所有检查，继续处理请求
    next();
  } catch (error) {
    console.error('学生注册中间件错误:', error);
    next(error); // 将错误传递给错误处理中间件
  }
}

/**
 * 教师注册中间件
 * 检查教师注册配置并应用相应规则
 */
async function teacherRegisterMiddleware(req, res, next) {
  try {
    console.log(`检查教师注册请求 - 教师ID: ${req.body.teacher_id}`);
    
    // 从Nacos获取注册配置
    const config = await nacosClient.getConfig(REGISTER_CONFIG_DATA_ID);
    const teacherConfig = config.teacherRegister || {};
    
    // 检查是否启用了教师注册功能
    if (teacherConfig.enabled === false) {
      return res.status(403).json({
        error: '教师注册功能已关闭',
        code: 'TEACHER_REGISTRATION_DISABLED'
      });
    }
    
    // 检查是否允许自主注册
    if (teacherConfig.allowSelfRegister === false) {
      return res.status(403).json({
        error: '当前不允许教师自主注册，请联系管理员',
        code: 'SELF_REGISTRATION_DISABLED'
      });
    }
    
    // 检查必填字段
    const { school } = req.body;
    if (teacherConfig.requireSchool && !school) {
      return res.status(400).json({
        error: '学校信息为必填项',
        code: 'SCHOOL_REQUIRED'
      });
    }
    
    // 检查密码长度
    const { password } = req.body;
    const securityConfig = config.security || {};
    if (securityConfig.minimumPasswordLength > 0 && 
        (!password || password.length < securityConfig.minimumPasswordLength)) {
      return res.status(400).json({
        error: `密码长度不能少于 ${securityConfig.minimumPasswordLength} 个字符`,
        code: 'PASSWORD_TOO_SHORT'
      });
    }
    
    // 在原始请求对象上附加配置信息，以便后续处理
    req.registerConfig = config;
    
    // 教师ID注册次数限制在后端代码中已经处理，无需在中间件中重复
    
    // 如果通过了所有检查，继续处理请求
    next();
  } catch (error) {
    console.error('教师注册中间件错误:', error);
    next(error); // 将错误传递给错误处理中间件
  }
}

/**
 * 注册后处理中间件
 * 在注册成功后更新IP计数和冷却时间
 */
function postRegistrationHandler(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress;
  const config = req.registerConfig || {};
  
  // 学生注册后处理
  if (req.originalUrl.includes('/register') && !req.originalUrl.includes('/teacher')) {
    const studentConfig = config.studentRegister || {};
    
    // 更新IP注册计数
    if (studentConfig.maxAccountsPerIp > 0) {
      if (!ipRegistrationCounts[clientIp]) {
        ipRegistrationCounts[clientIp] = { count: 0, lastUpdate: Date.now() };
      }
      ipRegistrationCounts[clientIp].count += 1;
      ipRegistrationCounts[clientIp].lastUpdate = Date.now();
    }
    
    // 设置IP冷却时间
    if (studentConfig.registerCooldown > 0) {
      ipCooldownTimers[clientIp] = Date.now() + (studentConfig.registerCooldown * 1000);
    }
  }
  
  next();
}

module.exports = {
  studentRegisterMiddleware,
  teacherRegisterMiddleware,
  postRegistrationHandler
}; 