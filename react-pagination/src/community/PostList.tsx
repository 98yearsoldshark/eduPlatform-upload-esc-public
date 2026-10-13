import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './styles/PostList.css';
import { Post } from '../types/communityTypes';

interface PostListProps {
  posts: Post[];
  currentUserId?: number;
  onRefresh: () => void;
}

const PostList: React.FC<PostListProps> = ({ posts, currentUserId, onRefresh }) => {
  const navigate = useNavigate();
  
  const handlePostClick = (postId: number) => {
    navigate(`/post/${postId}`);
  };
  
  const handleInteraction = async (postId: number, type: 'like' | 'favorite' | 'coin' | 'recommend', event: React.MouseEvent) => {
    event.stopPropagation(); // 阻止事件冒泡，避免触发帖子点击
    
    if (!currentUserId) return;
    
    try {
      await axios.post('http://localhost:3003/api/community/interactions/interactions', {
        userId: currentUserId,
        postId,
        type
      });
      
      // 刷新帖子列表
      onRefresh();
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.error === '苹果币余额不足') {
        alert('苹果币余额不足，无法投币');
      } else {
        console.error(`${type}操作失败`, err);
      }
    }
  };
  
  const formatDate = (dateString: string) => {
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
  
  return (
    <div className="post-list">
      {posts.map(post => (
        <div key={post.id} className="post-item" onClick={() => handlePostClick(post.id)}>
          <div className="post-header">
            <div className="post-title">{post.title}</div>
            <div className="post-category">{getCategoryName(post.category)}</div>
          </div>
          
          <div className="post-content">
            {post.content.length > 200 ? `${post.content.substring(0, 200)}...` : post.content}
          </div>
          
          <div className="post-footer">
            <div className="post-info">
              <span className="post-author">{post.author_name}</span>
              <span className="post-time">{formatDate(post.created_at)}</span>
              {post.visibility !== 'public' && (
                <span className="post-visibility">
                  {post.visibility === 'friends_only' ? '仅好友可见' : '对教师不可见'}
                </span>
              )}
            </div>
            
            <div className="post-interactions">
              <div 
                className={`interaction-item ${post.current_user_liked ? 'active' : ''}`}
                onClick={(e) => handleInteraction(post.id, 'like', e)}
              >
                <i className="interaction-icon like-icon"></i>
                <span>{post.like_count}</span>
              </div>
              
              <div 
                className={`interaction-item ${post.current_user_favorited ? 'active' : ''}`}
                onClick={(e) => handleInteraction(post.id, 'favorite', e)}
              >
                <i className="interaction-icon favorite-icon"></i>
                <span>{post.favorite_count}</span>
              </div>
              
              <div 
                className={`interaction-item ${post.current_user_coined ? 'active' : ''}`}
                onClick={(e) => handleInteraction(post.id, 'coin', e)}
              >
                <i className="interaction-icon coin-icon"></i>
                <span>{post.coin_count}</span>
              </div>
              
              <div 
                className={`interaction-item ${post.current_user_recommended ? 'active' : ''}`}
                onClick={(e) => handleInteraction(post.id, 'recommend', e)}
              >
                <i className="interaction-icon recommend-icon"></i>
                <span>{post.recommend_count}</span>
              </div>
              
              <div className="interaction-item">
                <i className="interaction-icon comment-icon"></i>
                <span>{post.comment_count}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

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

export default PostList;