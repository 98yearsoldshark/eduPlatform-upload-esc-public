import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Table, Space, Modal, Form, Input, message, Select, Tabs, Tag, Popconfirm } from 'antd';
import { UserOutlined, DeleteOutlined, EditOutlined, SettingOutlined, UserAddOutlined, UserDeleteOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import PermissionSettings from '../components/supremeadmin/PermissionSettings';
import RegisterConfiguration from '../components/supremeadmin/RegisterConfiguration';
import AccountManagement from '../components/supremeadmin/AccountManagement';

const { Title, Paragraph } = Typography;
const { Option } = Select;

interface UserData {
  id: number;
  name: string;
  email: string;
  school: string;
  classNumber?: string;
  studentId: string;
  roles?: string[];
}

const SupremeAdmin: React.FC = () => {
  const { token, teacher } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [userForm] = Form.useForm();
  const [roleForm] = Form.useForm();
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [userPagination, setUserPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [searchType, setSearchType] = useState('name');
  const [activeTab, setActiveTab] = useState('1');

  // 检查是否为最高管理员，如果不是则重定向
  useEffect(() => {
    const checkIsSupremAdmin = async () => {
      try {
        const response = await axios.get(`http://localhost:3003/api/community/roles/check-suprem-admin?teacherid=${teacher?.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!response.data.isSupremAdmin) {
          message.error('您没有访问最高管理员页面的权限');
          navigate('/admin');
        }
      } catch (error) {
        console.error('检查管理员权限失败:', error);
        message.error('权限验证失败');
        navigate('/admin');
      }
    };
 
    if (teacher?.id) {
      checkIsSupremAdmin();
    }
  }, [teacher, token, navigate]);

  // 获取所有用户列表
  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      let url = `http://localhost:3003/api/community/roles/all-users?page=${page}&limit=${userPagination.pageSize}`;
      
      if (searchText) {
        url += `&searchType=${searchType}&search=${encodeURIComponent(searchText)}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUsers(response.data.users);
      setUserPagination({
        ...userPagination,
        current: page,
        total: response.data.pagination.total
      });
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === '1') {
      fetchUsers();
    }
  }, [token, searchText, searchType, activeTab]);

  // 打开用户详情模态框
  const showUserModal = (userData: UserData) => {
    setCurrentUser(userData);
    userForm.resetFields();
    userForm.setFieldsValue({
      name: userData.name,
      email: userData.email,
      school: userData.school,
      classNumber: userData.classNumber,
      studentId: userData.studentId
    });
    setUserModalVisible(true);
  };

  // 关闭用户模态框
  const handleUserCancel = () => {
    setUserModalVisible(false);
  };

  // 更新用户信息
  const handleUserSubmit = async () => {
    try {
      const values = await userForm.validateFields();
      
      await axios.put(`http://localhost:3003/api/community/users/${currentUser?.id}`, {
        ...values,
        operatorId: teacher?.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      message.success('用户信息更新成功');
      setUserModalVisible(false);
      fetchUsers();
    } catch (error) {
      console.error('更新用户信息失败:', error);
      message.error('更新用户信息失败');
    }
  };

  // 打开角色管理模态框
  const showRoleModal = (userData: UserData) => {
    setCurrentUser(userData);
    roleForm.resetFields();
    roleForm.setFieldsValue({
      roles: userData.roles || []
    });
    setRoleModalVisible(true);
  };

  // 关闭角色管理模态框
  const handleRoleCancel = () => {
    setRoleModalVisible(false);
  };

  // 更新用户角色
  const handleRoleSubmit = async () => {
    try {
      const values = await roleForm.validateFields();
      console.log('values:', values);
      console.log('teacher?.id:', teacher?.id);
      console.log('currentUser?.id:', currentUser?.id);
      
      await axios.put(`http://localhost:3003/api/community/roles/update-roles`, {
        operatorId: teacher?.id,
        targetUserId: currentUser?.id,
        roles: values.roles
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      message.success('用户角色更新成功');
      setRoleModalVisible(false);
      fetchUsers();
    } catch (error) {
      console.error('更新用户角色失败:', error);
      message.error('更新用户角色失败');
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: number) => {
    try {
      await axios.delete(`http://localhost:3003/api/community/users/${userId}`, {
        data: { operatorId: teacher?.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      message.success('用户删除成功');
      fetchUsers();
    } catch (error) {
      console.error('删除用户失败:', error);
      message.error('删除用户失败');
    }
  };

  // 用户表格列定义
  const userColumns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '学号/工号',
      dataIndex: 'studentId',
      key: 'studentId',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: '学校',
      dataIndex: 'school',
      key: 'school',
    },
    {
      title: '班级',
      dataIndex: 'classNumber',
      key: 'classNumber',
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => (
        <>
          {roles && roles.map(role => {
            let color = 'blue';
            if (role === 'admin') color = 'red';
            if (role === 'teacher') color = 'green';
            if (role === 'assistant') color = 'orange';
            return (
              <Tag color={color} key={role}>
                {role === 'admin' ? '管理员' : 
                 role === 'teacher' ? '教师' : 
                 role === 'assistant' ? '助教' : 
                 role === 'student' ? '学生' : role}
              </Tag>
            );
          })}
        </>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: UserData) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => showUserModal(record)}
          >
            编辑
          </Button>
          <Button 
            type="text" 
            icon={<UserOutlined />} 
            onClick={() => showRoleModal(record)}
          >
            角色
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };

  // 定义Tabs的items属性
  const tabItems = [
    {
      key: '1',
      label: (
        <span>
          <UserOutlined />
          用户管理
        </span>
      ),
      children: (
        <Card>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Select
                defaultValue="name"
                style={{ width: 120 }}
                onChange={(value) => setSearchType(value)}
              >
                <Option value="name">姓名</Option>
                <Option value="email">邮箱</Option>
                <Option value="studentId">学号/工号</Option>
                <Option value="school">学校</Option>
              </Select>
              <Input.Search
                placeholder="搜索用户"
                allowClear
                onSearch={(value) => {
                  setSearchText(value);
                  fetchUsers(1);
                }}
                style={{ width: 300 }}
              />
            </Space>
          </div>

          <Table
            columns={userColumns}
            dataSource={users}
            rowKey="id"
            pagination={{
              current: userPagination.current,
              pageSize: userPagination.pageSize,
              total: userPagination.total,
              onChange: (page) => fetchUsers(page),
              showSizeChanger: true,
              onShowSizeChange: (_current, size) => {
                setUserPagination({ ...userPagination, pageSize: size });
                fetchUsers(1);
              },
            }}
            loading={loading}
          />
        </Card>
      )
    },
    {
      key: '2',
      label: (
        <span>
          <SettingOutlined />
          权限控制
        </span>
      ),
      children: <PermissionSettings visible={activeTab === '2'} />
    },
    {
      key: '3',
      label: (
        <span>
          <UserAddOutlined />
          访问配置
        </span>
      ),
      children: <RegisterConfiguration visible={activeTab === '3'} />
    },
    {
      key: '4',
      label: (
        <span>
          <UserDeleteOutlined />
          账号管理
        </span>
      ),
      children: <AccountManagement visible={activeTab === '4'} />
    }
  ];

  return (
    <div className="supreme-admin-container">
      <Typography>
        <Title level={2}>最高管理员控制台</Title>
        <Paragraph>
          您是系统最高管理员，可以管理所有用户和系统权限，包括分配和移除管理员权限、调整角色权限和系统安全策略。
        </Paragraph>
      </Typography>

      <Tabs 
        activeKey={activeTab} 
        onChange={handleTabChange} 
        items={tabItems}
      />

      {/* 用户编辑模态框 */}
      <Modal
        title="编辑用户信息"
        open={userModalVisible}
        onOk={handleUserSubmit}
        onCancel={handleUserCancel}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={userForm}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true, message: '请输入邮箱' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="school"
            label="学校"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="classNumber"
            label="班级"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="studentId"
            label="学号/工号"
            rules={[{ required: true, message: '请输入学号/工号' }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* 角色管理模态框 */}
      <Modal
        title="管理用户角色"
        open={roleModalVisible}
        onOk={handleRoleSubmit}
        onCancel={handleRoleCancel}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={roleForm}
          layout="vertical"
        >
          <Form.Item
            name="roles"
            label="用户角色"
            rules={[{ required: true, message: '请选择至少一个角色' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择用户角色"
              style={{ width: '100%' }}
            >
              <Option value="student">学生</Option>
              <Option value="assistant">助教</Option>
              <Option value="teacher">教师</Option>
              <Option value="admin">管理员</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SupremeAdmin;