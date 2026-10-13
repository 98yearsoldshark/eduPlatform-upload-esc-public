import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Radio, message } from 'antd';
import { UserOutlined, LockOutlined, IdcardOutlined, BankOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const { Title } = Typography;

interface LoginFormValues {
  teacher_id: string;
  password: string;
}

interface RegisterFormValues {
  name: string;
  gender: '男' | '女';
  teacher_id: string;
  phone?: string;
  email?: string;
  wechat?: string;
  school: string;
  password: string;
  confirmPassword: string;
}

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { login } = useAuth();

  const handleLogin = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      // 确保密码是字符串类型
      const loginData = {
        teacher_id: values.teacher_id,
        password: String(values.password) // 确保密码是字符串
      };
      
      console.log('发送登录请求:', JSON.stringify(loginData));
      
      // 使用axios替代fetch进行请求
      const response = await axios.post('http://localhost:3002/login', loginData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('登录响应:', response.data);

      // axios不需要检查response.ok
      // 使用AuthContext提供的login函数
      login(response.data.token, response.data.teacher);
      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      console.error('登录错误:', error);
      
      // 提供更详细的错误信息
      if (error.response) {
        // 服务器返回了错误状态码
        console.error('服务器响应错误:', {
          status: error.response.status,
          data: error.response.data
        });
        
        const errorMessage = error.response.data?.error || 
                             error.response.data?.message || 
                            `登录失败 (${error.response.status})`;
        message.error(errorMessage);
      } else if (error.request) {
        // 请求发送了但没有收到响应
        console.error('未收到服务器响应');
        message.error('服务器未响应，请检查网络连接或服务器状态');
      } else {
        // 设置请求时发生了错误
        message.error(`请求错误: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: RegisterFormValues) => {
    // 验证密码确认
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      // 移除确认密码字段
      const { confirmPassword, ...registerData } = values;

      const response = await fetch('http://localhost:3002/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerData),
      });

      const data = await response.json();

      if (response.ok) {
        message.success('注册成功，请登录');
        setIsLogin(true);
      } else {
        message.error(data.error || '注册失败');
      }
    } catch (error) {
      console.error('注册错误:', error);
      message.error('注册请求失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3}>{isLogin ? '教师登录' : '教师注册'}</Title>
        </div>

        {isLogin ? (
          <Form
            name="login"
            initialValues={{ remember: true }}
            onFinish={handleLogin}
            layout="vertical"
          >
            <Form.Item
              name="teacher_id"
              rules={[{ required: true, message: '请输入教师身份码' }]}
            >
              <Input prefix={<IdcardOutlined />} placeholder="教师身份码" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading}>
                登录
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              还没有账号？
              <a onClick={() => setIsLogin(false)}>立即注册</a>
            </div>
          </Form>
        ) : (
          <Form
            name="register"
            onFinish={handleRegister}
            layout="vertical"
          >
            <Form.Item
              name="name"
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="姓名" />
            </Form.Item>

            <Form.Item
              name="gender"
              initialValue="男"
            >
              <Radio.Group>
                <Radio value="男">男</Radio>
                <Radio value="女">女</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="teacher_id"
              rules={[{ required: true, message: '请输入教师身份码' }]}
            >
              <Input prefix={<IdcardOutlined />} placeholder="教师身份码" />
            </Form.Item>

            <Form.Item name="phone">
              <Input placeholder="手机号（选填）" />
            </Form.Item>

            <Form.Item name="email">
              <Input placeholder="邮箱（选填）" />
            </Form.Item>

            <Form.Item name="wechat">
              <Input placeholder="微信号（选填）" />
            </Form.Item>

            <Form.Item
              name="school"
              rules={[{ required: true, message: '请输入学校' }]}
            >
              <Input prefix={<BankOutlined />} placeholder="学校" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              rules={[{ required: true, message: '请确认密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading}>
                注册
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              已有账号？
              <a onClick={() => setIsLogin(true)}>立即登录</a>
            </div>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default Login;