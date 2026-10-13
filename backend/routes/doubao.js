// 豆包视觉接口：在服务端保管 API 密钥，只接受已签名的学生 JWT。
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { requireEnv } = require('../config/runtime');
const router = express.Router();

router.post('/vision', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    const user = jwt.verify(token || '', requireEnv('JWT_SECRET'));
    if (!user.id) return res.status(401).json({ error: { message: '请先登录' } });
  } catch {
    return res.status(401).json({ error: { message: '请先登录或重新登录' } });
  }
  const { prompt, imageUrl } = req.body;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 10000 ||
      typeof imageUrl !== 'string' || imageUrl.length > 14 * 1024 * 1024 ||
      !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(imageUrl)) {
    return res.status(400).json({ error: { message: '请提供有效的提示词和图片' } });
  }
  if (!process.env.DOUBA_API_KEY) {
    return res.status(503).json({ error: { message: '未配置豆包服务' } });
  }
  try {
    const response = await axios.post(
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      {
        model: process.env.DOUBA_VISION_MODEL || 'doubao-1-5-vision-pro-32k-250115',
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ] }],
      },
      { headers: { Authorization: `Bearer ${process.env.DOUBA_API_KEY}` }, timeout: 60000 },
    );
    res.json(response.data);
  } catch {
    res.status(502).json({ error: { message: '豆包服务请求失败，请稍后重试' } });
  }
});

module.exports = router;
