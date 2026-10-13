import React, { useState, useEffect } from 'react';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
import { CodeBlock } from 'react-code-blocks';

const TencentCloude: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [result, setResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState<boolean>(false);
    const [notification, setNotification] = useState<{ show: boolean; message: string; type: string }>({ 
        show: false, 
        message: '', 
        type: '' 
    });
    const [ocrResult, setOcrResult] = useState<any>(null);
    const [latexContentaQues, setLatexContentaQues] = useState<string>('');
    const [latexContentAandQ, setLatexContentAandQ] = useState<string>('');
    const [isCodeBlockVisible, setIsCodeBlockVisible] = useState<boolean>(false);

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

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setImageFile(file);
    };

    const handleSubmit = async () => {
        if (!imageFile) {
            alert('请上传图片');
            return;
        }
        setIsLoading(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(imageFile);
            await new Promise((resolve) => {
                reader.onload = resolve;
            });

            // 检查 reader.result 是否为 null
            if (!reader.result) {
                throw new Error('文件读取失败');
            }
            const base64Image = reader.result.toString().split(',')[1];

            const payload = {
                ImageBase64: base64Image
            };

            const response = await fetch('http://localhost:3001/api/tx-ocr/ocr', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`请求失败，状态码: ${response.status}`);
            }

            const data = await response.json();
            console.log('OCR结果:', data);
            setOcrResult(data);
            console.log(data.aQues);
            
            // 提取aQues字段的内容用于LaTeX渲染
            if (data?.aQues) {
                // 处理LaTeX转义字符，将\替换为\
                // const latexString = data.aQues.replace(/\\\\/g, '\\');
                const latexStringaQues = data.aQues;
                setLatexContentaQues(latexStringaQues);
            }
            // 提取AandQ字段的内容用于LaTeX渲染
            if (data?.AandQ) {
                // 处理LaTeX转义字符，将\替换为\
                // const latexString = data.aQues.replace(/\\\\/g, '\\');
                const latexStringAandQ = data.AandQ;
                setLatexContentAandQ(latexStringAandQ);
            }
            
            // 提取题目文本作为结果
            if (data?.Response?.QuestionInfo?.[0]?.ResultList?.[0]?.Question?.[0]?.Text) {
                const questionText = data.Response.QuestionInfo[0].ResultList[0].Question[0].Text;
                const options = data.Response.QuestionInfo[0].ResultList[0].Option || [];
                
                let formattedResult = questionText + '\n';
                options.forEach((option: any) => {
                    formattedResult += `${option.Text}\n`;
                });
                
                setResult(formattedResult);
            } else {
                setResult(JSON.stringify(data, null, 2));
            }
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

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">腾讯OCR题目识别</h1>
            <input type="file" accept="image/*" onChange={handleImageChange} className="mb-4" />
            <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-blue-500 text-white p-2 rounded"
            >
                {isLoading ? '正在处理...' : '提交'}
            </button>

            {result && (
                <div className="mt-4">
                    <h2 className="text-lg font-bold">识别结果:</h2>
                    <div className="flex flex-col space-y-2">
                        <textarea
                            value={result}
                            onChange={(e) => setResult(e.target.value)}
                            style={{ width: '100%', minHeight: '150px' }}
                            className="border p-2 resize-none"
                        />
                        <button
                            onClick={handleCopy}
                            className={`p-2 rounded ${copied ? 'bg-green-500 text-white' : 'bg-gray-300 text-black'}`}
                        >
                            {copied ? '已复制' : '一键复制'}
                        </button>
                        <div className="code-block-container">
                            <button 
                                onClick={() => setIsCodeBlockVisible(!isCodeBlockVisible)}
                                className="p-2 rounded bg-gray-200 text-black mb-2"
                            >
                                {isCodeBlockVisible ? '收起代码' : '展开代码'}
                            </button>
                            {isCodeBlockVisible && (
                                <CodeBlock
                                    text={result}
                                    language="latex"
                                    showLineNumbers
                                    startingLineNumber={1}
                                    codeContainerStyle={{ width: '1000px' }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {ocrResult && (
                <div className="mt-4">
                    <h2 className="text-lg font-bold">详细识别结果:</h2>
                    {ocrResult?.Response?.QuestionInfo?.[0]?.ImageBase64 && (
                        <div className="mb-4">
                            <h3 className="text-md font-semibold">题目图片</h3>
                            <img 
                                src={`data:image/png;base64,${ocrResult.Response.QuestionInfo[0].ImageBase64}`} 
                                alt="OCR识别结果"
                                style={{ maxWidth: '100%', marginBottom: '20px' }}
                            />
                        </div>
                    )}
                    <div>
                        <h3 className="text-md font-semibold">题目信息</h3>
                        <pre className="bg-gray-100 p-4 rounded overflow-auto">
                            {JSON.stringify(
                                {
                                    ...ocrResult?.Response?.QuestionInfo?.[0],
                                    ImageBase64: undefined
                                }, 
                                (k, v) => k === 'ImageBase64' ? undefined : v, 
                                2
                            )}
                        </pre>
                    </div>
                </div>
            )}
            
            <MathJaxContext>
                {latexContentaQues && (
                    <div className="mt-4">
                        <h2 className="text-lg font-bold">LaTeX渲染结果:</h2>
                        <div className="bg-gray-50 p-4 rounded border">
                            <MathJax dynamic>{latexContentaQues}</MathJax>
                        </div>
                    </div>
                )}
                {latexContentAandQ && (                    <div className="mt-4">
                        <h2 className="text-lg font-bold">LaTeX渲染AandQ结果:</h2>
                        <div className="bg-gray-50 p-4 rounded border">
                            <MathJax dynamic>{latexContentAandQ}</MathJax>
                        </div>
                    </div>
                )}
                <div className="mt-4">
                    <h2 className="text-lg font-bold">原始识别结果:</h2>
                    <MathJax dynamic>{result}</MathJax>
                </div>
                

            </MathJaxContext>
        </div>
    );
};

export default TencentCloude;