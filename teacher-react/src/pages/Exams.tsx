import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Table, Space, Modal, Form, Input, message, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface ExamData {
  id: number;
  title: string;
  description: string;
  subject: string;
  grade: string;
  duration: number; // 考试时长（分钟）
  total_score: number; // 总分
  created_at: string;
  updated_at: string;
  status: 'draft' | 'published' | 'archived';
}

const Exams: React.FC = () => {
  const { token } = useAuth();
  const [exams, setExams] = useState<ExamData[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamData | null>(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // 获取试卷列表（模拟数据，实际项目中应该从API获取）
  const fetchExams = async (page = 1) => {
    setLoading(true);
    try {
      // 模拟API调用
      // 实际项目中应该使用类似下面的代码：
      // const response = await axios.get(`http://localhost:3002/exams?page=${page}&limit=${pagination.pageSize}`, {
      //   headers: { Authorization: `Bearer ${token}` }
      // });
      
      // 模拟数据
      const mockExams: ExamData[] = [
        {
          id: 1,
          title: '高中数学期中考试',
          description: '高中数学第一学期期中考试',
          subject: '数学',
          grade: '高一',
          duration: 120,
          total_score: 150,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'published'
        },
        {
          id: 2,
          title: '初中英语测试',
          description: '初中英语词汇和语法测试',
          subject: '英语',
          grade: '初三',
          duration: 90,
          total_score: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'draft'
        }
      ];
      
      setExams(mockExams);
      setPagination({
        ...pagination,
        current: page,
        total: mockExams.length
      });
    } catch (error) {
      console.error('获取试卷列表失败:', error);
      message.error('获取试卷列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [token]);

  // 打开创建/编辑试卷模态框
  const showModal = (examData?: ExamData) => {
    setEditingExam(examData || null);
    form.resetFields();
    if (examData) {
      form.setFieldsValue({
        title: examData.title,
        description: examData.description,
        subject: examData.subject,
        grade: examData.grade,
        duration: examData.duration,
        total_score: examData.total_score,
        status: examData.status
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
      
      if (editingExam) {
        // 更新试卷（模拟）
        message.success('试卷更新成功');
      } else {
        // 创建试卷（模拟）
        message.success('试卷创建成功');
      }
      
      setModalVisible(false);
      fetchExams();
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  // 删除试卷
  const handleDelete = async (_id: number) => {
    try {
      // 模拟删除操作
      message.success('试卷删除成功');
      fetchExams();
    } catch (error) {
      console.error('删除试卷失败:', error);
      message.error('删除试卷失败');
    }
  };

  // 获取状态标签颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'green';
      case 'draft': return 'blue';
      case 'archived': return 'gray';
      default: return 'default';
    }
  };

  // 获取状态显示文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'published': return '已发布';
      case 'draft': return '草稿';
      case 'archived': return '已归档';
      default: return status;
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '试卷名称',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '科目',
      dataIndex: 'subject',
      key: 'subject',
    },
    {
      title: '年级',
      dataIndex: 'grade',
      key: 'grade',
    },
    {
      title: '考试时长',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration: number) => `${duration}分钟`,
    },
    {
      title: '总分',
      dataIndex: 'total_score',
      key: 'total_score',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <span style={{ color: getStatusColor(status) }}>
          {getStatusText(status)}
        </span>
      ),
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
      render: (_: any, record: ExamData) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EyeOutlined />} 
            onClick={() => message.info('查看试卷功能开发中')}
          >
            查看
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
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="exams-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Typography>
          <Title level={2}>试卷管理</Title>
          <Paragraph>
            创建和管理您的试卷，支持多种题型和自动批改。
          </Paragraph>
        </Typography>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => showModal()}
        >
          创建试卷
        </Button>
      </div>

      <Card>
        <Table 
          columns={columns} 
          dataSource={exams} 
          rowKey="id" 
          loading={loading}
          pagination={pagination}
          onChange={(pagination) => fetchExams(pagination.current)}
        />
      </Card>

      {/* 创建/编辑试卷模态框 */}
      <Modal
        title={editingExam ? '编辑试卷' : '创建试卷'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            status: 'draft',
            duration: 90,
            total_score: 100
          }}
        >
          <Form.Item
            name="title"
            label="试卷名称"
            rules={[{ required: true, message: '请输入试卷名称' }]}
          >
            <Input placeholder="请输入试卷名称" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="试卷描述"
          >
            <TextArea rows={3} placeholder="请输入试卷描述" />
          </Form.Item>
          
          <Form.Item
            name="subject"
            label="科目"
            rules={[{ required: true, message: '请选择科目' }]}
          >
            <Select placeholder="请选择科目">
              <Option value="数学">数学</Option>
              <Option value="语文">语文</Option>
              <Option value="英语">英语</Option>
              <Option value="物理">物理</Option>
              <Option value="化学">化学</Option>
              <Option value="生物">生物</Option>
              <Option value="历史">历史</Option>
              <Option value="地理">地理</Option>
              <Option value="政治">政治</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="grade"
            label="适用年级"
            rules={[{ required: true, message: '请选择适用年级' }]}
          >
            <Select placeholder="请选择适用年级">
              <Option value="小学一年级">小学一年级</Option>
              <Option value="小学二年级">小学二年级</Option>
              <Option value="小学三年级">小学三年级</Option>
              <Option value="小学四年级">小学四年级</Option>
              <Option value="小学五年级">小学五年级</Option>
              <Option value="小学六年级">小学六年级</Option>
              <Option value="初一">初一</Option>
              <Option value="初二">初二</Option>
              <Option value="初三">初三</Option>
              <Option value="高一">高一</Option>
              <Option value="高二">高二</Option>
              <Option value="高三">高三</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="duration"
            label="考试时长（分钟）"
            rules={[{ required: true, message: '请输入考试时长' }]}
          >
            <Input type="number" min={1} />
          </Form.Item>
          
          <Form.Item
            name="total_score"
            label="总分"
            rules={[{ required: true, message: '请输入总分' }]}
          >
            <Input type="number" min={1} />
          </Form.Item>
          
          <Form.Item
            name="status"
            label="状态"
          >
            <Select>
              <Option value="draft">草稿</Option>
              <Option value="published">已发布</Option>
              <Option value="archived">已归档</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Exams;