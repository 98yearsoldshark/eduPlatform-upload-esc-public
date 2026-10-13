// 题目类型接口
export interface QuestionItem {
  id: number;
  type: 'image' | 'latex';
  subject: string;
  grade: string;
  year: string;
  question_type: string;
  folder_name?: string;
  path?: string;
  latex_code?: string;
  images?: Array<{name: string, url: string}>;
  is_selected: boolean;
}

// 题目统计数据接口
export interface QuestionStats {
  id: number;
  type: 'image' | 'latex';
  starCount: number; 
  postCount: number;
  commentCount: number;
  likeCount: number;
  recommendCount: number;
  coinCount: number;
  favoriteCount: number;
  appleCount: number; // 学生总评分数
  studentCount: number; // 评分学生数
  averageRating: number; // 平均评分
  lastRefreshed: string;
  relatedPosts: Array<{
    id: number;
    title: string;
    author: string;
    commentCount: number;
    likeCount: number;
    coinCount: number;
    favoriteCount: number;
    created_at: string;
  }>;
} 