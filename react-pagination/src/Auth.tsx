import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from './utils/authUtils';

interface AuthProps {
  children: React.ReactNode;
}

const Auth: React.FC<AuthProps> = ({ children }) => {
  // 使用authUtils中的isAuthenticated函数检查用户是否已认证
  const authenticated = isAuthenticated();

  console.log('Auth组件：用户认证状态检查 -', authenticated ? '已认证' : '未认证');

  if (!authenticated) {
    console.log('Auth组件：用户未认证，重定向到登录页');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default Auth;