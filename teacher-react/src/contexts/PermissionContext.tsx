import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { message } from 'antd';
import axios from 'axios';
import { useAuth } from './AuthContext';

// 定义权限状态接口
interface PermissionState {
  canAssignAssistant: boolean;
  canViewAllStudents: boolean;
  maxClassCount: number;
  canModifyQuestions: boolean;
}

// 权限上下文接口
interface PermissionContextType {
  permissions: PermissionState;
  loading: boolean;
  refreshPermissions: () => Promise<void>;
}

// 创建权限上下文
const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

// 默认权限状态
const defaultPermissions: PermissionState = {
  canAssignAssistant: true,
  canViewAllStudents: true,
  maxClassCount: 10,
  canModifyQuestions: true
};

// 权限提供者组件Props接口
interface PermissionProviderProps {
  children: ReactNode;
}

// 权限提供者组件
export const PermissionProvider: React.FC<PermissionProviderProps> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState<PermissionState>(defaultPermissions);
  const [loading, setLoading] = useState<boolean>(true);

  // 获取权限配置
  const fetchPermissions = async () => {
    if (!token || !isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('【权限上下文】正在获取权限配置...');
      const response = await axios.get('http://localhost:3003/api/config/permissions/config/public', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const config = response.data.config;
        console.log('【权限上下文】获取权限配置成功:', config);
        
        // 从配置中提取教师权限
        const teacherPermissions = config.roles?.teacher || {};
        
        setPermissions({
          canAssignAssistant: !!teacherPermissions.canAssignAssistant,
          canViewAllStudents: !!teacherPermissions.canViewAllStudents,
          maxClassCount: teacherPermissions.maxClassCount || 10,
          canModifyQuestions: !!teacherPermissions.canModifyQuestions
        });
      } else {
        console.error('【权限上下文】获取权限配置失败:', response.data.error);
        message.error('获取权限配置失败，使用默认配置');
      }
    } catch (error) {
      console.error('【权限上下文】获取权限配置出错:', error);
      message.error('获取权限配置出错，使用默认配置');
    } finally {
      setLoading(false);
    }
  };

  // 初始化和token变化时获取权限
  useEffect(() => {
    fetchPermissions();
  }, [token, isAuthenticated]);

  // 提供上下文值
  const contextValue: PermissionContextType = {
    permissions,
    loading,
    refreshPermissions: fetchPermissions
  };

  return (
    <PermissionContext.Provider value={contextValue}>
      {children}
    </PermissionContext.Provider>
  );
};

// 自定义hook，用于在组件中获取权限状态
export const usePermissions = (): PermissionContextType => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

export default PermissionContext; 