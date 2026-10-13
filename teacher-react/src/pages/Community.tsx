import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Table, Space, Modal, Form, Input, message, Select, Tabs, Tooltip, Popconfirm, Tag, Image, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, EyeOutlined, CommentOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionContext';
import axios from 'axios';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
import { useLocation } from 'react-router-dom';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

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
  questionRef?: {
    question_type: 'image' | 'latex';
    question_id?: number;
    question_path?: string;
  };
}

interface UserData {
  id: number;
  name: string;
  email: string;
  school: string;
  classNumber?: string;
  studentId: string;
  isAssistant?: boolean; // 添加助教身份标识
}

const Community: React.FC = () => {
  const { token, teacher } = useAuth();
  const { permissions } = usePermissions();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<PostData | null>(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [currentPost, setCurrentPost] = useState<PostData | null>(null);
  const [userSearchText, setUserSearchText] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<UserData[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [questionImages, setQuestionImages] = useState<any[]>([]);
  const [questionLatex, setQuestionLatex] = useState<any | null>(null);
  const [questionId, setQuestionId] = useState<string>(''); // 添加题目编号状态
  const [debugMode, setDebugMode] = useState<boolean>(true); // 添加调试模式状态
  const [comments, setComments] = useState<any[]>([]);
  const [commentLoading, setCommentLoading] = useState<boolean>(false);
  const [showDebugInfo, setShowDebugInfo] = useState<boolean>(false);
  
  // 添加useLocation钩子获取URL参数
  const location = useLocation();
  
  // 配置MathJax
  const config = {
    loader: { load: ["[tex]/ams"] },
    tex: {
      packages: {"[+]": ["ams"]},
      inlineMath: [["$", "$"]],
      displayMath: [["$$", "$$"]]
    }
  };

  // 修复帖子数据中的questionRef
  const processPostsData = (postsData: PostData[]): PostData[] => {
    console.log('处理帖子数据...');
    return postsData.map(post => {
      // 创建一个新对象，避免直接修改原始数据
      const processedPost = { ...post };
      
      // 处理questionRef
      if (processedPost.questionRef) {
        if (typeof processedPost.questionRef === 'string') {
          try {
            console.log(`帖子 ${post.id} 的questionRef是字符串，尝试解析为对象`);
            processedPost.questionRef = JSON.parse(processedPost.questionRef as any);
            console.log(`帖子 ${post.id} 的questionRef解析结果:`, processedPost.questionRef);
          } catch (e) {
            console.error(`帖子 ${post.id} 的questionRef解析失败:`, e);
            // 如果解析失败，设置为undefined以避免类型错误
            processedPost.questionRef = undefined;
          }
        }
      }
      
      return processedPost;
    });
  };

  // 获取帖子列表
  const fetchPosts = async (page = 1, tab = activeTab) => {
    setLoading(true);
    try {
      let url = `http://localhost:3003/api/community/posts?page=${page}&limit=${pagination.pageSize}`;
      
      // 根据标签筛选不同状态的帖子
      if (tab === 'pending') {
        url += '&status=pending';
      } else if (tab === 'approved') {
        url += '&status=approved';
      } else if (tab === 'rejected') {
        url += '&status=rejected';
      } else if (tab === 'all') {
        // 不添加status参数，表示获取所有状态的帖子
        // 这需要后端支持不传status参数时返回所有帖子
      }
      
      // 添加搜索条件
      if (searchText) {
        url += `&search=${encodeURIComponent(searchText)}`;
      }
      
      // 如果是教师，添加教师ID
      if (teacher?.id) {
        url += `&userId=${teacher.id}`;
      }
      
      console.log('获取帖子列表, URL:', url);
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('获取到帖子列表:', response.data.posts);
      
      // 处理帖子数据，修复可能的questionRef格式问题
      const processedPosts = processPostsData(response.data.posts);
      
      // 检查帖子数据是否包含questionRef
      processedPosts.forEach((post: PostData, index: number) => {
        console.log(`帖子 ${index+1} (ID: ${post.id}) 是否引用题目: ${post.questionRef ? '是' : '否'}`);
        if (post.questionRef) {
          console.log(`帖子 ${index+1} 题目引用详情:`, post.questionRef);
        }
      });
      
      setPosts(processedPosts);
      setPagination({
        ...pagination,
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

  useEffect(() => {
    fetchPosts();
  }, [token, searchText]);

  // 检查URL参数中是否包含postId，如果有则显示帖子详情
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const postIdParam = params.get('postId');
    
    if (postIdParam && teacher?.id) {
      const postId = parseInt(postIdParam, 10);
      console.log('从URL参数中获取到帖子ID:', postId);
      
      // 先检查是否已经显示了该帖子
      if (currentPost && currentPost.id === postId && viewModalVisible) {
        console.log('已经显示了该帖子，不需要重复加载');
        return;
      }
      
      // 检查当前列表是否有该帖子
      if (posts.length > 0) {
        const targetPost = posts.find(post => post.id === postId);
        
        if (targetPost) {
          // 在当前列表中找到帖子，直接显示详情
          console.log('从当前列表中找到帖子，显示详情:', targetPost);
          viewPostDetail(targetPost);
          return;
        }
      }
      
      // 如果未在当前列表中找到，或列表为空，直接通过API获取帖子详情
      console.log('未在当前列表中找到帖子ID:', postId, '通过API获取');
      fetchCompletePostDetail(postId);
    }
  }, [location.search, teacher?.id]);

  // 打开创建/编辑帖子模态框
  const showModal = (postData?: PostData) => {
    setEditingPost(postData || null);
    form.resetFields();
    if (postData) {
      form.setFieldsValue({
        title: postData.title,
        content: postData.content,
        category: postData.category,
        visibility: postData.visibility,
        is_anonymous: !!postData.is_anonymous
      });
    }
    setModalVisible(true);
  };

  // 关闭模态框
  const handleCancel = () => {
    setModalVisible(false);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const postData = {
        ...values,
        userId: teacher?.id,
        is_anonymous: values.is_anonymous ? 1 : 0
      };
      
      if (editingPost) {
        // 更新帖子
        await axios.put(`http://localhost:3003/api/community/posts/${editingPost.id}`, postData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success('帖子更新成功');
      } else {
        // 创建帖子
        await axios.post('http://localhost:3003/api/community/posts', postData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success('帖子创建成功');
      }
      
      setModalVisible(false);
      fetchPosts();
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  // 删除帖子
  const handleDelete = async (postId: number) => {
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

  // 添加一个辅助函数来检查帖子数据
  const checkPostData = (post: PostData) => {
    console.log('==== 检查帖子数据 ====');
    console.log('帖子ID:', post.id);
    console.log('标题:', post.title);
    console.log('作者:', post.author_name);
    console.log('是否有questionRef:', !!post.questionRef);
    
    if (post.questionRef) {
      console.log('questionRef详情:', post.questionRef);
      
      // 检查questionRef的结构
      if (typeof post.questionRef === 'string') {
        console.log('警告: questionRef是字符串而不是对象');
        try {
          // 尝试解析JSON字符串
          const parsedRef = JSON.parse(post.questionRef as any);
          console.log('解析后的questionRef:', parsedRef);
          
          // 临时修复: 如果是字符串，尝试转换为对象
          if (typeof post.questionRef === 'string') {
            post.questionRef = JSON.parse(post.questionRef as any);
            console.log('已将字符串转换为对象:', post.questionRef);
          }
        } catch (e) {
          console.error('无法解析questionRef字符串:', e);
        }
      } 
      
      // 检查必要的属性
      if (post.questionRef) {
        const { question_type, question_id, question_path } = post.questionRef;
        console.log('题目类型:', question_type);
        console.log('题目ID:', question_id);
        console.log('题目路径:', question_path);
        
        if (!question_type) {
          console.error('缺少question_type属性');
        }
        
        if (question_type === 'latex' && !question_id) {
          console.error('LaTeX题目缺少question_id属性');
        }
        
        if (question_type === 'image' && !question_path) {
          console.error('图片题目缺少question_path属性');
        }
      }
    }
    
    console.log('==== 检查结束 ====');
    return post;
  };

  // 查看帖子详情
  const viewPostDetail = (post: PostData) => {
    console.log('查看帖子详情:', post);
    
    // 在设置帖子之前检查数据
    const checkedPost = checkPostData(post);
    setCurrentPost(checkedPost);
    setViewModalVisible(true);
    
    // 重置题目内容状态
    setQuestionImages([]);
    setQuestionLatex(null);
    
    // 如果帖子引用了题目，获取题目内容
    if (checkedPost.questionRef) {
      console.log('发现帖子引用了题目:', checkedPost.questionRef);
      
      // ===== 关键修改：通过单独的API获取完整的帖子详情 =====
      // 参考 PostDetail.tsx 的实现，可能完整的帖子详情包含更多信息
      if (teacher?.id) {
        fetchCompletePostDetail(checkedPost.id);
      } else {
        fetchQuestionContent(checkedPost.questionRef);
      }
    } else {
      console.log('帖子没有引用题目');
    }
  };
  
  // 获取完整帖子详情的函数
  const fetchCompletePostDetail = async (postId: number) => {
    if (!teacher?.id) return;
    
    console.log('正在获取完整帖子详情, ID:', postId);
    try {
      // 显示加载状态
      setLoading(true);
      
      // 使用单独的API获取完整帖子信息
      const response = await axios.get(`http://localhost:3003/api/community/posts/${postId}`, {
        params: { userId: teacher.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('获取到完整帖子详情:', response.data);
      
      // 重置题目内容状态
      setQuestionImages([]);
      setQuestionLatex(null);
      
      // 处理获取到的帖子数据
      const completePost = checkPostData(response.data);
      
      // 更新当前帖子并打开模态框
      setCurrentPost(completePost);
      setViewModalVisible(true);
      
      // 获取评论数据
      if (response.data.comments) {
        setComments(response.data.comments);
      } else {
        // 如果帖子详情中没有包含评论，单独获取评论
        fetchComments(postId);
      }
      
      // 如果帖子引用了题目，获取题目内容
      if (completePost.questionRef) {
        console.log('完整详情中的题目引用:', completePost.questionRef);
        fetchQuestionContent(completePost.questionRef);
      } else {
        console.log('完整帖子详情中没有引用题目');
      }
    } catch (error) {
      console.error('获取完整帖子详情失败:', error);
      message.error('获取帖子详情失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 添加获取帖子评论的函数
  const fetchComments = async (postId: number) => {
    if (!teacher?.id) return;
    
    setCommentLoading(true);
    try {
      const response = await axios.get(`http://localhost:3003/api/community/posts/${postId}/comments`, {
        params: { userId: teacher.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('获取到帖子评论:', response.data);
      setComments(response.data || []);
    } catch (error) {
      console.error('获取帖子评论失败:', error);
    } finally {
      setCommentLoading(false);
    }
  };
  
  // 获取引用题目的内容
  // 参考 PostDetail.tsx 和 Exams.tsx 中的实现
  const fetchQuestionContent = async (questionRef: any) => {
    if (!questionRef) {
      console.error('questionRef为空，无法获取题目内容');
      return;
    }
    
    console.log('获取题目内容，题目引用:', questionRef);
    
    // 添加一个安全检查以处理可能的字符串情况
    let processedRef = questionRef;
    if (typeof questionRef === 'string') {
      console.log('questionRef是字符串，尝试解析为JSON');
      try {
        processedRef = JSON.parse(questionRef);
        console.log('解析成功:', processedRef);
      } catch (error) {
        console.error('解析questionRef字符串失败:', error);
        return;
      }
    }
    
    // 提取关键属性
    const question_type = processedRef.question_type;
    const question_id = processedRef.question_id;
    const question_path = processedRef.question_path;
    
    console.log('引用类型:', question_type);
    console.log('题目ID:', question_id);
    console.log('题目路径:', question_path);
    
    if (!question_type) {
      console.error('questionRef缺少question_type属性');
      return;
    }
    
    try {
      // 提取题目编号
      let extractedQuestionId = '';
      
      if (question_type === 'latex' && question_id) {
        // ===== LaTeX题目处理 =====
        console.log('尝试获取LaTeX题目，ID:', question_id);
        try {
          // API调用与 Exams.tsx 和 PostDetail.tsx 保持一致
          const response = await axios.get(`http://localhost:3001/latex-questions`, {
            params: { id: question_id }
          });
          console.log('LaTeX题目API响应状态:', response.status);
          console.log('LaTeX题目API响应:', response.data);
          
          // 处理响应数据可能是数组的情况
          if (Array.isArray(response.data)) {
            console.log('LaTeX响应是数组，长度:', response.data.length);
            // 从数组中找到匹配的题目ID
            const matchedQuestion = response.data.find(item => Number(item.id) === Number(question_id));
            console.log('找到匹配的题目?', !!matchedQuestion);
            
            if (matchedQuestion && matchedQuestion.latex_code) {
              console.log('成功获取LaTeX代码:', matchedQuestion.latex_code.substring(0, 100) + '...');
              
              // 确保LaTeX代码不包含多余的$$符号
              let latexCode = matchedQuestion.latex_code;
              latexCode = latexCode.replace(/^\$\$|\$\$$/g, '');
              matchedQuestion.latex_code = latexCode;
              
              console.log('处理后的LaTeX代码:', latexCode.substring(0, 100) + '...');
              setQuestionLatex(matchedQuestion);
              
              // 设置题目编号
              if (matchedQuestion.folder_name) {
                extractedQuestionId = matchedQuestion.folder_name;
              } else if (matchedQuestion.path) {
                const pathParts = matchedQuestion.path.split('/');
                extractedQuestionId = pathParts[pathParts.length - 1] || '';
              }
            } else {
              console.error('在数组中未找到匹配的LaTeX题目或缺少latex_code字段');
              // 尝试不严格匹配
              const looseMatch = response.data.find(item => String(item.id) === String(question_id));
              if (looseMatch && looseMatch.latex_code) {
                console.log('使用非严格匹配找到题目');
                let latexCode = looseMatch.latex_code;
                latexCode = latexCode.replace(/^\$\$|\$\$$/g, '');
                looseMatch.latex_code = latexCode;
                setQuestionLatex(looseMatch);
                
                // 设置题目编号
                if (looseMatch.folder_name) {
                  extractedQuestionId = looseMatch.folder_name;
                } else if (looseMatch.path) {
                  const pathParts = looseMatch.path.split('/');
                  extractedQuestionId = pathParts[pathParts.length - 1] || '';
                }
              }
            }
          } else if (response.data && response.data.latex_code) {
            // 处理响应是单个对象的情况
            console.log('LaTeX响应是单个对象');
            console.log('成功获取LaTeX代码:', response.data.latex_code.substring(0, 100) + '...');
            
            // 确保LaTeX代码不包含多余的$$符号
            let latexCode = response.data.latex_code;
            latexCode = latexCode.replace(/^\$\$|\$\$$/g, '');
            response.data.latex_code = latexCode;
            
            console.log('处理后的LaTeX代码:', latexCode.substring(0, 100) + '...');
            setQuestionLatex(response.data);
            
            // 设置题目编号
            if (response.data.folder_name) {
              extractedQuestionId = response.data.folder_name;
            } else if (response.data.path) {
              const pathParts = response.data.path.split('/');
              extractedQuestionId = pathParts[pathParts.length - 1] || '';
            }
          } else {
            console.error('LaTeX题目响应中缺少latex_code字段');
          }
        } catch (error) {
          console.error('获取LaTeX题目失败:', error);
        }
      } else if (question_type === 'image' && question_path) {
        // ===== 图片题目处理 =====
        console.log('尝试获取图片题目，路径:', question_path);
        
        // 确保路径格式正确，参考 Exams.tsx 的实现
        const formattedPath = question_path.startsWith('/prtsc/') 
          ? question_path.replace('/prtsc/', '') 
          : question_path;
        
        console.log('处理后的文件夹路径:', formattedPath);
        
        try {
          // API调用与 Exams.tsx 保持一致
          const response = await axios.get(`http://localhost:3001/images`, {
            params: { folderPath: formattedPath }
          });
          
          console.log('图片API响应状态:', response.status);
          console.log('图片API响应:', response.data);
          
          if (response.data && response.data.length > 0) {
            console.log('找到图片数量:', response.data.length);
            setQuestionImages(response.data);
            
            // 从路径中提取题目编号
            const pathParts = formattedPath.split('/');
            extractedQuestionId = pathParts[pathParts.length - 1] || '';
          } else {
            console.error('没有找到图片');
            
            // 尝试替代路径，与 Exams.tsx 处理方式保持一致
            const altPath = formattedPath.includes('prtsc')
              ? formattedPath
              : `prtsc/${formattedPath}`;
            
            console.log('尝试替代路径:', altPath);
            
            const altResponse = await axios.get(`http://localhost:3001/images`, {
              params: { folderPath: altPath }
            });
            
            if (altResponse.data && altResponse.data.length > 0) {
              console.log('使用替代路径找到图片数量:', altResponse.data.length);
              setQuestionImages(altResponse.data);
              
              // 从替代路径中提取题目编号
              const altPathParts = altPath.split('/');
              extractedQuestionId = altPathParts[altPathParts.length - 1] || '';
            } else {
              console.error('使用替代路径仍未找到图片');
              
              // 最后尝试直接使用原始路径
              const originalResponse = await axios.get(`http://localhost:3001/images`, {
                params: { folderPath: question_path }
              });
              
              if (originalResponse.data && originalResponse.data.length > 0) {
                console.log('使用原始路径找到图片数量:', originalResponse.data.length);
                setQuestionImages(originalResponse.data);
                
                // 从原始路径中提取题目编号
                const origPathParts = question_path.split('/');
                extractedQuestionId = origPathParts[origPathParts.length - 1] || '';
              }
            }
          }
        } catch (error) {
          console.error('获取图片失败:', error);
        }
      } else {
        console.error('不支持的题目类型或缺少必要参数');
      }
      
      // 设置题目编号
      setQuestionId(extractedQuestionId);
      console.log('提取的题目编号:', extractedQuestionId);
      
      // 检查状态更新
      setTimeout(() => {
        console.log('状态检查 - 题目ID:', questionId);
        console.log('状态检查 - 帖子ID:', currentPost?.id);
        console.log('状态检查 - questionLatex:', !!questionLatex);
        console.log('状态检查 - questionImages:', questionImages.length);
        console.log('状态检查 - questionRef:', currentPost?.questionRef);
      }, 300);
    } catch (error) {
      console.error('获取引用题目内容失败:', error);
    }
  };

  // 审核帖子
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

  // 拒绝帖子
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

  // 搜索用户
  const searchUsers = async () => {
    if (!userSearchText) return;
    
    setUserSearchLoading(true);
    try {
      const response = await axios.get(`http://localhost:3003/api/community/users/search?query=${encodeURIComponent(userSearchText)}&userId=${teacher?.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchedUsers(response.data);
    } catch (error) {
      console.error('搜索用户失败:', error);
      message.error('搜索用户失败');
    } finally {
      setUserSearchLoading(false);
    }
  };

  // 分配助教角色
  const assignAssistantRole = async (studentId: string) => {
    try {
      // 检查权限
      if (!permissions.canAssignAssistant) {
        message.error('您没有分配助教的权限');
        return;
      }
      
      await axios.post('http://localhost:3003/api/community/roles/assign-assistant', {
        teacherId: teacher?.id,
        studentId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('已成功分配助教角色');
      setUserSearchText('');
      setSearchedUsers([]);
    } catch (error: any) {
      console.error('分配助教角色失败:', error);
      if (error.response?.status === 403) {
        message.error('权限不足：您没有分配助教的权限');
      } else {
        message.error('分配助教角色失败');
      }
    }
  };

  // 表格列定义
  const columns = [
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
                onClick={() => approvePost(record.id)}
              >
                通过
              </Button>
              <Button 
                type="text" 
                danger
                onClick={() => rejectPost(record.id)}
              >
                拒绝
              </Button>
            </>
          )}
          
          <Popconfirm
            title="确定要删除这篇帖子吗？"
            onConfirm={() => handleDelete(record.id)}
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

  // 用户搜索结果表格列
  const userColumns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '学号',
      dataIndex: 'studentId',
      key: 'studentId',
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
      title: '身份',
      key: 'role',
      render: (_: any, record: UserData & { isAssistant?: boolean }) => (
        record.isAssistant ? 
          <span><Tag color="blue">助教</Tag></span> : 
          <span><Tag color="default">学生</Tag></span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: UserData & { isAssistant?: boolean }) => (
        record.isAssistant ? 
        <Tooltip title="该用户已是助教">
          <Button 
            type="default" 
            size="small"
            disabled
          >
            已是助教
          </Button>
        </Tooltip> :
        <Button 
          type="primary" 
          size="small"
          onClick={() => assignAssistantRole(record.studentId)}
          disabled={!permissions.canAssignAssistant}
        >
          分配助教角色
        </Button>
      ),
    },
  ];

  // 添加切换调试模式的函数
  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
    console.log('调试模式:', !debugMode);
  };

  // 在组件底部添加调试模式开关
  const renderDebugToggle = () => {
    if (!debugMode) return null;
    
    return (
      <div style={{ 
        position: 'fixed', 
        bottom: 10, 
        right: 10, 
        padding: '5px 10px',
        background: '#f0f0f0',
        border: '1px solid #ccc',
        borderRadius: 4,
        cursor: 'pointer',
        zIndex: 1000
      }}
      onClick={toggleDebugMode}
      >
        调试模式: {debugMode ? '开启' : '关闭'}
      </div>
    );
  };

  // 添加格式化评论日期的函数
  const formatCommentDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) {
      return '刚刚';
    } else if (diffMins < 60) {
      return `${diffMins}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 30) {
      return `${diffDays}天前`;
    } else {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }
  };
  
  // 递归渲染评论的函数
  const renderComments = (commentsList: any[]) => {
    return commentsList.map(comment => (
      <div key={comment.id} style={{ 
        marginBottom: '16px', 
        padding: '12px', 
        borderRadius: '4px', 
        backgroundColor: '#f9f9f9'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <Space>
            <strong>{comment.author_name || '用户'}</strong>
            {comment.user_id === teacher?.id && <Tag color="blue">我</Tag>}
          </Space>
          <span style={{ color: '#999' }}>{formatCommentDate(comment.created_at)}</span>
        </div>
        
        <div style={{ marginBottom: '8px' }}>{comment.content}</div>
        
        {comment.replies && comment.replies.length > 0 && (
          <div style={{ marginLeft: '20px', paddingLeft: '12px', borderLeft: '2px solid #f0f0f0' }}>
            {renderComments(comment.replies)}
          </div>
        )}
      </div>
    ));
  };

  // 添加删除后缺失的函数
  // 当模态框关闭时，重置状态
  const handleViewModalClose = () => {
    console.log('关闭帖子详情模态框');
    setViewModalVisible(false);
    setQuestionImages([]);
    setQuestionLatex(null);
    setQuestionId('');
    setComments([]); // 重置评论
    setShowDebugInfo(false); // 重置调试信息显示状态
  };

  return (
    <div className="community-container">
      <Tabs
        defaultActiveKey="all"
        onChange={(key) => {
          setActiveTab(key);
          fetchPosts(1, key);
        }}
        items={[
          {
            key: 'all',
            label: '所有帖子',
            children: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <Typography>
                  <Title level={4}>社区广场</Title>
                  <Paragraph>管理社区帖子，发布教师公告</Paragraph>
                </Typography>
                <Space>
                  <Input.Search
                    placeholder="搜索帖子"
                    allowClear
                    onSearch={(value) => {
                      setSearchText(value);
                      fetchPosts(1);
                    }}
                    style={{ width: 200 }}
                  />
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => showModal()}
                  >
                    发布帖子
                  </Button>
                </Space>
              </div>
            )
          },
          {
            key: 'pending',
            label: '待审核',
            children: (
              <div style={{ marginTop: '20px' }}>
                <Table
                  columns={columns}
                  dataSource={posts}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    ...pagination,
                    onChange: (page) => fetchPosts(page, 'pending')
                  }}
                />
              </div>
            )
          },
          {
            key: 'approved',
            label: '已批准',
            children: (
              <div style={{ marginTop: '20px' }}>
                <Table
                  columns={columns}
                  dataSource={posts}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    ...pagination,
                    onChange: (page) => fetchPosts(page, 'approved')
                  }}
                />
              </div>
            )
          },
          {
            key: 'rejected',
            label: '已拒绝',
            children: (
              <div style={{ marginTop: '20px' }}>
                <Table
                  columns={columns}
                  dataSource={posts}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    ...pagination,
                    onChange: (page) => fetchPosts(page, 'rejected')
                  }}
                />
              </div>
            )
          },
          {
            key: 'assistant',
            label: '助教管理',
            children: (
              <div style={{ marginTop: '20px' }}>
                <Input.Search
                  placeholder="搜索用户（姓名、学号、学校）"
                  loading={userSearchLoading}
                  value={userSearchText}
                  onChange={(e) => setUserSearchText(e.target.value)}
                  onSearch={searchUsers}
                  style={{ width: 300, marginBottom: '20px' }}
                />
                {searchedUsers.length > 0 && (
                  <Table
                    columns={userColumns}
                    dataSource={searchedUsers}
                    rowKey="id"
                    pagination={false}
                  />
                )}
              </div>
            )
          }
        ]}
      />

      {/* 创建/编辑帖子模态框 */}
      <Modal
        title={editingPost ? '编辑帖子' : '发布帖子'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            visibility: 'public',
            is_anonymous: false
          }}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入帖子标题" />
          </Form.Item>
          
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="请选择分类">
              <Option value="公告">公告</Option>
              <Option value="学习">学习</Option>
              <Option value="讨论">讨论</Option>
              <Option value="问答">问答</Option>
              <Option value="分享">分享</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea rows={6} placeholder="请输入帖子内容" />
          </Form.Item>
          
          <Form.Item
            name="visibility"
            label="可见性"
          >
            <Select>
              <Option value="public">公开</Option>
              <Option value="friends_only">仅好友可见</Option>
              <Option value="teacher_hidden">对教师隐藏</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="is_anonymous"
            valuePropName="checked"
          >
            <input type="checkbox" /> 匿名发布
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看帖子详情模态框 */}
      <Modal
        title="帖子详情"
        open={viewModalVisible}
        onCancel={handleViewModalClose}
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
            
            {/* 可折叠的调试信息 */}
            {debugMode && (
              <div style={{ margin: '10px 0', padding: '10px', background: '#f5f5f5', border: '1px dashed #ccc' }}>
                <div 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    cursor: 'pointer',
                    padding: '5px 0'
                  }}
                  onClick={() => setShowDebugInfo(!showDebugInfo)}
                >
                  <strong>调试信息</strong>
                  {showDebugInfo ? <UpOutlined /> : <DownOutlined />}
                </div>
                
                {showDebugInfo && (
                  <div style={{ marginTop: '10px' }}>
                    <p>是否有引用题目: {currentPost.questionRef ? '是' : '否'}</p>
                    {currentPost.questionRef && (
                      <>
                        <p>引用类型: {
                          typeof currentPost.questionRef === 'string' 
                            ? '字符串(需解析)' 
                            : currentPost.questionRef.question_type
                        }</p>
                        <p>题目ID: {
                          typeof currentPost.questionRef === 'string'
                            ? '未解析'
                            : currentPost.questionRef.question_id
                        }</p>
                        <p>题目路径: {
                          typeof currentPost.questionRef === 'string'
                            ? '未解析'
                            : currentPost.questionRef.question_path
                        }</p>
                      </>
                    )}
                    <p>是否有图片: {questionImages.length > 0 ? '是' : '否'}</p>
                    <p>是否有LaTeX: {questionLatex ? '是' : '否'}</p>
                  </div>
                )}
              </div>
            )}
            
            {/* 显示引用的题目 */}
            {currentPost.questionRef && (
              <div style={{ marginTop: 20, border: '1px solid #f0f0f0', padding: 16, borderRadius: 4 }}>
                <h3>引用题目 {questionId && <Tag color="blue">题目编号: {questionId}</Tag>}</h3>
                
                {/* 图片题目显示区域 */}
                {questionImages.length > 0 && (
                  <Card title="题目图片" style={{ marginBottom: '16px' }}>
                    <Row gutter={[16, 16]}>
                      {questionImages.map((image, index) => (
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
                {questionLatex && (
                  <Card title="LaTeX题目" style={{ marginBottom: '16px' }}>
                    <div style={{ padding: '10px' }}>
                      <MathJaxContext version={3} config={config}>
                        {questionLatex && questionLatex.latex_code ? (
                          <MathJax dynamic>
                            {`$$${questionLatex.latex_code}$$`}
                          </MathJax>
                        ) : (
                          <div>无法加载LaTeX内容</div>
                        )}
                      </MathJaxContext>
                    </div>
                  </Card>
                )}
                
                {/* 既无图片也无LaTeX时显示加载提示 */}
                {questionImages.length === 0 && !questionLatex && (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <p>正在加载题目内容...</p>
                  </div>
                )}
              </div>
            )}
            
            {/* 添加评论区域 */}
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <CommentOutlined style={{ marginRight: '8px' }} />
                <h3 style={{ margin: 0 }}>评论 ({comments.length})</h3>
              </div>
              
              {commentLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>加载评论中...</div>
              ) : comments.length > 0 ? (
                <div style={{ marginBottom: '20px', maxHeight: '400px', overflowY: 'auto', padding: '0 5px' }}>
                  {renderComments(comments)}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                  暂无评论
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      
      {/* 调试模式开关 */}
      {renderDebugToggle()}
    </div>
  );
};

export default Community;