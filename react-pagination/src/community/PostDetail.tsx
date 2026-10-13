import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './styles/PostDetail.css';
import { Post, Comment, UserInfo } from '../types/communityTypes';
import { Card, Image, Row, Col } from 'antd';
import { MathJax, MathJaxContext } from 'better-react-mathjax';

const PostDetail: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [questionImages, setQuestionImages] = useState<any[]>([]);
  const [questionLatex, setQuestionLatex] = useState<any | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  const [replyTo, setReplyTo] = useState<{ id: number, name: string } | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<{
    like: boolean;
    favorite: boolean;
    coin: boolean;
    recommend: boolean;
  }>({ like: false, favorite: false, coin: false, recommend: false });
  
  // 配置MathJax
  const config = {
    loader: { load: ["[tex]/ams"] },
    tex: {
      packages: {"[+]": ["ams"]},
      inlineMath: [["$", "$"]],
      displayMath: [["$$", "$$"]]
    }
  };
  
  const navigate = useNavigate();
  
  // 获取用户信息
  useEffect(() => {
    const tokenStr = localStorage.getItem('token');
    if (tokenStr) {
      try {
        // 尝试方法1：作为JSON对象解析
        let user = null;
      try {
          const tokenData = JSON.parse(tokenStr);
          if (tokenData && tokenData.user) {
            user = tokenData.user;
            console.log('从JSON格式token获取到user信息');
          }
        } catch (parseError) {
          console.log('Token不是JSON格式，可能是JWT格式');
        }
        
        // 如果未获取到user信息，尝试方法2：解析JWT
        if (!user) {
          try {
            // 简单解析JWT的payload部分
            const jwtParts = tokenStr.split('.');
            if (jwtParts.length === 3) {
              const payload = JSON.parse(atob(jwtParts[1]));
              if (payload) {
                // JWT可能有不同的用户信息格式
                user = payload.user || {
                  id: payload.userId || payload.id || payload.sub,
                  name: payload.name || payload.username || '用户'
                };
                console.log('从JWT payload解析user信息');
              }
            }
          } catch (jwtError) {
            console.error('解析JWT失败:', jwtError);
          }
        }
        
        // 如果仍未获取到user信息，尝试方法3：直接从localStorage获取userId
        if (!user) {
          const userId = localStorage.getItem('userId');
          if (userId) {
            user = { id: Number(userId), name: '用户' };
            console.log('从localStorage直接获取userId:', userId);
          }
        }
        
        // 如果成功获取到用户信息
        if (user) {
        setUserInfo(user);
        } else {
          console.error('无法获取用户信息');
        }
      } catch (err) {
        console.error('解析用户信息失败', err);
      }
    }
  }, []);
  
  // 获取帖子详情
  useEffect(() => {
    if (userInfo && postId) {
      fetchPostDetail();
      fetchInteractionStatus();
    }
  }, [userInfo, postId]);
  
  // 获取引用题目的内容
  const fetchQuestionContent = async (questionRef: any) => {
    if (!questionRef) return;
    
    console.log('获取题目内容，题目引用:', questionRef);
    
    try {
      if (questionRef.question_type === 'latex' && questionRef.question_id) {
        // 获取LaTeX题目内容
        console.log('尝试获取LaTeX题目，ID:', questionRef.question_id);
        try {
          // 使用正确的API路径获取LaTeX题目
          const response = await axios.get(`http://localhost:3001/latex-questions`, {
            params: { id: questionRef.question_id }
          });
          console.log('LaTeX题目API响应:', response.data);
          
          // 处理响应数据可能是数组的情况
          if (Array.isArray(response.data)) {
            // 从数组中找到匹配的题目ID
            const matchedQuestion = response.data.find(item => item.id === questionRef.question_id);
            if (matchedQuestion && matchedQuestion.latex_code) {
              console.log('成功获取LaTeX代码:', matchedQuestion.latex_code.substring(0, 100) + '...');
              setQuestionLatex(matchedQuestion);
            } else {
              console.error('在数组中未找到匹配的LaTeX题目或缺少latex_code字段:', response.data);
            }
          } else if (response.data && response.data.latex_code) {
            // 处理响应是单个对象的情况
            console.log('成功获取LaTeX代码:', response.data.latex_code.substring(0, 100) + '...');
            setQuestionLatex(response.data);
          } else {
            console.error('LaTeX题目响应中缺少latex_code字段:', response.data);
          }
        } catch (error) {
          console.error('获取LaTeX题目失败:', error);
        }
      } else if (questionRef.question_type === 'image' && questionRef.question_path) {
        // 获取图片题目内容
        const folderPath = questionRef.question_path.replace('/prtsc/', '');
        const response = await axios.get(`http://localhost:3001/images`, {
          params: { folderPath }
        });
        if (response.data && response.data.length > 0) {
          setQuestionImages(response.data);
        }
      }
    } catch (error) {
      console.error('获取引用题目内容失败:', error);
    }
  };
  
  const fetchPostDetail = async () => {
    if (!userInfo || !postId) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:3003/api/community/posts/${postId}`, {
        params: { userId: userInfo.id }
      });
      
      setPost(response.data);
      setComments(response.data.comments || []);
      
      // 如果帖子引用了题目，获取题目内容
      if (response.data.questionRef) {
        fetchQuestionContent(response.data.questionRef);
      }
    } catch (err: any) {
      console.error('获取帖子详情失败', err);
      if (err.response?.status === 403) {
        setError('您没有权限查看此帖子');
      } else if (err.response?.status === 404) {
        setError('帖子不存在或已被删除');
      } else {
        setError('获取帖子详情失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const fetchInteractionStatus = async () => {
    if (!userInfo || !postId) return;
    
    try {
      // 修正API路径，确保与后端路由匹配
      const response = await axios.get(`http://localhost:3003/api/community/interactions/interactions/status`, {
        params: { userId: userInfo.id, postId }
      });
      
      setInteractions(response.data);
    } catch (err) {
      console.error('获取互动状态失败', err);
    }
  };
  
  const handleInteraction = async (type: 'like' | 'favorite' | 'coin' | 'recommend') => {
    if (!userInfo || !postId) return;
    
    try {
      await axios.post('http://localhost:3003/api/community/interactions/interactions', {
        userId: userInfo.id,
        postId: Number(postId),
        type
      });
      
      // 刷新帖子详情和互动状态
      fetchPostDetail();
      fetchInteractionStatus();
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.error === '苹果币余额不足') {
        alert('苹果币余额不足，无法投币');
      } else {
        console.error(`${type}操作失败`, err);
      }
    }
  };
  
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userInfo || !postId || !newComment.trim()) return;
    
    try {
      await axios.post('http://localhost:3003/api/community/interactions/comments', {
        userId: userInfo.id,
        postId: Number(postId),
        content: newComment,
        parentId: replyTo ? replyTo.id : null
      });
      
      // 清空评论框并刷新评论列表
      setNewComment('');
      setReplyTo(null);
      fetchPostDetail();
    } catch (err: any) {
      console.error('发表评论失败', err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      } else {
        alert('发表评论失败，请稍后重试');
      }
    }
  };
  
  const handleReply = (commentId: number, authorName: string) => {
    setReplyTo({ id: commentId, name: authorName });
    // 滚动到评论框
    document.getElementById('comment-form')?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleCancelReply = () => {
    setReplyTo(null);
  };
  
  const handleReport = async () => {
    if (!userInfo || !postId) return;
    
    const reason = prompt('请输入举报原因：');
    if (!reason) return;
    
    try {
      await axios.post(`http://localhost:3003/api/community/posts/${postId}/report`, {
        userId: userInfo.id,
        reason
      });
      
      alert('举报成功，管理员会尽快处理');
    } catch (err: any) {
      console.error('举报失败', err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      } else {
        alert('举报失败，请稍后重试');
      }
    }
  };
  
  const handleDeletePost = async () => {
    if (!userInfo || !postId || !post) return;
    
    if (post.user_id !== userInfo.id) {
      alert('您没有权限删除此帖子');
      return;
    }
    
    if (!window.confirm('确定要删除此帖子吗？删除后无法恢复。')) {
      return;
    }
    
    try {
      await axios.delete(`http://localhost:3003/api/community/posts/${postId}`, {
        data: { userId: userInfo.id }
      });
      
      alert('帖子已删除');
      navigate('/square');
    } catch (err: any) {
      console.error('删除帖子失败', err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      } else {
        alert('删除帖子失败，请稍后重试');
      }
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  if (loading) {
    return <div className="post-detail-loading">加载中...</div>;
  }
  
  if (error) {
    return <div className="post-detail-error">{error}</div>;
  }
  
  if (!post) {
    return <div className="post-detail-error">帖子不存在</div>;
  }
  
  return (
    <div className="post-detail-container">
      <div className="post-detail-header">
        <h1 className="post-title">{post.title}</h1>
        <div className="post-meta">
          <span className="post-author">{post.author_name}</span>
          <span className="post-time">{formatDate(post.created_at)}</span>
          <span className="post-category">{getCategoryName(post.category)}</span>
          {post.visibility !== 'public' && (
            <span className="post-visibility">
              {post.visibility === 'friends_only' ? '仅好友可见' : '对教师不可见'}
            </span>
          )}
        </div>
      </div>
      
      <div className="post-detail-content">{post.content}</div>
      
      {/* 显示引用的题目 */}
      {post.questionRef && (questionImages.length > 0 || questionLatex) && (
        <div className="post-referenced-question">
          <h3>引用题目</h3>
          
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
              <div className="latex-question-container">
                <MathJaxContext version={3} config={config}>
                  {questionLatex && questionLatex.latex_code ? (
                    <MathJax dynamic>{questionLatex.latex_code}</MathJax>
                  ) : (
                    <div>无法加载LaTeX内容</div>
                  )}
                </MathJaxContext>
              </div>
            </Card>
          )}
        </div>
      )}
      
      <div className="post-detail-actions">
        <div className="post-interactions">
          <button 
            className={`interaction-btn ${interactions.like ? 'active' : ''}`}
            onClick={() => handleInteraction('like')}
          >
            <i className="interaction-icon like-icon"></i>
            <span>点赞 {post.like_count}</span>
          </button>
          
          <button 
            className={`interaction-btn ${interactions.favorite ? 'active' : ''}`}
            onClick={() => handleInteraction('favorite')}
          >
            <i className="interaction-icon favorite-icon"></i>
            <span>收藏 {post.favorite_count}</span>
          </button>
          
          <button 
            className={`interaction-btn ${interactions.coin ? 'active' : ''}`}
            onClick={() => handleInteraction('coin')}
          >
            <i className="interaction-icon coin-icon"></i>
            <span>投币 {post.coin_count}</span>
          </button>
          
          <button 
            className={`interaction-btn ${interactions.recommend ? 'active' : ''}`}
            onClick={() => handleInteraction('recommend')}
          >
            <i className="interaction-icon recommend-icon"></i>
            <span>推荐 {post.recommend_count}</span>
          </button>
        </div>
        
        <div className="post-management">
          {userInfo && post.user_id === userInfo.id && (
            <button className="delete-btn" onClick={handleDeletePost}>删除</button>
          )}
          <button className="report-btn" onClick={handleReport}>举报</button>
        </div>
      </div>
      
      <div className="post-detail-comments">
        <h3>评论 ({comments.length})</h3>
        
        {comments.length === 0 ? (
          <div className="empty-comments">暂无评论，快来发表第一条评论吧</div>
        ) : (
          <div className="comment-list">
            {renderComments(comments, handleReply)}
          </div>
        )}
        
        <div className="comment-form" id="comment-form">
          {replyTo && (
            <div className="reply-info">
              回复 {replyTo.name}：
              <button className="cancel-reply-btn" onClick={handleCancelReply}>取消回复</button>
            </div>
          )}
          
          <form onSubmit={handleSubmitComment}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="发表评论..."
              rows={4}
              required
            />
            <button type="submit" disabled={!newComment.trim()}>发表评论</button>
          </form>
        </div>
      </div>
    </div>
  );
};

// 递归渲染评论树
function renderComments(comments: Comment[], onReply: (id: number, name: string) => void) {
  return comments.map(comment => (
    <div key={comment.id} className="comment-item">
      <div className="comment-header">
        <span className="comment-author">{comment.author_name}</span>
        <span className="comment-time">{formatCommentDate(comment.created_at)}</span>
      </div>
      
      <div className="comment-content">{comment.content}</div>
      
      <div className="comment-actions">
        <button className="reply-btn" onClick={() => onReply(comment.id, comment.author_name)}>
          回复
        </button>
      </div>
      
      {comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies">
          {renderComments(comment.replies, onReply)}
        </div>
      )}
    </div>
  ));
}

// 格式化评论日期
function formatCommentDate(dateString: string) {
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
}

// 获取分类名称
function getCategoryName(category: string): string {
  const categoryMap: Record<string, string> = {
    'question': '题目交流',
    'study': '学习分享',
    'entertainment': '娱乐活动',
    'help': '疑难解惑'
  };
  
  return categoryMap[category] || category;
}

export default PostDetail;