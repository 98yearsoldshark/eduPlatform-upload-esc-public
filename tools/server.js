const express = require('express');
const multer  = require('multer');
const upload = multer(); // 这里不配置存储选项，Multer 会将文件数据保存在 req.file 中，其他字段保存在 req.body 中

const app = express();

// 假设你的上传接口为 /upload
app.post('/upload', upload.single('file'), (req, res) => {
  // req.body 包含除了文件以外的所有字段
  const typeValue = req.body.type;  // 这里就能读取到 "A卷"
  console.log('type 字段的值:', typeValue);
  
  // 你还可以获取其他字段：
  console.log('subject:', req.body.subject);
  console.log('grade:', req.body.grade);
  console.log('year:', req.body.year);
  console.log('note:', req.body.note);

  // req.file 包含文件信息
  console.log('上传的文件信息:', req.file);

  res.send('上传成功');
});

app.listen(3002, () => {
  console.log('Server running on port 3000');
});
