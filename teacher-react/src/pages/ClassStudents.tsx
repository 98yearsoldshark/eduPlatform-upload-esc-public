import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Table, Space, Modal, message, Tag, Breadcrumb, Alert } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionContext';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const { Title, Paragraph } = Typography;

interface StudentData {
  id: number;
  name: string;
  student_id: string;
  gender?: string;
  join_date: string;
}

interface ClassData {
  id: number;
  name: string;
  description: string;
  class_code: string;
}

const ClassStudents: React.FC = () => {
  const { token } = useAuth();
  const { permissions } = usePermissions();
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<StudentData | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // 获取班级信息
  const fetchClassInfo = async () => {
    try {
      const response = await axios.get(`http://localhost:3002/classes/${classId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClassData(response.data);
    } catch (error) {
      console.error('获取班级信息失败:', error);
      message.error('获取班级信息失败');
      navigate('/classes');
    }
  };

  // 获取班级学生列表
  const fetchStudents = async () => {
    if (!permissions.canViewAllStudents) {
      setPermissionError('您没有查看学生列表的权限');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:3002/classes/${classId}/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudents(response.data);
      setPermissionError(null);
    } catch (error: any) {
      console.error('获取学生列表失败:', error);
      if (error.response?.status === 403) {
        setPermissionError('您没有查看学生列表的权限');
      } else {
        message.error('获取学生列表失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (classId) {
      fetchClassInfo();
      fetchStudents();
    }
  }, [classId, token, permissions.canViewAllStudents]);

  // 确认移除学生
  const confirmRemoveStudent = (student: StudentData) => {
    setStudentToRemove(student);
    setDeleteModalVisible(true);
  };

  // 执行移除学生
  const handleRemoveStudent = async () => {
    if (!studentToRemove) return;
    
    try {
      await axios.delete(`http://localhost:3002/classes/${classId}/students/${studentToRemove.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('学生已从班级中移除');
      setDeleteModalVisible(false);
      fetchStudents();
    } catch (error) {
      console.error('移除学生失败:', error);
      message.error('移除学生失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '学生姓名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <UserOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '学号',
      dataIndex: 'student_id',
      key: 'student_id',
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      render: (text: string) => text || '未设置',
    },
    {
      title: '加入时间',
      dataIndex: 'join_date',
      key: 'join_date',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: StudentData) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => confirmRemoveStudent(record)}
        >
          移除
        </Button>
      ),
    },
  ];

  return (
    <div className="class-students-container">
      <Breadcrumb 
        style={{ marginBottom: '16px' }}
        items={[
          {
            title: <Link to="/classes">班级管理</Link>
          },
          {
            title: classData?.name || '班级详情'
          },
          {
            title: '学生列表'
          }
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <Title level={3}>
            <Space>
              <Button 
                icon={<ArrowLeftOutlined />} 
                type="link" 
                onClick={() => navigate('/classes')}
              />
              {classData?.name} - 学生列表
            </Space>
          </Title>
          <Paragraph>
            班级码: <Tag color="blue">{classData?.class_code}</Tag> (学生可通过此班级码加入班级)
          </Paragraph>
        </div>
      </div>

      {permissionError && (
        <Alert
          message="权限错误"
          description={permissionError}
          type="error"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      <Card>
        {!permissionError && students.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p>班级中还没有学生</p>
            <p>学生可以通过班级码 <Tag color="blue">{classData?.class_code}</Tag> 加入班级</p>
          </div>
        ) : (
          !permissionError && (
            <Table 
              columns={columns} 
              dataSource={students} 
              rowKey="id" 
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          )
        )}
      </Card>

      {/* 移除学生确认模态框 */}
      <Modal
        title="确认移除学生"
        open={deleteModalVisible}
        onOk={handleRemoveStudent}
        onCancel={() => setDeleteModalVisible(false)}
        okText="移除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要将学生 "{studentToRemove?.name}" 从班级中移除吗？此操作不可撤销。</p>
      </Modal>
    </div>
  );
};

export default ClassStudents;