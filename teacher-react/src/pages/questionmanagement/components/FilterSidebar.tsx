import React from 'react';
import { Layout, Select, Button, Radio, Divider, Typography, Tabs } from 'antd';
import { FilterOutlined, ReloadOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { QuestionItem } from '../types';

const { Sider } = Layout;
const { Option } = Select;
const { Title, Text } = Typography;

interface FilterSidebarProps {
  subject: string;
  setSubject: (value: string) => void;
  grade: string;
  setGrade: (value: string) => void;
  year: string;
  setYear: (value: string) => void;
  questionType: string;
  setQuestionType: (value: string) => void;
  selectionStatus: 'all' | 'selected' | 'unselected';
  setSelectionStatus: (value: 'all' | 'selected' | 'unselected') => void;
  activeTab: string;
  setActiveTab: (value: string) => void;
  handleFilterChange: () => void;
  fetchQuestions: () => void;
  selectedQuestionIds: number[];
  questions: QuestionItem[];
  handleBatchSelect: () => void;
  handleBatchCancelSelection: () => void;
  canModifyQuestions: boolean;
  setCurrentPage: (page: number) => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  subject,
  setSubject,
  grade,
  setGrade,
  year,
  setYear,
  questionType,
  setQuestionType,
  selectionStatus,
  setSelectionStatus,
  activeTab,
  setActiveTab,
  handleFilterChange,
  fetchQuestions,
  selectedQuestionIds,
  questions,
  handleBatchSelect,
  handleBatchCancelSelection,
  canModifyQuestions,
  setCurrentPage
}) => {
  return (
    <Sider width={250} style={{ background: '#fff', padding: '16px', borderRight: '1px solid #f0f0f0' }}>
      <Title level={4}>题目筛选</Title>
      
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          setCurrentPage(1);
        }}
        items={[
          {
            key: 'all',
            label: '所有题目',
          },
          {
            key: 'image',
            label: '图片题目',
          },
          {
            key: 'latex',
            label: 'LaTeX题目',
          }
        ]}
      />
      
      <Divider />
      
      <div style={{ marginBottom: '16px' }}>
        <Text strong>学科:</Text>
        <Select
          style={{ width: '100%', marginTop: '8px' }}
          placeholder="选择学科"
          allowClear
          value={subject}
          onChange={(value) => {
            setSubject(value);
            // 重置后续所有筛选条件
            setGrade('');
            setYear('');
            setQuestionType('');
          }}
        >
          <Option value="线性代数">线性代数</Option>
          <Option value="数学分析">数学分析</Option>
          <Option value="英语">英语</Option>
          <Option value="大学物理">大学物理</Option>
          <Option value="电磁场">电磁场</Option>
        </Select>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <Text strong>年级:</Text>
        <Select
          style={{ width: '100%', marginTop: '8px' }}
          placeholder="选择年级"
          allowClear
          value={grade}
          onChange={(value) => {
            setGrade(value);
            // 重置后续所有筛选条件
            setYear('');
            setQuestionType('');
          }}
          disabled={!subject} // 如果没有选择学科，禁用年级选择
        >
          <Option value="大一">大一</Option>
          <Option value="大二">大二</Option>
          <Option value="大三">大三</Option>
        </Select>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <Text strong>年份:</Text>
        <Select
          style={{ width: '100%', marginTop: '8px' }}
          placeholder="选择年份"
          allowClear
          value={year}
          onChange={(value) => {
            setYear(value);
            // 重置后续所有筛选条件
            setQuestionType('');
          }}
          disabled={!grade} // 如果没有选择年级，禁用年份选择
        >
          <Option value="2019">2019</Option>
          <Option value="2020">2020</Option>
          <Option value="2021">2021</Option>
          <Option value="2022">2022</Option>
          <Option value="2023">2023</Option>
          <Option value="2024">2024</Option>
        </Select>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <Text strong>类型:</Text>
        <Select
          style={{ width: '100%', marginTop: '8px' }}
          placeholder="选择类型"
          allowClear
          value={questionType}
          onChange={(value) => setQuestionType(value)}
          disabled={!year} // 如果没有选择年份，禁用类型选择
        >
          <Option value="A卷">A卷</Option>
          <Option value="B卷">B卷</Option>
        </Select>
      </div>
      
      <Divider />
      
      <div style={{ marginBottom: '16px' }}>
        <Text strong>筛选题目:</Text>
        <Radio.Group 
          onChange={(e) => setSelectionStatus(e.target.value)} 
          value={selectionStatus}
          style={{ marginTop: '8px', display: 'flex', flexDirection: 'column' }}
        >
          <Radio value="all">显示全部题目</Radio>
          <Radio value="selected">只显示已选入题目</Radio>
          <Radio value="unselected">只显示未选入题目</Radio>
        </Radio.Group>
      </div>
      
      <Button 
        type="primary" 
        icon={<FilterOutlined />} 
        style={{ marginRight: '8px', marginBottom: '16px' }}
        onClick={handleFilterChange}
      >
        应用筛选
      </Button>
      
      <Button 
        icon={<ReloadOutlined />}
        onClick={() => {
          setSubject('');
          setYear('');
          setQuestionType('');
          setGrade('');
          setSelectionStatus('all');
          setCurrentPage(1);
          fetchQuestions();
        }}
      >
        重置筛选
      </Button>
      
      {selectedQuestionIds.length > 0 && (
        <div style={{ marginTop: '16px', position: 'sticky', bottom: '20px' }}>
          <Button 
            type="primary" 
            block
            icon={<CheckCircleOutlined />}
            onClick={handleBatchSelect}
            style={{ 
              height: '40px', 
              fontSize: '16px',
              background: '#52c41a', 
              borderColor: '#52c41a',
              boxShadow: '0 2px 6px rgba(82, 196, 26, 0.5)',
              marginBottom: '8px'
            }}
            disabled={!canModifyQuestions}
          >
            批量选入 ({selectedQuestionIds.filter(id => 
              !questions.find(q => q.id === id)?.is_selected
            ).length}题)
          </Button>
          
          <Button 
            danger
            block
            icon={<DeleteOutlined />}
            onClick={handleBatchCancelSelection}
            style={{ height: '40px' }}
            disabled={selectedQuestionIds.filter(id => !questions.find(q => q.id === id)?.is_selected).length === 0}
          >
            取消临时选择
          </Button>
        </div>
      )}
    </Sider>
  );
};

export default FilterSidebar; 