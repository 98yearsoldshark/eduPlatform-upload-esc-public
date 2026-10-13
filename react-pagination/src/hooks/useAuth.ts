import { useState, useEffect } from 'react';
import { parseToken } from '../utils/authUtils';

/**
 * 认证自定义Hook - 提供组件中使用的用户认证信息
 * @returns {{userId: number|null, userInfo: any, isAuthenticated: boolean, loading: boolean, error: string|null}}
 */
export const useAuth = () => {
  const [userId, setUserId] = useState<number | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 获取并解析token
    const fetchUser = async () => {
      try {
        setLoading(true);
        const userData = parseToken();
        
        if (userData) {
          setUserId(userData.id);
          setUserInfo(userData);
          setIsAuthenticated(true);
          console.log('useAuth: 成功获取用户信息', userData);
        } else {
          setUserId(null);
          setUserInfo(null);
          setIsAuthenticated(false);
          setError('无法获取用户信息');
          console.error('useAuth: 未找到有效的用户信息');
        }
      } catch (err) {
        setError('解析用户信息失败');
        console.error('useAuth: 解析token时出错', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return {
    userId,
    userInfo,
    isAuthenticated,
    loading,
    error
  };
};

export default useAuth; 