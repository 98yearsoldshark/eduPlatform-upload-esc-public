import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './styles/FriendRequestModal.css';
import { FriendRequest, UserInfo } from '../types/communityTypes';

interface FriendRequestModalProps {
  userId?: number;
  onClose: () => void;
  onRefresh?: () => void;
}

const FriendRequestModal: React.FC<FriendRequestModalProps> = ({ userId, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'invite' | 'requests'>('invite');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<UserInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [message, setMessage] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 获取好友申请列表
  useEffect(() => {
    if (userId && activeTab === 'requests') {
      fetchFriendRequests();
    }
  }, [userId, activeTab]);
  
  const fetchFriendRequests = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:3003/api/community/friendships/requests`, {
        params: { userId, type: 'received' }
      });
      setRequests(response.data);
    } catch (err) {
      console.error('获取好友申请列表失败', err);
      setError('获取好友申请列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearch = async () => {
    if (!searchQuery.trim() || !userId) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`http://localhost:3003/api/community/users/search`, {
        params: { query: searchQuery, userId }
      });
      setSearchResults(response.data);
    } catch (err) {
      console.error('搜索用户失败', err);
      setError('搜索用户失败');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUserSelect = (user: UserInfo) => {
    setSelectedUser(user);
    setSearchResults([]);
    setSearchQuery('');
  };
  
  const handleSendRequest = async () => {
    if (!userId || !selectedUser) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await axios.post('http://localhost:3003/api/community/friendships/requests', {
        userId,
        friendId: selectedUser.id,
        message,
        nickname
      });
      
      setSuccess('好友申请已发送');
      setSelectedUser(null);
      setMessage('');
      setNickname('');
    } catch (err: any) {
      console.error('发送好友申请失败', err);
      setError(err.response?.data?.error || '发送好友申请失败');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRequestAction = async (requestId: number, action: 'accept' | 'reject') => {
    if (!userId) return;
    
    setLoading(true);
    try {
      await axios.put(`http://localhost:3003/api/community/friendships/requests/${requestId}`, {
        userId,
        action
      });
      
      // 刷新申请列表
      fetchFriendRequests();
      
      // 如果提供了刷新回调，则调用它（用于刷新好友列表）
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error(`${action === 'accept' ? '接受' : '拒绝'}好友申请失败`, err);
      setError(`${action === 'accept' ? '接受' : '拒绝'}好友申请失败`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="friend-request-modal-overlay">
      <div className="friend-request-modal">
        <div className="modal-header">
          <h2>好友申请</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-tabs">
          <button 
            className={`tab-btn ${activeTab === 'invite' ? 'active' : ''}`}
            onClick={() => setActiveTab('invite')}
          >
            添加好友
          </button>
          <button 
            className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            申请列表
          </button>
        </div>
        
        <div className="modal-content">
          {activeTab === 'invite' ? (
            <div className="invite-tab">
              <div className="search-section">
                <div className="search-input-container">
                  <input
                    type="text"
                    placeholder="搜索用户（姓名、学校或邮箱）"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button className="search-btn" onClick={handleSearch}>搜索</button>
                </div>
                
                {searchResults.length > 0 && (
                  <ul className="search-results">
                    {searchResults.map(user => (
                      <li key={user.id} onClick={() => handleUserSelect(user)}>
                        <div className="user-name">{user.name}</div>
                        {user.school && <div className="user-school">{user.school}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {selectedUser && (
                <div className="request-form">
                  <h3>发送好友申请</h3>
                  <div className="selected-user">
                    <div className="user-name">{selectedUser.name}</div>
                    {selectedUser.school && <div className="user-school">{selectedUser.school}</div>}
                  </div>
                  
                  <div className="form-group">
                    <label>备注名称（可选）</label>
                    <input
                      type="text"
                      placeholder="请输入备注名称"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>申请消息（可选）</label>
                    <textarea
                      placeholder="请输入申请消息"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                  
                  <button 
                    className="send-request-btn" 
                    onClick={handleSendRequest}
                    disabled={loading}
                  >
                    {loading ? '发送中...' : '发送申请'}
                  </button>
                </div>
              )}
              
              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}
            </div>
          ) : (
            <div className="requests-tab">
              {loading && <div className="loading">加载中...</div>}
              
              {error && <div className="error-message">{error}</div>}
              
              {!loading && requests.length === 0 && (
                <div className="empty-requests">暂无好友申请</div>
              )}
              
              {requests.length > 0 && (
                <ul className="request-list">
                  {requests.map(request => (
                    <li key={request.id} className="request-item">
                      <div className="request-info">
                        <div className="sender-name">{request.sender_name}</div>
                        {request.sender_school && (
                          <div className="sender-school">{request.sender_school}</div>
                        )}
                        {request.message && (
                          <div className="request-message">"{request.message}"</div>
                        )}
                        <div className="request-time">{new Date(request.created_at).toLocaleString()}</div>
                      </div>
                      
                      {request.status === 'pending' ? (
                        <div className="request-actions">
                          <button 
                            className="accept-btn"
                            onClick={() => handleRequestAction(request.id, 'accept')}
                            disabled={loading}
                          >
                            接受
                          </button>
                          <button 
                            className="reject-btn"
                            onClick={() => handleRequestAction(request.id, 'reject')}
                            disabled={loading}
                          >
                            拒绝
                          </button>
                        </div>
                      ) : (
                        <div className="request-status">
                          {request.status === 'accepted' ? '已接受' : '已拒绝'}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendRequestModal;