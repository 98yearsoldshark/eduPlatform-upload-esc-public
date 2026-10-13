import React from 'react';
import { Card, Typography, Alert } from 'antd';
import ImageBrowser from './components/ImageBrowser';

const { Title, Paragraph } = Typography;

const TestPage2: React.FC = () => {
  return (
    <div>
      <Title level={4}>图片浏览器</Title>
      <Paragraph>
        这是一个优化的图片浏览器，支持图片懒加载、预加载和预览功能。
      </Paragraph>
      
      <Alert
        message="图片优化功能"
        description="本页面实现了以下图片优化功能：1. 懒加载 - 图片只在滚动到视图内时加载；2. 缩略图预加载 - 先加载小图提高加载速度；3. 预览功能 - 支持缩放、查看原图等功能；4. 大图片预览优化 - 支持查看高分辨率图片。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Card title="图片浏览器" style={{ marginTop: 16 }}>
        <div style={{ height: '600px' }}>
          <ImageBrowser 
            title="prtsc目录图片预览" 
            path=""  // 默认查看根目录
          />
        </div>
      </Card>
    </div>
  );
};

export default TestPage2; 