import React, { } from 'react';
import { Card, Row, Col, Button, Divider, Typography, Spin, Space, Statistic, Empty, List, Tooltip } from 'antd';
import { SyncOutlined, StarOutlined, CommentOutlined, LikeOutlined, ThunderboltOutlined, DollarOutlined, StarFilled, HeartOutlined, UnorderedListOutlined, BarChartOutlined } from '@ant-design/icons';
import { MathJaxContext, MathJax } from 'better-react-mathjax';
import { QuestionItem, QuestionStats } from '../types';
import { mathJaxConfig } from '../config';

const { Title, Text } = Typography;

interface QuestionDetailProps {
  selectedDetailQuestion: QuestionItem | null;
  questionStats: QuestionStats | null;
  statsLoading: boolean;
  refreshQuestionStats: () => void;
}

// 定义评论数据结构
interface CommentData {
  id: number;
  user_id: number;
  author_name: string;
  content: string;
  created_at: string;
  parent_id: number | null;
  replies?: CommentData[];
}

// 定义处理后的评论数据结构
interface ProcessedComment {
  id: number;
  userId: number;
  authorName: string;
  content: string;
  createdAt: string;
  formattedCreatedAt: string;
  parentId: number | null;
  replies: ProcessedComment[];
}

// 定义帖子评论集合
interface PostComments {
  postId: number;
  postTitle: string;
  comments: ProcessedComment[];
  error?: string;
}

// 处理评论数据，确保数据结构完整
const processComments = (comments: CommentData[] = []): ProcessedComment[] => {
  return comments.map(comment => {
    return {
      id: comment.id,
      userId: comment.user_id,
      authorName: comment.author_name,
      content: comment.content,
      createdAt: comment.created_at,
      formattedCreatedAt: new Date(comment.created_at).toLocaleString(),
      parentId: comment.parent_id || null,
      // 递归处理回复
      replies: Array.isArray(comment.replies) ? processComments(comment.replies) : []
    };
  });
};

// 获取所有相关帖子的评论
const fetchAllComments = async (relatedPosts: any[] = []): Promise<PostComments[]> => {
  try {
    if (!relatedPosts || relatedPosts.length === 0) {
      return [];
    }

    // 获取所有帖子的评论
    const commentPromises = relatedPosts.map(async post => {
      try {
        const response = await fetch(`http://localhost:3003/api/community/posts/${post.id}`);
        if (!response.ok) {
          throw new Error(`获取帖子${post.id}评论失败: ${response.statusText}`);
        }
        const postData = await response.json();
        
        // 包含帖子ID和标题信息，便于确定评论所属帖子
        return {
          postId: post.id,
          postTitle: post.title,
          comments: processComments(postData.comments || [])
        };
      } catch (error: any) {
        console.error(`获取帖子${post.id}评论时出错:`, error);
        return {
          postId: post.id,
          postTitle: post.title,
          comments: [],
          error: error.message
        };
      }
    });

    return await Promise.all(commentPromises);
  } catch (error: any) {
    console.error('获取所有评论数据失败:', error);
    return [];
  }
};

const QuestionDetail: React.FC<QuestionDetailProps> = ({
  selectedDetailQuestion,
  questionStats,
  statsLoading,
  refreshQuestionStats
}) => {
  if (!selectedDetailQuestion) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Empty description="请选择一个题目查看详情" />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Title level={4}>题目详情</Title>
        <Space>
          <Button 
            icon={<BarChartOutlined />} 
            onClick={async () => {
              if (selectedDetailQuestion && questionStats) {
                // 获取评论数据
                const commentsData = await fetchAllComments(questionStats.relatedPosts);

                // 创建一个完整的JSON对象，包含所有统计信息
                const statsData = {
                  timestamp: new Date().toISOString(),
                  questionInfo: {
                    id: selectedDetailQuestion.id,
                    type: selectedDetailQuestion.type,
                    folderName: selectedDetailQuestion.folder_name || null,
                    subject: selectedDetailQuestion.subject,
                    grade: selectedDetailQuestion.grade,
                    year: selectedDetailQuestion.year,
                    questionType: selectedDetailQuestion.question_type,
                    // 添加题目内容数据
                    content: selectedDetailQuestion.type === 'latex' 
                      ? { latex_code: selectedDetailQuestion.latex_code || null }
                      : { images: selectedDetailQuestion.images || [] }
                  },
                  statistics: {
                    starCount: questionStats.starCount,
                    averageRating: typeof questionStats.averageRating === 'number' 
                      ? parseFloat(questionStats.averageRating.toFixed(2)) 
                      : (typeof questionStats.averageRating === 'string' 
                          ? parseFloat(parseFloat(questionStats.averageRating).toFixed(2)) 
                          : 0),
                    studentCount: typeof questionStats.studentCount === 'number' 
                      ? questionStats.studentCount 
                      : (typeof questionStats.studentCount === 'string' 
                          ? parseInt(questionStats.studentCount, 10) 
                          : 0),
                    postCount: questionStats.postCount,
                    commentCount: questionStats.commentCount,
                    likeCount: questionStats.likeCount,
                    recommendCount: questionStats.recommendCount,
                    coinCount: questionStats.coinCount,
                    favoriteCount: questionStats.favoriteCount,
                    appleCount: questionStats.appleCount || 0, // 总评分数
                    lastRefreshed: questionStats.lastRefreshed
                  },
                  relatedPosts: questionStats.relatedPosts 
                    ? questionStats.relatedPosts.map(post => ({
                        id: post.id,
                        title: post.title,
                        author: post.author,
                        createdAt: post.created_at,
                        formattedCreatedAt: new Date(post.created_at).toLocaleString(),
                        commentCount: post.commentCount,
                        likeCount: post.likeCount,
                        favoriteCount: post.favoriteCount,
                        coinCount: post.coinCount || 0
                      }))
                    : [],
                  // 添加评论详细数据
                  comments: commentsData
                };
                
                // 在控制台打印统计数据
                console.log('题目详细统计数据JSON：');
                console.log(statsData);
                
                // 显示友好的提示
                console.log('\n提示：可以使用 copy(statsData) 命令将数据复制到剪贴板');
                
                // 为方便开发者使用，将统计数据存储在window对象上
                (window as any).statsData = statsData;
              } else {
                console.log('题目数据或统计数据不完整，无法显示统计信息');
              }
            }}
          >
            统计分析
          </Button>
          <Button 
            icon={<SyncOutlined />} 
            onClick={refreshQuestionStats}
            loading={statsLoading}
          >
            刷新数据
          </Button>
        </Space>
      </div>
      
      <Card 
        title={
          <Space>
            <Text strong>{selectedDetailQuestion.folder_name || `题目 ${selectedDetailQuestion.id}`}</Text>
            <Tooltip title={selectedDetailQuestion.type === 'latex' ? 'LaTeX题目' : '图片题目'}>
              <Text type="secondary">{selectedDetailQuestion.type === 'latex' ? 'LaTeX' : '图片'}</Text>
            </Tooltip>
          </Space>
        }
        variant="outlined"
        style={{ marginBottom: '20px' }}
      >
        <div style={{ minHeight: '200px' }}>
          {selectedDetailQuestion.type === 'image' && selectedDetailQuestion.images && selectedDetailQuestion.images.length > 0 ? (
            // 渲染图片题目
            <Row gutter={[16, 16]}>
              {selectedDetailQuestion.images.map((image, index) => (
                <Col span={index === 0 ? 24 : 8} key={index}>
                  <img
                    src={`http://localhost:3001${image.url}`}
                    alt={image.name}
                    style={{ width: '100%', maxHeight: index === 0 ? '400px' : '200px', objectFit: 'contain' }}
                  />
                </Col>
              ))}
            </Row>
          ) : selectedDetailQuestion.type === 'latex' && selectedDetailQuestion.latex_code ? (
            // 渲染LaTeX题目，使用错误处理
            <div className="latex-question-container" style={{ padding: '15px' }}>
              <MathJaxContext config={mathJaxConfig}>
                <MathJax 
                  key={`latex-${selectedDetailQuestion.id}`}
                  hideUntilTypeset={'first'} 
                  inline={false} 
                  dynamic={true}
                  onError={(error) => console.error('MathJax渲染错误:', error)}
                >
                  {selectedDetailQuestion.latex_code || '暂无LaTeX代码'}
                </MathJax>
              </MathJaxContext>
            </div>
          ) : (
            <Empty description="未找到题目内容" />
          )}
        </div>
      </Card>
      
      {statsLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <p>加载统计数据中...</p>
        </div>
      ) : questionStats ? (
        <>
          <Card title="统计数据总览" variant="outlined" style={{ marginBottom: '20px' }}>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Statistic 
                  title="教师打星数" 
                  value={questionStats.starCount} 
                  prefix={<StarOutlined style={{ color: '#fadb14' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="学生平均评分" 
                  value={questionStats && typeof questionStats.averageRating === 'number' && questionStats.averageRating > 0 ? 
                    parseFloat(questionStats.averageRating.toFixed(1)) : 
                    (questionStats && typeof questionStats.averageRating === 'string' && parseFloat(questionStats.averageRating) > 0 ? 
                      parseFloat(parseFloat(questionStats.averageRating).toFixed(1)) : 
                      0)} 
                  suffix={
                    <Tooltip title="参与评分的学生人数">
                      {`(${questionStats ? 
                        (typeof questionStats.studentCount === 'number' ? 
                          questionStats.studentCount : 
                          (typeof questionStats.studentCount === 'string' ? 
                            parseInt(questionStats.studentCount, 10) : 
                            0)) : 
                        0}人)`}
                    </Tooltip>
                  }
                  prefix={<HeartOutlined style={{ color: '#f5222d' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="引用帖子数" 
                  value={questionStats.postCount} 
                  prefix={<UnorderedListOutlined style={{ color: '#1890ff' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="评论总数" 
                  value={questionStats.commentCount} 
                  prefix={<CommentOutlined style={{ color: '#52c41a' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="点赞总数" 
                  value={questionStats.likeCount} 
                  prefix={<LikeOutlined style={{ color: '#fa541c' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="推荐总数" 
                  value={questionStats.recommendCount} 
                  prefix={<ThunderboltOutlined style={{ color: '#722ed1' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="投币总数" 
                  value={questionStats.coinCount} 
                  prefix={<DollarOutlined style={{ color: '#faad14' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="收藏总数" 
                  value={questionStats.favoriteCount} 
                  prefix={<StarFilled style={{ color: '#f5222d' }} />}
                />
              </Col>
            </Row>
            <Divider />
            <Text type="secondary">最后更新时间: {new Date(questionStats.lastRefreshed).toLocaleString()}</Text>
          </Card>
          
          <Card title="引用该题目的帖子" variant="outlined" style={{ marginBottom: '20px' }}>
            {questionStats.relatedPosts && questionStats.relatedPosts.length > 0 ? (
              <List
                itemLayout="horizontal"
                dataSource={questionStats.relatedPosts}
                renderItem={(post) => (
                  <List.Item
                    actions={[
                      <Tooltip title="评论数">
                        <Space>
                          <CommentOutlined /> {post.commentCount}
                        </Space>
                      </Tooltip>,
                      <Tooltip title="点赞数">
                        <Space>
                          <LikeOutlined /> {post.likeCount}
                        </Space>
                      </Tooltip>,
                      <Tooltip title="收藏数">
                        <Space>
                          <StarOutlined /> {post.favoriteCount}
                        </Space>
                      </Tooltip>
                    ]}
                  >
                    <List.Item.Meta
                      title={<a href={`/community?postId=${post.id}`} target="_blank">{post.title}</a>}
                      description={
                        <Space>
                          <Text type="secondary">作者: {post.author}</Text>
                          <Text type="secondary">发布时间: {new Date(post.created_at).toLocaleString()}</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无引用该题目的帖子" />
            )}
          </Card>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Empty description="暂无统计数据，点击「刷新数据」获取最新统计" />
        </div>
      )}
    </div>
  );
};

export default QuestionDetail; 