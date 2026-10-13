/**
 * 社区互动相关路由（评论、点赞、收藏、投币等）
 */
const express = require('express');
const router = express.Router();

// 使用server.js中的连接池和executeWithRetry函数
const { pool, executeWithRetry } = require('../server');

// 添加评论
router.post('/comments', async (req, res) => {
  try {
    const { userId, postId, content, parentId = null } = req.body;
    
    if (!userId || !postId || !content) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查用户今日评论数量是否超过限制
    const [userLimits] = await pool.execute(
      'SELECT * FROM community_user_limits WHERE user_id = ?',
      [userId]
    );
    
    const today = new Date().toISOString().split('T')[0];
    let userLimit;
    
    if (userLimits.length === 0) {
      // 创建新的用户限制记录
      await pool.execute(
        'INSERT INTO community_user_limits (user_id, comments_today, last_reset_date) VALUES (?, 1, ?)',
        [userId, today]
      );
      userLimit = { comments_today: 1 };
    } else {
      userLimit = userLimits[0];
      
      // 如果是新的一天，重置计数
      if (userLimit.last_reset_date !== today) {
        await pool.execute(
          'UPDATE community_user_limits SET comments_today = 1, last_reset_date = ? WHERE user_id = ?',
          [today, userId]
        );
        userLimit.comments_today = 1;
      } else if (userLimit.comments_today >= 20) {
        return res.status(429).json({ error: '今日评论数量已达上限（20条）' });
      } else {
        // 增加今日评论计数
        await pool.execute(
          'UPDATE community_user_limits SET comments_today = comments_today + 1 WHERE user_id = ?',
          [userId]
        );
        userLimit.comments_today += 1;
      }
    }
    
    // 添加评论
    const [result] = await pool.execute(
      'INSERT INTO community_comments (post_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)',
      [postId, userId, parentId, content]
    );
    
    const commentId = result.insertId;
    
    // 获取帖子作者ID，用于发送通知
    const [posts] = await pool.execute(
      'SELECT user_id FROM community_posts WHERE id = ?',
      [postId]
    );
    
    if (posts.length > 0) {
      const postAuthorId = posts[0].user_id;
      
      // 如果评论者不是帖子作者，则发送通知
      if (postAuthorId !== userId) {
        await pool.execute(
          'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
          [postAuthorId, 'comment', '有人评论了你的帖子', postId]
        );
      }
      
      // 如果是回复其他评论，也给被回复者发送通知
      if (parentId) {
        const [parentComments] = await pool.execute(
          'SELECT user_id FROM community_comments WHERE id = ?',
          [parentId]
        );
        
        if (parentComments.length > 0) {
          const parentCommentAuthorId = parentComments[0].user_id;
          
          if (parentCommentAuthorId !== userId) {
            await pool.execute(
              'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
              [parentCommentAuthorId, 'comment', '有人回复了你的评论', commentId]
            );
          }
        }
      }
    }
    
    res.status(201).json({
      id: commentId,
      message: '评论发布成功'
    });
  } catch (error) {
    console.error('添加评论失败:', error);
    res.status(500).json({ error: '添加评论失败' });
  }
});

// 删除评论
router.delete('/comments/:id', async (req, res) => {
  try {
    const commentId = req.params.id;
    const { userId } = req.body;
    
    // 验证评论所有权
    const [comments] = await pool.execute(
      'SELECT * FROM community_comments WHERE id = ?',
      [commentId]
    );
    
    if (comments.length === 0) {
      return res.status(404).json({ error: '评论不存在' });
    }
    
    if (comments[0].user_id !== userId) {
      return res.status(403).json({ error: '无权删除此评论' });
    }
    
    // 删除评论
    await pool.execute('DELETE FROM community_comments WHERE id = ?', [commentId]);
    
    res.json({ message: '评论删除成功' });
  } catch (error) {
    console.error('删除评论失败:', error);
    res.status(500).json({ error: '删除评论失败' });
  }
});

// 添加互动（点赞、收藏、投币、推荐）
router.post('/interactions', async (req, res) => {
  try {
    const { userId, postId, type } = req.body;
    
    if (!userId || !postId || !type) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (!['like', 'favorite', 'coin', 'recommend'].includes(type)) {
      return res.status(400).json({ error: '互动类型无效' });
    }
    
    // 检查是否已经进行过此类互动
    const [existingInteractions] = await pool.execute(
      'SELECT * FROM community_interactions WHERE user_id = ? AND post_id = ? AND type = ?',
      [userId, postId, type]
    );
    
    if (existingInteractions.length > 0) {
      // 如果已经存在，则取消互动
      await pool.execute(
        'DELETE FROM community_interactions WHERE user_id = ? AND post_id = ? AND type = ?',
        [userId, postId, type]
      );
      
      res.json({ message: `已取消${getInteractionTypeName(type)}` });
    } else {
      // 如果是投币操作，需要检查用户苹果币余额
      if (type === 'coin') {
        const [userCoins] = await pool.execute(
          'SELECT current_amount FROM community_apple_coins WHERE user_id = ?',
          [userId]
        );
        
        let currentCoins = 0;
        
        if (userCoins.length > 0) {
          currentCoins = userCoins[0].current_amount;
        }
        
        if (currentCoins < 1) {
          return res.status(400).json({ error: '苹果币余额不足' });
        }
        
        // 扣除用户苹果币
        if (userCoins.length > 0) {
          await pool.execute(
            'UPDATE community_apple_coins SET current_amount = current_amount - 1 WHERE user_id = ?',
            [userId]
          );
        } else {
          await pool.execute(
            'INSERT INTO community_apple_coins (user_id, current_amount, total_collected) VALUES (?, 0, 0)',
            [userId]
          );
        }
        
        // 获取帖子作者ID，给作者增加苹果币
        const [posts] = await pool.execute(
          'SELECT user_id FROM community_posts WHERE id = ?',
          [postId]
        );
        
        if (posts.length > 0) {
          const postAuthorId = posts[0].user_id;
          
          const [authorCoins] = await pool.execute(
            'SELECT * FROM community_apple_coins WHERE user_id = ?',
            [postAuthorId]
          );
          
          if (authorCoins.length > 0) {
            await pool.execute(
              'UPDATE community_apple_coins SET current_amount = current_amount + 1, total_collected = total_collected + 1 WHERE user_id = ?',
              [postAuthorId]
            );
          } else {
            await pool.execute(
              'INSERT INTO community_apple_coins (user_id, current_amount, total_collected) VALUES (?, 1, 1)',
              [postAuthorId]
            );
          }
        }
      }
      
      // 添加互动记录
      await pool.execute(
        'INSERT INTO community_interactions (user_id, post_id, type) VALUES (?, ?, ?)',
        [userId, postId, type]
      );
      
      // 获取帖子作者ID，用于发送通知
      const [posts] = await pool.execute(
        'SELECT user_id FROM community_posts WHERE id = ?',
        [postId]
      );
      
      if (posts.length > 0) {
        const postAuthorId = posts[0].user_id;
        
        // 如果互动者不是帖子作者，则发送通知
        if (postAuthorId !== userId) {
          await pool.execute(
            'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
            [postAuthorId, `interaction_${type}`, `有人${getInteractionTypeName(type)}了你的帖子`, postId]
          );
        }
      }
      
      res.status(201).json({
        message: `${getInteractionTypeName(type)}成功`
      });
    }
  } catch (error) {
    console.error('添加互动失败:', error);
    res.status(500).json({ error: '添加互动失败' });
  }
});

// 获取帖子的互动统计
router.get('/interactions/stats/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    
    // 获取各类互动的数量
    const [stats] = await pool.execute(
      `SELECT 
        type, 
        COUNT(*) as count 
      FROM community_interactions 
      WHERE post_id = ? 
      GROUP BY type`,
      [postId]
    );
    
    // 格式化结果
    const result = {
      like: 0,
      favorite: 0,
      coin: 0,
      recommend: 0
    };
    
    stats.forEach(stat => {
      result[stat.type] = stat.count;
    });
    
    res.json(result);
  } catch (error) {
    console.error('获取互动统计失败:', error);
    res.status(500).json({ error: '获取互动统计失败' });
  }
});

// 获取用户对特定帖子的互动状态
router.get('/interactions/status', async (req, res) => {
  try {
    const { userId, postId } = req.query;
    
    if (!userId || !postId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 获取用户对该帖子的所有互动
    const [interactions] = await pool.execute(
      'SELECT type FROM community_interactions WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );
    
    // 格式化结果
    const result = {
      like: false,
      favorite: false,
      coin: false,
      recommend: false
    };
    
    interactions.forEach(interaction => {
      result[interaction.type] = true;
    });
    
    res.json(result);
  } catch (error) {
    console.error('获取互动状态失败:', error);
    res.status(500).json({ error: '获取互动状态失败' });
  }
});

// 辅助函数：获取互动类型的中文名称
function getInteractionTypeName(type) {
  const typeNames = {
    like: '点赞',
    favorite: '收藏',
    coin: '投币',
    recommend: '推荐'
  };
  
  return typeNames[type] || type;
}

module.exports = router;