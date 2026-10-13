import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Table, Space, Modal, Form, Input, message, Tooltip, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, CopyOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { usePermissions } from '../contexts/PermissionContext';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

interface ClassData {
  id: number;
  name: string;
  description: string;
  class_code: string;
  created_at: string;
  updated_at: string;
}

const Classes: React.FC = () => {
  const { token } = useAuth();
  const { permissions } = usePermissions();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  const [form] = Form.useForm();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassData | null>(null);

  // 获取班级列表
  const fetchClasses = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:3002/classes', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setClasses(response.data);
    } catch (error) {
      console.error('获取班级列表失败:', error);
      message.error('获取班级列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [token]);

  // 打开创建/编辑班级模态框
  const showModal = (classData?: ClassData) => {
    setEditingClass(classData || null);
    form.resetFields();
    if (classData) {
      form.setFieldsValue({
        name: classData.name,
        description: classData.description
      });
    }
    setModalVisible(true);
  };

  // 关闭模态框
  const handleCancel = () => {
    setModalVisible(false);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingClass) {
        // 更新班级
        await axios.put(`http://localhost:3002/classes/${editingClass.id}`, values, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success('班级更新成功');
      } else {
        // 创建班级
        // 检查是否超过最大班级数量限制
        if (classes.length >= permissions.maxClassCount) {
          message.error(`您最多只能创建${permissions.maxClassCount}个班级`);
          setModalVisible(false);
          return;
        }
        
        await axios.post('http://localhost:3002/classes', values, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success('班级创建成功');
      }
      
      setModalVisible(false);
      fetchClasses();
    } catch (error: any) {
      console.error('提交班级表单失败:', error);
      if (error.response?.status === 403 && error.response?.data?.error === '权限不足') {
        message.error(`创建失败: ${error.response.data.detail || '您已达到最大班级数量限制'}`);
      } else {
        message.error('提交失败');
      }
    }
  };

  // 确认删除班级
  const confirmDelete = (classData: ClassData) => {
    setClassToDelete(classData);
    setDeleteModalVisible(true);
  };

  // 执行删除班级
  const handleDelete = async () => {
    if (!classToDelete) return;
    
    try {
      await axios.delete(`http://localhost:3002/classes/${classToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('班级删除成功');
      setDeleteModalVisible(false);
      fetchClasses();
    } catch (error) {
      console.error('删除班级失败:', error);
      message.error('删除班级失败');
    }
  };

  // 复制班级码
  const copyClassCode = (code: string) => {
    navigator.clipboard.writeText(code)
      .then(() => {
        message.success('班级码已复制到剪贴板');
      })
      .catch(() => {
        message.error('复制失败，请手动复制');
      });
  };

  // 表格列定义
  const columns = [
    {
      title: '班级名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '班级码',
      dataIndex: 'class_code',
      key: 'class_code',
      render: (text: string) => (
        <Space>
          <Tag color="blue">{text}</Tag>
          <Tooltip title="复制班级码">
            <Button 
              icon={<CopyOutlined />} 
              size="small" 
              type="text" 
              onClick={() => copyClassCode(text)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ClassData) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<TeamOutlined />} 
            onClick={() => window.location.href = `/classes/${record.id}/students`}
          >
            学生
          </Button>
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => showModal(record)}
          >
            编辑
          </Button>
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => confirmDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="classes-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Typography>
          <Title level={2}>班级管理</Title>
          <Paragraph>
            创建和管理您的班级，生成班级码供学生加入。
            {classes.length > 0 && (
              <span style={{ marginLeft: '10px', color: classes.length >= permissions.maxClassCount ? '#ff4d4f' : '' }}>
                (当前班级数: {classes.length}/{permissions.maxClassCount})
              </span>
            )}
          </Paragraph>
        </Typography>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => showModal()}
          disabled={classes.length >= permissions.maxClassCount}
        >
          创建班级
        </Button>
      </div>

      <Card>
        <Table 
          columns={columns} 
          dataSource={classes} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 创建/编辑班级模态框 */}
      <Modal
        title={editingClass ? '编辑班级' : '创建班级'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        okText={editingClass ? '更新' : '创建'}
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          name="class_form"
        >
          <Form.Item
            name="name"
            label="班级名称"
            rules={[{ required: true, message: '请输入班级名称' }]}
          >
            <Input placeholder="请输入班级名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="班级描述"
          >
            <TextArea 
              placeholder="请输入班级描述（选填）" 
              rows={4} 
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        title="确认删除"
        open={deleteModalVisible}
        onOk={handleDelete}
        onCancel={() => setDeleteModalVisible(false)}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除班级 "{classToDelete?.name}" 吗？此操作不可撤销，班级中的所有学生关联也将被删除。</p>
      </Modal>
    </div>
  );
};

export default Classes;