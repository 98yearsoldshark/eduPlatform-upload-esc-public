import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './styles/FriendList.css';
import { Friend } from '../types/communityTypes';
import FriendRequestModal from './FriendRequestModal';

interface FriendListProps {
  userId?: number;
}

const FriendList: React.FC<FriendListProps> = ({ userId }) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  
  const navigate = useNavigate();
  
  useEffect(() => {
    if (userId) {
      fetchFriends();
    }
  }, [userId]);
  
  const fetchFriends = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:3003/api/community/friendships/friends`, {
        params: { userId }
      });
      setFriends(response.data);
    } catch (err) {
      console.error('获取好友列表失败', err);
      setError('获取好友列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFriendClick = (friendId: number) => {
    navigate(`/messages/${friendId}`);
  };
  
  const handleAddFriend = () => {
    setShowModal(true);
  };
  
  const handleCloseModal = () => {
    setShowModal(false);
  };
  
  if (loading) {
    return <div className="friend-list-loading">加载中...</div>;
  }
  
  if (error) {
    return <div className="friend-list-error">{error}</div>;
  }
  
  return (
    <div className="friend-list">
      <div className="friend-list-header">
        <button className="add-friend-btn" onClick={handleAddFriend}>
          添加好友
        </button>
      </div>
      
      {friends.length === 0 ? (
        <div className="empty-friend-list">暂无好友</div>
      ) : (
        <ul className="friends">
          {friends.map(friend => (
            <li key={friend.id} className="friend-item" onClick={() => handleFriendClick(friend.friend_id)}>
              <div className="friend-avatar">
                {friend.name ? friend.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="friend-info">
                <div className="friend-name">{friend.nickname || friend.name}</div>
                <div className="friend-school">{friend.school}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      
      {showModal && (
        <FriendRequestModal 
          userId={userId} 
          onClose={handleCloseModal} 
          onRefresh={fetchFriends}
        />
      )}
    </div>
  );
};

export default FriendList;