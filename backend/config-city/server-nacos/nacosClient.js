// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../config/runtime');
/**
 * Nacos配置客户端
 * 负责与Nacos服务器通信，获取和发布配置
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { EventEmitter } = require('events');
const axios = require('axios');

// 配置事件发射器
const configEvents = new EventEmitter();

// Nacos服务器配置
// 实际项目中应从环境变量或专门的配置文件中读取
const NACOS_CONFIG = {
  serverAddr: process.env.NACOS_SERVER_ADDR || '127.0.0.1:8848',
  namespace: process.env.NACOS_NAMESPACE || 'public',
  group: process.env.NACOS_GROUP || 'DEFAULT_GROUP',
  username: process.env.NACOS_USERNAME,
  password: process.env.NACOS_PASSWORD
};

// 全局配置缓存
const configCache = {};

// 模拟Nacos客户端实现
// 在实际项目中，应使用官方的Nacos SDK
class NacosClient {
  constructor() {
    // 初始化配置目录路径
    this.configDir = path.join(__dirname, 'config');
    
    // 确保配置目录存在
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    
    // 加载本地配置缓存
    this.loadLocalConfigs();
    
    // 模拟配置更新检查（实际项目中应使用Nacos长轮询或WebSocket）
    setInterval(() => this.checkConfigUpdates(), 30000);
    
    console.log('Nacos客户端初始化完成，使用本地配置目录:', this.configDir);
  }
  
  // 加载本地配置文件
  loadLocalConfigs() {
    try {
      const files = fs.readdirSync(this.configDir);
      files.forEach(file => {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const dataId = file;
          const filePath = path.join(this.configDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          try {
            // 解析YAML配置
            const config = yaml.load(content);
            configCache[dataId] = {
              content,
              config,
              md5: this.calculateMd5(content),
              lastModified: fs.statSync(filePath).mtime
            };
            console.log(`已加载本地配置: ${dataId}`);
          } catch (parseError) {
            console.error(`解析配置文件失败: ${dataId}`, parseError);
          }
        }
      });
    } catch (error) {
      console.error('加载本地配置失败:', error);
    }
  }
  
  // 模拟配置更新检查
  checkConfigUpdates() {
    // 实际项目中应通过Nacos API检查配置是否有更新
    // 这里只是简单地检查文件修改时间
    try {
      const files = fs.readdirSync(this.configDir);
      files.forEach(file => {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const dataId = file;
          const filePath = path.join(this.configDir, file);
          const stats = fs.statSync(filePath);
          
          // 检查配置是否已存在于缓存中，且最后修改时间是否有变化
          if (configCache[dataId] && stats.mtime > configCache[dataId].lastModified) {
            const content = fs.readFileSync(filePath, 'utf8');
            const newMd5 = this.calculateMd5(content);
            
            // 如果内容有变化，更新缓存并触发事件
            if (newMd5 !== configCache[dataId].md5) {
              try {
                const config = yaml.load(content);
                configCache[dataId] = {
                  content,
                  config,
                  md5: newMd5,
                  lastModified: stats.mtime
                };
                
                console.log(`配置已更新: ${dataId}`);
                configEvents.emit('configChanged', { dataId, config });
              } catch (parseError) {
                console.error(`解析更新的配置失败: ${dataId}`, parseError);
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('检查配置更新失败:', error);
    }
  }
  
  // 计算内容的MD5值（用于比较配置是否有变化）
  calculateMd5(content) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }
  
  // 获取配置
  async getConfig(dataId, group = NACOS_CONFIG.group) {
    // 先从缓存获取
    if (configCache[dataId]) {
      return configCache[dataId].config;
    }
    
    // 尝试从本地文件获取
    try {
      const filePath = path.join(this.configDir, dataId);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const config = yaml.load(content);
        
        // 更新缓存
        configCache[dataId] = {
          content,
          config,
          md5: this.calculateMd5(content),
          lastModified: fs.statSync(filePath).mtime
        };
        
        return config;
      }
    } catch (error) {
      console.error(`获取本地配置失败: ${dataId}`, error);
    }
    
    // 如果本地没有配置，返回空对象
    return {};
  }
  
  // 发布配置
  async publishConfig(dataId, content, group = NACOS_CONFIG.group) {
    try {
      // 保存到本地文件
      const filePath = path.join(this.configDir, dataId);
      fs.writeFileSync(filePath, content, 'utf8');
      
      // 解析配置内容
      const config = yaml.load(content);
      
      // 更新缓存
      configCache[dataId] = {
        content,
        config,
        md5: this.calculateMd5(content),
        lastModified: new Date()
      };
      
      // 触发配置变更事件
      configEvents.emit('configChanged', { dataId, config });
      
      console.log(`配置已发布: ${dataId}`);
      return true;
    } catch (error) {
      console.error(`发布配置失败: ${dataId}`, error);
      throw error;
    }
  }
  
  // 删除配置
  async removeConfig(dataId, group = NACOS_CONFIG.group) {
    try {
      const filePath = path.join(this.configDir, dataId);
      
      // 检查文件是否存在
      if (fs.existsSync(filePath)) {
        // 删除文件
        fs.unlinkSync(filePath);
        
        // 从缓存中移除
        delete configCache[dataId];
        
        // 触发配置删除事件
        configEvents.emit('configRemoved', { dataId });
        
        console.log(`配置已删除: ${dataId}`);
        return true;
      } else {
        console.warn(`配置不存在，无法删除: ${dataId}`);
        return false;
      }
    } catch (error) {
      console.error(`删除配置失败: ${dataId}`, error);
      throw error;
    }
  }
  
  // 监听配置变更
  subscribe(dataId, listener, group = NACOS_CONFIG.group) {
    const eventName = `${group}:${dataId}`;
    
    // 注册事件监听器
    configEvents.on('configChanged', (data) => {
      if (data.dataId === dataId) {
        listener(data.config);
      }
    });
    
    console.log(`已订阅配置变更: ${dataId}`);
    
    // 返回取消订阅的函数
    return () => {
      configEvents.removeListener('configChanged', listener);
      console.log(`已取消订阅配置变更: ${dataId}`);
    };
  }
  
  // 获取所有配置列表
  async getAllConfigs() {
    try {
      const configs = [];
      const files = fs.readdirSync(this.configDir);
      
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const dataId = file;
          const filePath = path.join(this.configDir, file);
          const stats = fs.statSync(filePath);
          
          configs.push({
            dataId,
            group: NACOS_CONFIG.group,
            lastModified: stats.mtime.toISOString(),
            size: stats.size
          });
        }
      }
      
      return configs;
    } catch (error) {
      console.error('获取配置列表失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
const nacosClient = new NacosClient();

module.exports = {
  nacosClient,
  getConfig: async (dataId, group) => nacosClient.getConfig(dataId, group),
  publishConfig: async (dataId, content, group) => nacosClient.publishConfig(dataId, content, group),
  removeConfig: async (dataId, group) => nacosClient.removeConfig(dataId, group),
  subscribe: (dataId, listener, group) => nacosClient.subscribe(dataId, listener, group),
  getAllConfigs: async () => nacosClient.getAllConfigs()
}; 