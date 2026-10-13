/**
 * 通信服务模块入口
 * 导出所有通信相关功能，提供统一的接口
 */

// 导出通信服务核心
import CommunicationService from './CommunicationService';
export { default as CommunicationService } from './CommunicationService';

// 导出类型定义
export * from './types';

// 导出适配器
export * from './adapters';

// 提供便捷访问方法
export const getService = (): CommunicationService => {
  return CommunicationService.getInstance();
};

/**
 * 特定消息类型的便捷发送方法
 */

// 发送图片
export const sendImageToAI = (imageUrl: string, description: string = '图片内容') => {
  const instance = CommunicationService.getInstance();
  return instance.sendMessageToAI({
    type: 'EXAM_QUESTION_IMAGE',
    content: description,
    timestamp: Date.now(),
    imageUrl
  });
};

// 发送LaTeX内容
export const sendLatexToAI = (latexCode: string) => {
  const instance = CommunicationService.getInstance();
  return instance.sendMessageToAI({
    type: 'EXAM_QUESTION_LATEX',
    content: latexCode,
    timestamp: Date.now(),
    format: 'latex'
  });
};

// 发送OCR识别结果
export const sendOcrToAI = (ocrResult: string) => {
  const instance = CommunicationService.getInstance();
  return instance.sendMessageToAI({
    type: 'OCR_QUESTION_RESULT',
    content: `识别题目结果：${ocrResult}`,
    timestamp: Date.now()
  });
};

// 发送普通文本
export const sendTextToAI = (text: string) => {
  const instance = CommunicationService.getInstance();
  return instance.sendMessageToAI({
    type: 'EXAM_QUESTION_TEXT',
    content: text,
    timestamp: Date.now()
  });
}; 