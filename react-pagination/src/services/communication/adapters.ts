/**
 * 通信适配器模块
 * 适配不同类型的数据传输，提供特定数据类型的发送功能
 */

import CommunicationService from './CommunicationService';
import { MessageType, CommunicationMessage, CommunicationResult, ImageMessage, TextMessage } from './types';

/**
 * 获取通信服务实例
 */
const getCommunicationService = (): CommunicationService => {
  return CommunicationService.getInstance();
};

/**
 * 图片适配器 - 处理图片类型数据的传输
 */
export const ImageAdapter = {
  /**
   * 发送图片消息到AI助手
   * @param imageUrl 图片URL
   * @param description 图片描述
   * @param imageType 可选的图片类型
   */
  sendImage(imageUrl: string, description: string, imageType?: string): CommunicationResult {
    const message: ImageMessage = {
      type: MessageType.EXAM_QUESTION_IMAGE,
      content: description,
      timestamp: Date.now(),
      imageUrl,
      ...(imageType && { imageType })
    };

    return getCommunicationService().sendMessageToAI(message);
  }
};

/**
 * 文本适配器 - 处理文本类型数据的传输
 */
export const TextAdapter = {
  /**
   * 发送普通文本到AI助手
   * @param text 文本内容
   */
  sendText(text: string): CommunicationResult {
    const message: TextMessage = {
      type: MessageType.EXAM_QUESTION_TEXT,
      content: text,
      timestamp: Date.now(),
      format: 'plain'
    };

    return getCommunicationService().sendMessageToAI(message);
  },

  /**
   * 发送LaTeX格式文本到AI助手
   * @param latexCode LaTeX格式的文本
   */
  sendLatexText(latexCode: string): CommunicationResult {
    const message: TextMessage = {
      type: MessageType.EXAM_QUESTION_LATEX,
      content: latexCode,
      timestamp: Date.now(),
      format: 'latex'
    };

    return getCommunicationService().sendMessageToAI(message);
  }
};

/**
 * OCR适配器 - 处理OCR识别结果的传输
 */
export const OcrAdapter = {
  /**
   * 发送OCR识别结果到AI助手
   * @param ocrResult OCR识别文本结果
   */
  sendOcrResult(ocrResult: string): CommunicationResult {
    const message: TextMessage = {
      type: MessageType.OCR_QUESTION_RESULT,
      content: `识别题目结果：${ocrResult}`,
      timestamp: Date.now(),
      format: 'plain'
    };

    return getCommunicationService().sendMessageToAI(message);
  }
};

/**
 * 通用适配器 - 提供基础的消息发送功能
 */
export const GeneralAdapter = {
  /**
   * 发送自定义消息到AI助手
   * @param message 自定义消息对象
   */
  sendCustomMessage(message: CommunicationMessage): CommunicationResult {
    // 确保消息有时间戳
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    return getCommunicationService().sendMessageToAI(message);
  }
}; 