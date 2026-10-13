import React, { useState, useEffect } from 'react';
import { Card, Form, Switch, InputNumber, Select, Button, message, Tabs, Tag, Divider, Input, Alert } from 'antd';
import { SaveOutlined, ReloadOutlined, UserAddOutlined, TeamOutlined, SafetyOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

// const { Option } = Select;
const { TabPane } = Tabs;

// 组件接口定义
interface RegisterConfigurationProps {
  visible: boolean;
}

const RegisterConfiguration: React.FC<RegisterConfigurationProps> = ({ visible }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [_config, setConfig] = useState<any>(null);
  const [activeKey, setActiveKey] = useState<string>('1');
  
  // 学生端注册配置表单
  const [studentRegisterForm] = Form.useForm();
  // 教师端注册配置表单
  const [teacherRegisterForm] = Form.useForm();
  // 注册安全配置表单
  const [securityForm] = Form.useForm();
  
  // 加载注册配置
  const fetchRegisterConfig = async () => {
    setLoading(true);
    try {
      console.log('【注册配置】开始请求注册配置数据');
      console.log('【注册配置】使用的令牌:', token ? `${token.substring(0, 10)}...` : '未找到令牌');
      
      if (!token) {
        message.error('未找到认证令牌，请尝试重新登录');
        setLoading(false);
        return;
      }
      
      const response = await axios.get('http://localhost:3003/api/config/permissions/register-config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('【注册配置】请求成功，响应数据:', JSON.stringify(response.data));
      
      if (response.data.success) {
        const configData = response.data.config || {
          studentRegister: {
            enabled: true,
            requireEmail: true,
            requirePhone: true,
            allowOpenRegistration: true,
            maxAccountsPerIp: 5,
            registerCooldown: 60
          },
          teacherRegister: {
            enabled: true,
            maxRegisterPerTeacherId: 5,
            requireApproval: false,
            allowSelfRegister: true,
            requireSchool: true
          },
          security: {
            useRecaptcha: false,
            recaptchaKey: '',
            allowPasswordReset: true,
            minimumPasswordLength: 3,
            restrictedDomains: [],
            restrictedEmails: []
          }
        };
        
        setConfig(configData);
        
        // 填充表单数据
        studentRegisterForm.setFieldsValue(configData.studentRegister || {});
        teacherRegisterForm.setFieldsValue(configData.teacherRegister || {});
        securityForm.setFieldsValue(configData.security || {});
      } else {
        console.error('【注册配置】请求返回错误:', response.data.error);
        message.error('获取注册配置失败: ' + response.data.error);
        
        // 设置默认值
        const defaultConfig = {
          studentRegister: {
            enabled: true,
            requireEmail: true,
            requirePhone: true,
            allowOpenRegistration: true,
            maxAccountsPerIp: 5,
            registerCooldown: 60
          },
          teacherRegister: {
            enabled: true,
            maxRegisterPerTeacherId: 5,
            requireApproval: false,
            allowSelfRegister: true,
            requireSchool: true
          },
          security: {
            useRecaptcha: false,
            recaptchaKey: '',
            allowPasswordReset: true,
            minimumPasswordLength: 3,
            restrictedDomains: [],
            restrictedEmails: []
          }
        };
        setConfig(defaultConfig);
        studentRegisterForm.setFieldsValue(defaultConfig.studentRegister);
        teacherRegisterForm.setFieldsValue(defaultConfig.teacherRegister);
        securityForm.setFieldsValue(defaultConfig.security);
      }
    } catch (error: any) {
      console.error('【注册配置】加载注册配置失败:', error);
      message.error('加载注册配置失败: ' + (error.response?.data?.error || error.message));
      
      // 设置默认配置
      const defaultConfig = {
        studentRegister: {
          enabled: true,
          requireEmail: true,
          requirePhone: true,
          allowOpenRegistration: true,
          maxAccountsPerIp: 5,
          registerCooldown: 60
        },
        teacherRegister: {
          enabled: true,
          maxRegisterPerTeacherId: 5,
          requireApproval: false,
          allowSelfRegister: true,
          requireSchool: true
        },
        security: {
          useRecaptcha: false,
          recaptchaKey: '',
          allowPasswordReset: true,
          minimumPasswordLength: 3,
          restrictedDomains: [],
          restrictedEmails: []
        }
      };
      setConfig(defaultConfig);
      studentRegisterForm.setFieldsValue(defaultConfig.studentRegister);
      teacherRegisterForm.setFieldsValue(defaultConfig.teacherRegister);
      securityForm.setFieldsValue(defaultConfig.security);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (visible) {
      fetchRegisterConfig();
    }
  }, [visible]);
  
  // 保存学生端注册配置
  const saveStudentRegisterConfig = async () => {
    try {
      const values = await studentRegisterForm.validateFields();
      setSaving(true);
      
      const response = await axios.post(
        'http://localhost:3003/api/config/permissions/register-config/student',
        { studentRegister: values },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        message.success('学生端注册配置已更新');
      } else {
        message.error('更新学生端注册配置失败: ' + response.data.error);
      }
    } catch (error: any) {
      console.error('保存学生端注册配置失败:', error);
      message.error('保存学生端注册配置失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };
  
  // 保存教师端注册配置
  const saveTeacherRegisterConfig = async () => {
    try {
      const values = await teacherRegisterForm.validateFields();
      setSaving(true);
      
      const response = await axios.post(
        'http://localhost:3003/api/config/permissions/register-config/teacher',
        { teacherRegister: values },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        message.success('教师端注册配置已更新');
      } else {
        message.error('更新教师端注册配置失败: ' + response.data.error);
      }
    } catch (error: any) {
      console.error('保存教师端注册配置失败:', error);
      message.error('保存教师端注册配置失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };
  
  // 保存安全配置
  const saveSecurityConfig = async () => {
    try {
      const values = await securityForm.validateFields();
      setSaving(true);
      
      const response = await axios.post(
        'http://localhost:3003/api/config/permissions/register-config/security',
        { security: values },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        message.success('注册安全配置已更新');
      } else {
        message.error('更新注册安全配置失败: ' + response.data.error);
      }
    } catch (error: any) {
      console.error('保存注册安全配置失败:', error);
      message.error('保存注册安全配置失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };
  
  if (!visible) {
    return null;
  }
  
  return (
    <Card 
      title={
        <div>
          <UserAddOutlined /> 注册功能配置
          <Tag color="volcano" style={{ marginLeft: 10 }}>
            访问控制
          </Tag>
          <Tag color="blue">
            Nacos配置中心
          </Tag>
        </div>
      }
    >
      <Alert
        message="说明"
        description="本页面修改的配置将实时影响系统的注册功能，请谨慎操作。配置更改后，新的注册请求将立即应用新的设置。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Tabs 
        activeKey={activeKey} 
        onChange={setActiveKey}
      >
        <TabPane 
          tab={<span><TeamOutlined />学生端注册配置</span>} 
          key="1"
        >
          <Form
            form={studentRegisterForm}
            layout="vertical"
            disabled={loading}
          >
            <Form.Item
              name="enabled"
              label="是否启用学生注册功能"
              valuePropName="checked"
              tooltip="关闭后，学生将无法通过前端页面注册新账号"
            >
              <Switch />
            </Form.Item>
            
            <Form.Item
              name="requireEmail"
              label="是否必须提供邮箱"
              valuePropName="checked"
              tooltip="开启后，注册时必须提供有效的邮箱地址"
            >
              <Switch />
            </Form.Item>
            
            <Form.Item
              name="requirePhone"
              label="是否必须提供手机号"
              valuePropName="checked"
              tooltip="开启后，注册时必须提供有效的手机号码"
            >
              <Switch />
            </Form.Item>
            
            <Form.Item
              name="allowOpenRegistration"
              label="允许开放注册"
              valuePropName="checked"
              tooltip="开启后，任何人都可以注册；关闭后，只有通过邀请才能注册"
            >
              <Switch />
            </Form.Item>
            
            <Form.Item
              name="maxAccountsPerIp"
              label="单个IP最多注册账号数"
              tooltip="限制同一IP地址可以注册的最大账号数量，防止批量注册"
            >
              <InputNumber min={1} max={100} />
            </Form.Item>
            
            <Form.Item
              name="registerCooldown"
              label="注册冷却时间(秒)"
              tooltip="同一IP地址两次注册之间需要等待的时间，防止频繁注册"
            >
              <InputNumber min={0} max={3600} />
            </Form.Item>
            
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              onClick={saveStudentRegisterConfig}
              loading={saving}
            >
              保存学生端注册配置
            </Button>
          </Form>
        </TabPane>
        
        <TabPane 
          tab={<span><TeamOutlined />教师端注册配置</span>} 
          key="2"
        >
          <Form
            form={teacherRegisterForm}
            layout="vertical"
            disabled={loading}
          >
            <Form.Item
              name="enabled"
              label="是否启用教师注册功能"
              valuePropName="checked"
              tooltip="关闭后，教师将无法通过前端页面注册新账号"
            >
              <Switch />
            </Form.Item>
            
            <Form.Item
              name="maxRegisterPerTeacherId"
              label="单个教师ID最多注册账号数"
              tooltip="限制同一教师ID可以注册的最大账号数量，防止滥用"
            >
              <InputNumber min={1} max={10} />
            </Form.Item>
            
            <Form.Item
              name="requireApproval"
              label="教师注册是否需要管理员审核"
              valuePropName="checked"
              tooltip="开启后，新教师注册需要管理员手动审核通过后才能使用"
            >
              <Switch />
            </Form.Item>
            
            <Form.Item
              name="allowSelfRegister"
              label="允许教师自主注册"
              valuePropName="checked"
              tooltip="关闭后，只有管理员可以创建教师账号"
            >
              <Switch />
            </Form.Item>
            
            <Form.Item
              name="requireSchool"
              label="是否必须填写学校信息"
              valuePropName="checked"
              tooltip="开启后，教师注册时必须填写所属学校信息"
            >
              <Switch />
            </Form.Item>
            
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              onClick={saveTeacherRegisterConfig}
              loading={saving}
            >
              保存教师端注册配置
            </Button>
          </Form>
        </TabPane>
        
        <TabPane 
          tab={<span><SafetyOutlined />注册安全配置</span>} 
          key="3"
        >
          <Form
            form={securityForm}
            layout="vertical"
            disabled={loading}
          >
            <Form.Item
              name="useRecaptcha"
              label="启用reCAPTCHA验证"
              valuePropName="checked"
              tooltip="开启后，注册时需要通过Google reCAPTCHA验证，防止机器人注册"
            >
              <Switch />
            </Form.Item>
            
            <Form.Item
              name="recaptchaKey"
              label="reCAPTCHA站点密钥"
              tooltip="从Google reCAPTCHA官网获取的站点密钥"
              rules={[{ required: securityForm.getFieldValue('useRecaptcha'), message: '启用reCAPTCHA时必须提供站点密钥' }]}
            >
              <Input placeholder="请输入reCAPTCHA站点密钥" disabled={!securityForm.getFieldValue('useRecaptcha')} />
            </Form.Item>
            
            <Form.Item
              name="allowPasswordReset"
              label="是否允许密码重置"
              valuePropName="checked"
              tooltip="开启后，用户可以通过邮箱重置密码；关闭后，只能由管理员重置"
            >
              <Switch />
            </Form.Item>
            
            <Form.Item
              name="minimumPasswordLength"
              label="最小密码长度"
              tooltip="设置注册时密码的最小长度要求"
            >
              <InputNumber min={3} max={20} />
            </Form.Item>
            
            <Divider>域名和邮箱限制</Divider>
            
            <Form.Item
              label="受限制的域名"
              tooltip="设置不允许注册的邮箱域名，如 spam.com"
              name="restrictedDomains"
            >
              <Select
                mode="tags"
                style={{ width: '100%' }}
                placeholder="输入域名后按Enter添加"
                tokenSeparators={[',']}
              />
            </Form.Item>
            
            <Form.Item
              label="受限制的邮箱"
              tooltip="设置不允许注册的特定邮箱地址"
              name="restrictedEmails"
            >
              <Select
                mode="tags"
                style={{ width: '100%' }}
                placeholder="输入邮箱后按Enter添加"
                tokenSeparators={[',']}
              />
            </Form.Item>
            
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              onClick={saveSecurityConfig}
              loading={saving}
            >
              保存安全配置
            </Button>
          </Form>
        </TabPane>
      </Tabs>
      
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={fetchRegisterConfig}
          loading={loading}
          style={{ marginRight: 8 }}
        >
          刷新配置
        </Button>
      </div>
    </Card>
  );
};

export default RegisterConfiguration; 