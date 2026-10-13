# EduPlatform 教师端

基于 React、TypeScript 和 Vite 的教师端界面。

```bash
npm ci
npm run dev -- --port 5174
```

后端配置和数据库准备见[项目中文说明](../README.md)。前端不保存云服务密钥，豆包视觉调用由学生端后端代理。

`npm run build` 先进行 TypeScript 检查；当前快照中保留了原有类型问题。`npx vite build` 可单独验证打包，但不替代类型检查。
