import React, { useState, useEffect } from 'react';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
import axios from 'axios';
import './Profile.css';
// import './css/try1.css';
import './css/join-class.css'
import { parseToken, decodeObject } from './utils/authUtils';

const Profile = () => {
  const [classCode, setClassCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [joinedClasses, setJoinedClasses] = useState<any[]>([]);
  const [studentId, setStudentId] = useState('');
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState('');

  // 显示localStorage中的所有数据（用于调试）
  const debugLocalStorage = () => {
    console.log('==== DEBUG: localStorage内容 ====');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        console.log(`${key}: ${value?.substring(0, 100)}${value && value.length > 100 ? '...' : ''}`);
      }
    }
    console.log('================================');
  };

  // 获取学生信息
  useEffect(() => {
    // 调试输出localStorage内容
    debugLocalStorage();
    
    // 使用认证工具函数获取用户信息
    const userInfo = parseToken();
    // parseToken已经处理了中文编码问题
    
    if (userInfo) {
      console.log('Profile组件：成功获取用户信息', userInfo);
      
      // 确保所有关键字段都存在
      const processedInfo = {
        id: userInfo.id,
        name: userInfo.name || '未设置',
        email: userInfo.email || '未设置',
        school: userInfo.school || '未设置',
        phone: userInfo.phone || '未设置',
        classNumber: userInfo.classNumber || '未设置',
        studentId: userInfo.studentId || '未设置'
      };
      
      setStudentId(String(processedInfo.id));
      setStudentInfo(processedInfo);
      
        // 获取学生已加入的班级
      fetchJoinedClasses(String(processedInfo.id));
    } else {
      console.error('Profile组件：无法获取用户信息，请重新登录');
      setMessage({ text: '无法获取用户信息，请重新登录', type: 'error' });
    }
  }, []);

  // 获取学生已加入的班级列表
  const fetchJoinedClasses = async (id: string) => {
    setClassLoading(true);
    setClassError('');
    
    try {
      console.log('正在获取学生班级信息，ID:', id);
      
      // 设置请求超时时间为10秒
      const response = await axios.get(`http://localhost:3002/classes/students/${id}/classes`, {
        timeout: 10000 // 10秒超时
      });
      
      // 确保response.data是数组
      const classesData = Array.isArray(response.data) ? response.data : [];
      
      // 处理中文字段
      const processedClasses = classesData.map(cls => decodeObject(cls, ['name', 'description']));
      
      setJoinedClasses(processedClasses);
      console.log('成功获取学生班级信息:', processedClasses);
    } catch (error: any) {
      console.error('获取已加入班级失败-pagination:', error);
      
      // 提供更详细的错误信息
      let errorMsg = '获取班级信息失败';
      if (error.code === 'ECONNABORTED') {
        errorMsg = '连接超时，请检查网络或服务器状态';
      } else if (error.response) {
        errorMsg = `服务器返回错误: ${error.response.status}`;
      } else if (error.message) {
        errorMsg = `请求错误: ${error.message}`;
      }
      
      setClassError(errorMsg);
      // 发生错误时设置为空数组
      setJoinedClasses([]);
    } finally {
      setClassLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('jsonToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userInfo');
    window.location.href = '/';
  };

  const equation = String.raw`
\begin{aligned}&\text{4. 下面表达式中不属于本构方程的是（D）} \\&\text{A.} \quad \vec{D} = \varepsilon \vec{E}, \\&\text{B.} \quad \vec{J} = \sigma \vec{E}, \\&\text{C.} \quad \mu \vec{H} = \vec{B}, \\&\text{D.} \quad \nabla \cdot \vec{J} = -\frac{\partial \rho}{\partial t}\end{aligned}

\begin{aligned} &\text{4.下面表达式中不属于本构方程的是（D）} \\ &\text{A.} \quad \vec{D} = \varepsilon \vec{E}, \\ &\text{B.} \quad \vec{J} = \sigma \vec{E}, \\ &\text{C.} \quad \mu \vec{H} = \vec{B}, \\ &\text{D.} \quad \nabla \cdot \vec{J} = -\frac{\partial \rho}{\partial t} \end{aligned}




`;

  // 配置 MathJax，确保加载 ams 包
  const config = {

  };

  // 处理加入班级
  const handleJoinClass = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!classCode.trim()) {
      setMessage({ text: '请输入班级码', type: 'error' });
      return;
    }
    
    if (!studentId) {
      setMessage({ text: '无法获取学生信息，请重新登录', type: 'error' });
      return;
    }
    
    setLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      // 调用后端API加入班级
      const response = await axios.post('http://localhost:3002/classes/join', {
        student_id: studentId,
        class_code: classCode
      });
      
      setMessage({ text: response.data.message, type: 'success' });
      setClassCode('');
      
      // 刷新已加入的班级列表
      fetchJoinedClasses(studentId);
    } catch (error) {
      console.error('加入班级失败:', error);
      const errorMessage = (error as any).response?.data?.error || '加入班级失败，请稍后再试';
      setMessage({ text: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-container">
      <header className="profile-header">
        <h1>我的页面</h1>
        <button className="logout-button" onClick={handleLogout}>
          退出登录
        </button>
      </header>
      <main className="profile-content">
        {/* 个人信息展示 */}
        {studentInfo ? (
          <section className="student-info-section">
            <h3>个人信息</h3>
            <div className="student-info">
              <p><strong>姓名:</strong> {studentInfo.name || '未设置'}</p>
              <p><strong>学校:</strong> {studentInfo.school || '未设置'}</p>
              <p><strong>班级:</strong> {studentInfo.classNumber || '未设置'}</p>
              <p><strong>学号:</strong> {studentInfo.studentId || '未设置'}</p>
              <p><strong>邮箱:</strong> {studentInfo.email || '未设置'}</p>
              <p><strong>手机:</strong> {studentInfo.phone || '未设置'}</p>
            </div>
          </section>
        ) : (
          <section className="student-info-section">
            <h3>个人信息</h3>
            <div className="loading-info">
              正在加载用户信息...
              {message.text && (
                <div className={`message ${message.type}`}>
                  {message.text}
                </div>
              )}
            </div>
          </section>
        )}
        
        {/* 加入班级表单 */}
        <section className="join-class-section">
          <h3>加入班级</h3>
          <form onSubmit={handleJoinClass} className="join-class-form">
            <div className="form-group">
              <input
                type="text"
                placeholder="请输入班级码"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                disabled={loading}
                className="class-code-input"
              />
              <button type="submit" disabled={loading} className="join-button">
                {loading ? '加入中...' : '加入班级'}
              </button>
            </div>
            {message.text && (
              <div className={`message ${message.type}`}>
                {message.text}
              </div>
            )}
          </form>
        </section>
        
        {/* 已加入的班级列表 */}
        <section className="joined-classes-section">
          <h3>我的班级</h3>
          {classLoading ? (
            <div className="loading-classes">正在加载班级信息...</div>
          ) : classError ? (
            <div className="class-error">
              <p>{classError}</p>
              <button onClick={() => fetchJoinedClasses(studentId)} className="retry-button">
                重试
              </button>
            </div>
          ) : Array.isArray(joinedClasses) && joinedClasses.length > 0 ? (
            <ul className="class-list">
              {joinedClasses.map((cls) => (
                <li key={cls.id} className="class-item">
                  <div className="class-name">{cls.name}</div>
                  <div className="class-description">{cls.description}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-classes">您还没有加入任何班级</p>
          )}
        </section>

        <section className="equation-section">
          <h3>电磁场方程：</h3>
          <div className="equation-container">
            <MathJaxContext version={3} config={config} onStartup={(_mathJax) => {
              console.log('MathJax配置:', config);
              console.log('LaTeX内容:', equation);
              // 尝试获取处理后的LaTeX
              setTimeout(() => {
                const mathElements = document.querySelectorAll('.MathJax');
                console.log('渲染后的MathJax元素:', mathElements);
                if (mathElements.length > 0) {
                  console.log('MathJax HTML内容:', mathElements[0].outerHTML);
                }
              }, 1000);
            }}>
              <div style={{ textAlign: 'left', width: '100%' }}>
                {/* dynamic=false 提高渲染稳定性 */}
                <MathJax>{equation}</MathJax>
              </div>
            </MathJaxContext>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Profile;
