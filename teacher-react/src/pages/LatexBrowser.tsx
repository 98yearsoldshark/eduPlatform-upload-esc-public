import React, { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Space, Button, Input, Select, Modal, Form, Spin, Typography, message, Tooltip, Dropdown, Switch } from 'antd';
import { SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, SyncOutlined, ExportOutlined, DownOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
import '../styles/LatexBrowser.css';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// MathJax配置
const config = {
  loader: { load: ["[tex]/ams"] },
  tex: {
    packages: {"[+]": ["ams"]},
    inlineMath: [["$", "$"]],
    displayMath: [["$$", "$$"]]
  },
  startup: {
    typeset: false,
  },
  options: {
    enableMenu: false,
    renderActions: {
      addMenu: [],
    },
    safeOptions: {
      allow: {
        URLs: 'safe',
        classes: 'safe',
        cssIDs: 'safe',
        styles: 'safe'
      }
    }
  }
};

// LaTeX题目接口
interface LatexQuestion {
  id: number;
  latex_path: string;
  subject: string;
  grade: string;
  year: string;
  type: string;
  folder_name: string;
  correct_answer: string;
  note: string | null;
  latex_code: string | null;
  created_at: string;
  updated_at: string;
}

const LatexBrowser: React.FC = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<LatexQuestion[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<LatexQuestion[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  
  // 筛选条件
  const [subject, setSubject] = useState<string>('');
  const [grade, setGrade] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  
  // 预览和编辑模态框
  const [previewVisible, setPreviewVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<LatexQuestion | null>(null);
  
  // 表单实例
  const [form] = Form.useForm();
  
  // 监听correct_answer值变化
  const [customAnswerVisible, setCustomAnswerVisible] = useState(false);
  // LaTeX实时渲染控制
  const [autoRender, setAutoRender] = useState(true);
  const [latexContent, setLatexContent] = useState<string>('');
  const [renderKey, setRenderKey] = useState<number>(0);
  
  // 获取LaTeX题目数据
  const fetchLatexQuestions = useCallback(async (page = pagination.current, pageSize = pagination.pageSize) => {
    if (!token) {
      console.error('缺少认证令牌，无法获取LaTeX题目数据');
      message.error('认证失败，请重新登录');
      return;
    }
    
    setLoading(true);
    try {
      console.log('正在使用令牌获取LaTeX题目数据:', token.substring(0, 10) + '...');
      
      // 创建干净的查询参数对象
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize)
      };
      
      // 仅添加有值的筛选条件
      if (subject) params.subject = subject;
      if (grade) params.grade = grade;
      if (year) params.year = year;
      if (type) params.type = type;
      if (searchText) params.search = searchText;
      
      console.log('查询参数:', params);
      console.log('参数类型:', Object.entries(params).map(([k, v]) => `${k}: ${typeof v}`));
      
      const response = await axios.get('http://localhost:3002/api/latex-questions', {
        params,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('获取LaTeX题目数据成功:', response.data);
      
      if (response.data && Array.isArray(response.data.questions)) {
        setQuestions(response.data.questions);
        setFilteredQuestions(response.data.questions);
        setPagination({
          ...pagination,
          current: page,
          total: response.data.total || response.data.questions.length,
        });
      } else {
        console.warn('获取数据格式异常:', response.data);
        message.error('获取数据格式异常');
        setQuestions([]);
        setFilteredQuestions([]);
      }
    } catch (error) {
      console.error('获取LaTeX题目失败:', error);
      
      // 更详细的错误处理
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // 服务器返回了错误响应
          console.error('错误状态码:', error.response.status);
          console.error('错误头信息:', error.response.headers);
          console.error('错误数据:', error.response.data);
          message.error(`获取LaTeX题目失败: ${error.response.data.error || ''} ${error.response.data.details || error.message}`);
        } else if (error.request) {
          // 请求已发送但没有收到响应
          console.error('没有收到响应:', error.request);
          message.error('服务器未响应，请检查网络连接');
        } else {
          // 设置请求时发生错误
          console.error('请求配置错误:', error.message);
          message.error(`请求错误: ${error.message}`);
        }
        // 打印完整的Axios错误配置
        console.error('Axios请求配置:', error.config);
      } else {
        // 非Axios错误
        console.error('未知错误:', error);
        message.error('获取LaTeX题目数据失败，发生未知错误');
      }
      
      setQuestions([]);
      setFilteredQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [token, subject, grade, year, type, searchText]);
  
  // 初始化加载
  useEffect(() => {
    if (token) {
      fetchLatexQuestions();
    } else {
      console.warn('令牌不存在，延迟获取数据');
    }
  }, [token, fetchLatexQuestions]);
  
  // 搜索和筛选
  const handleSearch = () => {
    fetchLatexQuestions(1);
  };
  
  // 重置筛选条件
  const handleReset = () => {
    setSubject('');
    setGrade('');
    setYear('');
    setType('');
    setSearchText('');
    fetchLatexQuestions(1);
  };
  
  // 表格变更处理（分页、排序等）
  const handleTableChange = (pagination: any) => {
    fetchLatexQuestions(pagination.current, pagination.pageSize);
  };
  
  // 预览LaTeX题目
  const handlePreview = (record: LatexQuestion) => {
    setCurrentQuestion(record);
    setPreviewVisible(true);
  };
  
  // 监听LaTeX代码变化
  const handleLatexCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    // 更新表单中的latex_code字段
    form.setFieldsValue({ latex_code: newContent });
    
    // 如果开启了自动渲染，更新渲染内容
    if (autoRender) {
      setLatexContent(newContent);
      // 增加key以强制MathJax重新渲染
      setRenderKey(prev => prev + 1);
    }
    console.log('LaTeX代码已更新，' + (autoRender ? '自动渲染已触发' : '等待手动刷新'));
  };
  
  // 手动刷新LaTeX渲染
  const handleRefreshRender = () => {
    setLatexContent(form.getFieldValue('latex_code') || '');
    setRenderKey(prev => prev + 1);
    console.log('手动刷新LaTeX渲染');
  };
  
  // 切换自动渲染
  const toggleAutoRender = () => {
    const newStatus = !autoRender;
    setAutoRender(newStatus);
    console.log(`${newStatus ? '开启' : '关闭'}自动渲染`);
    
    // 如果开启自动渲染，立即执行一次渲染
    if (newStatus) {
      handleRefreshRender();
    }
  };
  
  // 编辑LaTeX题目
  const handleEdit = (record: LatexQuestion) => {
    setCurrentQuestion(record);
    
    // 检查是否是ABCD选项
    const isStandardOption = ['A', 'B', 'C', 'D'].includes(record.correct_answer);
    setCustomAnswerVisible(!isStandardOption);
    
    // 设置初始LaTeX内容
    setLatexContent(record.latex_code || '');
    
    form.setFieldsValue({
      subject: record.subject,
      grade: record.grade,
      year: record.year,
      type: record.type,
      folder_name: record.folder_name,
      correct_answer: isStandardOption ? record.correct_answer : 'other',
      custom_answer: isStandardOption ? '' : record.correct_answer,
      note: record.note || '',
      latex_code: record.latex_code || '',
    });
    
    setEditVisible(true);
  };
  
  // 监听答案类型变化
  const handleAnswerTypeChange = (value: string) => {
    console.log('答案类型变更为:', value);
    setCustomAnswerVisible(value === 'other');
  };
  
  // 提交编辑
  const handleSubmitEdit = async () => {
    if (!token) {
      message.error('认证失败，请重新登录');
      return;
    }
    
    try {
      const values = await form.validateFields();
      
      if (!currentQuestion) {
        message.error('当前没有选中题目');
        return;
      }
      
      // 处理自定义答案
      if (values.correct_answer === 'other' && values.custom_answer) {
        values.correct_answer = values.custom_answer;
      }
      
      // 删除自定义答案字段，避免发送到后端
      delete values.custom_answer;
      
      setLoading(true);
      
      const response = await axios.put(`http://localhost:3002/api/latex-questions/${currentQuestion.id}`, values, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.success) {
        message.success('更新成功');
        setEditVisible(false);
        fetchLatexQuestions(); // 刷新数据
      } else {
        message.error(response.data?.message || '更新失败');
      }
    } catch (error) {
      console.error('更新LaTeX题目失败:', error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`更新失败: ${error.response.data.error || error.message}`);
      } else {
      message.error('更新LaTeX题目失败');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // 删除LaTeX题目
  const handleDelete = (record: LatexQuestion) => {
    if (!token) {
      message.error('认证失败，请重新登录');
      return;
    }
    
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除ID为 ${record.id} 的LaTeX题目吗？此操作不可恢复。`,
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          
          const response = await axios.delete(`http://localhost:3002/api/latex-questions/${record.id}`, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.data && response.data.success) {
            message.success('删除成功');
            fetchLatexQuestions(); // 刷新数据
          } else {
            message.error(response.data?.message || '删除失败');
          }
        } catch (error) {
          console.error('删除LaTeX题目失败:', error);
          if (axios.isAxiosError(error) && error.response) {
            message.error(`删除失败: ${error.response.data.error || error.message}`);
          } else {
          message.error('删除LaTeX题目失败');
          }
        } finally {
          setLoading(false);
        }
      },
    });
  };
  
  // 创建新LaTeX题目
  const handleCreate = () => {
    setCurrentQuestion(null);
    form.resetFields();
    setCustomAnswerVisible(false);
    setLatexContent('');
    setEditVisible(true);
  };
  
  // 导出所有LaTeX题目数据
  const handleExportData = async (useFilters = false) => {
    if (!token) {
      message.error('认证失败，请重新登录');
      return;
    }
    
    try {
      message.loading({ content: '正在导出数据...', key: 'export' });
      
      // 构建请求参数
      const params: Record<string, string> = {
        limit: '1000', // 设置一个较大的限制获取所有数据
      };
      
      // 如果使用筛选条件，则添加当前的筛选参数
      if (useFilters) {
        if (subject) params.subject = subject;
        if (grade) params.grade = grade;
        if (year) params.year = year;
        if (type) params.type = type;
        if (searchText) params.search = searchText;
      }
      
      // 获取数据
      const response = await axios.get('http://localhost:3002/api/latex-questions', {
        params,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && Array.isArray(response.data.questions)) {
        const exportData = {
          timestamp: new Date().toISOString(),
          total: response.data.questions.length,
          filters: useFilters ? { subject, grade, year, type, search: searchText } : null,
          items: response.data.questions
        };
        
        // 转换为JSON字符串
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // 构建文件名
        const filterSuffix = useFilters ? '-filtered' : '';
        const fileName = `latex-questions${filterSuffix}-${new Date().toISOString().slice(0, 10)}.json`;
        
        // 创建下载链接
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // 清理
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        message.success({ 
          content: `成功导出${response.data.questions.length}个LaTeX题目数据${useFilters ? '（已筛选）' : ''}`, 
          key: 'export' 
        });
      } else {
        message.error({ content: '导出数据格式异常', key: 'export' });
      }
    } catch (error) {
      console.error('导出数据失败:', error);
      
      // 错误处理
      if (axios.isAxiosError(error) && error.response) {
        message.error({ content: `导出失败: ${error.response.data.error || error.message}`, key: 'export' });
      } else {
        message.error({ content: '导出数据失败，请检查网络连接', key: 'export' });
      }
    }
  };
  
  // 导出为CSV格式
  const exportToCSV = (useFilters = false) => {
    if (!questions || questions.length === 0) {
      message.error('没有数据可导出');
      return;
    }
    
    try {
      // CSV标题行
      const headers = [
        'ID', '路径', '学科', '年级', '年份', '类型', 
        '文件夹名', '正确答案', '笔记', '创建时间', '更新时间'
      ];
      
      // 数据行
      const dataRows = questions.map(q => [
        q.id,
        q.latex_path,
        q.subject,
        q.grade,
        q.year,
        q.type,
        q.folder_name,
        q.correct_answer,
        q.note || '',
        q.created_at,
        q.updated_at || ''
      ]);
      
      // 组合标题和数据
      const csvContent = [
        headers.join(','),
        ...dataRows.map(row => row.map(cell => 
          // 处理包含逗号、引号或换行符的单元格
          typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n')) 
            ? `"${cell.replace(/"/g, '""')}"` 
            : cell
        ).join(','))
      ].join('\n');
      
      // 创建Blob并下载
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      // 构建文件名
      const filterSuffix = useFilters ? '-filtered' : '';
      const fileName = `latex-questions${filterSuffix}-${new Date().toISOString().slice(0, 10)}.csv`;
      
      // 下载
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // 清理
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success(`成功导出${questions.length}个LaTeX题目数据为CSV格式${useFilters ? '（已筛选）' : ''}`);
    } catch (error) {
      console.error('导出CSV失败:', error);
      message.error('导出CSV失败，请重试');
    }
  };
  
  // 提交创建
  const handleSubmitCreate = async () => {
    if (!token) {
      message.error('认证失败，请重新登录');
      return;
    }
    
    try {
      const values = await form.validateFields();
      
      // 处理自定义答案
      if (values.correct_answer === 'other' && values.custom_answer) {
        values.correct_answer = values.custom_answer;
      }
      
      // 删除自定义答案字段，避免发送到后端
      delete values.custom_answer;
      
      setLoading(true);
      
      const response = await axios.post('http://localhost:3002/api/latex-questions', values, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.success) {
        message.success('创建成功');
        setEditVisible(false);
        fetchLatexQuestions(); // 刷新数据
      } else {
        message.error(response.data?.message || '创建失败');
      }
    } catch (error) {
      console.error('创建LaTeX题目失败:', error);
      if (axios.isAxiosError(error) && error.response) {
        message.error(`创建失败: ${error.response.data.error || error.message}`);
      } else {
      message.error('创建LaTeX题目失败');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // 表格列配置
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '学科',
      dataIndex: 'subject',
      key: 'subject',
      width: 100,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '年级',
      dataIndex: 'grade',
      key: 'grade',
      width: 80,
      render: (text: string) => <Tag color="purple">{text}</Tag>,
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 80,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
    },
    {
      title: '文件夹名',
      dataIndex: 'folder_name',
      key: 'folder_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '正确答案',
      dataIndex: 'correct_answer',
      key: 'correct_answer',
      width: 80,
      render: (text: string) => <Tag color="green">{text}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: LatexQuestion) => (
        <Space size="small">
          <Tooltip title="预览">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handlePreview(record)} 
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)} 
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => handleDelete(record)} 
            />
          </Tooltip>
        </Space>
      ),
    },
  ];
  
  return (
    <div className="latex-browser-container">
      <div className="latex-browser-header">
        <Title level={4}>LaTeX题目数据库</Title>
        <Space>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleCreate}
        >
          创建新题目
        </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'export-all-json',
                  label: '导出所有数据(JSON)',
                  onClick: () => handleExportData(false)
                },
                {
                  key: 'export-filtered-json',
                  label: '导出筛选数据(JSON)',
                  onClick: () => handleExportData(true)
                },
                {
                  key: 'export-all-csv',
                  label: '导出所有数据(CSV)',
                  onClick: () => exportToCSV(false)
                },
                {
                  key: 'export-filtered-csv',
                  label: '导出筛选数据(CSV)',
                  onClick: () => exportToCSV(true)
                }
              ]
            }}
          >
            <Button icon={<ExportOutlined />}>
              导出 <DownOutlined />
            </Button>
          </Dropdown>
        </Space>
      </div>
      
      <div className="latex-browser-filters">
        <Space wrap>
          <Select
            placeholder="选择学科"
            style={{ width: 120 }}
            value={subject}
            onChange={setSubject}
            allowClear
          >
            <Option value="线性代数">线性代数</Option>
            <Option value="数学分析">数学分析</Option>
            <Option value="英语">英语</Option>
            <Option value="大学物理">大学物理</Option>
            <Option value="电磁场">电磁场</Option>
          </Select>
          
          <Select
            placeholder="选择年级"
            style={{ width: 100 }}
            value={grade}
            onChange={setGrade}
            allowClear
          >
            <Option value="大一">大一</Option>
            <Option value="大二">大二</Option>
            <Option value="大三">大三</Option>
          </Select>
          
          <Select
            placeholder="选择年份"
            style={{ width: 100 }}
            value={year}
            onChange={setYear}
            allowClear
          >
            <Option value="2019">2019</Option>
            <Option value="2020">2020</Option>
            <Option value="2021">2021</Option>
            <Option value="2022">2022</Option>
            <Option value="2023">2023</Option>
            <Option value="2024">2024</Option>
          </Select>
          
          <Select
            placeholder="选择类型"
            style={{ width: 100 }}
            value={type}
            onChange={setType}
            allowClear
          >
            <Option value="A卷">A卷</Option>
            <Option value="B卷">B卷</Option>
          </Select>
          
          <Input
            placeholder="搜索LaTeX内容或笔记"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
            allowClear
          />
          
          <Button type="primary" onClick={handleSearch}>搜索</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </div>
      
      <Table
        columns={columns}
        dataSource={filteredQuestions}
        rowKey="id"
        pagination={pagination}
        onChange={handleTableChange}
        loading={loading}
        scroll={{ x: 1100 }}
        size="middle"
      />
      
      {/* 预览LaTeX模态框 */}
      <Modal
        title={`预览LaTeX题目 (ID: ${currentQuestion?.id})`}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={700}
      >
        {currentQuestion ? (
          <div className="latex-preview">
            <div className="latex-info">
              <p><strong>路径:</strong> {currentQuestion.latex_path}</p>
              <p>
                <strong>分类:</strong> 
                <Tag color="blue">{currentQuestion.subject}</Tag>
                <Tag color="purple">{currentQuestion.grade}</Tag>
                <Tag>{currentQuestion.year}</Tag>
                <Tag>{currentQuestion.type}</Tag>
              </p>
              <p><strong>文件夹名:</strong> {currentQuestion.folder_name}</p>
              <p><strong>正确答案:</strong> <Tag color="green">{currentQuestion.correct_answer}</Tag></p>
              {currentQuestion.note && (
                <div>
                  <strong>笔记:</strong>
                  <p className="latex-note">{currentQuestion.note}</p>
                </div>
              )}
            </div>
            
            <div className="latex-content">
              <strong>LaTeX代码:</strong>
              <div className="latex-code-display">
                {currentQuestion.latex_code || '没有LaTeX代码'}
              </div>
              
              <strong>渲染效果:</strong>
              <div className="latex-render">
                <MathJaxContext config={config}>
                  <MathJax 
                    hideUntilTypeset={'first'} 
                    inline={false} 
                    dynamic={true}
                  >
                    {currentQuestion.latex_code || '没有LaTeX代码可渲染'}
                  </MathJax>
                </MathJaxContext>
              </div>
            </div>
          </div>
        ) : (
          <Spin tip="加载中..." />
        )}
      </Modal>
      
      {/* 编辑/创建LaTeX模态框 */}
      <Modal
        title={currentQuestion ? `编辑LaTeX题目 (ID: ${currentQuestion.id})` : '创建新LaTeX题目'}
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={currentQuestion ? handleSubmitEdit : handleSubmitCreate}
        confirmLoading={loading}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          name="latexForm"
        >
          <Form.Item
            name="subject"
            label="学科"
            rules={[{ required: true, message: '请选择学科' }]}
          >
            <Select placeholder="选择学科">
              <Option value="线性代数">线性代数</Option>
              <Option value="数学分析">数学分析</Option>
              <Option value="英语">英语</Option>
              <Option value="大学物理">大学物理</Option>
              <Option value="电磁场">电磁场</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="grade"
            label="年级"
            rules={[{ required: true, message: '请选择年级' }]}
          >
            <Select placeholder="选择年级">
              <Option value="大一">大一</Option>
              <Option value="大二">大二</Option>
              <Option value="大三">大三</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="year"
            label="年份"
            rules={[{ required: true, message: '请选择年份' }]}
          >
            <Select placeholder="选择年份">
              <Option value="2019">2019</Option>
              <Option value="2020">2020</Option>
              <Option value="2021">2021</Option>
              <Option value="2022">2022</Option>
              <Option value="2023">2023</Option>
              <Option value="2024">2024</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select placeholder="选择类型">
              <Option value="A卷">A卷</Option>
              <Option value="B卷">B卷</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="folder_name"
            label="文件夹名"
            rules={[{ required: true, message: '请输入文件夹名' }]}
          >
            <Input placeholder="输入文件夹名，如时间戳ID" />
          </Form.Item>
          
          <Form.Item
            name="correct_answer"
            label="正确答案"
            rules={[{ required: true, message: '请输入正确答案' }]}
          >
            <Select 
              placeholder="选择或输入正确答案"
              onChange={handleAnswerTypeChange}
            >
              <Option value="A">A</Option>
              <Option value="B">B</Option>
              <Option value="C">C</Option>
              <Option value="D">D</Option>
              <Option value="other">其他答案（数字或单词，如120）</Option>
            </Select>
          </Form.Item>
          
          {customAnswerVisible && (
            <Form.Item
              name="custom_answer"
              label="自定义答案"
              rules={[{ required: true, message: '请输入自定义答案' }]}
              extra="请输入数字或单词，例如：120"
            >
              <Input placeholder="输入数字或单词答案" />
            </Form.Item>
          )}
          
          <Form.Item
            name="note"
            label="笔记"
          >
            <TextArea rows={3} placeholder="输入笔记（可选）" />
          </Form.Item>
          
          <Form.Item
            name="latex_code"
            label={
              <Space>
                <span>LaTeX代码</span>
                <Button 
                  type="text" 
                  size="small" 
                  icon={<SyncOutlined spin={renderKey % 2 === 1} />} 
                  onClick={handleRefreshRender}
                  title="刷新渲染"
                >
                  刷新渲染
                </Button>
                <Switch 
                  size="small" 
                  checked={autoRender} 
                  onChange={toggleAutoRender} 
                  checkedChildren="自动渲染" 
                  unCheckedChildren="手动渲染"
                />
              </Space>
            }
            rules={[{ required: true, message: '请输入LaTeX代码' }]}
          >
            <TextArea 
              rows={6} 
              placeholder="输入LaTeX代码" 
              onChange={handleLatexCodeChange} 
            />
          </Form.Item>
        </Form>
        
        {form && (
          <div className="latex-preview-edit">
            <strong>预览:</strong>
            <div className="latex-render">
              <MathJaxContext config={config}>
                <MathJax 
                  key={`render-${renderKey}`}
                  hideUntilTypeset={'first'} 
                  inline={false} 
                  dynamic={true}
                >
                  {latexContent || '暂无LaTeX代码可渲染'}
                </MathJax>
              </MathJaxContext>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LatexBrowser; 