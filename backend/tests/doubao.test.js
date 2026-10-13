// 验证后端豆包代理的鉴权、配置缺失与错误脱敏，不访问真实云服务。
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const app = express();
app.use(express.json());
app.use('/api/doubao', require('../routes/doubao'));
const server = app.listen(0, '127.0.0.1');
after(() => server.close());

const validBody = { prompt: '识别数学题', imageUrl: 'data:image/png;base64,YQ==' };
async function request(token, body = validBody) {
  if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
  return fetch(`http://127.0.0.1:${server.address().port}/api/doubao/vision`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
    body: JSON.stringify(body),
  });
}

test('只允许已签名的 JWT，并在服务端注入 API 密钥', async () => {
  for (const token of ['', 'invalid', JSON.stringify({ user: { id: 1 } }), jwt.sign({ id: 1 }, 'wrong-key')]) {
    assert.equal((await request(token)).status, 401);
  }
  const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1m' });
  assert.equal((await request(token, { prompt: '题目', imageUrl: 'https://example.com/image.png' })).status, 400);
  delete process.env.DOUBA_API_KEY;
  assert.equal((await request(token)).status, 503);
  process.env.DOUBA_API_KEY = randomBytes(32).toString('hex');
  const originalPost = axios.post;
  try {
    axios.post = async (url, body, config) => {
      assert.equal(url, 'https://ark.cn-beijing.volces.com/api/v3/chat/completions');
      assert.equal(config.headers.Authorization, `Bearer ${process.env.DOUBA_API_KEY}`);
      assert.equal(body.messages[0].content[1].image_url.url, validBody.imageUrl);
      assert.equal(body.model, 'doubao-1-5-vision-pro-32k-250115');
      return { data: { choices: [{ message: { content: '识别成功' } }] } };
    };
    const response = await request(token, { ...validBody, model: 'untrusted-model' });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.choices[0].message.content, '识别成功');
    assert.ok(!JSON.stringify(result).includes(process.env.DOUBA_API_KEY));
    axios.post = async () => { throw new Error(process.env.DOUBA_API_KEY); };
    const failed = await request(token);
    assert.equal(failed.status, 502);
    assert.ok(!(await failed.text()).includes(process.env.DOUBA_API_KEY));
  } finally {
    axios.post = originalPost;
  }
});
