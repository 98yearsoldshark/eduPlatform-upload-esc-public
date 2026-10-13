import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './styles/CreatePost.css';
import { UserInfo } from '../types/communityTypes';
import { Select, Modal, Card, Row, Col, Image } from 'antd';
import { MathJax, MathJaxContext } from 'better-react-mathjax';

const { Option } = Select;

const CreatePost: React.FC = () => {
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [category, setCategory] = useState<string>('question');
  const [visibility, setVisibility] = useState<'public' | 'friends_only' | 'teacher_hidden'>('public');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // 题目引用相关状态
  const [showQuestionModal, setShowQuestionModal] = useState<boolean>(false);
  const [subject, setSubject] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [grade, setGrade] = useState<string>('');
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [images, setImages] = useState<any[]>([]);
  const [latexQuestions, setLatexQuestions] = useState<any[]>([]);
  const [selectedLatexQuestion, setSelectedLatexQuestion] = useState<any | null>(null);
  const [_questionType, setQuestionType] = useState<'image' | 'latex' | 'both'>('image');
  const [selectedQuestion, setSelectedQuestion] = useState<{
    questionType: 'image' | 'latex';
    questionId?: number;
    questionPath?: string;
    displayName?: string;
  } | null>(null);
  
  const navigate = useNavigate();
  
  // 获取用户信息
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const user = JSON.parse(token).user;
        setUserInfo(user);
      } catch (err) {
        console.error('解析用户信息失败', err);
        setError('获取用户信息失败');
      }
    }
  }, []);
  
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
    
    // 构建完整的文件夹路径
    const fullPath = subject && grade && year && type ? 
      `/prtsc/${subject}/${grade}/${year}/${type}/${folderPath}` : folderPath;
    
    // 设置选中的题目
    setSelectedQuestion({
      questionType: 'image',
      questionPath: fullPath,
      displayName: folderPath
    });
  };
  
  // 处理LaTeX题目点击
  const handleLatexQuestionClick = (question: any) => {
    setSelectedLatexQuestion(question);
    setSelectedFolder('');
    
    // 设置选中的题目
    setSelectedQuestion({
      questionType: 'latex',
      questionId: question.id,
      questionPath: question.latex_path,
      displayName: question.folder_name || `题目 ${question.id}`
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userInfo) {
      setError('用户未登录');
      return;
    }
    
    if (!title.trim()) {
      setError('请输入标题');
      return;
    }
    
    if (!content.trim()) {
      setError('请输入内容');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('http://localhost:3003/api/community/posts', {
        userId: userInfo.id,
        title,
        content,
        category,
        visibility,
        isAnonymous,
        questionRef: selectedQuestion
      });
      
      if (response.data.message.includes('审核中')) {
        alert('帖子已提交，正在审核中');
      } else {
        alert('帖子发布成功');
      }
      
      // 发布成功后返回社区主页
      navigate('/square');
    } catch (err: any) {
      console.error('发布帖子失败', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('发布帖子失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancel = () => {
    navigate('/square');
  };
  
  const openQuestionModal = () => {
    setShowQuestionModal(true);
  };
  
  const closeQuestionModal = () => {
    setShowQuestionModal(false);
  };
  
  const confirmQuestionSelection = () => {
    closeQuestionModal();
  };
  
  const removeSelectedQuestion = () => {
    setSelectedQuestion(null);
    setSelectedFolder('');
    setSelectedLatexQuestion(null);
  };
  
  return (
    <div className="create-post-container">
      <h2>发布帖子</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <form className="create-post-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">标题</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入标题（5-50字）"
            maxLength={50}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="content">内容</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请输入内容"
            rows={10}
            required
          />
        </div>
        
        <div className="form-group">
          <label>引用题目</label>
          <div className="question-reference">
            {selectedQuestion ? (
              <div className="selected-question">
                <span>已选择: {selectedQuestion.displayName}</span>
                <button type="button" className="remove-question-btn" onClick={removeSelectedQuestion}>移除</button>
              </div>
            ) : (
              <button type="button" className="select-question-btn" onClick={openQuestionModal}>选择题目</button>
            )}
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="category">分类</label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="question">题目交流</option>
            <option value="study">学习分享</option>
            <option value="entertainment">娱乐活动</option>
            <option value="help">疑难解惑</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="visibility">可见性</label>
          <select
            id="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'public' | 'friends_only' | 'teacher_hidden')}
          >
            <option value="public">公开</option>
            <option value="friends_only">仅好友可见</option>
            <option value="teacher_hidden">对教师不可见</option>
          </select>
        </div>
        
        <div className="form-group checkbox-group">
          <input
            type="checkbox"
            id="anonymous"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
          />
          <label htmlFor="anonymous">匿名发布</label>
        </div>
        
        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={handleCancel} disabled={loading}>
            取消
          </button>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '发布中...' : '发布'}
          </button>
        </div>
      </form>
      
      {/* 选择题目的模态框 */}
      <Modal
        title="选择引用题目"
        open={showQuestionModal}
        onOk={confirmQuestionSelection}
        onCancel={closeQuestionModal}
        width={1000}
        footer={[
          <button key="cancel" onClick={closeQuestionModal} className="cancel-btn">
            取消
          </button>,
          <button key="submit" onClick={confirmQuestionSelection} className="submit-btn">
            确定
          </button>
        ]}
      >
        <div style={{ marginBottom: '20px' }}>
          <Select
            style={{ width: 200, marginRight: '10px' }}
            placeholder="选择学科"
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
            onChange={(value) => setType(value)}
          >
            <Option value="A卷">A卷</Option>
            <Option value="B卷">B卷</Option>
          </Select>

          <Select
            style={{ width: 200, marginRight: '10px' }}
            placeholder="选择年级"
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
              </Card>
            )}
          </Col>
        </Row>
      </Modal>
    </div>
  );
};

export default CreatePost;