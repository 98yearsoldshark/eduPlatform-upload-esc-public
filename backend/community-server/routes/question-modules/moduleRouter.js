/**
 * 题目管理路由 - 模块化路由组件
 */
const express = require('express');
const router = express.Router();
// 使用console替代不存在的logger模块
// const { logError, logInfo } = require('../../utils/logger');
const { executeWithRetry } = require('../../server');  // 修正路径为相对于当前文件的正确位置
const authModule = require('./auth');
const queryModule = require('./query');
const statsModule = require('./stats');
const selectionModule = require('./selection');
const utilsModule = require('./utils');

// 使用解构赋值获取具体方法
const { ensureAuthenticated, getUserData } = authModule;
const { getQuestionList } = queryModule;
const { updateQuestionStats } = statsModule;
const { selectQuestion, unselectQuestion } = selectionModule;
const { generateQuestionId } = utilsModule;

// 获取题目的统计信息
router.get('/:id/stats', authModule.authenticate, async (req, res) => {
  const id = req.params.id;
  const type = req.query.type || 'default';
  
  console.log(`【问题统计】获取题目统计信息, ID: ${id}, 类型: ${type}`);
  
  try {
    // 使用query模块获取最新统计数据
    const stats = await queryModule.getQuestionStats(id, type, executeWithRetry);
    
    // 确保更新数据库中的统计信息
    await statsModule.updateQuestionStats(id, type, executeWithRetry);
    
    // 返回统计结果
    console.log(`【问题统计】获取统计成功: ${JSON.stringify(stats)}`);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error(`【问题统计】获取统计失败: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `获取统计信息失败: ${error.message}`
    });
  }
});

module.exports = router; 