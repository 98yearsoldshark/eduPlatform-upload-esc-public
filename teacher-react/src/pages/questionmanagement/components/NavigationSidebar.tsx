import React from 'react';
import { Layout, Button, Tooltip } from 'antd';
import { UnorderedListOutlined, InfoCircleOutlined, FolderOutlined, CodeOutlined } from '@ant-design/icons';
import { QuestionItem } from '../types';

const { Sider } = Layout;

interface NavigationSidebarProps {
  rightTabActive: string;
  setRightTabActive: (tab: string) => void;
  selectedDetailQuestion: QuestionItem | null;
}

const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  rightTabActive,
  setRightTabActive,
  selectedDetailQuestion
}) => {
  return (
    <Sider width={80} theme="light" style={{ background: '#fff', borderLeft: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
        <Tooltip title="题目列表" placement="left">
          <Button 
            type={rightTabActive === 'selection' ? 'primary' : 'default'}
            shape="circle" 
            icon={<UnorderedListOutlined />} 
            size="large"
            style={{ marginBottom: '20px' }}
            onClick={() => setRightTabActive('selection')}
          />
        </Tooltip>
        <Tooltip title="题目详情" placement="left">
          <Button 
            type={rightTabActive === 'details' ? 'primary' : 'default'}
            shape="circle" 
            icon={<InfoCircleOutlined />} 
            size="large"
            style={{ marginBottom: '20px' }}
            onClick={() => setRightTabActive('details')}
            disabled={!selectedDetailQuestion}
          />
        </Tooltip>
        <Tooltip title="文件浏览器" placement="left">
          <Button 
            type={rightTabActive === 'files' ? 'primary' : 'default'}
            shape="circle" 
            icon={<FolderOutlined />} 
            size="large"
            style={{ marginBottom: '20px' }}
            onClick={() => setRightTabActive('files')}
          />
        </Tooltip>
        <Tooltip title="LaTeX浏览器" placement="left">
          <Button 
            type={rightTabActive === 'latex' ? 'primary' : 'default'}
            shape="circle" 
            icon={<CodeOutlined />} 
            size="large"
            onClick={() => setRightTabActive('latex')}
          />
        </Tooltip>
      </div>
    </Sider>
  );
};

export default NavigationSidebar; 