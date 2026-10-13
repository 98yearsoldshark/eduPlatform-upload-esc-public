/**
 * 社区系统类型定义
 */

// 用户信息
export interface UserInfo {
  id: number;
  name: string;
  email: string;
  phone?: string;
  school?: string;
  classNumber?: string;
  studentId?: string;
  wechat?: string;
}

// 题目引用
export interface QuestionReference {
  id: number;
  post_id: number;
  question_type: 'image' | 'latex';
  question_id?: number;
  question_path?: string;
  created_at: string;
}

// 帖子
export interface Post {
  id: number;
  user_id: number;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
  visibility: 'public' | 'friends_only' | 'teacher_hidden';
  is_anonymous: boolean;
  author_name: string;
  comment_count: number;
  like_count: number;
  favorite_count: number;
  coin_count: number;
  recommend_count: number;
  // 当前用户的互动状态
  current_user_liked?: boolean;
  current_user_favorited?: boolean;
  current_user_coined?: boolean;
  current_user_recommended?: boolean;
  // 引用的题目
  questionRef?: QuestionReference;
}

// 评论
export interface Comment {
  id: number;
  user_id: number;
  content: string;
  created_at: string;
  parent_id: number | null;
  author_name: string;
  replies?: Comment[];
}

// 好友
export interface Friend {
  id: number;
  friend_id: number;
  nickname?: string;
  created_at: string;
  name: string;
  school?: string;
  email?: string;
}

// 好友申请
export interface FriendRequest {
  id: number;
  sender_id: number;
  receiver_id: number;
  message?: string;
  nickname?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  sender_name?: string;
  sender_school?: string;
  receiver_name?: string;
  receiver_school?: string;
}

// 私信
export interface PrivateMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  created_at: string;
  is_read: boolean;
}

// 私信会话
export interface Conversation {
  friend_id: number;
  friend_name: string;
  friend_school?: string;
  last_message_time: string;
  last_message: string;
  unread_count: number;
}

// 通知
export interface Notification {
  id: number;
  user_id: number;
  type: string;
  content: string;
  related_id?: number;
  is_read: boolean;
  created_at: string;
}

// 苹果币信息
export interface AppleCoins {
  current_amount: number;
  total_collected: number;
  updated_at?: string;
}