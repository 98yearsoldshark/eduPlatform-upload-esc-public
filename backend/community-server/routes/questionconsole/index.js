/**
 * 题目管理路由 - 主文件
 * 整合各个子模块的路由
 */
const express = require('express');
const router = express.Router();

// 导入身份验证中间件
const { authenticate } = require('./middlewares');

// 导入子模块
const questionList = require('./questionList');
const questionSelection = require('./questionSelection');
const questionSelectionBatch = require('./questionSelectionBatch');
const questionStats = require('./questionStats');
const questionUtils = require('./questionUtils');

// 注册中间件
router.use(express.json());

// 注册路由 - 题目列表相关
router.get('/', authenticate, questionList.getQuestionList);

// 注册路由 - 题目选择相关
router.post('/select', authenticate, questionSelection.selectQuestions);
router.post('/deselect', authenticate, questionSelection.deselectQuestion);
router.post('/batch-deselect', authenticate, questionSelectionBatch.batchDeselectQuestions);
router.get('/select-status', authenticate, questionSelectionBatch.getSelectStatus);

// 注册路由 - 题目统计相关
router.get('/:id/stats', authenticate, questionStats.getQuestionStats);
router.post('/:id/refresh-stats', authenticate, questionStats.refreshQuestionStats);

// 导出路由
module.exports = router; 