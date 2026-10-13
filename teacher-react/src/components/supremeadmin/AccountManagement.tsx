import React, { useState, useEffect } from 'react';
import { Table, Card, Button, message, Space, Tag, Popconfirm, Alert, Empty } from 'antd';
import { CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

interface AccountRequestData {
  id: number;
  user_id: number; // 学生端用户ID
  teacher_id: number; // 教师端ID
  previous_roles: string; // JSON字符串形式的角色列表
  request_time: string; // 请求时间
  status: 'pending' | 'approved' | 'rejected'; // 请求状态
  processed_time: string | null; // 处理时间
  processed_by: number | null; // 处理人ID
  
  // 联表查询的字段
  userName: string; // 用户名称
  studentId: string; // 学号
  teacherName: string; // 教师端用户名
  
  // 解析后的字段
  roles: string[]; // 解析后的角色列表
}

interface AccountManagementProps {
  visible: boolean;
}

const AccountManagement: React.FC<AccountManagementProps> = ({ visible }) => {
  const { token, teacher } = useAuth();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<AccountRequestData[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // 获取账号删除请求列表
  const fetchRequests = async (page = 1) => {
    if (!visible) return;
    
    setLoading(true);
    try {
      const response = await axios.get(
        `http://localhost:3003/api/community/roles/account-delete-requests?page=${page}&limit=${pagination.pageSize}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // 数据结构适配
      const requestData = response.data.requests.map((item: any) => ({
        ...item,
        // 确保roles数组存在，即使JSON解析失败
        roles: item.roles || [] 
      }));
      
      console.log('获取到的请求数据:', requestData);
      
      setRequests(requestData);
      setPagination({
        ...pagination,
        current: page,
        total: response.data.pagination.total
      });
    } catch (error) {
      console.error('获取账号删除请求失败:', error);
      message.error('获取账号删除请求失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchRequests();
    }
  }, [visible, token]);

  // 批准删除教师端账号
  const handleApproveRequest = async (record: AccountRequestData) => {
    try {
      console.log('准备发送批准请求，参数:', {
        operatorId: teacher?.id,
        requestId: record.id,
        userId: record.user_id,
        teacherId: record.teacher_id
      });
      
      // 检查参数是否齐全
      if (!teacher?.id) {
        message.error('无法获取操作者ID，请重新登录');
        return;
      }
      
      if (!record.id || !record.user_id || !record.teacher_id) {
        message.error('请求数据不完整，缺少必要参数');
        console.error('请求数据不完整:', record);
        return;
      }
      
      const response = await axios.post(
        'http://localhost:3003/api/community/roles/delete-teacher-account',
        {
          operatorId: teacher.id,
          requestId: record.id,
          userId: record.user_id,
          teacherId: record.teacher_id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('批准删除响应:', response.data);
      message.success('已批准删除教师端账号');
      fetchRequests(pagination.current);
    } catch (error: any) {
      console.error('批准删除教师端账号失败:', error);
      
      // 详细的错误信息
      if (error.response) {
        console.error('错误响应数据:', error.response.data);
        console.error('错误状态码:', error.response.status);
        message.error(`批准删除失败: ${error.response.data?.error || '未知错误'}`);
      } else {
        message.error('批准删除教师端账号失败');
      }
    }
  };

  // 拒绝删除请求
  const handleRejectRequest = async (record: AccountRequestData) => {
    try {
      await axios.post(
        'http://localhost:3003/api/community/roles/reject-delete-request',
        {
          operatorId: teacher?.id,
          requestId: record.id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      message.success('已拒绝删除请求');
      fetchRequests(pagination.current);
    } catch (error) {
      console.error('拒绝删除请求失败:', error);
      message.error('拒绝删除请求失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '用户姓名',
      dataIndex: 'userName',
      key: 'userName',
    },
    {
      title: '学号',
      dataIndex: 'studentId',
      key: 'studentId',
    },
    {
      title: '教师端账号',
      dataIndex: 'teacherName',
      key: 'teacherName',
    },
    {
      title: '之前的角色',
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
      title: '请求时间',
      dataIndex: 'request_time',
      key: 'request_time',
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AccountRequestData) => (
        <Space size="middle">
          <Popconfirm
            title="确定要批准删除此教师端账号吗？"
            description="此操作将永久删除该教师端账号及相关角色记录"
            onConfirm={() => handleApproveRequest(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="primary" icon={<CheckCircleOutlined />}>
              批准
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确定要拒绝此删除请求吗？"
            onConfirm={() => handleRejectRequest(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>
              拒绝
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="教师端账号删除请求">
      <Alert
        message="账号管理说明"
        description="当用户删除了所有特殊角色(教师、助教、管理员)后，系统将自动生成教师端账号删除请求。批准请求将永久删除对应的教师端账号，拒绝请求将保留账号供日后使用。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      {requests.length === 0 ? (
        <Empty 
          description="暂无账号删除请求" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: fetchRequests,
          }}
          loading={loading}
        />
      )}
    </Card>
  );
};

export default AccountManagement; 