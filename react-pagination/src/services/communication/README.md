# 主程序与AI助手通信服务

## 概述

本模块实现了主程序（5173端口）与AI助手程序（5011端口）之间的双向通信功能。通信基于两种机制：
1. **postMessage API** - 主要通信方式，通过iframe直接通信
2. **localStorage** - 备选通信方式，在postMessage不可用时使用

## 架构设计

通信服务由以下几个部分组成：

1. **通信核心层（CommunicationService.ts）**：
   - 通信服务类的单例实现
   - 管理消息的发送和接收
   - 提供事件订阅机制

2. **类型定义（types.ts）**：
   - 定义消息类型和接口
   - 确保类型安全

3. **适配器层（adapters.ts）**：
   - 为不同类型的数据提供专用适配器
   - 简化API使用

4. **接收器示例（receiver-example.ts）**：
   - 展示AI助手端如何接收和处理消息

## 支持的消息类型

服务支持以下几种消息类型：

| 消息类型 | 描述 | 数据格式 |
|---------|------|---------|
| `EXAM_QUESTION_TEXT` | 题目文本内容 | 文本格式 |
| `EXAM_QUESTION_LATEX` | LaTeX格式题目 | LaTeX数学公式 |
| `EXAM_QUESTION_IMAGE` | 题目图片 | 图片URL + 描述 |
| `OCR_QUESTION_RESULT` | OCR识别结果 | 文本格式 |
| `GENERAL_MESSAGE` | 通用消息 | 自定义格式 |

## 使用方法

### 在主程序中发送消息

#### 1. 使用适配器API（推荐）

```typescript
// 导入适配器
import { ImageAdapter, TextAdapter, OcrAdapter } from './services/communication';

// 发送图片
ImageAdapter.sendImage('http://example.com/image.png', '这是一道数学题');

// 发送LaTeX
TextAdapter.sendLatexText('$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$');

// 发送普通文本
TextAdapter.sendText('这是一个简单的问题：1+1=?');

// 发送OCR结果
OcrAdapter.sendOcrResult('通过OCR识别的题目内容...');
```

#### 2. 使用便捷函数

```typescript
import { sendImageToAI, sendLatexToAI, sendTextToAI } from './services/communication';

// 发送图片
sendImageToAI('http://example.com/image.png', '这是一道数学题');

// 发送LaTeX
sendLatexToAI('$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$');

// 发送文本
sendTextToAI('这是一个简单的问题：1+1=?');
```

#### 3. 直接使用通信服务

```typescript
import { CommunicationService, MessageType } from './services/communication';

const service = CommunicationService.getInstance();

// 发送自定义消息
service.sendMessageToAI({
  type: MessageType.EXAM_QUESTION_TEXT,
  content: '这是一个自定义消息',
  timestamp: Date.now()
});
```

### 在AI助手程序中接收消息

要在AI助手程序中接收消息，请参考 `receiver-example.ts` 文件，将其复制到AI助手程序中并进行适当调整。

基本使用流程：

```typescript
// 导入或获取接收器实例
import { receiverInstance } from './path/to/receiver';

// 添加消息处理器
receiverInstance.addMessageHandler('EXAM_QUESTION_IMAGE', (message) => {
  console.log('收到图片消息:', message);
  // 处理图片消息
});

// 添加通用消息处理器
receiverInstance.addMessageHandler('*', (message) => {
  console.log('收到任意类型消息:', message);
  // 通用处理逻辑
});
```

## 安全注意事项

1. **来源验证** - 通信模块会验证消息来源，只接受来自允许域名的消息
2. **消息验证** - 接收时验证消息格式，防止处理无效消息
3. **错误处理** - 捕获并记录所有异常，确保通信错误不会影响整个应用

## 调试与故障排除

### 启用调试模式

所有通信操作都会在控制台输出调试信息，格式为：`CommunicationService: [操作描述]`

### 常见问题解决方案

1. **无法发送消息**
   - 检查AI助手iframe是否已加载完成
   - 确认Origin和目标域名正确配置

2. **接收消息失败**
   - 检查允许的域名列表是否包含发送方域名
   - 确保消息格式正确

3. **跨域问题**
   - 确保两个应用都运行在相同的源或已正确配置CORS

## 与现有系统集成

本通信模块已在以下组件中集成：

1. `AiDialog.tsx` - AI对话框组件，自动初始化通信服务
2. `Exams.tsx` - 考题页面，使用通信服务发送题目内容 