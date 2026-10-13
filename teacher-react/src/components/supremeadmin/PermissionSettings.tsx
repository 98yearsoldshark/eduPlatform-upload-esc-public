import React, { useState, useEffect } from 'react';
import { Tabs, Card, Switch, InputNumber, Form, Button, message, Tag, Collapse } from 'antd';
import { SaveOutlined, ReloadOutlined, SettingOutlined, LockOutlined, TeamOutlined, CommentOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

// const { Option } = Select;

// 组件接口定义
interface PermissionSettingsProps {
  visible: boolean;
}

const PermissionSettings: React.FC<PermissionSettingsProps> = ({ visible }) => {
  const { token, teacher } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [_config, setConfig] = useState<any>(null);
  const [activeKey, setActiveKey] = useState<string>('1');
  
  // 教师角色表单
  const [teacherForm] = Form.useForm();
  // 助教角色表单
  const [assistantForm] = Form.useForm();
  // 管理员角色表单
  const [adminForm] = Form.useForm();
  // 策略配置表单
  const [policiesForm] = Form.useForm();
  // A社区配置表单
  const [communityForm] = Form.useForm();
  
  // 加载权限配置
  const fetchPermissionConfig = async () => {
    setLoading(true);
    try {
      console.log('【权限配置】开始请求权限配置数据');
      console.log('【权限配置】Auth上下文信息:', JSON.stringify({
        tokenExists: !!token,
        teacherExists: !!teacher,
        teacherId: teacher?.id,
        teacherName: teacher?.name
      }));
      console.log('【权限配置】使用的令牌:', token ? `${token.substring(0, 10)}...` : '未找到令牌');
      
      if (!token) {
        message.error('未找到认证令牌，请尝试重新登录');
        setLoading(false);
        return;
      }
      
      // 设置请求头
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      console.log('【权限配置】请求头:', JSON.stringify(headers));
      
      const response = await axios.get('http://localhost:3003/api/config/permissions/config', {
        headers: headers
      });
      
      console.log('【权限配置】请求成功，响应状态:', response.status);
      console.log('【权限配置】响应数据:', JSON.stringify(response.data));
      
      if (response.data.success) {
        console.log('【权限配置】获取到配置数据');
        const configData = response.data.config;
        setConfig(configData);
        
        // 填充表单数据
        if (configData.roles) {
          teacherForm.setFieldsValue(configData.roles.teacher || {});
          assistantForm.setFieldsValue(configData.roles.assistant || {});
          adminForm.setFieldsValue(configData.roles.admin || {});
        }
        
        if (configData.policies) {
          policiesForm.setFieldsValue(configData.policies);
        }
        
        if (configData.community) {
          communityForm.setFieldsValue(configData.community);
        }
      } else {
        console.error('【权限配置】请求返回错误:', response.data.error);
        message.error('获取权限配置失败: ' + response.data.error);
      }
    } catch (error: any) {
      console.error('【权限配置】加载权限配置失败:', error);
      
      // 更详细的错误日志
      if (error.response) {
        // 服务器返回了错误状态码
        console.error('【权限配置】错误状态码:', error.response.status);
        console.error('【权限配置】错误数据:', error.response.data);
        console.error('【权限配置】响应头:', error.response.headers);
        
        // 针对不同错误类型提供不同的错误消息
        if (error.response.status === 401) {
          message.error('身份验证失败，请重新登录');
        } else if (error.response.status === 403) {
          message.error('您没有权限访问此功能');
        } else {
          message.error(`服务器错误 (${error.response.status}): ${error.response.data.error || '未知错误'}`);
        }
      } else if (error.request) {
        // 请求已发送但没有收到响应
        console.error('【权限配置】未收到响应:', error.request);
        message.error('服务器未响应，请检查网络连接');
      } else {
        // 请求设置时发生错误
        console.error('【权限配置】请求错误:', error.message);
        message.error('请求错误: ' + error.message);
      }
      
      // 尝试备用方案 - 测试验证端点
      try {
        console.log('【权限配置】尝试访问认证测试端点');
        const testResponse = await axios.get('http://localhost:3003/api/config/permissions/auth-test', {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('【权限配置】认证测试结果:', testResponse.data);
      } catch (testError) {
        console.error('【权限配置】认证测试失败:', testError);
      }
      
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (visible) {
      fetchPermissionConfig();
    }
  }, [visible, token]);
  
  // 在组件加载时添加console日志
  useEffect(() => {
    console.log('【权限设置】组件已加载，权限表单现在可用于配置权限');
    console.log('【权限设置】教师信息:', teacher);
    console.log('【权限设置】Token状态:', token ? '已存在' : '不存在');
  }, []);
  
  // 保存教师角色权限
  const saveTeacherPermissions = async () => {
    try {
      const values = await teacherForm.validateFields();
      setSaving(true);
      
      const response = await axios.post(
        'http://localhost:3003/api/config/permissions/roles/teacher',
        { role: 'teacher', permissions: values },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        message.success('教师角色权限已更新');
      } else {
        message.error('更新教师角色权限失败: ' + response.data.error);
      }
    } catch (error) {
      console.error('保存教师角色权限失败:', error);
      message.error('保存教师角色权限失败');
    } finally {
      setSaving(false);
    }
  };
  
  // 保存助教角色权限
  const saveAssistantPermissions = async () => {
    try {
      const values = await assistantForm.validateFields();
      setSaving(true);
      
      const response = await axios.post(
        'http://localhost:3003/api/config/permissions/roles/assistant',
        { role: 'assistant', permissions: values },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        message.success('助教角色权限已更新');
      } else {
        message.error('更新助教角色权限失败: ' + response.data.error);
      }
    } catch (error) {
      console.error('保存助教角色权限失败:', error);
      message.error('保存助教角色权限失败');
    } finally {
      setSaving(false);
    }
  };
  
  // 保存管理员角色权限
  const saveAdminPermissions = async () => {
    try {
      const values = await adminForm.validateFields();
      setSaving(true);
      
      const response = await axios.post(
        'http://localhost:3003/api/config/permissions/roles/admin',
        { role: 'admin', permissions: values },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        message.success('管理员角色权限已更新');
      } else {
        message.error('更新管理员角色权限失败: ' + response.data.error);
      }
    } catch (error) {
      console.error('保存管理员角色权限失败:', error);
      message.error('保存管理员角色权限失败');
    } finally {
      setSaving(false);
    }
  };
  
  // 保存策略配置
  const savePolicies = async () => {
    try {
      const values = await policiesForm.validateFields();
      setSaving(true);
      
      const response = await axios.post(
        'http://localhost:3003/api/config/permissions/policies',
        { policies: values },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        message.success('安全策略已更新');
      } else {
        message.error('更新安全策略失败: ' + response.data.error);
      }
    } catch (error) {
      console.error('保存安全策略失败:', error);
      message.error('保存安全策略失败');
    } finally {
      setSaving(false);
    }
  };
  
  // 保存社区配置
  const saveCommunityConfig = async () => {
    try {
      const values = await communityForm.validateFields();
      setSaving(true);
      
      const response = await axios.post(
        'http://localhost:3003/api/config/permissions/community',
        { community: values },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        message.success('社区配置已更新');
      } else {
        message.error('更新社区配置失败: ' + response.data.error);
      }
    } catch (error) {
      console.error('保存社区配置失败:', error);
      message.error('保存社区配置失败');
    } finally {
      setSaving(false);
    }
  };
  
  if (!visible) {
    return null;
  }

  // 定义Tabs项
  const tabsItems = [
    {
      key: '1',
      label: (
        <span>
          <TeamOutlined />
          角色权限
        </span>
      ),
      children: (
        <Collapse 
          accordion 
          defaultActiveKey={['1']} 
          items={[
            {
              key: '1',
              label: "教师角色权限配置",
              children: (
                <Form
                  form={teacherForm}
                  layout="vertical"
                  disabled={loading}
                >
                  <Form.Item
                    name="canAssignAssistant"
                    label="是否可以分配助教角色"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Form.Item
                    name="canViewAllStudents"
                    label="是否可以查看全部学生数据"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Form.Item
                    name="maxClassCount"
                    label="最大管理的班级数"
                  >
                    <InputNumber min={1} max={100} />
                  </Form.Item>
                  
                  <Form.Item
                    name="canDeleteStudentWorks"
                    label="是否可以删除学生提交的作业"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Form.Item
                    name="canModifyQuestions"
                    label="是否可以修改题目库"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Button 
                    type="primary" 
                    icon={<SaveOutlined />} 
                    onClick={saveTeacherPermissions}
                    loading={saving}
                  >
                    保存教师角色配置
                  </Button>
                </Form>
              )
            },
            {
              key: '2',
              label: "助教角色权限配置",
              children: (
                <Form
                  form={assistantForm}
                  layout="vertical"
                  disabled={loading}
                >
                  <Form.Item
                    name="canManageClass"
                    label="是否可以管理班级"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Form.Item
                    name="canGradeAssignments"
                    label="是否可以批改作业"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Form.Item
                    name="canPublishNotifications"
                    label="是否可以发布通知"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Form.Item
                    name="canViewStudentDetails"
                    label="是否可以查看学生详细信息"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Form.Item
                    name="canModerateCommunity"
                    label="是否可以管理社区帖子"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Button 
                    type="primary" 
                    icon={<SaveOutlined />} 
                    onClick={saveAssistantPermissions}
                    loading={saving}
                  >
                    保存助教角色配置
                  </Button>
                </Form>
              )
            },
            {
              key: '3',
              label: "管理员角色权限配置",
              children: (
                <Form
                  form={adminForm}
                  layout="vertical"
                  disabled={loading}
                >
                  <Form.Item
                    name="canAssignTeacher"
                    label="是否可以分配教师角色"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Form.Item
                    name="canAssignAdmin"
                    label="是否可以分配管理员角色"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Form.Item
                    name="canAccessSystemConfig"
                    label="是否可以访问系统配置"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Form.Item
                    name="canViewAllUserData"
                    label="是否可以查看所有用户数据"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Form.Item
                    name="canManageAnnouncements"
                    label="是否可以管理系统公告"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Button 
                    type="primary" 
                    icon={<SaveOutlined />} 
                    onClick={saveAdminPermissions}
                    loading={saving}
                  >
                    保存管理员角色配置
                  </Button>
                </Form>
              )
            }
          ]}
        />
      )
    },
    {
      key: '2',
      label: (
        <span>
          <LockOutlined />
          安全策略
        </span>
      ),
      children: (
        <Form
          form={policiesForm}
          layout="vertical"
          disabled={loading}
        >
          <Form.Item
            name="enableIpWhitelist"
            label="是否启用IP白名单限制"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          
          <Form.Item
            name="maxLoginAttempts"
            label="最大登录失败尝试次数"
          >
            <InputNumber min={1} max={10} />
          </Form.Item>
          
          <Form.Item
            name="accountLockTime"
            label="账号锁定时间(分钟)"
          >
            <InputNumber min={5} max={1440} />
          </Form.Item>
          
          <Form.Item
            name="passwordExpiryDays"
            label="密码有效期(天)，0表示永不过期"
          >
            <InputNumber min={0} max={365} />
          </Form.Item>
          
          <Form.Item
            name="sessionTimeout"
            label="会话有效期(分钟)"
          >
            <InputNumber min={5} max={1440} />
          </Form.Item>
          
          <Form.Item
            name="allowMultipleDevices"
            label="是否允许多设备同时登录"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          
          <Form.Item
            name="logSensitiveOperations"
            label="是否记录敏感操作日志"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={savePolicies}
            loading={saving}
          >
            保存安全策略配置
          </Button>
        </Form>
      )
    },
    {
      key: '3',
      label: (
        <span>
          <CommentOutlined />
          社区功能
        </span>
      ),
      children: (
        <Form
          form={communityForm}
          layout="vertical"
          disabled={loading}
        >
          <Form.Item
            name="enabled"
            label="是否开启社区功能"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          
          <Form.Item label="发帖审核" style={{ marginBottom: 0 }}>
            <Form.Item
              name={['postModeration', 'enabled']}
              label="是否需要审核"
              valuePropName="checked"
              style={{ display: 'inline-block', width: 'calc(50% - 12px)' }}
            >
              <Switch />
            </Form.Item>
          </Form.Item>
          
          <Form.Item label="评论控制" style={{ marginBottom: 0 }}>
            <Form.Item
              name={['commentControl', 'allowAnonymous']}
              label="是否允许匿名评论"
              valuePropName="checked"
              style={{ display: 'inline-block', width: 'calc(50% - 12px)' }}
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name={['commentControl', 'enableWordFilter']}
              label="是否开启敏感词过滤"
              valuePropName="checked"
              style={{ display: 'inline-block', width: 'calc(50% - 12px)', margin: '0 0 0 24px' }}
            >
              <Switch />
            </Form.Item>
          </Form.Item>
          
          <Form.Item
            name={['commentControl', 'maxLength']}
            label="最大评论长度"
          >
            <InputNumber min={10} max={2000} />
          </Form.Item>
          
          <Form.Item label="用户控制" style={{ marginBottom: 0 }}>
            <Form.Item
              name={['userControl', 'requireInvitationCode']}
              label="注册是否需要邀请码"
              valuePropName="checked"
              style={{ display: 'inline-block', width: 'calc(50% - 12px)' }}
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name={['userControl', 'allowUsernameChange']}
              label="是否允许自由更改用户名"
              valuePropName="checked"
              style={{ display: 'inline-block', width: 'calc(50% - 12px)', margin: '0 0 0 24px' }}
            >
              <Switch />
            </Form.Item>
          </Form.Item>
          
          <Form.Item
            name={['userControl', 'usernameChangeCooldown']}
            label="用户名更改冷却期(天)"
          >
            <InputNumber min={1} max={365} />
          </Form.Item>
          
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={saveCommunityConfig}
            loading={saving}
          >
            保存社区配置
          </Button>
        </Form>
      )
    }
  ];
  
  return (
    <Card 
      title={
        <div>
          <SettingOutlined /> 权限控制动态调整
          <Tag color="volcano" style={{ marginLeft: 10 }}>
            企业级安全
          </Tag>
          <Tag color="blue">
            Nacos配置中心
          </Tag>
        </div>
      }
    >
      <Tabs 
        activeKey={activeKey} 
        onChange={setActiveKey}
        items={tabsItems}
      />
      
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={fetchPermissionConfig}
          loading={loading}
          style={{ marginRight: 8 }}
        >
          刷新配置
        </Button>
      </div>
    </Card>
  );
};

export default PermissionSettings; 