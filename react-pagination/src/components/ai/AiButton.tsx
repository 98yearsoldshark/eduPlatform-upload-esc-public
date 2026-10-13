import React from 'react';

interface AiButtonProps {
  onSelectMode: (mode: string) => void;
  buttonText?: string;
  showDropdown?: boolean;
}

const AiButton: React.FC<AiButtonProps> = ({ 
  onSelectMode, 
  buttonText = "AI助手", 
  showDropdown = false 
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
    console.log('打开/关闭AI助手下拉菜单');
  };

  const handleModeSelect = (mode: string) => {
    onSelectMode(mode);
    setIsDropdownOpen(false);
    console.log(`选择AI模式: ${mode}`);
  };

  // 简单按钮模式，点击直接使用默认模式
  if (!showDropdown) {
    return (
      <button 
        onClick={() => onSelectMode('embedded')}
        style={{
          padding: '5px 10px',
          cursor: 'pointer',
          borderRadius: '4px',
          backgroundColor: '#f0f0f0',
          border: '1px solid #ccc'
        }}
      >
        {buttonText}
      </button>
    );
  }

  // 下拉菜单模式，可以选择不同的AI对话模式
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button 
        onClick={toggleDropdown}
        style={{
          padding: '5px 10px',
          cursor: 'pointer',
          borderRadius: '4px',
          backgroundColor: '#f0f0f0',
          border: '1px solid #ccc'
        }}
      >
        {buttonText} ▼
      </button>
      
      {isDropdownOpen && (
        <div 
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            zIndex: 1000,
            minWidth: '150px'
          }}
        >
          <div 
            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
            onClick={() => handleModeSelect('embedded')}
          >
            嵌入式AI助手
          </div>
          <div 
            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
            onClick={() => handleModeSelect('assistant')}
          >
            阅读助手AI
          </div>
          <div 
            style={{ padding: '8px 12px', cursor: 'pointer' }}
            onClick={() => handleModeSelect('normal')}
          >
            AI对话页面
          </div>
        </div>
      )}
    </div>
  );
};

export default AiButton; 