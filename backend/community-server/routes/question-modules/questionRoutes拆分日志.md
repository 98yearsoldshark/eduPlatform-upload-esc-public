# questionRoutes.js 拆分日志

## 拆分概述

原始文件 `questionRoutes.js` (2341行) 被拆分为以下模块：

### 核心文件

1. **index.js** - 路由聚合器，导入所有子模块并注册路由
2. **middlewares.js** - 中间件函数

### 功能模块

3. **questionUtils.js** - 通用工具函数
4. **questionList.js** - 题目列表相关功能
5. **questionSelection.js** - 题目选择功能
6. **questionSelectionBatch.js** - 批量题目选择功能
7. **questionStats.js** - 题目统计主模块

### 辅助模块

8. **questionStatsHelper.js** - 题目统计获取详情辅助函数
9. **questionStatsUpdateHelper.js** - 题目统计更新辅助函数

## 文件功能详情

### index.js

主要功能：导入所有子模块，聚合并注册路由。
路径: `/backend/community-server/routes/questionconsole/index.js`

### middlewares.js

主要功能：提供中间件函数，包括权限验证等功能。
路径: `/backend/community-server/routes/questionconsole/middlewares.js`

### questionUtils.js

主要功能：提供通用工具函数，支持其他模块使用。
路径: `/backend/community-server/routes/questionconsole/questionUtils.js`

### questionList.js

主要功能：处理题目列表的获取、分页、筛选等功能。
路径: `/backend/community-server/routes/questionconsole/questionList.js`

### questionSelection.js

主要功能：处理题目的选择和取消选择功能。
路径: `/backend/community-server/routes/questionconsole/questionSelection.js`

### questionSelectionBatch.js

主要功能：处理题目的批量取消选择功能，以及获取选择状态。
路径: `/backend/community-server/routes/questionconsole/questionSelectionBatch.js`

### questionStats.js

主要功能：提供题目统计功能的入口点，包括获取和更新统计数据。
路径: `/backend/community-server/routes/questionconsole/questionStats.js`

### questionStatsHelper.js

主要功能：提供获取题目统计详情的辅助函数。
路径: `/backend/community-server/routes/questionconsole/questionStatsHelper.js`

### questionStatsUpdateHelper.js

主要功能：提供更新题目统计数据的辅助函数。
路径: `/backend/community-server/routes/questionconsole/questionStatsUpdateHelper.js`

## 服务器集成

在服务器主文件 `server.js` 中，更新了导入路径：
- 原路径: `const questionRoutes = require('./routes/questionRoutes');`
- 新路径: `const questionRoutes = require('./routes/questionconsole');`

路由挂载点保持不变: `app.use('/api/questions', questionRoutes);`

## 模块使用方式

通过 `index.js` 统一导出所有功能，应用程序可以保持原有的导入方式不变，内部实现细节已封装。

## 优势

1. **代码组织更清晰**：功能按逻辑分组到不同文件
2. **易于维护**：每个文件专注于特定功能，降低复杂度
3. **协作更便捷**：团队成员可以在不同功能模块上并行工作
4. **性能可能提升**：模块化代码可能带来性能优化空间

## 后续建议

1. 考虑建立单元测试
2. 完善各模块的文档
3. 考虑进一步重构以提高代码复用性 