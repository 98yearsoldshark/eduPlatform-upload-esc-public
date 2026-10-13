import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './styles/NotificationsPage.css';
import { Notification } from '../types/communityTypes';

interface NotificationsPageProps {
  userId?: number;
}

const NotificationsPage: React.FC<NotificationsPageProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!userId) {
      const tokenStr = localStorage.getItem('token');
      if (tokenStr) {
        try {
          // 尝试方法1：作为JSON对象解析
          let user = null;
        try {
            const tokenData = JSON.parse(tokenStr);
            if (tokenData && tokenData.user) {
              user = tokenData.user;
            }
          } catch (parseError) {
            console.log('Token不是JSON格式，可能是JWT格式');
          }
          
          // 尝试方法2：解析JWT
          if (!user) {
            try {
              const jwtParts = tokenStr.split('.');
              if (jwtParts.length === 3) {
                const payload = JSON.parse(atob(jwtParts[1]));
                if (payload) {
                  user = payload.user || {
                    id: payload.userId || payload.id || payload.sub,
                    name: payload.name || payload.username || '用户'
                  };
                }
              }
            } catch (jwtError) {
              console.error('解析JWT失败:', jwtError);
            }
          }
          
          // 尝试方法3：直接从localStorage获取userId
          if (!user) {
            const localUserId = localStorage.getItem('userId');
            if (localUserId) {
              user = { id: localUserId };
            }
          }
          
          if (user && user.id) {
          fetchNotifications(user.id, activeTab === 'unread');
          } else {
            throw new Error('无法获取用户ID');
          }
        } catch (err) {
          console.error('解析用户信息失败', err);
          setError('获取用户信息失败');
          setLoading(false);
        }
      } else {
        setError('请先登录');
        setLoading(false);
      }
    } else {
      fetchNotifications(userId, activeTab === 'unread');
    }
  }, [userId, activeTab]);
  
  const fetchNotifications = async (uid: number, unreadOnly: boolean) => {
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:3003/api/community/notifications`, {
        params: { userId: uid, unreadOnly }
      });
      setNotifications(response.data.notifications);
    } catch (err) {
      console.error('获取通知失败', err);
      setError('获取通知失败');
    } finally {
      setLoading(false);
    }
  };
  
  const handleMarkAsRead = async (notificationId: number) => {
    try {
      let uid = userId;

      // 如果没有直接提供userId，尝试从token获取
      if (!uid) {
        const tokenStr = localStorage.getItem('token');
        if (tokenStr) {
          try {
            // 尝试JSON解析
            const tokenData = JSON.parse(tokenStr);
            if (tokenData?.user?.id) {
              uid = Number(tokenData.user.id);
            } else {
              // 尝试JWT解析
              const jwtParts = tokenStr.split('.');
              if (jwtParts.length === 3) {
                const payload = JSON.parse(atob(jwtParts[1]));
                const payloadId = payload?.userId || payload?.id || payload?.sub;
                if (payloadId) uid = Number(payloadId);
              }
            }
          } catch (err) {
            // 尝试从localStorage获取
            const localUserId = localStorage.getItem('userId');
            if (localUserId) uid = Number(localUserId);
          }
        }
      }

      if (!uid) return;
      
      await axios.put(`http://localhost:3003/api/community/notifications/${notificationId}/read`, {
        userId: uid
      });
      
      // 更新本地通知状态
      setNotifications(prevNotifications =>
        prevNotifications.map(notification =>
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification
        )
      );
    } catch (err) {
      console.error('标记通知已读失败', err);
    }
  };
  
  const handleMarkAllAsRead = async () => {
    if (!userId && !localStorage.getItem('token')) return;
    
    try {
      let uid = userId;

      // 如果没有直接提供userId，尝试从token获取
      if (!uid) {
        const tokenStr = localStorage.getItem('token');
        if (tokenStr) {
          try {
            // 尝试JSON解析
            const tokenData = JSON.parse(tokenStr);
            if (tokenData?.user?.id) {
              uid = Number(tokenData.user.id);
            } else {
              // 尝试JWT解析
              const jwtParts = tokenStr.split('.');
              if (jwtParts.length === 3) {
                const payload = JSON.parse(atob(jwtParts[1]));
                const payloadId = payload?.userId || payload?.id || payload?.sub;
                if (payloadId) uid = Number(payloadId);
              }
            }
          } catch (err) {
            // 尝试从localStorage获取
            const localUserId = localStorage.getItem('userId');
            if (localUserId) uid = Number(localUserId);
          }
        }
      }

      if (!uid) return;
      
      await axios.put(`http://localhost:3003/api/community/notifications/read-all`, {
        userId: uid
      });
      
      // 更新本地通知状态
      setNotifications(prevNotifications =>
        prevNotifications.map(notification => ({
          ...notification,
          is_read: true
        }))
      );
    } catch (err) {
      console.error('标记所有通知已读失败', err);
    }
  };
  
  const handleDeleteNotification = async (notificationId: number) => {
    try {
      await axios.delete(`http://localhost:3003/api/community/notifications/${notificationId}`);
      
      // 从列表中移除该通知
      setNotifications(prevNotifications =>
        prevNotifications.filter(notification => notification.id !== notificationId)
      );
    } catch (err) {
      console.error('删除通知失败', err);
    }
  };
  
  const handleNotificationClick = (notification: Notification) => {
    // 如果未读，则标记为已读
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }
    
    // 根据通知类型导航到相应页面
    switch (notification.type) {
      case 'friend_request':
        // 导航到好友申请页面
        navigate('/square', { state: { openFriendRequests: true } });
        break;
      case 'friend_accepted':
      case 'friend_rejected':
        // 导航到好友列表
        navigate('/square');
        break;
      case 'post_like':
      case 'post_comment':
      case 'post_favorite':
        // 导航到相关帖子
        if (notification.related_id) {
          navigate(`/post/${notification.related_id}`);
        }
        break;
      case 'system':
        // 系统通知不需要导航
        break;
      default:
        // 默认导航到社区首页
        navigate('/square');
    }
  };
  
  const getNotificationContent = (notification: Notification) => {
    // 根据通知类型返回格式化的内容
    switch (notification.type) {
      case 'friend_request':
        return `${notification.content} 向你发送了好友申请`;
      case 'friend_accepted':
        return `${notification.content} 接受了你的好友申请`;
      case 'friend_rejected':
        return `${notification.content} 拒绝了你的好友申请`;
      case 'post_like':
        return `${notification.content} 点赞了你的帖子`;
      case 'post_comment':
        return `${notification.content} 评论了你的帖子`;
      case 'post_favorite':
        return `${notification.content} 收藏了你的帖子`;
      case 'system':
        return notification.content;
      default:
        return notification.content;
    }
  };
  
  const getNotificationIcon = (type: string) => {
    // 根据通知类型返回对应的图标类名
    switch (type) {
      case 'friend_request':
      case 'friend_accepted':
      case 'friend_rejected':
        return 'user-icon';
      case 'post_like':
        return 'like-icon';
      case 'post_comment':
        return 'comment-icon';
      case 'post_favorite':
        return 'favorite-icon';
      case 'system':
        return 'system-icon';
      default:
        return 'default-icon';
    }
  };
  
  if (loading && notifications.length === 0) {
    return <div className="notifications-loading">加载中...</div>;
  }
  
  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <h2>通知中心</h2>
        <div className="notifications-actions">
          <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
            全部标为已读
          </button>
        </div>
      </div>
      
      <div className="notifications-tabs">
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          全部
        </button>
        <button 
          className={`tab-btn ${activeTab === 'unread' ? 'active' : ''}`}
          onClick={() => setActiveTab('unread')}
        >
          未读
        </button>
      </div>
      
      {error && <div className="notifications-error">{error}</div>}
      
      {!loading && notifications.length === 0 && (
        <div className="empty-notifications">
          {activeTab === 'all' ? '暂无通知' : '暂无未读通知'}
        </div>
      )}
      
      {notifications.length > 0 && (
        <ul className="notifications-list">
          {notifications.map(notification => (
            <li 
              key={notification.id} 
              className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className={`notification-icon ${getNotificationIcon(notification.type)}`}></div>
              <div className="notification-content">
                <div className="notification-text">{getNotificationContent(notification)}</div>
                <div className="notification-time">{new Date(notification.created_at).toLocaleString()}</div>
              </div>
              <div className="notification-actions">
                {!notification.is_read && (
                  <button 
                    className="mark-read-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAsRead(notification.id);
                    }}
                  >
                    标为已读
                  </button>
                )}
                <button 
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNotification(notification.id);
                  }}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotificationsPage;