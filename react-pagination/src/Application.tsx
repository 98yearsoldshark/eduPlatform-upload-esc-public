// import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
// 导入封装好的AI组件
import { AiButton, AiDialog } from './components/ai';

const Application = () => {
  const navigate = useNavigate();
  const [aiMode, setAiMode] = useState<string | null>(null);

  const handleUploadClick = () => {
    navigate('/upload');
  };

  const handleViewRecords = () => {
    navigate('/records');
  };

  const handleOcrClick = () => {
    navigate('/ocrpages');
  };

  // AI对话模式处理函数
  const handleAiMode = (mode: string) => {
    setAiMode(mode);
    console.log(`AI模式切换为: ${mode}`);
  };

  // 关闭AI对话
  const closeAiDialog = () => {
    setAiMode(null);
    console.log('关闭AI对话');
  };

  return (
    <div className="application-container">
      <h2>应用页面</h2>
      <div className="button-group">
        <button onClick={handleUploadClick}>上传题目</button>
        <button onClick={handleViewRecords}>查看答题记录</button>
        <button onClick={handleOcrClick}>题目识别</button>
        
        {/* 使用封装的AI按钮组件 */}
        <AiButton onSelectMode={handleAiMode} buttonText="AI助手" showDropdown={true} />
      </div>

      {/* 使用封装的AI对话组件 */}
      <AiDialog mode={aiMode} onClose={closeAiDialog} />
    </div>
  );
};

export default Application;

