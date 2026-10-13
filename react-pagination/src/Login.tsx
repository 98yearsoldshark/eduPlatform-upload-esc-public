import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/auth.css';
import { storeTokens } from './utils/authUtils';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 显示localStorage的内容（调试用）
  const debugLocalStorage = () => {
    console.log('==== DEBUG: localStorage当前内容 ====');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        console.log(`${key}: ${value?.substring(0, 50)}${value && value.length > 50 ? '...' : ''}`);
      }
    }
    console.log('==================================');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      console.log('正在发送登录请求...');
      const response = await fetch('http://localhost:3001/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      debugLocalStorage(); // 登录前显示localStorage内容

      // 检查响应状态是否成功
      if (response.ok) {
        // 解析响应数据
        const data = await response.json();
        console.log('登录成功，处理认证信息:', data);
        
        if (data.token && data.user) {
          // 存储JWT格式的token作为主token和JSON格式的token作为备用
          storeTokens(data.token, data.user);
          
          // 显式存储完整的用户信息到userInfo
        localStorage.setItem('userInfo', JSON.stringify(data.user));
          
          // 向控制台输出日志
          console.log('认证信息已保存，JWT和JSON格式token已同时存储');
          console.log('完整的用户信息已保存到userInfo:', data.user);
          
          // 再次显示localStorage内容以验证存储是否成功
          debugLocalStorage();
          
        // 登录成功后重定向到应用主页
        window.location.href = '/app';
        } else {
          setError('服务器未返回有效的认证信息');
          console.error('认证信息无效:', data);
        }
      } else {
        // 如果响应状态不是成功
        // 解析错误信息
        const data = await response.json();
        // 显示服务器返回的错误信息，如果没有则显示默认错误信息
        setError(data.message || '登录失败');
        console.error('登录失败:', data);
      }
    } catch (error) {
      console.error('登录出错:', error);
      setError(`网络错误，请稍后重试: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const goToRegister = () => {
    navigate('/register');
  };

  return (
    <div className="login-container">
      <h2>登录</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>邮箱:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label>密码:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
      <div className="register-link">
        <p>还没有账号？<a href="#" onClick={goToRegister}>立即注册</a></p>
      </div>
    </div>
  );
};

export default Login;