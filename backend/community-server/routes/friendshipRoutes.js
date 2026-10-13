/**
 * 社区用户关系相关路由（好友、私信等）
 */
const express = require('express');
const router = express.Router();

// 使用server.js中的连接池和executeWithRetry函数
const { pool, executeWithRetry } = require('../server');


// 发送好友申请
router.post('/requests', async (req, res) => {
  try {
    const { userId, friendId, message, nickname } = req.body;
    
    if (!userId || !friendId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (userId === friendId) {
      return res.status(400).json({ error: '不能添加自己为好友' });
    }
    
    // 检查用户是否存在
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [friendId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 检查是否已经是好友
    const [existingFriendships] = await pool.execute(
      `SELECT * FROM community_friendships 
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId, friendId, friendId, userId]
    );
    
    if (existingFriendships.length > 0) {
      return res.status(400).json({ error: '已经是好友关系' });
    }
    
    // 检查是否已经发送过申请
    const [existingRequests] = await pool.execute(
      'SELECT * FROM community_friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = "pending"',
      [userId, friendId]
    );
    
    if (existingRequests.length > 0) {
      return res.status(400).json({ error: '已经发送过好友申请' });
    }
    
    // 检查今日申请次数是否超过限制
    const [userLimits] = await pool.execute(
      'SELECT * FROM community_user_limits WHERE user_id = ?',
      [userId]
    );
    
    const today = new Date().toISOString().split('T')[0];
    let userLimit;
    
    if (userLimits.length === 0) {
      // 创建新的用户限制记录
      await pool.execute(
        'INSERT INTO community_user_limits (user_id, friend_requests_today, last_reset_date) VALUES (?, 1, ?)',
        [userId, today]
      );
      userLimit = { friend_requests_today: 1 };
    } else {
      userLimit = userLimits[0];
      
      // 如果是新的一天，重置计数
      if (userLimit.last_reset_date !== today) {
        await pool.execute(
          'UPDATE community_user_limits SET friend_requests_today = 1, last_reset_date = ? WHERE user_id = ?',
          [today, userId]
        );
        userLimit.friend_requests_today = 1;
      } else if (userLimit.friend_requests_today >= 10) {
        return res.status(429).json({ error: '今日好友申请次数已达上限（10次）' });
      } else {
        // 增加今日申请计数
        await pool.execute(
          'UPDATE community_user_limits SET friend_requests_today = friend_requests_today + 1 WHERE user_id = ?',
          [userId]
        );
        userLimit.friend_requests_today += 1;
      }
    }
    
    // 添加好友申请
    const [result] = await pool.execute(
      'INSERT INTO community_friend_requests (sender_id, receiver_id, message, nickname) VALUES (?, ?, ?, ?)',
      [userId, friendId, message || '', nickname || '']
    );
    
    const requestId = result.insertId;
    
    // 发送通知
    await pool.execute(
      'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
      [friendId, 'friend_request', '收到一条新的好友申请', requestId]
    );
    
    res.status(201).json({
      id: requestId,
      message: '好友申请已发送'
    });
  } catch (error) {
    console.error('发送好友申请失败:', error);
    res.status(500).json({ error: '发送好友申请失败' });
  }
});

// 处理好友申请（接受/拒绝）
router.put('/requests/:id', async (req, res) => {
  try {
    const requestId = req.params.id;
    const { userId, action } = req.body;
    
    if (!userId || !action) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: '无效的操作' });
    }
    
    // 获取申请详情
    const [requests] = await pool.execute(
      'SELECT * FROM community_friend_requests WHERE id = ?',
      [requestId]
    );
    
    if (requests.length === 0) {
      return res.status(404).json({ error: '申请不存在' });
    }
    
    const request = requests[0];
    
    if (request.receiver_id !== userId) {
      return res.status(403).json({ error: '无权处理此申请' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ error: '该申请已被处理' });
    }
    
    if (action === 'accept') {
      // 接受申请，建立好友关系
      await pool.execute(
        'INSERT INTO community_friendships (user_id, friend_id, nickname) VALUES (?, ?, ?)',
        [userId, request.sender_id, request.nickname]
      );
      
      // 更新申请状态
      await pool.execute(
        'UPDATE community_friend_requests SET status = "accepted" WHERE id = ?',
        [requestId]
      );
      
      // 发送通知
      await pool.execute(
        'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
        [request.sender_id, 'friend_accepted', '你的好友申请已被接受', userId]
      );
      
      res.json({ message: '已接受好友申请' });
    } else {
      // 拒绝申请
      await pool.execute(
        'UPDATE community_friend_requests SET status = "rejected" WHERE id = ?',
        [requestId]
      );
      
      res.json({ message: '已拒绝好友申请' });
    }
  } catch (error) {
    console.error('处理好友申请失败:', error);
    res.status(500).json({ error: '处理好友申请失败' });
  }
});

// 获取好友列表
router.get('/friends', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 获取好友列表
    const [friendships] = await pool.execute(
      `SELECT 
        f.id,
        f.friend_id,
        f.nickname,
        f.created_at,
        u.name,
        u.school,
        u.email
      FROM community_friendships f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ?
      UNION
      SELECT 
        f.id,
        f.user_id AS friend_id,
        '' AS nickname,
        f.created_at,
        u.name,
        u.school,
        u.email
      FROM community_friendships f
      JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = ?
      ORDER BY created_at DESC`,
      [userId, userId]
    );
    
    res.json(friendships);
  } catch (error) {
    console.error('获取好友列表失败:', error);
    res.status(500).json({ error: '获取好友列表失败' });
  }
});

// 获取好友申请列表
router.get('/requests', async (req, res) => {
  try {
    const { userId, type = 'received' } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    let query;
    let queryParams;
    
    if (type === 'received') {
      // 获取收到的好友申请
      query = `
        SELECT 
          r.id,
          r.sender_id,
          r.message,
          r.nickname,
          r.status,
          r.created_at,
          u.name AS sender_name,
          u.school AS sender_school
        FROM community_friend_requests r
        JOIN users u ON r.sender_id = u.id
        WHERE r.receiver_id = ?
        ORDER BY r.created_at DESC
      `;
      queryParams = [userId];
    } else {
      // 获取发送的好友申请
      query = `
        SELECT 
          r.id,
          r.receiver_id,
          r.message,
          r.nickname,
          r.status,
          r.created_at,
          u.name AS receiver_name,
          u.school AS receiver_school
        FROM community_friend_requests r
        JOIN users u ON r.receiver_id = u.id
        WHERE r.sender_id = ?
        ORDER BY r.created_at DESC
      `;
      queryParams = [userId];
    }
    
    const [requests] = await pool.execute(query, queryParams);
    
    res.json(requests);
  } catch (error) {
    console.error('获取好友申请列表失败:', error);
    res.status(500).json({ error: '获取好友申请列表失败' });
  }
});

// 删除好友
router.delete('/friends/:friendId', async (req, res) => {
  try {
    const { userId } = req.body;
    const friendId = req.params.friendId;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 删除好友关系
    await pool.execute(
      `DELETE FROM community_friendships 
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId, friendId, friendId, userId]
    );
    
    res.json({ message: '已删除好友关系' });
  } catch (error) {
    console.error('删除好友失败:', error);
    res.status(500).json({ error: '删除好友失败' });
  }
});

// 发送私信
router.post('/messages', async (req, res) => {
  try {
    const { senderId, receiverId, content } = req.body;
    
    if (!senderId || !receiverId || !content) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查是否为好友关系
    const [friendships] = await pool.execute(
      `SELECT * FROM community_friendships 
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [senderId, receiverId, receiverId, senderId]
    );
    
    if (friendships.length === 0) {
      return res.status(403).json({ error: '只能给好友发送私信' });
    }
    
    // 添加私信
    const [result] = await pool.execute(
      'INSERT INTO community_private_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
      [senderId, receiverId, content]
    );
    
    const messageId = result.insertId;
    
    // 发送通知
    await pool.execute(
      'INSERT INTO community_notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
      [receiverId, 'private_message', '收到一条新的私信', messageId]
    );
    
    res.status(201).json({
      id: messageId,
      message: '私信发送成功'
    });
  } catch (error) {
    console.error('发送私信失败:', error);
    res.status(500).json({ error: '发送私信失败' });
  }
});

// 获取私信列表
router.get('/messages', async (req, res) => {
  try {
    const { userId, friendId, page = 1, limit = 20 } = req.query;
    
    if (!userId || !friendId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const offset = (page - 1) * limit;
    
    // 获取私信列表
    const [messages] = await pool.execute(
      `SELECT 
        id,
        sender_id,
        receiver_id,
        content,
        created_at,
        is_read
      FROM community_private_messages
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
      [userId, friendId, friendId, userId, Number(limit), Number(offset)]
    );
    
    // 标记为已读
    await pool.execute(
      'UPDATE community_private_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
      [friendId, userId]
    );
    
    // 获取总数
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) AS total
      FROM community_private_messages
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
      [userId, friendId, friendId, userId]
    );
    
    const total = countResult[0].total;
    
    res.json({
      messages: messages.reverse(), // 返回时按时间正序排列
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取私信列表失败:', error);
    res.status(500).json({ error: '获取私信列表失败' });
  }
});

// 获取私信会话列表
router.get('/conversations', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 获取最近的私信会话
    const [conversations] = await pool.execute(
      `SELECT 
        CASE 
          WHEN m.sender_id = ? THEN m.receiver_id
          ELSE m.sender_id
        END AS friend_id,
        u.name AS friend_name,
        u.school AS friend_school,
        MAX(m.created_at) AS last_message_time,
        (SELECT content FROM community_private_messages 
         WHERE ((sender_id = ? AND receiver_id = friend_id) OR (sender_id = friend_id AND receiver_id = ?)) 
         ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM community_private_messages 
         WHERE sender_id = friend_id AND receiver_id = ? AND is_read = 0) AS unread_count
      FROM community_private_messages m
      JOIN users u ON (CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END) = u.id
      WHERE m.sender_id = ? OR m.receiver_id = ?
      GROUP BY friend_id
      ORDER BY last_message_time DESC`,
      [userId, userId, userId, userId, userId, userId, userId]
    );
    
    res.json(conversations);
  } catch (error) {
    console.error('获取私信会话列表失败:', error);
    res.status(500).json({ error: '获取私信会话列表失败' });
  }
});

module.exports = router;