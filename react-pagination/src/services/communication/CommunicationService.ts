/**
 * 通信服务模块
 * 实现主程序与副程序之间的数据传输功能
 */

import { CommunicationMessage, CommunicationResult, MessageListener } from './types';

// 副程序域名白名单
const ALLOWED_DOMAINS = ['http://localhost:5011'];

// 存储键名前缀
const STORAGE_KEY_PREFIX = 'COMMUNICATION_';

class CommunicationService {
  private listeners: Map<string, MessageListener[]> = new Map();
  private static instance: CommunicationService;

  private constructor() {
    // 初始化消息监听器
    this.initMessageListener();
    console.log('CommunicationService: 初始化完成');
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): CommunicationService {
    if (!CommunicationService.instance) {
      CommunicationService.instance = new CommunicationService();
    }
    return CommunicationService.instance;
  }

  /**
   * 初始化消息监听器
   */
  private initMessageListener(): void {
    // 监听来自其他窗口的postMessage消息
    window.addEventListener('message', this.handleIncomingMessage);
    
    // 监听localStorage变化的事件
    window.addEventListener('storage', this.handleStorageChange);
    
    console.log('CommunicationService: 事件监听器已注册');
  }

  /**
   * 处理接收到的postMessage消息
   */
  private handleIncomingMessage = (event: MessageEvent): void => {
    // 安全检查：验证消息来源
    if (!ALLOWED_DOMAINS.includes(event.origin) && 
        !event.origin.startsWith('http://localhost:5020')) {
      console.warn(`CommunicationService: 拒绝来自未授权域名的消息: ${event.origin}`);
      return;
    }

    const message = event.data as CommunicationMessage;
    if (!message || !message.type) {
      console.warn('CommunicationService: 接收到无效消息格式');
      return;
    }

    console.log(`CommunicationService: 收到消息类型 ${message.type}，来自 ${event.origin}`);
    
    // 触发对应类型的事件监听器
    this.notifyListeners(message.type, message);
    
    // 同时保存到localStorage以便跨页面共享
    this.saveToStorage(message);
  }

  /**
   * 处理localStorage变化事件
   */
  private handleStorageChange = (event: StorageEvent): void => {
    // 检查是否是通信相关的键
    if (event.key && event.key.startsWith(STORAGE_KEY_PREFIX)) {
      const messageType = event.key.replace(STORAGE_KEY_PREFIX, '');
      
      try {
        if (event.newValue) {
          const message = JSON.parse(event.newValue) as CommunicationMessage;
          console.log(`CommunicationService: 检测到本地存储变化，消息类型 ${messageType}`);
          
          // 通知监听器
          this.notifyListeners(messageType, message);
        }
      } catch (error) {
        console.error('CommunicationService: 解析本地存储数据失败', error);
      }
    }
  }

  /**
   * 向AI助手发送消息
   * @param message 消息对象
   * @returns 消息发送结果
   */
  public sendMessageToAI(message: CommunicationMessage): CommunicationResult {
    try {
      console.log(`CommunicationService: 正在发送消息类型 ${message.type}`);
      
      // 确保时间戳存在
      if (!message.timestamp) {
        message.timestamp = Date.now();
      }

      // 策略1: 使用postMessage向iframe发送消息
      const iframeResult = this.sendViaIframe(message);
      
      // 策略2: 使用localStorage作为备选方案
      if (!iframeResult.success) {
        console.log('CommunicationService: PostMessage失败，尝试使用localStorage');
        return this.sendViaLocalStorage(message);
      }
      
      return iframeResult;
    } catch (error: unknown) {
      const err = error as Error;
      console.error('CommunicationService: 发送消息失败', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * 通过iframe的postMessage发送消息
   */
  private sendViaIframe(message: CommunicationMessage): CommunicationResult {
    // 查找页面中的所有AI助手iframe
    const aiIframes = document.querySelectorAll('iframe[src*="localhost:5011"]');
    
    if (aiIframes.length === 0) {
      return { 
        success: false, 
        error: 'CommunicationService: 未找到AI助手iframe' 
      };
    }
    
    let success = false;
    
    // 尝试向所有找到的iframe发送消息
    aiIframes.forEach(iframe => {
      try {
        const aiIframe = iframe as HTMLIFrameElement;
        if (aiIframe.contentWindow) {
          aiIframe.contentWindow.postMessage(message, 'http://localhost:5011');
          console.log(`CommunicationService: 成功通过postMessage发送消息`);
          success = true;
        }
      } catch (error) {
        console.warn('CommunicationService: 向单个iframe发送失败，尝试下一个');
      }
    });
    
    return { 
      success,
      message: success ? '成功通过iframe发送消息' : '所有iframe发送尝试均失败'
    };
  }

  /**
   * 通过localStorage发送消息
   */
  private sendViaLocalStorage(message: CommunicationMessage): CommunicationResult {
    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${message.type}`;
      localStorage.setItem(storageKey, JSON.stringify(message));
      console.log(`CommunicationService: 成功通过localStorage存储消息: ${storageKey}`);
      return { success: true, message: '已通过localStorage存储消息' };
    } catch (error: unknown) {
      const err = error as Error;
      return { success: false, error: `localStorage存储失败: ${err.message}` };
    }
  }

  /**
   * 通知特定类型的所有监听器
   */
  private notifyListeners(type: string, message: CommunicationMessage): void {
    const listeners = this.listeners.get(type) || [];
    listeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error(`CommunicationService: 执行监听器时出错`, error);
      }
    });
  }

  /**
   * 将消息保存到localStorage
   */
  private saveToStorage(message: CommunicationMessage): void {
    const storageKey = `${STORAGE_KEY_PREFIX}${message.type}`;
    localStorage.setItem(storageKey, JSON.stringify(message));
  }

  /**
   * 添加消息类型监听器
   */
  public addListener(type: string, listener: MessageListener): void {
    const currentListeners = this.listeners.get(type) || [];
    this.listeners.set(type, [...currentListeners, listener]);
    console.log(`CommunicationService: 已添加 ${type} 类型的监听器`);
  }

  /**
   * 移除消息类型监听器
   */
  public removeListener(type: string, listener: MessageListener): void {
    const currentListeners = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      currentListeners.filter(l => l !== listener)
    );
  }

  /**
   * 清除指定类型的所有监听器
   */
  public clearListeners(type: string): void {
    this.listeners.delete(type);
  }

  /**
   * 销毁服务实例，清理所有事件监听器
   */
  public destroy(): void {
    window.removeEventListener('message', this.handleIncomingMessage);
    window.removeEventListener('storage', this.handleStorageChange);
    this.listeners.clear();
    console.log('CommunicationService: 服务已销毁');
  }
}

export default CommunicationService; 