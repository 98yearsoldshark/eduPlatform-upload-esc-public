import React from 'react';
import { Tag, Tooltip } from 'antd';
import { CrownOutlined, UserOutlined, TeamOutlined, BookOutlined } from '@ant-design/icons';

interface RoleTagProps {
  roles?: string[];
  isSupremAdmin?: boolean;
}

const RoleTag: React.FC<RoleTagProps> = ({ roles = [], isSupremAdmin = false }) => {
  // 角色优先级：最高管理员 > 管理员 > 教师 > 助教
  const getPrimaryRole = () => {
    if (isSupremAdmin) return 'suprem-admin';
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('teacher')) return 'teacher';
    if (roles.includes('assistant')) return 'assistant';
    return 'unknown';
  };

  const primaryRole = getPrimaryRole();

  // 角色配置：颜色、图标和提示文本
  const roleConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
    'suprem-admin': {
      color: '#f50',
      icon: <CrownOutlined />,
      text: '最高管理员'
    },
    'admin': {
      color: '#f50',
      icon: <CrownOutlined />,
      text: '管理员'
    },
    'teacher': {
      color: '#108ee9',
      icon: <BookOutlined />,
      text: '教师'
    },
    'assistant': {
      color: '#87d068',
      icon: <TeamOutlined />,
      text: '助教'
    },
    'unknown': {
      color: '#d9d9d9',
      icon: <UserOutlined />,
      text: '未知角色'
    }
  };

  const config = roleConfig[primaryRole];

  return (
    <Tooltip title={`您的角色: ${config.text}`}>
      <Tag color={config.color} icon={config.icon} style={{ marginRight: 0 }}>
        {config.text}
      </Tag>
    </Tooltip>
  );
};

export default RoleTag;