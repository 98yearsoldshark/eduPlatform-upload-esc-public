import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

interface Teacher {
  id: number;
  name: string;
  school: string;
  roles?: string[]; // 用户角色数组
  [key: string]: any; // 允许其他属性
}

interface AuthContextType {
  isAuthenticated: boolean;
  teacher: Teacher | null;
  token?: string;
  login: (token: string, teacherData: Teacher) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查本地存储中是否有令牌和教师信息
    const storedToken = localStorage.getItem('teacherToken');
    const teacherInfo = localStorage.getItem('teacherInfo');

    if (storedToken && teacherInfo) {
      try {
        const teacherData = JSON.parse(teacherInfo);
        setToken(storedToken);
        setTeacher(teacherData);
        setIsAuthenticated(true);
        
        // 打印调试信息，在控制台查看
        console.log("【AuthContext】从本地存储还原的认证信息:");
        console.log("【AuthContext】token:", storedToken.substring(0, 10) + "...");
        console.log("【AuthContext】teacher:", teacherData);
      } catch (error) {
        console.error('Failed to parse teacher info:', error);
        // 如果解析失败，清除本地存储
        localStorage.removeItem('teacherToken');
        localStorage.removeItem('teacherInfo');
      }
    }

    setLoading(false);
  }, []);

  const login = (token: string, teacherData: Teacher) => {
    // 打印调试信息，检查login调用时的参数
    console.log("【AuthContext】登录调用，收到的参数:");
    console.log("【AuthContext】token:", token.substring(0, 10) + "...");
    console.log("【AuthContext】teacherData:", teacherData);
    
    localStorage.setItem('teacherToken', token);
    localStorage.setItem('teacherInfo', JSON.stringify(teacherData));
    setToken(token);
    setTeacher(teacherData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('teacherToken');
    localStorage.removeItem('teacherInfo');
    setToken(undefined);
    setTeacher(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, teacher, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};