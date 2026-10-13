import React, { useState } from 'react';
import { Card, Typography, Tabs } from 'antd';
import FileExplorer from '../pages/test-function/FileExplorer';
import TestPage1 from '../pages/test-function/TestPage1';
import TestPage2 from '../pages/test-function/TestPage2';

const { Title, Paragraph } = Typography;

const TestFunction: React.FC = () => {
  const [activeKey, setActiveKey] = useState('1');
  
  // 定义tab项
  const tabItems = [
    {
      key: '1',
      label: '文件浏览器',
      children: <FileExplorer />
    },
    {
      key: '2',
      label: '测试功能1',
      children: <TestPage1 />
    },
    {
      key: '3',
      label: '测试功能2',
      children: <TestPage2 />
    }
  ];

  const handleTabChange = (key: string) => {
    setActiveKey(key);
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card title="测试功能" variant="outlined" style={{ width: '100%' }}>
        <Typography>
          <Title level={4}>测试功能模块</Title>
          <Paragraph>
            本模块提供多种测试功能，可以通过下方标签页切换不同的功能。
          </Paragraph>
        </Typography>
        
        <Tabs 
          activeKey={activeKey} 
          onChange={handleTabChange} 
          type="card"
          items={tabItems}
        />
      </Card>
    </div>
  );
};

export default TestFunction; 