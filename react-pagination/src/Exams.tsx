import React, { useState, useEffect } from 'react';
import { Select, Card, Row, Col, Image, Radio, Button, message, Input, Rate } from 'antd';
import axios from 'axios';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
import { parseToken } from './utils/authUtils';
// 导入AI组件
import { AiButton, AiDialog } from './components/ai';
// 导入通信服务
import { ImageAdapter, TextAdapter } from './services/communication';

const { Option } = Select;

interface FolderStructure {
  name: string;
  type: 'folder' | 'file';
  children?: FolderStructure[];
}

interface ImageInfo {
  name: string;
  url: string;
}

interface LatexQuestion {
  id: number;
  latex_path: string;
  subject: string;
  grade: string;
  year: string;
  type: string;
  folder_name: string;
  correct_answer: string;
  note: string;
  latex_code: string;
}

interface AnswerOption {
  value: string;
  label: string;
}

const Exams: React.FC = () => {
  // 设置默认筛选值
  const [subject, setSubject] = useState<string>('线性代数');
  const [year, setYear] = useState<string>('2019');
  const [type, setType] = useState<string>('A卷');
  const [grade, setGrade] = useState<string>('大一');
  const [folders, setFolders] = useState<FolderStructure[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customAnswer, setCustomAnswer] = useState<string>('');
  const [userId, setUserId] = useState<number | null>(null);
  const [_latexQuestion, _setLatexQuestion] = useState<LatexQuestion | null>(null);
  const [latexQuestions, setLatexQuestions] = useState<LatexQuestion[]>([]);
  const [selectedLatexQuestion, setSelectedLatexQuestion] = useState<LatexQuestion | null>(null);
  const [_questionType, setQuestionType] = useState<'image' | 'latex' | 'both'>('image');
  const [relatedPosts, setRelatedPosts] = useState<any[]>([]);
  const [showRelatedPosts, setShowRelatedPosts] = useState<boolean>(false);
  const [hasAnswered, setHasAnswered] = useState<boolean>(false);
  const [ratingValue, setRatingValue] = useState<number>(0);
  const [ratingSubmitting, setRatingSubmitting] = useState<boolean>(false);
  // AI对话状态
  const [aiMode, setAiMode] = useState<string | null>(null);

  const answerOptions: AnswerOption[] = [
    { value: 'A', label: 'A' },
    { value: 'B', label: 'B' },
    { value: 'C', label: 'C' },
    { value: 'D', label: 'D' },
    { value: 'custom', label: '其他' }
  ];

  useEffect(() => {
    // 使用认证工具函数获取用户信息
    const userData = parseToken();
    
    if (userData) {
      console.log('Exams组件：已获取用户信息', userData);
      setUserId(userData.id);
    } else {
      console.error('Exams组件：无法获取用户信息，请重新登录');
      message.error('获取用户信息失败，请重新登录');
    }
  }, []);

  // 获取题目评分信息
  const fetchQuestionRating = async (questionId: number, questionType: 'image' | 'latex') => {
    try {
      const response = await axios.get('http://localhost:3003/api/community/question-rating', {
        params: { 
          questionId,
          questionType,
          userId
        }
      });
      
      console.log('题目评分信息:', response.data);
    } catch (error) {
      console.error('获取题目评分失败:', error);
    }
  };

  // 获取文件夹结构
  const fetchFolders = async () => {
    try {
      const response = await axios.get('http://localhost:3001/folders', {
        params: {
          subject,
          year,
          type,
          grade
        }
      });
      setFolders(response.data);
      
      // 同时获取LaTeX题目
      fetchLatexQuestions();
    } catch (error) {
      console.error('获取文件夹失败:', error);
    }
  };

  // 获取LaTeX题目
  const fetchLatexQuestions = async () => {
    try {
      const response = await axios.get('http://localhost:3001/latex-questions', {
        params: {
          subject,
          year,
          type,
          grade
        }
      });
      // 如果有LaTeX题目，存储到状态中
      if (response.data && response.data.length > 0) {
        setLatexQuestions(response.data);
        // 如果有LaTeX题目，设置questionType为both
        setQuestionType('both');
      } else {
        setLatexQuestions([]);
        // 如果没有LaTeX题目，设置questionType为image
        setQuestionType('image');
      }
      console.log('LaTeX题目:', response.data);
    } catch (error) {
      console.error('获取LaTeX题目失败:', error);
      setLatexQuestions([]);
    }
  };

  // 获取选中文件夹中的图片
  const fetchImages = async (folderPath: string) => {
    try {
      // 构建完整的文件夹路径
      const fullPath = subject && grade && year && type ? 
        `${subject}/${grade}/${year}/${type}/${folderPath}` : folderPath;
      
      const response = await axios.get(`http://localhost:3001/images`, {
        params: { folderPath: fullPath }
      });
      setImages(response.data);
      
      // 如果有图片，确保questionType包含image
      if (response.data && response.data.length > 0) {
        if (latexQuestions.length > 0) {
          setQuestionType('both');
        } else {
          setQuestionType('image');
        }
      } else if (latexQuestions.length > 0) {
        setQuestionType('latex');
      } else {
        setQuestionType('image'); // 默认为图片模式，即使没有图片
      }
    } catch (error) {
      console.error('获取图片失败:', error);
    }
  };

  const handleSearch = () => {
    if (subject || year || type || grade) {
      fetchFolders();
    }
  };

  const handleFolderClick = (folderPath: string) => {
    setSelectedFolder(folderPath);
    setSelectedLatexQuestion(null);
    fetchImages(folderPath);
    // 重置选项
    setSelectedOption('');
    setCustomAnswer('');
    setHasAnswered(false);
    
    // 构建完整的文件夹路径
    const fullPath = subject && grade && year && type ? 
      `/prtsc/${subject}/${grade}/${year}/${type}/${folderPath}` : folderPath;
    
    // 发送请求获取并打印正确答案
    axios.get('http://localhost:3001/print-correct-answer', {
      params: {
        questionPath: fullPath,
        questionType: 'image'
      }
    }).catch(error => {
      console.error('获取正确答案失败:', error);
    });
    
    // 获取题目评分信息
    const questionId = generateQuestionId(folderPath);
    fetchQuestionRating(questionId, 'image');
  };
  
  // 处理LaTeX题目点击
  const handleLatexQuestionClick = (question: LatexQuestion) => {
    setSelectedLatexQuestion(question);
    setSelectedFolder('');
    // 重置选项
    setSelectedOption('');
    setCustomAnswer('');
    setHasAnswered(false);
    
    // 发送请求获取并打印正确答案
    axios.get('http://localhost:3001/print-correct-answer', {
      params: {
        questionId: question.id,
        questionType: 'latex'
      }
    }).catch(error => {
      console.error('获取正确答案失败:', error);
    });
    
    // 获取题目评分信息
    fetchQuestionRating(question.id, 'latex');
  };

  const handleSubmit = async () => {
    if ((!selectedOption && selectedOption !== 'custom') || 
        (selectedOption === 'custom' && !customAnswer)) {
      message.error('请选择一个选项或输入答案');
      return;
    }

    // 确定最终提交的答案
    const finalAnswer = selectedOption === 'custom' ? customAnswer : selectedOption;

    try {
      // 根据当前选择的题目类型确定提交路径
      let questionPath;
      let questionId = null;
      
      if (selectedLatexQuestion) {
        // 如果是LaTeX题目
        questionPath = selectedLatexQuestion.latex_path;
        questionId = selectedLatexQuestion.id;
      } else if (selectedFolder) {
        // 如果是图片题目
        questionPath = `/prtsc/${subject}/${grade}/${year}/${type}/${selectedFolder}`;
        // 使用文件夹名作为ID
        questionId = generateQuestionId(selectedFolder);
      } else {
        message.error('请选择一个题目');
        return;
      }
      
      const response = await axios.post('http://localhost:3001/submit-answer', {
        userId,
        questionPath,
        questionId,
        selectedOption: finalAnswer,
        questionType: selectedLatexQuestion ? 'latex' : 'image'
      });

      if (response.data.correct) {
        message.success('回答正确！');
      } else {
        message.error('回答错误！');
      }
      
      // 标记已回答，显示打星功能
      setHasAnswered(true);
      setRatingValue(0); // 重置评分
      
      // 获取引用了该题目的帖子
      fetchRelatedPosts(selectedLatexQuestion ? 'latex' : 'image', questionId || undefined, questionPath);
    } catch (error) {
      console.error('提交答案失败:', error);
      message.error('提交答案失败');
    }
  };
  
  // 获取引用了该题目的帖子
  const fetchRelatedPosts = async (questionType: string, questionId?: number, questionPath?: string) => {
    try {
      const response = await axios.get('http://localhost:3003/api/community/posts/by-question', {
        params: {
          questionType,
          questionId,
          questionPath
        }
      });
      
      if (response.data && response.data.length > 0) {
        setRelatedPosts(response.data);
        setShowRelatedPosts(true);
      } else {
        setRelatedPosts([]);
        setShowRelatedPosts(false);
      }
    } catch (error) {
      console.error('获取相关帖子失败:', error);
      setRelatedPosts([]);
      setShowRelatedPosts(false);
    }
  };

  // 工具函数：为图片题目生成唯一ID
  const generateQuestionId = (folderName: string) => {
    // 使用文件夹名称的哈希值作为ID
    let hash = 0;
    for (let i = 0; i < folderName.length; i++) {
      const char = folderName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    // 确保ID为正数
    return Math.abs(hash);
  };

  // 提交打星评分
  const submitRating = async () => {
    if (!userId || ratingValue <= 0) return;
    
    let questionId, questionType;
    
    if (selectedLatexQuestion) {
      questionId = selectedLatexQuestion.id;
      questionType = 'latex';
    } else if (selectedFolder) {
      questionId = generateQuestionId(selectedFolder);
      questionType = 'image';
    } else {
      message.error('无法确定题目信息');
      return;
    }
    
    setRatingSubmitting(true);
    try {
      console.log('提交评分数据:', {
        userId,
        questionId,
        questionType,
        rating: ratingValue,
        teacherId: 11 // 指定教师ID为11
      });
      
      const response = await axios.post('http://localhost:3003/api/community/rate-question', {
        userId,
        questionId,
        questionType,
        rating: ratingValue,
        teacherId: 11 // 指定教师ID为11
      });
      
      if (response.data.success) {
        message.success(`评分成功! 剩余苹果币: ${response.data.remainingApples}`);
        // 禁用评分功能，防止重复提交
        setHasAnswered(false);
      } else if (response.data.error) {
        message.error(response.data.error);
      }
    } catch (error: any) {
      console.error('评分失败:', error);
      // 显示更详细的错误消息
      if (error.response && error.response.data && error.response.data.error) {
        message.error(`评分失败: ${error.response.data.error}`);
      } else if (error.message) {
        message.error(`评分失败: ${error.message}`);
      } else {
        message.error('评分失败，请稍后再试');
      }
    } finally {
      setRatingSubmitting(false);
    }
  };

  // 组件加载时自动执行搜索
  useEffect(() => {
    // 加载后自动执行一次搜索
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 处理AI模式切换
  const handleAiMode = (mode: string) => {
    // 如果当前已经是这个模式，则关闭
    if (aiMode === mode) {
      setAiMode(null);
      console.log(`Exams: 关闭AI模式`);
    } else {
      setAiMode(mode);
      console.log(`Exams: AI模式切换为: ${mode}`);
      
      // 在AI助手打开后，如果有选择的题目，自动传输到AI助手
      if (selectedLatexQuestion || selectedFolder) {
        setTimeout(() => shareTitleWithAI(), 500); // 延迟确保iframe已加载
      }
    }
  };
  
  // 关闭AI对话
  const closeAiDialog = () => {
    setAiMode(null);
  };

  // 向AI助手传递当前题目内容
  const shareTitleWithAI = () => {
    let content = '';
    let success = false;
    
    // 检查数据来源
    if (selectedLatexQuestion) {
      // LaTeX题目
      console.log('发送LaTeX题目到AI助手');
      const result = TextAdapter.sendLatexText(selectedLatexQuestion.latex_code);
      success = result.success;
    } else if (selectedFolder && images.length > 0) {
      // 图片题目
      content = `题目文件夹: ${selectedFolder}`;
      console.log('发送图片题目到AI助手, 图片URL:', `http://localhost:3001${images[0].url}`);
      
      // 使用图片适配器
      const result = ImageAdapter.sendImage(
        `http://localhost:3001${images[0].url}`, 
        content
      );
      success = result.success;
    } else {
      // 没有选中任何题目
      message.info('请先选择一个题目');
      return;
    }
    
    if (success) {
      message.success('已将题目内容发送到AI助手！');
    } else {
      message.warning('发送到AI助手失败，请先打开AI助手窗口');
    }
  };

  return (
    <div style={{ padding: '20px' ,paddingTop: '100px'}}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
        <Select
          style={{ width: 200, marginRight: '10px' }}
          placeholder="选择学科"
            value={subject}
          onChange={(value) => setSubject(value)}
        >
            <Option value="线性代数">线性代数</Option>
            <Option value="数学分析">数学分析</Option>
            <Option value="英语">英语</Option>
            <Option value="大学物理">大学物理</Option>
            <Option value="电磁场">电磁场</Option>
        </Select>

        <Select
          style={{ width: 200, marginRight: '10px' }}
          placeholder="选择年份"
            value={year}
          onChange={(value) => setYear(value)}
        >
          <Option value="2019">2019</Option>
          <Option value="2020">2020</Option>
          <Option value="2021">2021</Option>
          <Option value="2022">2022</Option>
          <Option value="2023">2023</Option>
          <Option value="2024">2024</Option>
          <Option value="2025">2025</Option>
        </Select>

        <Select
          style={{ width: 200, marginRight: '10px' }}
          placeholder="选择类型"
            value={type}
          onChange={(value) => setType(value)}
        >
          <Option value="A卷">A卷</Option>
          <Option value="B卷">B卷</Option>
        </Select>

        <Select
          style={{ width: 200, marginRight: '10px' }}
          placeholder="选择年级"
            value={grade}
          onChange={(value) => setGrade(value)}
        >
          <Option value="大一">大一</Option>
          <Option value="大二">大二</Option>
          <Option value="大三">大三</Option>
        </Select>

        <button
          onClick={handleSearch}
          style={{
            padding: '4px 15px',
            fontSize: '14px',
            borderRadius: '2px',
            border: '1px solid #d9d9d9',
            backgroundColor: '#fff',
            cursor: 'pointer'
          }}
        >
          搜索
        </button>
        </div>
        
        {/* 添加AI助手按钮 */}
        <div>
          <AiButton onSelectMode={handleAiMode} buttonText="AI助手" showDropdown={true} />
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card title="文件夹列表" style={{ marginBottom: '16px' }}>
            {folders.map((folder, index) => (
              <div
                key={index}
                onClick={() => handleFolderClick(folder.name)}
                style={{
                  padding: '8px',
                  cursor: 'pointer',
                  backgroundColor: selectedFolder === folder.name ? '#f0f0f0' : 'transparent'
                }}
              >
                {folder.name}
              </div>
            ))}
          </Card>
          
          {latexQuestions.length > 0 && (
            <Card title="LaTeX题目列表">
              {latexQuestions.map((question, index) => (
                <div
                  key={index}
                  onClick={() => handleLatexQuestionClick(question)}
                  style={{
                    padding: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedLatexQuestion?.id === question.id ? '#f0f0f0' : 'transparent'
                  }}
                >
                  {question.folder_name || `题目 ${index + 1}`}
                </div>
              ))}
            </Card>
          )}
        </Col>
        <Col span={16}>
          {/* 图片题目显示区域 */}
          {selectedFolder && (
            <Card title="图片预览" style={{ marginBottom: '16px' }}>
              <Row gutter={[16, 16]}>
                {images.map((image, index) => (
                  <Col span={index === 0 ? 24 : 8} key={index}>
                    <Image
                      src={`http://localhost:3001${image.url}`}
                      alt={image.name}
                      style={{ width: '100%', height: index === 0 ? '200px' : '100px', objectFit: 'contain' }}
                    />
                  </Col>
                ))}
                {/* 添加传输到AI按钮 */}
                {images.length > 0 && (
                  <Col span={24} style={{ textAlign: 'right', marginTop: '10px' }}>
                    <Button type="primary" onClick={shareTitleWithAI}>
                      发送到AI助手
                    </Button>
                  </Col>
                )}
              </Row>
            </Card>
          )}
          
          {/* LaTeX题目显示区域 */}
          {selectedLatexQuestion && (
            <Card title="LaTeX题目" style={{ marginBottom: '16px' }}>
              <div className="latex-question-container">
                <MathJaxContext>
                  <MathJax dynamic>{selectedLatexQuestion.latex_code}</MathJax>
                </MathJaxContext>
              </div>
              {/* 添加传输到AI按钮 */}
              <div style={{ textAlign: 'right', marginTop: '10px' }}>
                <Button type="primary" onClick={shareTitleWithAI}>
                  发送到AI助手
                </Button>
              </div>
            </Card>
          )}
          
          {/* 答题区域 */}
          <Card title="答题区域">
            <div>
              <Radio.Group onChange={(e) => {
                setSelectedOption(e.target.value);
                if (e.target.value !== 'custom') {
                  setCustomAnswer('');
                }
              }} value={selectedOption}>
                {answerOptions.map(option => (
                  <Radio key={option.value} value={option.value}>{option.label}</Radio>
                ))}
              </Radio.Group>
              
              {selectedOption === 'custom' && (
                <Input 
                  placeholder="请输入您的答案"
                  value={customAnswer}
                  onChange={(e) => setCustomAnswer(e.target.value)}
                  style={{ width: 200, marginTop: '10px' }}
                />
              )}
              
              <Button 
                type="primary" 
                onClick={handleSubmit} 
                style={{ marginLeft: '20px' }}
                disabled={(!selectedOption || (selectedOption === 'custom' && !customAnswer))}
              >
                提交答案
              </Button>
            </div>
            
            {/* 打星区域 - 只在回答后显示 */}
            {hasAnswered && (
              <div style={{ marginTop: '20px', borderTop: '1px dashed #f0f0f0', paddingTop: '15px' }}>
                <h3>为本题打分</h3>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Rate 
                    value={ratingValue}
                    onChange={setRatingValue}
                    style={{ marginRight: '10px' }}
                  />
                  <Button 
                    type="primary" 
                    onClick={submitRating}
                    loading={ratingSubmitting}
                    disabled={ratingValue === 0}
                  >
                    确定
                  </Button>
                </div>
              </div>
            )}
          </Card>
          
          {/* 显示引用了当前题目的帖子 */}
          {showRelatedPosts && relatedPosts.length > 0 && (
            <Card title="引用了此题目的帖子" style={{ marginTop: '16px' }}>
              <div className="related-posts-list">
                {relatedPosts.map(post => (
                  <div key={post.id} className="related-post-item">
                    <h4>
                      <a href={`/post/${post.id}`} target="_blank" rel="noopener noreferrer">
                        {post.title}
                      </a>
                    </h4>
                    <div className="post-meta">
                      <span>作者: {post.author_name}</span>
                      <span>发布时间: {new Date(post.created_at).toLocaleString()}</span>
                      <span>分类: {post.category === 'question' ? '题目交流' : 
                                  post.category === 'study' ? '学习分享' : 
                                  post.category === 'entertainment' ? '娱乐活动' : '疑难解惑'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </Col>
      </Row>
      
      {/* 添加AI对话组件 */}
      <AiDialog mode={aiMode} onClose={closeAiDialog} />
    </div>
  );
};

export default Exams;
