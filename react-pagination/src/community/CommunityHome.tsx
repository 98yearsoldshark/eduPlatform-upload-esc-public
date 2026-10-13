import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './styles/CommunityHome.css';
import FriendList from './FriendList';
import PostList from './PostList';
import { Post, UserInfo } from '../types/communityTypes';
import { parseToken } from '../utils/authUtils';

const CommunityHome: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('all');
  const [sort, setSort] = useState<'latest' | 'popular' | 'recommended'>('latest');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [appleCoins, setAppleCoins] = useState<{current_amount: number, total_collected: number}>({current_amount: 0, total_collected: 0});
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  
  const navigate = useNavigate();
  
  // 获取用户信息
  useEffect(() => {
    // 使用认证工具函数获取用户信息
    const user = parseToken();
    
    if (user) {
      console.log('社区首页：已获取用户信息', user);
        setUserInfo(user);
        
        // 获取用户苹果币信息
        fetchAppleCoins(user.id);
        // 获取未读通知数量
        fetchUnreadNotifications(user.id);
    } else {
      console.error('社区首页：无法获取用户信息，请重新登录');
      setError('获取用户信息失败，请重新登录');
    }
  }, []);
  
  // 获取帖子列表
  useEffect(() => {
    if (userInfo) {
      fetchPosts();
    }
  }, [userInfo, category, sort, page]);
  
  const fetchPosts = async () => {
    if (!userInfo) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:3003/api/community/posts`, {
        params: {
          userId: userInfo.id,
          category: category !== 'all' ? category : undefined,
          sort,
          page,
          limit: 10
        }
      });
      
      setPosts(response.data.posts);
      setTotalPages(response.data.pagination.totalPages);
    } catch (err) {
      console.error('获取帖子失败', err);
      setError('获取帖子失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAppleCoins = async (userId: number) => {
    try {
      const response = await axios.get(`http://localhost:3003/api/community/apple-coins`, {
        params: { userId }
      });
      setAppleCoins(response.data);
    } catch (err) {
      console.error('获取苹果币信息失败', err);
    }
  };
  
  const fetchUnreadNotifications = async (userId: number) => {
    try {
      const response = await axios.get(`http://localhost:3003/api/community/notifications`, {
        params: { userId, unreadOnly: true }
      });
      setUnreadNotifications(response.data.unreadCount);
    } catch (err) {
      console.error('获取未读通知失败', err);
    }
  };
  
  const handleCreatePost = () => {
    navigate('/create-post');
  };
  
  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    setPage(1); // 切换分类时重置页码
  };
  
  const handleSortChange = (newSort: 'latest' | 'popular' | 'recommended') => {
    setSort(newSort);
    setPage(1); // 切换排序时重置页码
  };
  
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };
  
  const handleViewNotifications = () => {
    navigate('/notifications');
  };
  
  return (
    <div className="community-home">
      <div className="community-sidebar">
        <div className="sidebar-section">
          <button className="create-post-btn" onClick={handleCreatePost}>
            发布帖子
          </button>
        </div>
        
        <div className="sidebar-section">
          <h3>好友列表</h3>
          <FriendList userId={userInfo?.id} />
        </div>
        
        <div className="sidebar-section">
          <h3>待建设功能</h3>
          <div className="future-features">
            <button className="future-feature-btn">功能1</button>
            <button className="future-feature-btn">功能2</button>
            <button className="future-feature-btn">功能3</button>
          </div>
        </div>
      </div>
      
      <div className="community-main">
        <div className="community-header">
          <div className="user-info">
            <div className="apple-coins">
              <span>苹果币: {appleCoins.current_amount}</span>
              <span>总收集: {appleCoins.total_collected}</span>
            </div>
            <div className="notifications" onClick={handleViewNotifications}>
              通知 {unreadNotifications > 0 && <span className="notification-badge">{unreadNotifications}</span>}
            </div>
          </div>
          
          <div className="category-tabs">
            <button 
              className={category === 'all' ? 'active' : ''} 
              onClick={() => handleCategoryChange('all')}
            >
              全部
            </button>
            <button 
              className={category === 'question' ? 'active' : ''} 
              onClick={() => handleCategoryChange('question')}
            >
              题目交流
            </button>
            <button 
              className={category === 'study' ? 'active' : ''} 
              onClick={() => handleCategoryChange('study')}
            >
              学习分享
            </button>
            <button 
              className={category === 'entertainment' ? 'active' : ''} 
              onClick={() => handleCategoryChange('entertainment')}
            >
              娱乐活动
            </button>
            <button 
              className={category === 'help' ? 'active' : ''} 
              onClick={() => handleCategoryChange('help')}
            >
              疑难解惑
            </button>
          </div>
          
          <div className="sort-options">
            <button 
              className={sort === 'latest' ? 'active' : ''} 
              onClick={() => handleSortChange('latest')}
            >
              最新
            </button>
            <button 
              className={sort === 'popular' ? 'active' : ''} 
              onClick={() => handleSortChange('popular')}
            >
              热门
            </button>
            <button 
              className={sort === 'recommended' ? 'active' : ''} 
              onClick={() => handleSortChange('recommended')}
            >
              推荐
            </button>
          </div>
        </div>
        
        <div className="posts-container">
          {loading ? (
            <div className="loading">加载中...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : posts.length === 0 ? (
            <div className="empty-posts">暂无帖子</div>
          ) : (
            <PostList 
              posts={posts} 
              currentUserId={userInfo?.id} 
              onRefresh={fetchPosts} 
            />
          )}
        </div>
        
        <div className="pagination">
          <button 
            disabled={page === 1} 
            onClick={() => handlePageChange(page - 1)}
          >
            上一页
          </button>
          <span>第 {page} 页 / 共 {totalPages} 页</span>
          <button 
            disabled={page === totalPages} 
            onClick={() => handlePageChange(page + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommunityHome;