/**
 * MongoDB连接测试脚本
 * 用于验证MongoDB配置是否正确
 */

const mongodb = require('./index');

async function testMongoDBConnection() {
  console.log('开始测试MongoDB连接...');
  
  try {
    // 尝试初始化连接
    console.log('正在初始化MongoDB连接...');
    const connected = await mongodb.initConnection();
    
    if (connected) {
      console.log('MongoDB连接成功!');
      
      // 获取连接状态
      const status = mongodb.getConnectionStatus();
      console.log('\n连接状态信息:');
      console.log(`- 连接状态: ${status.isConnected ? '已连接' : '未连接'}`);
      console.log(`- 错误信息: ${status.error || '无'}`);
      console.log(`- 数据库名称: ${status.config.dbName}`);
      console.log(`- 连接字符串: ${status.config.connectionString.replace(/mongodb\+srv:\/\/.*@/, '${MONGODB_URI}')}`);
      console.log(`- 最大连接数: ${status.config.options.maxPoolSize}`);
      
      // 尝试获取集合
      console.log('\n尝试获取user_answers集合...');
      const collection = mongodb.getCollection('user_answers');
      
      if (collection) {
        // 尝试执行简单查询
        console.log('尝试执行简单查询...');
        const count = await collection.countDocuments();
        console.log(`集合中总共有 ${count} 条文档`);
        
        // 尝试插入测试文档
        console.log('\n尝试插入测试文档...');
        const testDoc = {
          userId: 999999,
          questionPath: 'test/path',
          answer_content: 'test_answer',
          correctness: 'correct',
          attempt_count: 1,
          answer_time: new Date(),
          isTest: true
        };
        
        const insertResult = await collection.insertOne(testDoc);
        console.log(`测试文档插入成功，ID: ${insertResult.insertedId}`);
        
        // 查询刚插入的文档
        console.log('\n尝试查询刚插入的测试文档...');
        const foundDoc = await collection.findOne({ _id: insertResult.insertedId });
        console.log('查询结果:', foundDoc);
        
        // 删除测试文档
        console.log('\n清理测试文档...');
        const deleteResult = await collection.deleteOne({ _id: insertResult.insertedId });
        console.log(`删除结果: ${deleteResult.deletedCount} 条文档被删除`);
      } else {
        console.error('无法获取user_answers集合，可能是权限问题或集合不存在');
      }
      
      // 关闭连接
      console.log('\n正在关闭连接...');
      await mongodb.closeConnection();
      console.log('MongoDB连接已关闭');
    } else {
      console.error('MongoDB连接失败，请检查配置和网络状态');
    }
  } catch (error) {
    console.error('测试MongoDB连接时发生错误:', error);
  }
}

// 如果直接运行此脚本，执行测试
if (require.main === module) {
  testMongoDBConnection()
    .then(() => {
      console.log('\n测试完成！');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n测试失败:', error);
      process.exit(1);
    });
}

module.exports = testMongoDBConnection; 