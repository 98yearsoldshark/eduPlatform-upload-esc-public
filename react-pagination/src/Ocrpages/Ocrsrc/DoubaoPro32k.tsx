// 豆包视觉识别页面：前端不保存长期 API 密钥。
import React, { useState , useEffect} from 'react';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
import { CodeBlock } from 'react-code-blocks';
// 导入AI组件
import { AiButton, AiDialog } from '../../components/ai';
// 导入通信服务
import { OcrAdapter } from '../../services/communication';

const DouBao32 : React.FC = () => {
  // const defaultPrompt = `根据图片内容生成latex代码，例如
  // \\begin{align*}
  //     &\\text{6. 下面关于时变电磁场位函数的描述中，错误的是：} \\\\
  //     &\\text{A.}  \\vec{B} &= \\nabla \\times \\vec{A} \\\\
  //     &\\text{B.}  -\\nabla \\varphi &= \\vec{E} \\\\
  //     &\\text{C.}  \\frac{\\partial \\varphi}{\\partial t} + \\nabla \\cdot \\vec{A} &= 0 \\\\
  //     &\\text{D.}  \\omega &= \\vec{E} + \\frac{\\partial \\vec{A}}{\\partial t}
  // \\end{align*}这样，只发给我latex代码`;    
  const defaultPrompt = `根据图片内容生成latex代码，例如，第一个例子"""
  \\begin{align*}
      &\\text{6. 下面关于时变电磁场位函数的描述中，错误的是：} \\\\
      &\\text{A.}  \\vec{B} = \\nabla \\times \\vec{A} \\\\
      &\\text{B.}  -\\nabla \\varphi = \\vec{E} \\\\
      &\\text{C.}  \\frac{\\partial \\varphi}{\\partial t} + \\nabla \\cdot \\vec{A} = 0 \\\\
      &\\text{D.}  \\omega = \\vec{E} + \\frac{\\partial \\vec{A}}{\\partial t}
  \\end{align*}"""第二个例子"""
  \\begin{aligned} &\\text{4.如图，已知P是\\(\\triangle\\)ABC边AB上的一点，连接CP.以下条件中不能判定\\(\\triangle\\)ACP\\(\\triangle\\)ABC的是() }\\\\ 
    &\\text{A.} \\angle ACP = \\angle B \\\\ 
    &\\text{B.} \\angle APC = \\angle ACB \\\\ 
    &\\text{C.} AC^{2} = AP·AB \\\\ 
    &\\text{D.} \\frac{AC}{CP} = \\frac{AB}{BC}
  \\end{aligned}"""这样，只发给我latex代码`;
    const [prompt, setPrompt] = useState(defaultPrompt);
    const [imageFile, setImageFile] = useState<File | null>(null);

    const [result, setResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState<boolean>(false);
    const [notification, setNotification] = useState<{ show: boolean; message: string; type: string }>({
      show: false,
      message: '',
      type: '',
    });
    
    // AI对话状态
    const [aiMode, setAiMode] = useState<string | null>(null);

    // 数据共享状态
    const [isSharedWithAI, setIsSharedWithAI] = useState(false);
  
    useEffect(() => {
      let timer: number;
      if (notification.show) {
        timer = window.setTimeout(() => {
          setNotification({ ...notification, show: false });
        }, 1000);
      }
      return () => {
        if (timer) clearTimeout(timer);
      };
    }, [notification.show]);

    // 组件卸载时清除LocalStorage中的OCR数据
    useEffect(() => {
      return () => {
        // 移除共享数据
        localStorage.removeItem('OCR_QUESTION_RESULT');
        console.log('OCR页面卸载，共享数据已清除');
      };
    }, []);

    const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPrompt(e.target.value);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setImageFile(file as unknown as null);
    };

    // 向AI助手传递OCR识别结果
    const shareResultWithAI = () => {
      if (!result || result.trim() === '') {
        setNotification({ 
          show: true, 
          message: '没有可共享的识别结果！', 
          type: 'error' 
        });
        return;
      }

      try {
        // 记录预览内容
        const contentPreview = result.length > 20 ? result.substring(0, 20) + "..." : result;
        
        // 使用OCR适配器发送数据
        const sendResult = OcrAdapter.sendOcrResult(result);
        
        if (sendResult.success) {
          console.log(`已成功发送OCR识别结果到AI助手，预览内容：${contentPreview}`);
          setIsSharedWithAI(true);
          setNotification({ 
            show: true, 
            message: '已将识别结果传递给AI助手！', 
            type: 'success' 
          });
          
          // 2秒后重置状态
          setTimeout(() => {
            setIsSharedWithAI(false);
          }, 2000);
        } else {
          throw new Error(sendResult.error || '发送失败，可能没有打开AI助手');
        }
      } catch (error: unknown) {
        const err = error as Error;
        console.error('发送OCR结果到AI助手出错:', err.message);
        
        setNotification({ 
          show: true, 
          message: '发送失败，请确保已打开AI助手！', 
          type: 'error' 
        });
      }
    };

    const handleSubmit = async () => {
        if (!prompt ||!imageFile) {
            alert('请输入提示词并上传图片');
            return;
        }
        setIsLoading(true);
        try {
            const apiUrl = 'http://localhost:3001/api/doubao/vision';

            const reader = new FileReader();
            reader.readAsDataURL(imageFile);
            await new Promise((resolve) => {
                reader.onload = resolve;
            });

            // 检查 reader.result 是否为 null
            if (!reader.result) {
                throw new Error('文件读取失败');
            }

            const requestBody = { prompt, imageUrl: reader.result.toString() };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`请求失败，错误信息: ${errorData.error.message}`);
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content || '未获取到有效内容';
            setResult(content);
            // 清除之前的共享状态
            setIsSharedWithAI(false);
        } catch (error) {
            console.error('请求出错:', error);
            setResult('请求出错，请稍后重试');
        } finally {
            setIsLoading(false);
        }
    };
    const handleCopy = () => {
      navigator.clipboard.writeText(result).then(() => {
        setNotification({ show: true, message: '复制成功！', type: 'success' });
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }).catch((err) => {
        console.error('复制失败:', err);
        setNotification({ show: true, message: `复制失败: ${err}`, type: 'error' });
      });
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
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">图片上传与提示词输入</h1>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
            <textarea
                placeholder="输入提示词"
                value={prompt}
                onChange={handlePromptChange}
                style={{ width: '200px', height: '300px' }}
                className="border p-2 mb-4 resize-both"
            />
                    <div>
            <input type="file" accept="image/*" onChange={handleImageChange} className="mb-4" />
      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="bg-blue-500 text-white p-2 rounded"
      >
        {isLoading ? '正在处理...' : '提交'}
      </button>
                    </div>
                </div>
                
                {/* 添加AI助手按钮 */}
                <div style={{ marginTop: '10px' }}>
                    <AiButton onSelectMode={handleAiMode} buttonText="AI助手" showDropdown={true} />
                </div>
            </div>

      {result && (
        <div className="mt-4">
          <h2 className="text-lg font-bold">结果:</h2>
          <div className="flex flex-col space-y-2">
            <textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              style={{ width: '100%', minHeight: '150px' }}
              className="border p-2 resize-none"
            />
                    <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleCopy}
              className={`p-2 rounded ${copied ? 'bg-green-500 text-white' : 'bg-gray-300 text-black'}`}
            >
              {copied ? '已复制' : '一键复制'}
            </button>
                      <button
                        onClick={shareResultWithAI}
                        disabled={isSharedWithAI}
                        className={`p-2 rounded ${isSharedWithAI ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}`}
                      >
                        {isSharedWithAI ? '已传递给AI助手' : '传递给AI助手'}
                      </button>
                    </div>
            <CodeBlock
              text={result}
              language="latex"
              showLineNumbers
              startingLineNumber={1}
            />
          </div>
                </div>
            )}
            
            {notification.show && (
              <div 
                style={{
                  position: 'fixed',
                  bottom: '20px',
                  right: '20px',
                  padding: '10px 20px',
                  backgroundColor: notification.type === 'success' ? '#4CAF50' : '#F44336',
                  color: 'white',
                  borderRadius: '4px',
                  zIndex: 1000
                }}
              >
                {notification.message}
        </div>
      )}
      
            <MathJaxContext>
            <MathJax dynamic>{result}</MathJax>
            </MathJaxContext>
            
            {/* 添加AI对话组件 */}
            <AiDialog mode={aiMode} onClose={closeAiDialog} />
        </div>
    );
};

export default DouBao32;    