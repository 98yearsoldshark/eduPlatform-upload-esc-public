/**
 * 题目管理路由 - 中间件
 */

// 用于验证请求的中间件
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: '未提供授权令牌' });
  }
  
  try {
    // 假设已有验证机制，这里简单处理
    // 实际项目中应该验证token的有效性
    next();
  } catch (error) {
    console.error('验证失败:', error);
    return res.status(403).json({ message: '授权验证失败' });
  }
};

// 导出中间件
module.exports = {
  authenticate
}; 