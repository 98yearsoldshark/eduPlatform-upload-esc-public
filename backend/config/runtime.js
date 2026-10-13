// 加载仓库根目录的私有环境文件，并拒绝缺失的认证密钥。
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`缺少必要环境变量：${name}`);
  return value;
}

module.exports = { requireEnv };
