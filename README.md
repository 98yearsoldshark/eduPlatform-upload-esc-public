# EduPlatform

这是 EduPlatform 的公开代码快照，包含学生端、教师端、社区后端和相关前端代码。仓库已移除真实凭据、数据库运行数据、Nacos 快照/日志、上传题目数据和构建产物。

## 快速开始

1. 安装 Node.js（建议 LTS）和项目依赖：

   ```bash
   cd backend && npm install
   cd ../react-pagination && npm install
   cd ../teacher-react && npm install
   ```

2. 回到仓库根目录，复制环境变量模板并填写本机或部署环境的值：

   ```bash
   cp .env.example .env
   # 在仓库根目录填写 .env；后端从这个固定位置读取。
   ```

   后端至少需要 `MYSQL_*`、`JWT_SECRET` 和 `TEACHER_JWT_SECRET`。使用 MongoDB、腾讯 OCR 或豆包服务时，再填写对应变量。

3. 初始化数据库表结构：

   ```bash
   mysql -h 127.0.0.1 -P 3306 -u root -p -e "CREATE DATABASE IF NOT EXISTS cxsjdb"
   mysql -h 127.0.0.1 -P 3306 -u root -p cxsjdb < backend/db/create_latex_table.sql
   ```

4. 启动后端：

   ```bash
   cd backend
   npm start
   ```

## 安全说明

- `.env`、密钥、访问令牌、数据库导出和运行日志禁止提交。
- 豆包视觉请求通过后端 `/api/doubao/vision` 转发，使用学生 JWT 鉴权；API 密钥不会发送给浏览器。
- 学生端 API 默认 `localhost:3001`、教师端 `localhost:3002`、社区 `localhost:3003`。部署时按实际域名配置；不要恢复旧公网地址。
- 两种 JWT 密钥必须分别设置，未设置时认证组件拒绝启动。管理员初始化还需要 `DEFAULT_ADMIN_PASSWORD`；手动初始化接口需要 `COMMUNITY_ADMIN_INIT_KEY`。
- 原私有仓库仍作为历史和业务数据存档，公开仓库使用全新 Git 历史。
- 如果曾经使用过旧仓库中的凭据，请先在对应云服务控制台撤销并重新生成。

## 目录

- `backend/`：Node.js 后端与数据库访问代码。
- `react-pagination/`：学生端前端。
- `teacher-react/`：教师端前端。
- `ChatGPT-Next-Web/`：独立的 AI 网页客户端。

## 运行范围与验证

这是脱敏后的源码快照，不包含原数据库和已上传题目；需要准备自己的数据库与数据。数据库连接、OCR 和 AI 的完整业务流程需要配置新凭据后验证。

Nacos 的 JAR、日志和运行数据不随源码分发，需单独安装对应的 Nacos 版本；`application.properties` 的 `${NACOS_*:}` 占位符由 Nacos/Spring 从进程环境读取，Node.js 的 `.env` 不会自动注入 Java 进程。当前 Node.js 的配置客户端使用本地 YAML，不必为浏览代码启动 Nacos。

原项目的前端完整 TypeScript 检查存在未使用变量等错误；上传版教师端还存在 `PostData.comments` 类型缺失。脱敏迁移保留了这些现有问题。

`.gitleaks.toml` 使用默认扫描规则，仅对上游 Edge 公共客户端标识和 Tauri 验签公钥按文件与确切值豁免；它们不是本项目的私有凭据。
