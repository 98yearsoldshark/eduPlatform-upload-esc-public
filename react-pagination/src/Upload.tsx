import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
import './Upload.css';

interface AnswerOption {
  value: string;
  label: string;
}

const Upload = () => {
  const [subject, setSubject] = useState('线性代数');
  const [year, setYear] = useState('2019');
  const [type, setType] = useState('A卷');
  const [grade, setGrade] = useState('大一');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [uploadType, setUploadType] = useState<'image' | 'latex'>('image');
  const [latexCode, setLatexCode] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('A');
  const [customAnswer, setCustomAnswer] = useState('');
  // const navigate = useNavigate();
  
  const answerOptions: AnswerOption[] = [
    { value: 'A', label: 'A' },
    { value: 'B', label: 'B' },
    { value: 'C', label: 'C' },
    { value: 'D', label: 'D' },
    { value: 'custom', label: '其他' }
  ];
  
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证表单
    if (uploadType === 'image' && files.length === 0) {
      setNotification({ show: true, message: '请选择要上传的图片文件', type: 'error' });
      return;
    }
    
    if (uploadType === 'latex' && !latexCode.trim()) {
      setNotification({ show: true, message: '请输入LaTeX代码', type: 'error' });
      return;
    }

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('grade', grade);
    formData.append('year', year);
    formData.append('type', type);
    formData.append('note', note);
    formData.append('upload_type', uploadType);
    
    // 处理正确答案
    const finalCorrectAnswer = correctAnswer === 'custom' ? customAnswer : correctAnswer;
    formData.append('correct_answer', finalCorrectAnswer);
    
    if (uploadType === 'image') {
      // 处理图片上传
      const sortedFiles = files.sort((a, b) => a.name.localeCompare(b.name));
      const renamedFiles = sortedFiles.map((file, index) => {
        const letter = String.fromCharCode(65 + index);
        const extension = file.name.split('.').pop();
        return new File([file], `${letter}.${extension}`, { type: file.type });
      });
      
      renamedFiles.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });
      formData.append('file_count', files.length.toString());
    } else {
      // 处理LaTeX代码上传
      formData.append('latex_code', latexCode);
    }

    try {
      const response = await fetch('http://localhost:3001/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setNotification({ show: true, message: '上传成功！', type: 'success' });
        // 重置表单状态，以便用户可以继续上传新文件
        if (uploadType === 'image') {
          setFiles([]);
        } else {
          setLatexCode('');
        }
        setNote('');
        setCorrectAnswer('A');
        setCustomAnswer('');
      } else {
        throw new Error('上传失败');
      }
    } catch (error) {
      console.error('上传出错:', error);
      setNotification({ show: true, message: `上传失败，请稍后重试。错误详情: ${(error as Error).message}`, type: 'error' });
    }
  };

  return (
    <div className="upload-container">
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
      <h2>上传题目</h2>
      
      {/* 上传类型选择 */}
      <div className="upload-tabs">
        <button 
          className={`tab-button ${uploadType === 'image' ? 'active' : ''}`}
          onClick={() => setUploadType('image')}
          type="button"
        >
          上传图片
        </button>
        <button 
          className={`tab-button ${uploadType === 'latex' ? 'active' : ''}`}
          onClick={() => setUploadType('latex')}
          type="button"
        >
          上传LaTeX代码
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        {/* 通用字段 */}
        <div>
          <label>学科:</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="线性代数">线性代数</option>
            <option value="数学分析">数学分析</option>
            <option value="英语">英语</option>
            <option value="大学物理">大学物理</option>
            <option value="电磁场">电磁场</option>
          </select>
        </div>
        <div>
          <label>年份:</label>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="2019">2019</option>
            <option value="2020">2020</option>
            <option value="2021">2021</option>
            <option value="2022">2022</option>
            <option value="2023">2023</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
          </select>
        </div>
        <div>
          <label>题目类型:</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="A卷">A卷</option>
            <option value="B卷">B卷</option>
            <option value="补考">补考</option>
          </select>
        </div>
        <div>
          <label>年级:</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="大一">大一</option>
            <option value="大二">大二</option>
            <option value="大三">大三</option>
          </select>
        </div>
        <div>
          <label>备注:</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        
        {/* 根据上传类型显示不同的上传区域 */}
        {uploadType === 'image' ? (
          <div>
            <label>选择文件:</label>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              required={uploadType === 'image'}
            />
            
            {/* 添加图片上传的正确答案选择 */}
            <div className="answer-section">
              <label>正确答案:</label>
              <div className="answer-options">
                {answerOptions.map((option) => (
                  <label key={option.value} className="answer-option">
                    <input
                      type="radio"
                      name="correctAnswer"
                      value={option.value}
                      checked={correctAnswer === option.value}
                      onChange={() => setCorrectAnswer(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              
              {correctAnswer === 'custom' && (
                <div className="custom-answer">
                  <label>自定义答案:</label>
                  <textarea
                    value={customAnswer}
                    onChange={(e) => setCustomAnswer(e.target.value)}
                    placeholder="请输入自定义答案..."
                    required={correctAnswer === 'custom'}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="latex-upload-section">
            <div>
              <label>LaTeX代码:</label>
              <textarea
                value={latexCode}
                onChange={(e) => setLatexCode(e.target.value)}
                required={uploadType === 'latex'}
                rows={10}
                placeholder="请输入LaTeX代码..."
                className="latex-textarea"
              />
            </div>
            
            <div className="answer-section">
              <label>正确答案:</label>
              <div className="answer-options">
                {answerOptions.map((option) => (
                  <label key={option.value} className="answer-option">
                    <input
                      type="radio"
                      name="correctAnswer"
                      value={option.value}
                      checked={correctAnswer === option.value}
                      onChange={() => setCorrectAnswer(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              
              {correctAnswer === 'custom' && (
                <div className="custom-answer">
                  <label>自定义答案:</label>
                  <textarea
                    value={customAnswer}
                    onChange={(e) => setCustomAnswer(e.target.value)}
                    placeholder="请输入自定义答案..."
                    required={correctAnswer === 'custom'}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        
        <button type="submit">上传</button>
      </form>
    </div>
  );
};

export default Upload;