import React, { useState, useEffect } from 'react';
import { Layout as AntLayout, Menu, theme, Button, Space, Avatar } from 'antd';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { HomeOutlined, FileTextOutlined, UserOutlined, LogoutOutlined, BookOutlined, ExperimentOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import RoleTag from './RoleTag';

const { Header, Content, Footer } = AntLayout;

const Layout: React.FC = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const { teacher, logout } = useAuth();
  // 检查是否为最高管理员
  const [isSupremAdmin, setIsSupremAdmin] = useState(false);
  // 获取用户角色
  const [userRoles, setUserRoles] = useState<string[]>([]);
  
  useEffect(() => {
    if (teacher?.id) {
      // 检查是否为最高管理员
      const checkIsSupremAdmin = async () => {
        try {
          const response = await axios.get(`http://localhost:3003/api/community/roles/check-suprem-admin?teacherid=${teacher.id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('teacherToken')}` }
          });
          setIsSupremAdmin(response.data.isSupremAdmin);
        } catch (error) {
          console.error('检查管理员权限失败:', error);
        }
      };
      
      // 获取用户角色
      const fetchUserRoles = async () => { 
        try {
          // 添加isTeacher=true参数，表明这是教师ID
          const response = await axios.get(`http://localhost:3003/api/community/roles/user/${teacher.id}?isTeacher=true`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('teacherToken')}` }
          });
          setUserRoles(response.data.roles || []);
        } catch (error) {
          console.error('获取用户角色失败:', error);
        }
      };
      
      checkIsSupremAdmin();
      fetchUserRoles();
    }
  }, [teacher]);
  const navigate = useNavigate();
  const location = useLocation();
  
  // 根据当前路径确定选中的菜单项
  const getSelectedKey = () => {
    const pathname = location.pathname;
    if (pathname === '/') return '1';
    if (pathname.startsWith('/exams')) return '2';
    if (pathname.startsWith('/questions')) return '8';
    if (pathname.startsWith('/classes')) return '3';
    if (pathname.startsWith('/community')) return '5';
    if (pathname.startsWith('/admin')) return '6';
    if (pathname.startsWith('/supreme-admin')) return '7';
    if (pathname.startsWith('/profile')) return '4';
    if (pathname.startsWith('/test-function')) return '9';
    return '1'; // 默认选中首页
  };

  return (
    <AntLayout className="layout" style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="demo-logo" style={{ color: 'white', fontSize: '18px', fontWeight: 'bold', marginRight: '20px' }}>
            教师管理系统
          </div>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[getSelectedKey()]}
            items={[
              {
                key: '1',
                icon: <HomeOutlined />,
                label: <Link to="/">首页</Link>,
              },
              {
                key: '2',
                icon: <FileTextOutlined />,
                label: <Link to="/exams">试卷管理</Link>,
              },
              {
                key: '8',
                icon: <BookOutlined />,
                label: <Link to="/questions">题目管理</Link>,
              },
              {
                key: '3',
                icon: <UserOutlined />,
                label: <Link to="/classes">班级管理</Link>,
              },
              {
                key: '5',
                icon: <FileTextOutlined />,
                label: <Link to="/community">社区广场</Link>,
              },
              {
                key: '6',
                icon: <UserOutlined />,
                label: <Link to="/admin">管理控制台</Link>,
                style: { display: teacher?.roles?.includes('admin') ? 'block' : 'none' }
              },
              {
                key: '7',
                icon: <UserOutlined />,
                label: <Link to="/supreme-admin">最高管理员</Link>,
                style: { display: isSupremAdmin ? 'block' : 'none' }
              },
              {
                key: '9',
                icon: <ExperimentOutlined />,
                label: <Link to="/test-function">测试功能</Link>,
              },
              {
                key: '4',
                icon: <UserOutlined />,
                label: <Link to="/profile">个人中心</Link>,
              },
            ]}
          />
        </div>
        
        {teacher && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Space>
              <Avatar style={{ backgroundColor: '#1677ff' }} icon={<UserOutlined />} />
              <span style={{ color: 'white' }}>{teacher.name}</span>
              <RoleTag roles={userRoles} isSupremAdmin={isSupremAdmin} />
              <Button 
                type="link" 
                icon={<LogoutOutlined />} 
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                style={{ color: 'white' }}
              >
                退出
              </Button>
            </Space>
          </div>
        )}
      </Header>
      <Content style={{ padding: '0 20px' }}>
        <div
          style={{
            padding: 0,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            marginTop: 16,
          }}
        >
          <Outlet />
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>
        教师管理系统 ©{new Date().getFullYear()} Created by Teacher React Team
      </Footer>
    </AntLayout>
  );
};

export default Layout;