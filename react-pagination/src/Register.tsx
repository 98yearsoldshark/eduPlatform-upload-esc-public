import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/auth.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    school: '',
    classNumber: '',
    studentId: '',
    name: '',
    wechat: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 清除该字段的错误信息
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // 验证手机号
    if (!formData.phone) {
      newErrors.phone = '手机号不能为空';
    } 
    // else if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
    //   newErrors.phone = '请输入有效的手机号';
    // }
    
    // 验证邮箱
    if (!formData.email) {
      newErrors.email = '邮箱不能为空';
    } 
    // else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    //   newErrors.email = '请输入有效的邮箱地址';
    // }
    
    // 验证密码
    if (!formData.password) {
      newErrors.password = '密码不能为空';
    } 
    // else if (formData.password.length < 6) {
    //   newErrors.password = '密码长度不能少于6个字符';
    // }
    
    // 验证确认密码
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }
    
    // 验证姓名
    if (!formData.name) {
      newErrors.name = '姓名不能为空';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // 移除确认密码字段，因为后端API不需要
      const { confirmPassword, ...submitData } = formData;
      
      const response = await fetch('http://localhost:3001/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();
      
      if (response.ok) {
        // 注册成功
        alert('注册成功！请登录');
        navigate('/');
      } else {
        // 注册失败，显示错误信息
        alert(data.error || '注册失败，请稍后重试');
      }
    } catch (error) {
      console.error('注册出错:', error);
      alert(`网络错误，请稍后重试。错误详情: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToLogin = () => {
    navigate('/');
  };

  return (
    <div className="register-container">
      <h2>注册账号</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>手机号 <span className="required">*</span></label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="请输入手机号"
          />
          {errors.phone && <span className="error">{errors.phone}</span>}
        </div>
        
        <div className="form-group">
          <label>邮箱 <span className="required">*</span></label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="请输入邮箱"
          />
          {errors.email && <span className="error">{errors.email}</span>}
        </div>
        
        <div className="form-group">
          <label>密码 <span className="required">*</span></label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="请输入密码（至少6个字符）"
          />
          {errors.password && <span className="error">{errors.password}</span>}
        </div>
        
        <div className="form-group">
          <label>确认密码 <span className="required">*</span></label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="请再次输入密码"
          />
          {errors.confirmPassword && <span className="error">{errors.confirmPassword}</span>}
        </div>
        
        <div className="form-group">
          <label>姓名 <span className="required">*</span></label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="请输入姓名"
          />
          {errors.name && <span className="error">{errors.name}</span>}
        </div>
        
        <div className="form-group">
          <label>学校</label>
          <input
            type="text"
            name="school"
            value={formData.school}
            onChange={handleChange}
            placeholder="请输入学校名称（选填）"
          />
        </div>
        
        <div className="form-group">
          <label>班级</label>
          <input
            type="text"
            name="classNumber"
            value={formData.classNumber}
            onChange={handleChange}
            placeholder="请输入班级（选填）"
          />
        </div>
        
        <div className="form-group">
          <label>学号</label>
          <input
            type="text"
            name="studentId"
            value={formData.studentId}
            onChange={handleChange}
            placeholder="请输入学号（选填）"
          />
        </div>
        
        <div className="form-group">
          <label>微信号</label>
          <input
            type="text"
            name="wechat"
            value={formData.wechat}
            onChange={handleChange}
            placeholder="请输入微信号（选填）"
          />
        </div>
        
        <div className="form-actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '注册中...' : '注册'}
          </button>
          <button type="button" onClick={goToLogin} className="secondary-button">
            返回登录
          </button>
        </div>
      </form>
    </div>
  );
};

export default Register;