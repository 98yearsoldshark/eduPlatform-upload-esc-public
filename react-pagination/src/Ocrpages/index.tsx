// import React, { useState } from 'react';
import React, { useState } from 'react';
import DouBao32 from './Ocrsrc/DoubaoPro32k';
import TencentCloude from './Ocrsrc/TencentCloude';

const Ocrpages: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'doubao' | 'tencent'>('doubao');

  return (
    <div className="ocr-container" style={{ padding: '20px' }}>
      <div className="tabs" style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('doubao')} 
          style={{ 
            padding: '8px 16px', 
            marginRight: '10px', 
            backgroundColor: activeTab === 'doubao' ? '#4a90e2' : '#e0e0e0',
            color: activeTab === 'doubao' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          豆包Pro识别
        </button>
        <button 
          onClick={() => setActiveTab('tencent')} 
          style={{ 
            padding: '8px 16px', 
            backgroundColor: activeTab === 'tencent' ? '#4a90e2' : '#e0e0e0',
            color: activeTab === 'tencent' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          腾讯OCR识别
        </button>
      </div>

      {activeTab === 'doubao' ? <DouBao32 /> : <TencentCloude />}
    </div>
  );
};

export default Ocrpages;