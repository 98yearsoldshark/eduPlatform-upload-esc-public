import React from 'react';
import { Row, Col, Card, Tag, Typography, Button, Checkbox, Space, Badge, Spin, Empty, Input, Pagination } from 'antd';
import { InfoCircleOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { MathJaxContext, MathJax } from 'better-react-mathjax';
import { QuestionItem } from '../types';
import { mathJaxConfig } from '../config';

const { Text } = Typography;

interface QuestionListProps {
  loading: boolean;
  filteredQuestions: QuestionItem[];
  selectedQuestionIds: number[];
  recentlySelectedIds: number[];
  recentlyCanceledIds: number[];
  isAllSelected: boolean;
  handleQuestionSelect: (questionId: number, checked: boolean) => void;
  handleSelectAllQuestions: (checked: boolean) => void;
  handleSelectDetailQuestion: (question: QuestionItem) => void;
  submitBatchSelect: (questionIds: number[]) => Promise<boolean>;
  handleDeselectQuestion: (question: QuestionItem) => void;
  handleBatchDeselect: () => void;
  searchKeyword: string;
  setSearchKeyword: (keyword: string) => void;
  currentPage: number;
  totalQuestions: number;
  pageSize: number;
  handlePageChange: (page: number) => void;
  selectionStatus: string;
  questions: QuestionItem[];
  debugMode: boolean;
  canModifyQuestions: boolean;
}

const QuestionList: React.FC<QuestionListProps> = ({
  loading,
  filteredQuestions,
  selectedQuestionIds,
  recentlySelectedIds,
  recentlyCanceledIds,
  isAllSelected,
  handleQuestionSelect,
  handleSelectAllQuestions,
  handleSelectDetailQuestion,
  submitBatchSelect,
  handleDeselectQuestion,
  handleBatchDeselect,
  searchKeyword,
  setSearchKeyword,
  currentPage,
  totalQuestions,
  pageSize,
  handlePageChange,
  selectionStatus,
  questions,
  debugMode,
  canModifyQuestions
}) => {
  
  // 渲染图片题目
  const renderImageQuestion = (question: QuestionItem) => {
    if (!question.images || question.images.length === 0) {
      return <div>无法加载题目图片</div>;
    }
    
    return (
      <div>
        {question.images.map((image, index) => (
          <img 
            key={index}
            src={`http://localhost:3001${image.url}`}
            alt={`题目图片${index + 1}`}
            style={{ 
              maxWidth: '100%', 
              marginBottom: '10px',
              border: '1px solid #f0f0f0',
              borderRadius: '4px'
            }}
          />
        ))}
      </div>
    );
  };
  
  // 渲染LaTeX题目
  const renderLatexQuestion = (question: QuestionItem) => {
    if (!question.latex_code) {
      return <div>无法加载LaTeX题目内容</div>;
    }
    
    try {
      return (
        <div className="latex-container" style={{ padding: '10px' }}>
          <MathJaxContext config={mathJaxConfig}>
            <MathJax 
              key={`latex-${question.id}`}
              hideUntilTypeset={'first'} 
              inline={false} 
              dynamic={true}
              onError={(error) => console.error('MathJax渲染错误:', error)}
            >
              {question.latex_code || '暂无LaTeX代码'}
            </MathJax>
          </MathJaxContext>
        </div>
      );
    } catch (error) {
      console.error('渲染LaTeX失败:', error);
      return <div>LaTeX渲染失败，请检查代码格式</div>;
    }
  };
  
  // 渲染题目列表
  const renderQuestionList = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <p>加载题目中...</p>
        </div>
      );
    }
    
    if (filteredQuestions.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Empty 
            description={searchKeyword ? "没有找到匹配的题目" : "没有找到符合条件的题目"}
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
          />
          {searchKeyword && (
            <Button 
              type="primary" 
              onClick={() => setSearchKeyword('')}
              style={{ marginTop: '16px' }}
            >
              清除搜索
            </Button>
          )}
        </div>
      );
    }
    
    return (
      <Row gutter={[16, 16]}>
        {filteredQuestions.map(question => {
          // 判断题目的状态
          const isSelected = selectedQuestionIds.includes(question.id);
          const isOfficiallySelected = question.is_selected;
          const isRecentlySelected = recentlySelectedIds.includes(question.id);
          const isRecentlyCanceled = recentlyCanceledIds.includes(question.id);
          
          if (debugMode) {
            // 仅在调试模式下输出当前题目的选中状态，帮助排查问题
            console.log(`题目ID: ${question.id}, 是否官方选中: ${isOfficiallySelected}, 原始is_selected值: ${JSON.stringify(question.is_selected)}`);
          }
          
          // 状态颜色和文本
          let statusColor = isOfficiallySelected ? "blue" : (isSelected ? "green" : "");
          let statusText = isOfficiallySelected ? "已选入" : (isSelected ? "已选择" : "");
          
          // 边框和阴影样式
          const borderStyle = isRecentlySelected ? '2px solid #52c41a' :
                            isRecentlyCanceled ? '2px solid #ff4d4f' :
                            isOfficiallySelected ? '1px solid #1890ff' : 
                            isSelected ? '1px solid #52c41a' : 
                            '1px solid #f0f0f0';
          
          const shadowStyle = isRecentlySelected ? '0 0 15px rgba(82, 196, 26, 0.8)' : 
                            isRecentlyCanceled ? '0 0 15px rgba(255, 77, 79, 0.8)' :
                            isOfficiallySelected ? '0 0 8px rgba(24, 144, 255, 0.5)' : 
                            isSelected ? '0 0 8px rgba(82, 196, 26, 0.5)' : 
                            '0 1px 2px rgba(0,0,0,0.1)';
          
          return (
            <Col span={12} key={question.id}>
              <Badge.Ribbon 
                text={statusText} 
                color={statusColor}
                style={{ display: statusText ? 'block' : 'none' }}
              >
                <Card
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <Text strong>{question.folder_name || `题目 ${question.id}`}</Text>
                        <Tag color={question.type === 'latex' ? 'blue' : 'green'}>
                          {question.type === 'latex' ? 'LaTeX' : '图片'}
                        </Tag>
                      </Space>
                    </div>
                  }
                  extra={
                    <Space>
                      <Tag color="orange">{question.subject}</Tag>
                      <Tag color="purple">{question.grade}</Tag>
                      <Tag>{question.year}</Tag>
                    </Space>
                  }
                  style={{ 
                    marginBottom: '16px', 
                    height: '100%',
                    boxShadow: shadowStyle,
                    border: borderStyle,
                    transition: 'all 0.3s ease'
                  }}
                  hoverable
                  actions={[
                    <Button 
                      type="text" 
                      icon={<InfoCircleOutlined />} 
                      onClick={() => handleSelectDetailQuestion(question)}
                    >
                      查看详情
                    </Button>,
                    isOfficiallySelected ? (
                      <Button 
                        danger
                        type="primary" 
                        size="small" 
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeselectQuestion(question)}
                        disabled={!canModifyQuestions}
                      >
                        取消选入
                      </Button>
                    ) : (
                      <Space>
                        <Button 
                          type="primary" 
                          size="small" 
                          icon={<CheckCircleOutlined />}
                          onClick={() => submitBatchSelect([question.id])}
                          disabled={!canModifyQuestions}
                        >
                          选入
                        </Button>
                        <Checkbox
                          checked={isSelected}
                          onChange={(e) => handleQuestionSelect(question.id, e.target.checked)}
                          style={{ 
                            transform: 'scale(1.2)',
                            '--ant-primary-color': '#52c41a'
                          } as React.CSSProperties}
                        >{isSelected ? '已临时选择' : '临时选择'}
                        </Checkbox>
                      </Space>
                    )
                  ]}
                >
                  <div style={{ height: '220px', overflow: 'auto' }}>
                    {question.type === 'image' 
                      ? renderImageQuestion(question) 
                      : renderLatexQuestion(question)}
                  </div>
                </Card>
              </Badge.Ribbon>
            </Col>
          );
        })}
      </Row>
    );
  };

  return (
    <>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={4}>题目列表</Typography.Title>
        <Space size="middle">
          <Input.Search 
            placeholder="搜索题目名称、学科、年级..." 
            allowClear
            style={{ width: 250 }}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onSearch={(value) => setSearchKeyword(value)}
          />
          <Space>
            <Checkbox 
              checked={isAllSelected}
              onChange={(e) => handleSelectAllQuestions(e.target.checked)}
              disabled={filteredQuestions.filter(q => !q.is_selected).length === 0}
            >
              全选本页
            </Checkbox>
            {/* 仅在"已选入"或"全部"筛选状态下显示批量取消选入按钮 */}
            {(selectionStatus === 'selected' || selectionStatus === 'all') && 
              filteredQuestions.filter(q => q.is_selected).length > 0 && (
              <Button 
                type="primary"
                danger
                size="small"
                icon={<DeleteOutlined />}
                loading={loading}
                onClick={handleBatchDeselect}
                disabled={!canModifyQuestions}
              >
                批量取消选入
              </Button>
            )}
          </Space>
        </Space>
      </div>
      
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* 左侧统计信息 */}
        <Space wrap>
          <Tag color="cyan">总计: {totalQuestions} 题</Tag>
          <Tag color="green">待选入: {selectedQuestionIds.filter(id => 
            !questions.find(q => q.id === id)?.is_selected
          ).length} 题</Tag>
          <Tag color="blue">已选入: {questions.filter(q => q.is_selected).length} 题</Tag>
          {searchKeyword && (
            <Tag color="purple">搜索结果: {filteredQuestions.length} 题</Tag>
          )}
        </Space>
      </div>
      
      {renderQuestionList()}
      
      {/* 分页组件 */}
      {totalQuestions > 0 && (
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <Pagination 
            current={currentPage}
            total={totalQuestions}
            pageSize={pageSize}
            onChange={handlePageChange}
            showSizeChanger={false}
          />
        </div>
      )}
    </>
  );
};

export default QuestionList; 