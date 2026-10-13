import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Table, Space, Modal, Form, Input, message, Select, Tabs, Tag, Popconfirm } from 'antd';
import { UserOutlined, DeleteOutlined, EditOutlined, EyeOutlined, SearchOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const { Title, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface UserData {
  id: number;
  name: string;
  email: string;
  school: string;
  classNumber?: string;
  studentId: string;
  roles?: string[];
}

interface PostData {
  id: number;
  title: string;
  content: string;
  category: string;
  visibility: 'public' | 'friends_only' | 'teacher_hidden';
  is_anonymous: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  user_id: number;
  author_name: string;
  comment_count: number;
  like_count: number;
}

interface CommentData {
  id: number;
  post_id: number;
  user_id: number;
  parent_id: number | null;
  content: string;
  created_at: string;
  author_name: string;
}

const Admin: React.FC = () => {
  const { token, teacher } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [userForm] = Form.useForm();
  const [userPagination, setUserPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [postPagination, setPostPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [commentPagination, setCommentPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [currentPost, setCurrentPost] = useState<PostData | null>(null);
  const [isSupremAdmin, setIsSupremAdmin] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [roleForm] = Form.useForm();

  // 检查当前用户是否为最高管理员
  const checkIsSupremAdmin = async () => {
    try {
      const response = await axios.get(`http://localhost:3003/api/community/roles/check-suprem-admin?teacherid=${teacher?.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsSupremAdmin(response.data.isSupremAdmin);
    } catch (error) {
      console.error('检查管理员权限失败:', error);
    }
  };

  useEffect(() => {
    if (teacher?.id) {
      checkIsSupremAdmin();
    }
  }, [teacher]);

  // 获取用户列表
  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      let url = `http://localhost:3003/api/community/roles/users?page=${page}&limit=${userPagination.pageSize}`;
      
      if (searchText) {
        url += `&search=${encodeURIComponent(searchText)}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUsers(response.data.users);
      setUserPagination({
        ...userPagination,
        current: page,
        total: response.data.pagination.total
      });
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取帖子列表
  const fetchPosts = async (page = 1) => {
    setLoading(true);
    try {
      let url = `http://localhost:3003/api/community/posts?page=${page}&limit=${postPagination.pageSize}`;
      
      if (searchText) {
        url += `&search=${encodeURIComponent(searchText)}`;
      }
      
      // 管理员可以看到所有帖子，包括待审核的
      url += '&admin=true';
      
      if (teacher?.id) {
        url += `&userId=${teacher.id}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPosts(response.data.posts);
      setPostPagination({
        ...postPagination,
        current: page,
        total: response.data.pagination.total
      });
    } catch (error) {
      console.error('获取帖子列表失败:', error);
      message.error('获取帖子列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取评论列表
  const fetchComments = async (page = 1) => {
    setLoading(true);
    try {
      let url = `http://localhost:3003/api/community/comments?page=${page}&limit=${commentPagination.pageSize}`;
      
      if (searchText) {
        url += `&search=${encodeURIComponent(searchText)}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setComments(response.data.comments);
      setCommentPagination({
        ...commentPagination,
        current: page,
        total: response.data.pagination.total
      });
    } catch (error) {
      console.error('获取评论列表失败:', error);
      message.error('获取评论列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token, searchText]);

  // 打开用户详情模态框
  const showUserModal = (userData: UserData) => {
    setCurrentUser(userData);
    userForm.resetFields();
    userForm.setFieldsValue({
      name: userData.name,
      email: userData.email,
      school: userData.school,
      classNumber: userData.classNumber,
      studentId: userData.studentId
    });
    setUserModalVisible(true);
  };

  // 关闭用户模态框
  const handleUserCancel = () => {
    setUserModalVisible(false);
  };

  // 更新用户信息
  const handleUserSubmit = async () => {
    try {
      const values = await userForm.validateFields();
      
      await axios.put(`http://localhost:3003/api/community/users/${currentUser?.id}`, {
        ...values,
        operatorId: teacher?.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      message.success('用户信息更新成功');
      setUserModalVisible(false);
      fetchUsers();
    } catch (error) {
      console.error('更新用户信息失败:', error);
      message.error('更新用户信息失败');
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: number) => {
    try {
      await axios.delete(`http://localhost:3003/api/community/users/${userId}`, {
        data: { operatorId: teacher?.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      message.success('用户删除成功');
      fetchUsers();
    } catch (error) {
      console.error('删除用户失败:', error);
      message.error('删除用户失败');
    }
  };

  // 查看帖子详情
  const viewPostDetail = (post: PostData) => {
    setCurrentPost(post);
    setViewModalVisible(true);
  };

  // 删除帖子
  const handleDeletePost = async (postId: number) => {
    try {
      await axios.delete(`http://localhost:3003/api/community/posts/${postId}`, {
        data: { userId: teacher?.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      message.success('帖子删除成功');
      fetchPosts();
    } catch (error) {
      console.error('删除帖子失败:', error);
      message.error('删除帖子失败');
    }
  };

  // 删除评论
  const handleDeleteComment = async (commentId: number) => {
    try {
      await axios.delete(`http://localhost:3003/api/community/comments/${commentId}`, {
        data: { userId: teacher?.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      message.success('评论删除成功');
      fetchComments();
    } catch (error) {
      console.error('删除评论失败:', error);
      message.error('删除评论失败');
    }
  };

  // 打开角色管理模态框
  const showRoleModal = (userData: UserData) => {
    setCurrentUser(userData);
    roleForm.resetFields();
    roleForm.setFieldsValue({
      roles: userData.roles || []
    });
    setRoleModalVisible(true);
  };

  // 关闭角色管理模态框
  const handleRoleCancel = () => {
    setRoleModalVisible(false);
  };

  // 更新用户角色
  const handleRoleSubmit = async () => {
    try {
      const values = await roleForm.validateFields();
      
      await axios.put(`http://localhost:3003/api/community/roles/update-roles`, {
        operatorId: teacher?.id,
        targetUserId: currentUser?.id,
        roles: values.roles
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      message.success('用户角色更新成功');
      setRoleModalVisible(false);
      fetchUsers();
    } catch (error) {
      console.error('更新用户角色失败:', error);
      message.error('更新用户角色失败');
    }
  };

  // 用户表格列定义
  const userColumns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '学号/工号',
      dataIndex: 'studentId',
      key: 'studentId',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: '学校',
      dataIndex: 'school',
      key: 'school',
    },
    {
      title: '班级',
      dataIndex: 'classNumber',
      key: 'classNumber',
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => (
        <>
          {roles && roles.map(role => {
            let color = 'blue';
            if (role === 'admin') color = 'red';
            if (role === 'teacher') color = 'green';
            if (role === 'assistant') color = 'orange';
            return (
              <Tag color={color} key={role}>
                {role === 'admin' ? '管理员' : 
                 role === 'teacher' ? '教师' : 
                 role === 'assistant' ? '助教' : 
                 role === 'student' ? '学生' : role}
              </Tag>
            );
          })}
        </>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: UserData) => {
        // 最高管理员可以编辑所有用户
        // 普通管理员不能编辑其他管理员
        const canEdit = isSupremAdmin || 
                        !record.roles?.includes('admin') || 
                        record.id === teacher?.id;
        
        return (
          <Space size="middle">
            {canEdit && (
              <>
                <Button 
                  type="text" 
                  icon={<EditOutlined />} 
                  onClick={() => showUserModal(record)}
                >
                  编辑
                </Button>
                <Button 
                  type="text" 
                  icon={<UserOutlined />} 
                  onClick={() => showRoleModal(record)}
                >
                  角色
                </Button>
                <Popconfirm
                  title="确定要删除这个用户吗？"
                  onConfirm={() => handleDeleteUser(record.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />}
                  >
                    删除
                  </Button>
                </Popconfirm>
              </>
            )}
            {!canEdit && (
              <span style={{ color: '#999' }}>无权操作</span>
            )}
          </Space>
        );
      },
    },
  ];

  // 帖子表格列定义
  const postColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '作者',
      dataIndex: 'author_name',
      key: 'author_name',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: '评论数',
      dataIndex: 'comment_count',
      key: 'comment_count',
    },
    {
      title: '点赞数',
      dataIndex: 'like_count',
      key: 'like_count',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        if (status === 'pending') return <span style={{ color: 'orange' }}>待审核</span>;
        if (status === 'approved') return <span style={{ color: 'green' }}>已通过</span>;
        if (status === 'rejected') return <span style={{ color: 'red' }}>已拒绝</span>;
        return status;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: PostData) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EyeOutlined />} 
            onClick={() => viewPostDetail(record)}
          >
            查看
          </Button>
          
          {record.status === 'pending' && (
            <>
              <Button 
                type="text" 
                style={{ color: 'green' }}
                icon={<CheckCircleOutlined />}
                onClick={() => approvePost(record.id)}
              >
                通过
              </Button>
              <Button 
                type="text" 
                danger
                icon={<StopOutlined />}
                onClick={() => rejectPost(record.id)}
              >
                拒绝
              </Button>
            </>
          )}
          
          <Popconfirm
            title="确定要删除这篇帖子吗？"
            onConfirm={() => handleDeletePost(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 评论表格列定义
  const commentColumns = [
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '作者',
      dataIndex: 'author_name',
      key: 'author_name',
    },
    {
      title: '帖子ID',
      dataIndex: 'post_id',
      key: 'post_id',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CommentData) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EyeOutlined />} 
            onClick={() => viewPostWithComment(record.post_id)}
          >
            查看帖子
          </Button>
          
          <Popconfirm
            title="确定要删除这条评论吗？"
            onConfirm={() => handleDeleteComment(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 查看包含评论的帖子
  const viewPostWithComment = async (postId: number) => {
    try {
      const response = await axios.get(`http://localhost:3003/api/community/posts/${postId}?userId=${teacher?.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCurrentPost(response.data);
      setViewModalVisible(true);
    } catch (error) {
      console.error('获取帖子详情失败:', error);
      message.error('获取帖子详情失败');
    }
  };

  // 审核帖子 - 通过
  const approvePost = async (postId: number) => {
    try {
      await axios.put(`http://localhost:3003/api/community/posts/${postId}/approve`, {
        userId: teacher?.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      message.success('帖子已批准');
      fetchPosts();
    } catch (error) {
      console.error('批准帖子失败:', error);
      message.error('批准帖子失败');
    }
  };

  // 审核帖子 - 拒绝
  const rejectPost = async (postId: number) => {
    try {
      await axios.put(`http://localhost:3003/api/community/posts/${postId}/reject`, {
        userId: teacher?.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      message.success('帖子已拒绝');
      fetchPosts();
    } catch (error) {
      console.error('拒绝帖子失败:', error);
      message.error('拒绝帖子失败');
    }
  };

  return (
    <div className="admin-container">
      <Tabs
        defaultActiveKey="users"
        items={[
          {
            key: 'users',
            label: '用户管理',
            children: (
              <div style={{ marginTop: '20px' }}>
                <Input.Search
                  placeholder="搜索用户"
                  allowClear
                  onSearch={(value) => {
                    setSearchText(value);
                    fetchUsers(1);
                  }}
                  style={{ width: 200, marginBottom: '20px' }}
                />
                <Table
                  columns={userColumns}
                  dataSource={users}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    ...userPagination,
                    onChange: (page) => fetchUsers(page)
                  }}
                />
              </div>
            )
          },
          {
            key: 'posts',
            label: '帖子管理',
            children: (
              <div style={{ marginTop: '20px' }}>
                <Input.Search
                  placeholder="搜索帖子"
                  allowClear
                  onSearch={(value) => {
                    setSearchText(value);
                    fetchPosts(1);
                  }}
                  style={{ width: 200, marginBottom: '20px' }}
                />
                <Table
                  columns={postColumns}
                  dataSource={posts}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    ...postPagination,
                    onChange: (page) => fetchPosts(page)
                  }}
                />
              </div>
            )
          },
          {
            key: 'comments',
            label: '评论管理',
            children: (
              <div style={{ marginTop: '20px' }}>
                <Input.Search
                  placeholder="搜索评论"
                  allowClear
                  onSearch={(value) => {
                    setSearchText(value);
                    fetchComments(1);
                  }}
                  style={{ width: 200, marginBottom: '20px' }}
                />
                <Table
                  columns={commentColumns}
                  dataSource={comments}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    ...commentPagination,
                    onChange: (page) => fetchComments(page)
                  }}
                />
              </div>
            )
          }
        ]}
      />
      {/* 用户编辑模态框 */}
      <Modal
        title="编辑用户信息"
        open={userModalVisible}
        onOk={handleUserSubmit}
        onCancel={handleUserCancel}
        width={600}
      >
        <Form
          form={userForm}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true, message: '请输入邮箱' }]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          
          <Form.Item
            name="school"
            label="学校"
          >
            <Input placeholder="请输入学校" />
          </Form.Item>
          
          <Form.Item
            name="classNumber"
            label="班级"
          >
            <Input placeholder="请输入班级" />
          </Form.Item>
          
          <Form.Item
            name="studentId"
            label="学号/工号"
            rules={[{ required: true, message: '请输入学号/工号' }]}
          >
            <Input placeholder="请输入学号/工号" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 角色管理模态框 */}
      <Modal
        title="管理用户角色"
        open={roleModalVisible}
        onOk={handleRoleSubmit}
        onCancel={handleRoleCancel}
        width={500}
      >
        <Form
          form={roleForm}
          layout="vertical"
        >
          <Form.Item
            name="roles"
            label="角色"
            rules={[{ required: true, message: '请选择至少一个角色' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择角色"
              style={{ width: '100%' }}
              disabled={!isSupremAdmin && currentUser?.roles?.includes('admin')}
            >
              <Option value="student">学生</Option>
              <Option value="assistant">助教</Option>
              <Option value="teacher">教师</Option>
              {isSupremAdmin && <Option value="admin">管理员</Option>}
            </Select>
          </Form.Item>
          
          {!isSupremAdmin && currentUser?.roles?.includes('admin') && (
            <div style={{ color: 'red' }}>
              注意：只有最高管理员才能修改管理员角色
            </div>
          )}
        </Form>
      </Modal>

      {/* 查看帖子详情模态框 */}
      <Modal
        title="帖子详情"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={null}
        width={700}
      >
        {currentPost && (
          <div>
            <h2>{currentPost.title}</h2>
            <p>作者: {currentPost.author_name}</p>
            <p>分类: {currentPost.category}</p>
            <p>发布时间: {new Date(currentPost.created_at).toLocaleString()}</p>
            <div style={{ marginTop: 20, marginBottom: 20, whiteSpace: 'pre-wrap' }}>
              {currentPost.content}
            </div>
            
            {currentPost.comments && currentPost.comments.length > 0 && (
              <div>
                <h3>评论 ({currentPost.comments.length})</h3>
                <div style={{ marginLeft: 20 }}>
                  {currentPost.comments.map((comment: any) => (
                    <div key={comment.id} style={{ marginBottom: 15, borderBottom: '1px solid #f0f0f0', paddingBottom: 10 }}>
                      <p>
                        <strong>{comment.author_name}</strong> 
                        <span style={{ color: '#999', marginLeft: 10, fontSize: 12 }}>
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </p>
                      <p>{comment.content}</p>
                      
                      {comment.replies && comment.replies.length > 0 && (
                        <div style={{ marginLeft: 20 }}>
                          {comment.replies.map((reply: any) => (
                            <div key={reply.id} style={{ marginBottom: 10, borderLeft: '2px solid #f0f0f0', paddingLeft: 10 }}>
                              <p>
                                <strong>{reply.author_name}</strong> 
                                <span style={{ color: '#999', marginLeft: 10, fontSize: 12 }}>
                                  {new Date(reply.created_at).toLocaleString()}
                                </span>
                              </p>
                              <p>{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Admin;