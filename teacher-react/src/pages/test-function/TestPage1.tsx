import React from 'react';
import { Card, Typography } from 'antd';

const { Title, Paragraph } = Typography;

const TestPage1: React.FC = () => {
  return (
    <div>
      <Title level={4}>测试功能1</Title>
      <Paragraph>
        这是测试功能1的内容，您可以根据需要自定义此页面。
      </Paragraph>
      <Card title="示例卡片" style={{ marginTop: 16 }}>
        <p>测试功能1的示例内容</p>
      </Card>
    </div>
  );
};

export default TestPage1; 