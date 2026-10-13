/**
 * 消息接收器示例 - 用于AI助手程序(5011端口)
 * 
 * 这个文件展示了如何在AI助手程序中接收和处理来自主程序的消息
 * 注意：此文件应复制到AI助手程序的代码中，而不是主程序
 */

import { MessageType } from './types';

// 定义接收的消息类型
interface ReceivedImageMessage {
  type: string;
  content: string;
  timestamp: number;
  imageUrl: string;
  imageType?: string;
}

interface ReceivedTextMessage {
  type: string;
  content: string;
  timestamp: number;
  format?: 'plain' | 'latex' | 'markdown';
}

type ReceivedMessage = ReceivedImageMessage | ReceivedTextMessage | any;

// 消息处理器
class MessageReceiver {
  private static instance: MessageReceiver;
  private messageHandlers: Map<string, Function[]> = new Map();
  private isInitialized: boolean = false;
  
  // 允许的源域
  private allowedOrigins = [
    'http://localhost:5020',  // 主程序域名
    'http://127.0.0.1:5173'   // 替代主程序域名
  ];

  private constructor() {
    this.initialize();
  }

  public static getInstance(): MessageReceiver {
    if (!MessageReceiver.instance) {
      MessageReceiver.instance = new MessageReceiver();
    }
    return MessageReceiver.instance;
  }

  // 初始化消息监听
  private initialize(): void {
    if (this.isInitialized) return;
    
    console.log('AI助手: 初始化消息接收器');
    
    // 监听 postMessage 消息
    window.addEventListener('message', this.handlePostMessage);
    
    // 监听 localStorage 变化
    window.addEventListener('storage', this.handleStorageChange);
    
    this.isInitialized = true;
  }

  // 处理 postMessage 消息
  private handlePostMessage = (event: MessageEvent): void => {
    // 安全检查：验证消息来源
    if (!this.allowedOrigins.includes(event.origin)) {
      console.warn(`AI助手: 拒绝来自未授权域名的消息: ${event.origin}`);
      return;
    }

    const message = event.data as ReceivedMessage;
    if (!message || !message.type) {
      console.warn('AI助手: 接收到无效消息格式');
      return;
    }

    console.log(`AI助手: 收到postMessage消息，类型: ${message.type}`);
    this.processMessage(message);
  };

  // 处理 localStorage 变化
  private handleStorageChange = (event: StorageEvent): void => {
    if (!event.key || !event.key.startsWith('COMMUNICATION_')) return;
    
    const messageType = event.key.replace('COMMUNICATION_', '');
    if (!event.newValue) return;
    
    try {
      const message = JSON.parse(event.newValue) as ReceivedMessage;
      console.log(`AI助手: 收到localStorage消息，类型: ${messageType}`);
      this.processMessage(message);
    } catch (error) {
      console.error('AI助手: 解析localStorage数据失败', error);
    }
  };

  // 处理接收到的消息
  private processMessage(message: ReceivedMessage): void {
    const { type } = message;
    
    // 实现各种消息类型的处理逻辑
    switch (type) {
      case MessageType.EXAM_QUESTION_IMAGE:
        this.handleImageMessage(message as ReceivedImageMessage);
        break;
      
      case MessageType.EXAM_QUESTION_LATEX:
        this.handleLatexMessage(message as ReceivedTextMessage);
        break;
        
      case MessageType.EXAM_QUESTION_TEXT:
        this.handleTextMessage(message as ReceivedTextMessage);
        break;
        
      case MessageType.OCR_QUESTION_RESULT:
        this.handleOcrResultMessage(message as ReceivedTextMessage);
        break;
        
      default:
        console.log(`AI助手: 收到未知类型消息: ${type}`, message);
        // 触发通用消息处理器
        this.notifyHandlers('*', message);
    }
    
    // 同时触发特定类型的处理器
    this.notifyHandlers(type, message);
  }

  // 处理图片消息
  private handleImageMessage(message: ReceivedImageMessage): void {
    console.log('AI助手: 收到图片消息', message);
    
    // 可以在这里将图片显示到UI上
    const { imageUrl, content } = message;
    
    // 这里只是示例代码，实际实现需要根据AI助手的UI框架来写
    const imageElement = document.createElement('img');
    imageElement.src = imageUrl;
    imageElement.alt = content;
    imageElement.style.maxWidth = '100%';
    
    // 将图片添加到AI助手的聊天窗口或其他指定位置
    const container = document.getElementById('ai-assistant-chat-container');
    if (container) {
      container.appendChild(imageElement);
      
      // 可以同时添加描述文本
      const descriptionElement = document.createElement('p');
      descriptionElement.textContent = `收到题目: ${content}`;
      container.appendChild(descriptionElement);
    }
  }

  // 处理LaTeX消息
  private handleLatexMessage(message: ReceivedTextMessage): void {
    console.log('AI助手: 收到LaTeX消息', message);
    
    // 这里需要根据AI助手应用的LaTeX渲染库来处理
    const { content } = message;
    
    // 示例：如果使用MathJax
    if (window.MathJax) {
      // 创建容器并添加到UI
      const latexContainer = document.createElement('div');
      latexContainer.innerHTML = content;
      
      const container = document.getElementById('ai-assistant-chat-container');
      if (container) {
        container.appendChild(latexContainer);
        
        // 触发MathJax重新渲染
        window.MathJax.typeset([latexContainer]);
      }
    } else {
      console.log('AI助手: MathJax未加载，显示原始LaTeX代码');
      // 备用方案：显示原始LaTeX代码
      const codeElement = document.createElement('pre');
      codeElement.textContent = content;
      
      const container = document.getElementById('ai-assistant-chat-container');
      if (container) {
        container.appendChild(codeElement);
      }
    }
  }

  // 处理文本消息
  private handleTextMessage(message: ReceivedTextMessage): void {
    console.log('AI助手: 收到文本消息', message);
    
    // 显示文本消息
    const { content } = message;
    
    // 创建文本元素并添加到UI
    const textElement = document.createElement('p');
    textElement.textContent = content;
    
    const container = document.getElementById('ai-assistant-chat-container');
    if (container) {
      container.appendChild(textElement);
    }
  }

  // 处理OCR结果消息
  private handleOcrResultMessage(message: ReceivedTextMessage): void {
    console.log('AI助手: 收到OCR结果消息', message);
    
    // 处理OCR文本结果
    const { content } = message;
    
    // 创建OCR结果元素并添加到UI
    const ocrElement = document.createElement('div');
    ocrElement.innerHTML = `<strong>OCR识别结果:</strong><p>${content}</p>`;
    
    const container = document.getElementById('ai-assistant-chat-container');
    if (container) {
      container.appendChild(ocrElement);
    }
  }

  // 添加消息处理器
  public addMessageHandler(type: string, handler: Function): void {
    const handlers = this.messageHandlers.get(type) || [];
    this.messageHandlers.set(type, [...handlers, handler]);
  }

  // 移除消息处理器
  public removeMessageHandler(type: string, handler: Function): void {
    const handlers = this.messageHandlers.get(type) || [];
    this.messageHandlers.set(
      type,
      handlers.filter(h => h !== handler)
    );
  }

  // 通知处理器
  private notifyHandlers(type: string, message: ReceivedMessage): void {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error(`AI助手: 执行处理器时出错`, error);
      }
    });
  }

  // 清理资源
  public destroy(): void {
    window.removeEventListener('message', this.handlePostMessage);
    window.removeEventListener('storage', this.handleStorageChange);
    this.messageHandlers.clear();
    this.isInitialized = false;
  }
}

// 声明全局MathJax类型
declare global {
  interface Window {
    MathJax?: {
      typeset: (elements: HTMLElement[]) => void;
    };
  }
}

// 导出单例
export const receiverInstance = MessageReceiver.getInstance();

// 示例使用方法
// 在AI助手程序中初始化接收器
document.addEventListener('DOMContentLoaded', () => {
  // 获取接收器实例
  const receiver = MessageReceiver.getInstance();
  
  // 添加一个通用消息处理器
  receiver.addMessageHandler('*', (message: any) => {
    console.log('AI助手: 通用处理器收到消息', message);
    
    // 可以在这里将消息添加到AI助手的聊天记录中
    // 或者触发AI生成回复的逻辑
  });
  
  console.log('AI助手: 消息接收器已准备就绪');
}); 