/**
 * 权限配置控制器
 * 提供权限配置的REST API接口
 */
const yaml = require('js-yaml');
const { nacosClient, getConfig, publishConfig } = require('./nacosClient');

// 权限配置文件ID
const PERMISSIONS_DATA_ID = 'permissions.yaml';
// 注册配置文件ID
const REGISTER_CONFIG_DATA_ID = 'register-config.yaml';

/**
 * 获取权限配置
 */
async function getPermissionsConfig(req, res) {
  try {
    // 获取配置
    const config = await getConfig(PERMISSIONS_DATA_ID);
    
    // 记录日志
    console.log('获取权限配置请求:', {
      user: req.teacher?.id || '未知用户',
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取权限配置失败:', error);
    res.status(500).json({
      success: false,
      error: '获取权限配置失败: ' + error.message
    });
  }
}

/**
 * 更新角色权限配置
 */
async function updateRolePermissions(req, res) {
  try {
    // 获取请求参数
    const { role, permissions } = req.body;
    
    if (!role || !permissions || typeof permissions !== 'object') {
      return res.status(400).json({
        success: false,
        error: '无效的请求参数'
      });
    }
    
    // 获取当前配置
    const config = await getConfig(PERMISSIONS_DATA_ID);
    
    // 确保roles配置存在
    if (!config.roles) {
      config.roles = {};
    }
    
    // 更新指定角色的权限
    config.roles[role] = {
      ...config.roles[role],
      ...permissions
    };
    
    // 将配置转换为YAML
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      quotingType: '"'
    });
    
    // 保存到Nacos
    await publishConfig(PERMISSIONS_DATA_ID, yamlContent);
    
    // 记录操作日志
    console.log('更新角色权限:', {
      user: req.teacher?.id || '未知用户',
      role,
      permissions: Object.keys(permissions),
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: `角色 ${role} 的权限已更新`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('更新角色权限失败:', error);
    res.status(500).json({
      success: false,
      error: '更新角色权限失败: ' + error.message
    });
  }
}

/**
 * 更新策略配置
 */
async function updatePolicies(req, res) {
  try {
    // 获取请求参数
    const { policies } = req.body;
    
    if (!policies || typeof policies !== 'object') {
      return res.status(400).json({
        success: false,
        error: '无效的策略配置'
      });
    }
    
    // 获取当前配置
    const config = await getConfig(PERMISSIONS_DATA_ID);
    
    // 更新策略配置
    config.policies = {
      ...config.policies,
      ...policies
    };
    
    // 将配置转换为YAML
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      quotingType: '"'
    });
    
    // 保存到Nacos
    await publishConfig(PERMISSIONS_DATA_ID, yamlContent);
    
    // 记录操作日志
    console.log('更新策略配置:', {
      user: req.teacher?.id || '未知用户',
      policies: Object.keys(policies),
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: '策略配置已更新',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('更新策略配置失败:', error);
    res.status(500).json({
      success: false,
      error: '更新策略配置失败: ' + error.message
    });
  }
}

/**
 * 更新社区功能配置
 */
async function updateCommunityConfig(req, res) {
  try {
    // 获取请求参数
    const { community } = req.body;
    
    if (!community || typeof community !== 'object') {
      return res.status(400).json({
        success: false,
        error: '无效的社区配置'
      });
    }
    
    // 获取当前配置
    const config = await getConfig(PERMISSIONS_DATA_ID);
    
    // 确保社区配置存在
    if (!config.community) {
      config.community = {};
    }
    
    // 递归合并社区配置
    config.community = deepMerge(config.community, community);
    
    // 将配置转换为YAML
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      quotingType: '"'
    });
    
    // 保存到Nacos
    await publishConfig(PERMISSIONS_DATA_ID, yamlContent);
    
    // 记录操作日志
    console.log('更新社区配置:', {
      user: req.teacher?.id || '未知用户',
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: '社区配置已更新',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('更新社区配置失败:', error);
    res.status(500).json({
      success: false,
      error: '更新社区配置失败: ' + error.message
    });
  }
}

/**
 * 校验配置
 */
async function validateConfig(req, res) {
  try {
    // 获取请求参数
    const { config } = req.body;
    
    if (!config || typeof config !== 'string') {
      return res.status(400).json({
        success: false,
        error: '无效的配置内容'
      });
    }
    
    // 尝试解析YAML
    const parsedConfig = yaml.load(config);
    
    // 校验配置结构
    const errors = validatePermissionsConfig(parsedConfig);
    
    if (errors.length > 0) {
      return res.json({
        success: false,
        valid: false,
        errors
      });
    }
    
    res.json({
      success: true,
      valid: true,
      message: '配置验证通过'
    });
  } catch (error) {
    console.error('配置验证失败:', error);
    res.status(400).json({
      success: false,
      valid: false,
      error: '配置格式无效: ' + error.message
    });
  }
}

/**
 * 获取配置历史版本
 */
async function getConfigHistory(req, res) {
  try {
    // 注意：此功能在模拟实现中不可用
    // 在真实Nacos环境中应调用相应API
    
    res.json({
      success: true,
      message: '在当前模拟环境中，配置历史功能不可用',
      history: []
    });
  } catch (error) {
    console.error('获取配置历史失败:', error);
    res.status(500).json({
      success: false,
      error: '获取配置历史失败: ' + error.message
    });
  }
}

/**
 * 获取注册配置
 */
async function getRegisterConfig(req, res) {
  try {
    // 获取配置
    const config = await getConfig(REGISTER_CONFIG_DATA_ID);
    
    // 如果配置不存在，则创建默认配置
    if (!config || Object.keys(config).length === 0) {
      const defaultConfig = {
        studentRegister: {
          enabled: true,
          requireEmail: true,
          requirePhone: true,
          allowOpenRegistration: true,
          maxAccountsPerIp: 5,
          registerCooldown: 60
        },
        teacherRegister: {
          enabled: true,
          maxRegisterPerTeacherId: 5,
          requireApproval: false,
          allowSelfRegister: true,
          requireSchool: true
        },
        security: {
          useRecaptcha: false,
          recaptchaKey: '',
          allowPasswordReset: true,
          minimumPasswordLength: 3,
          restrictedDomains: [],
          restrictedEmails: []
        }
      };
      
      // 将默认配置转换为YAML
      const yamlContent = yaml.dump(defaultConfig, {
        indent: 2,
        lineWidth: 120,
        quotingType: '"'
      });
      
      // 保存到Nacos
      await publishConfig(REGISTER_CONFIG_DATA_ID, yamlContent);
      
      // 记录日志
      console.log('创建默认注册配置:', {
        user: req.teacher?.id || '未知用户',
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        config: defaultConfig,
        timestamp: new Date().toISOString(),
        message: '已创建默认注册配置'
      });
    } else {
      // 记录日志
      console.log('获取注册配置请求:', {
        user: req.teacher?.id || '未知用户',
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        config,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('获取注册配置失败:', error);
    res.status(500).json({
      success: false,
      error: '获取注册配置失败: ' + error.message
    });
  }
}

/**
 * 更新学生端注册配置
 */
async function updateStudentRegisterConfig(req, res) {
  try {
    // 获取请求参数
    const { studentRegister } = req.body;
    
    if (!studentRegister || typeof studentRegister !== 'object') {
      return res.status(400).json({
        success: false,
        error: '无效的学生端注册配置'
      });
    }
    
    // 获取当前配置
    const config = await getConfig(REGISTER_CONFIG_DATA_ID);
    
    // 更新学生端注册配置
    config.studentRegister = {
      ...config.studentRegister,
      ...studentRegister
    };
    
    // 将配置转换为YAML
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      quotingType: '"'
    });
    
    // 保存到Nacos
    await publishConfig(REGISTER_CONFIG_DATA_ID, yamlContent);
    
    // 记录操作日志
    console.log('更新学生端注册配置:', {
      user: req.teacher?.id || '未知用户',
      config: studentRegister,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: '学生端注册配置已更新',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('更新学生端注册配置失败:', error);
    res.status(500).json({
      success: false,
      error: '更新学生端注册配置失败: ' + error.message
    });
  }
}

/**
 * 更新教师端注册配置
 */
async function updateTeacherRegisterConfig(req, res) {
  try {
    // 获取请求参数
    const { teacherRegister } = req.body;
    
    if (!teacherRegister || typeof teacherRegister !== 'object') {
      return res.status(400).json({
        success: false,
        error: '无效的教师端注册配置'
      });
    }
    
    // 获取当前配置
    const config = await getConfig(REGISTER_CONFIG_DATA_ID);
    
    // 更新教师端注册配置
    config.teacherRegister = {
      ...config.teacherRegister,
      ...teacherRegister
    };
    
    // 将配置转换为YAML
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      quotingType: '"'
    });
    
    // 保存到Nacos
    await publishConfig(REGISTER_CONFIG_DATA_ID, yamlContent);
    
    // 记录操作日志
    console.log('更新教师端注册配置:', {
      user: req.teacher?.id || '未知用户',
      config: teacherRegister,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: '教师端注册配置已更新',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('更新教师端注册配置失败:', error);
    res.status(500).json({
      success: false,
      error: '更新教师端注册配置失败: ' + error.message
    });
  }
}

/**
 * 更新注册安全配置
 */
async function updateSecurityConfig(req, res) {
  try {
    // 获取请求参数
    const { security } = req.body;
    
    if (!security || typeof security !== 'object') {
      return res.status(400).json({
        success: false,
        error: '无效的注册安全配置'
      });
    }
    
    // 获取当前配置
    const config = await getConfig(REGISTER_CONFIG_DATA_ID);
    
    // 确保配置对象存在
    if (!config.security) {
      config.security = {};
    }
    
    // 更新安全配置
    config.security = {
      ...config.security,
      ...security
    };
    
    // 将配置转换为YAML
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: 120,
      quotingType: '"'
    });
    
    // 保存到Nacos
    await publishConfig(REGISTER_CONFIG_DATA_ID, yamlContent);
    
    // 记录操作日志
    console.log('更新注册安全配置:', {
      user: req.teacher?.id || '未知用户',
      config: security,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: '注册安全配置已更新',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('更新注册安全配置失败:', error);
    res.status(500).json({
      success: false,
      error: '更新注册安全配置失败: ' + error.message
    });
  }
}

// 辅助函数：递归合并对象
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

// 辅助函数：校验权限配置结构
function validatePermissionsConfig(config) {
  const errors = [];
  
  // 检查主要字段是否存在
  if (!config.roles && !config.policies && !config.community) {
    errors.push('配置必须包含至少一个主要字段: roles, policies, community');
  }
  
  // 检查roles是否为对象
  if (config.roles && typeof config.roles !== 'object') {
    errors.push('roles必须是对象类型');
  }
  
  // 检查policies是否为对象
  if (config.policies && typeof config.policies !== 'object') {
    errors.push('policies必须是对象类型');
  }
  
  // 检查community是否为对象
  if (config.community && typeof config.community !== 'object') {
    errors.push('community必须是对象类型');
  }
  
  return errors;
}

module.exports = {
  getPermissionsConfig,
  updateRolePermissions,
  updatePolicies,
  updateCommunityConfig,
  validateConfig,
  getConfigHistory,
  getRegisterConfig,
  updateStudentRegisterConfig,
  updateTeacherRegisterConfig,
  updateSecurityConfig
}; 