import React, { useState, useEffect } from 'react';
import { Typography, Card, Tabs, Form, Input, Button, Avatar, message, Descriptions, Tag, Space } from 'antd';
import { UserOutlined, MailOutlined, BankOutlined, IdcardOutlined, TeamOutlined, CrownOutlined, BookOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const { Title, Paragraph } = Typography;

interface UserInfo {
  id: number;
  name: string;
  gender: string;
  teacher_id: string;
  phone: string;
  email: string;
  wechat: string;
  school: string;
  register_time: string;
  last_login_time: string;
  roles?: string[];
}

const Profile: React.FC = () => {
  const { teacher, token } = useAuth();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSupremAdmin, setIsSupremAdmin] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  // 获取用户信息
  const fetchUserInfo = async () => {
    if (!teacher?.id) return;
    
    setLoading(true);
    try {
      // 使用教师服务器API获取教师信息
      const url = `http://localhost:3002/profile`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserInfo(response.data);
      form.setFieldsValue({
        name: response.data.name,
        gender: response.data.gender,
        phone: response.data.phone,
        email: response.data.email,
        wechat: response.data.wechat,
        school: response.data.school,
        teacherid: response.data.teacher_id // 教师ID对应前端的teacherid字段
      });
  
      console.log('教师信息:', response.data);
    } catch (error) {
      console.error('获取教师信息失败:', error);
      message.error('获取教师信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 检查是否为最高管理员
  const checkIsSupremAdmin = async () => {
    if (!teacher?.id) return;
    
    try {
      // 确保URL参数名称正确，使用teacherid而不是teacherId
      const response = await axios.get(`http://localhost:3003/api/community/roles/check-suprem-admin?teacherid=${teacher.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsSupremAdmin(response.data.isSupremAdmin);
    } catch (error) {
      console.error('检查管理员权限失败:', error);
      // 如果API不存在，默认为非最高管理员
      setIsSupremAdmin(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
    checkIsSupremAdmin();
    fetchUserRoles();
  }, [teacher, token]);

  // 更新个人信息
  const handleUpdateProfile = async (values: any) => {
    try {
      if (!teacher?.id) {
        message.error('无法获取用户信息');
        return;
      }
      
      // 使用教师服务器API更新教师信息
      await axios.put(`http://localhost:3002/profile`, {
        name: values.name,
        gender: values.gender,
        phone: values.phone,
        email: values.email,
        wechat: values.wechat,
        school: values.school
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      message.success('个人信息更新成功');
      fetchUserInfo();
    } catch (error) {
      console.error('更新教师信息失败:', error);
      message.error('更新教师信息失败');
    }
  };

  // 修改密码
  const handleChangePassword = async (values: any) => {
    try {
      // 使用教师服务器API修改密码
      await axios.put(`http://localhost:3002/change-password`, {
        currentPassword: values.oldPassword,
        newPassword: values.newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      message.success('密码修改成功');
      passwordForm.resetFields();
    } catch (error) {
      console.error('修改密码失败:', error);
      message.error('修改密码失败');
    }
  };

  // 获取用户角色
  const fetchUserRoles = async () => { 
    if (!teacher?.id) return;
    
    try {
      // 添加isTeacher=true参数，表明这是教师ID
      const response = await axios.get(`http://localhost:3003/api/community/roles/user/${teacher.id}?isTeacher=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserRoles(response.data.roles || []);
      console.log('用户角色:', response.data.roles);
    } catch (error) {
      console.error('获取用户角色失败:', error);
      // 如果API请求失败，设置默认角色为教师
      setUserRoles(['teacher']);
    }
  };

  // 获取用户的主要角色（优先级最高的角色）
  const getPrimaryRole = () => {
    if (isSupremAdmin) return 'suprem-admin';
    if (userRoles.includes('admin')) return 'admin';
    if (userRoles.includes('teacher')) return 'teacher';
    if (userRoles.includes('assistant')) return 'assistant';
    return 'unknown';
  };

  // 获取角色标签
  const getRoleTag = (role: string) => {
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

    const config = roleConfig[role] || {
      color: '#d9d9d9',
      icon: <UserOutlined />,
      text: role
    };

    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 根据角色渲染不同内容
  const renderRoleSpecificContent = () => {
    const primaryRole = getPrimaryRole();
    
    // 根据主要角色渲染对应内容
    switch (primaryRole) {
      case 'suprem-admin':
        return (
          <Card title="最高管理员功能" style={{ marginTop: 16 }}>
            <Paragraph>
              作为最高管理员，您可以管理所有用户、角色和系统设置。
            </Paragraph>
            <Space>
              <Button type="primary" onClick={() => window.location.href = '/supreme-admin'}>
                进入最高管理员控制台
              </Button>
            </Space>
          </Card>
        );
      
      case 'admin':
        return (
          <Card title="管理员功能" style={{ marginTop: 16 }}>
            <Paragraph>
              作为管理员，您可以管理用户、帖子和评论。
            </Paragraph>
            <Space>
              <Button type="primary" onClick={() => window.location.href = '/admin'}>
                进入管理控制台
              </Button>
            </Space>
          </Card>
        );
      
      case 'assistant':
        return (
          <Card title="助教功能" style={{ marginTop: 16 }}>
            <Paragraph>
              作为助教，您可以协助教师管理班级和批改作业。
            </Paragraph>
            <Space>
              <Button type="primary" onClick={() => window.location.href = '/classes'}>
                查看班级
              </Button>
            </Space>
          </Card>
        );
      
      case 'teacher':
        return (
          <Card title="教师功能" style={{ marginTop: 16 }}>
            <Paragraph>
              作为教师，您可以管理班级、试卷和学生。
            </Paragraph>
            <Space>
              <Button type="primary" onClick={() => window.location.href = '/classes'}>
                班级管理
              </Button>
              <Button onClick={() => window.location.href = '/exams'}>
                试卷管理
              </Button>
            </Space>
          </Card>
        );
      
      default:
        return (
          <Card title="用户功能" style={{ marginTop: 16 }}>
            <Paragraph>
              欢迎使用教学管理系统。
            </Paragraph>
          </Card>
        );
    }
  };

  return (
    <div className="profile-container">
      <Title level={2}>个人中心</Title>
      
      <Card loading={loading}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <Avatar size={64} icon={<UserOutlined />} />
          <div style={{ marginLeft: 16 }}>
            <Title level={4} style={{ margin: 0 }}>{userInfo?.name}</Title>
            <Space>
              {getRoleTag(getPrimaryRole())}
            </Space>
          </div>
        </div>
        
        <Descriptions bordered column={2}>
          <Descriptions.Item label="姓名">{userInfo?.name}</Descriptions.Item>
          <Descriptions.Item label="性别">{userInfo?.gender}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{userInfo?.email}</Descriptions.Item>
          <Descriptions.Item label="手机">{userInfo?.phone}</Descriptions.Item>
          <Descriptions.Item label="学校">{userInfo?.school}</Descriptions.Item>
          <Descriptions.Item label="工号">{userInfo?.teacher_id}</Descriptions.Item>
          <Descriptions.Item label="微信">{userInfo?.wechat}</Descriptions.Item>
          <Descriptions.Item label="注册时间">{userInfo?.register_time}</Descriptions.Item>
        </Descriptions>
      </Card>
      
      {/* 根据角色显示不同内容 */}
      {renderRoleSpecificContent()}
      
      <Tabs 
        defaultActiveKey="1" 
        style={{ marginTop: 16 }}
        items={[
          {
            key: '1',
            label: '修改个人信息',
            children: (
              <Card>
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleUpdateProfile}
                >
                  <Form.Item
                    name="name"
                    label="姓名"
                    rules={[{ required: true, message: '请输入姓名' }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="姓名" />
                  </Form.Item>
                  
                  <Form.Item
                    name="email"
                    label="邮箱"
                    rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="邮箱" />
                  </Form.Item>
                  
                  <Form.Item
                    name="school"
                    label="学校"
                    rules={[{ required: true, message: '请输入学校' }]}
                  >
                    <Input prefix={<BankOutlined />} placeholder="学校" />
                  </Form.Item>
                  
                  <Form.Item
                    name="teacherid"
                    label="工号"
                    rules={[{ required: true, message: '请输入工号' }]}
                  >
                    <Input prefix={<IdcardOutlined />} placeholder="工号" />
                  </Form.Item>
                  
                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      保存修改
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            )
          },
          {
            key: '2',
            label: '修改密码',
            children: (
              <Card>
                <Form
                  form={passwordForm}
                  layout="vertical"
                  onFinish={handleChangePassword}
                >
                  <Form.Item
                    name="oldPassword"
                    label="当前密码"
                    rules={[{ required: true, message: '请输入当前密码' }]}
                  >
                    <Input.Password placeholder="当前密码" />
                  </Form.Item>
                  
                  <Form.Item
                    name="newPassword"
                    label="新密码"
                    rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码长度不能少于6个字符' }]}
                  >
                    <Input.Password placeholder="新密码" />
                  </Form.Item>
                  
                  <Form.Item
                    name="confirmPassword"
                    label="确认新密码"
                    dependencies={['newPassword']}
                    rules={[
                      { required: true, message: '请确认新密码' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('newPassword') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('两次输入的密码不一致'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password placeholder="确认新密码" />
                  </Form.Item>
                  
                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      修改密码
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            )
          }
        ]}
      />
    </div>
  );
};

export default Profile;