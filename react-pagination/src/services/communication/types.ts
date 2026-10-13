/**
 * 通信服务类型定义文件
 * 定义主程序与副程序之间通信的数据结构和类型
 */

// 通信数据类型枚举
export enum MessageType {
  OCR_QUESTION_RESULT = 'OCR_QUESTION_RESULT',      // OCR识别结果
  EXAM_QUESTION_TEXT = 'EXAM_QUESTION_TEXT',        // 文本题目
  EXAM_QUESTION_LATEX = 'EXAM_QUESTION_LATEX',      // LaTeX题目
  EXAM_QUESTION_IMAGE = 'EXAM_QUESTION_IMAGE',      // 图片题目
  GENERAL_MESSAGE = 'GENERAL_MESSAGE'               // 通用消息
}

// 基础消息接口
export interface BaseMessage {
  type: MessageType | string;
  content: string;
  timestamp: number;
}

// 图片消息接口
export interface ImageMessage extends BaseMessage {
  imageUrl: string;         // 图片URL
  imageType?: string;       // 图片类型(如png, jpeg等)
  imageSize?: number;       // 图片大小(字节)
}

// 文本类消息接口
export interface TextMessage extends BaseMessage {
  format?: 'plain' | 'latex' | 'markdown';  // 文本格式
}

// 组合消息类型
export type CommunicationMessage = BaseMessage | ImageMessage | TextMessage;

// 通信事件监听器类型
export type MessageListener = (message: CommunicationMessage) => void;

// 通信结果类型
export interface CommunicationResult {
  success: boolean;
  message?: string;
  error?: string;
} 