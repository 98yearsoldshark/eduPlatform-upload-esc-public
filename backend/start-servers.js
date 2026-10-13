// 先加载私有运行配置，禁止在源码中保存凭据。
require('./config/runtime');
// 从环境变量加载本地运行配置，公开仓库不保存真实凭据。

/**
 * 启动脚本 - 同时启动学生端、教师端和社区服务器
 */
const { spawn } = require('child_process');
const path = require('path');

// 定义服务器路径
const mainServerPath = path.join(__dirname, 'sever.js');
const teacherServerPath = path.join(__dirname, 'safe-teachsever', 'server.js');
const communityServerPath = path.join(__dirname, 'community-server', 'server.js');

// 启动主服务器(学生端)
const mainServer = spawn('node', [mainServerPath], {
  stdio: 'inherit',
  detached: false
});

// 启动教师端服务器
const teacherServer = spawn('node', [teacherServerPath], {
  stdio: 'inherit',
  detached: false
});

// 启动社区服务器
const communityServer = spawn('node', [communityServerPath], {
  stdio: 'inherit',
  detached: false
});

// 处理主服务器事件
mainServer.on('error', (err) => {
  console.error('主服务器启动失败:', err);
});

mainServer.on('close', (code) => {
  console.log(`主服务器已关闭，退出码: ${code}`);
  // 当主服务器关闭时，也关闭教师端服务器
  if (!teacherServer.killed) {
    teacherServer.kill();
  }
  process.exit(code);
});

// 处理教师端服务器事件
teacherServer.on('error', (err) => {
  console.error('教师端服务器启动失败:', err);
});

teacherServer.on('close', (code) => {
  console.log(`教师端服务器已关闭，退出码: ${code}`);
});

// 处理社区服务器事件
communityServer.on('error', (err) => {
  console.error('社区服务器启动失败:', err);
});

communityServer.on('close', (code) => {
  console.log(`社区服务器已关闭，退出码: ${code}`);
});

// 处理进程终止信号
process.on('SIGINT', () => {
  console.log('接收到终止信号，正在关闭服务器...');
  
  if (!mainServer.killed) {
    mainServer.kill();
  }
  
  if (!teacherServer.killed) {
    teacherServer.kill();
  }
  
  if (!communityServer.killed) {
    communityServer.kill();
  }
});

console.log('已启动学生端服务器(端口3001)、教师端服务器(端口3002)和社区服务器(端口3003)');