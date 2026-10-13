/**
 * 安全的localStorage工具函数
 * 解决服务端渲染(SSR)中访问localStorage不可用的问题
 */

// 检查是否为客户端环境
const isClient = typeof window !== 'undefined';

/**
 * 安全地从localStorage获取数据
 * @param key 存储键名
 * @param defaultValue 默认值（当获取失败时返回）
 * @returns 存储的值或默认值
 */
export const getItem = <T>(key: string, defaultValue?: T): T | null | undefined => {
  if (!isClient) {
    return defaultValue === undefined ? null : defaultValue;
  }

  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return defaultValue === undefined ? null : defaultValue;
    }
    
    // 尝试解析JSON数据
    try {
      return JSON.parse(item);
    } catch {
      // 如果不是有效的JSON，直接返回字符串
      return item as unknown as T;
    }
  } catch (error) {
    console.error(`读取localStorage[${key}]失败:`, error);
    return defaultValue === undefined ? null : defaultValue;
  }
};

/**
 * 安全地向localStorage写入数据
 * @param key 存储键名
 * @param value 要存储的值
 * @returns 操作是否成功
 */
export const setItem = (key: string, value: any): boolean => {
  if (!isClient) {
    console.log(`skip setItem ${key}`);
    return false;
  }

  try {
    const valueToStore = typeof value === 'object' ? JSON.stringify(value) : String(value);
    localStorage.setItem(key, valueToStore);
    return true;
  } catch (error) {
    console.error(`写入localStorage[${key}]失败:`, error);
    return false;
  }
};

/**
 * 安全地从localStorage移除数据
 * @param key 存储键名
 * @returns 操作是否成功
 */
export const removeItem = (key: string): boolean => {
  if (!isClient) {
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`移除localStorage[${key}]失败:`, error);
    return false;
  }
};

/**
 * 安全地清空localStorage
 * @returns 操作是否成功
 */
export const clear = (): boolean => {
  if (!isClient) {
    return false;
  }

  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.error('清空localStorage失败:', error);
    return false;
  }
};

/**
 * 获取localStorage中所有键名
 * @returns 键名数组或空数组
 */
export const getAllKeys = (): string[] => {
  if (!isClient) {
    return [];
  }

  try {
    return Object.keys(localStorage);
  } catch (error) {
    console.error('获取localStorage键名失败:', error);
    return [];
  }
};

/**
 * 检查localStorage中是否存在某个键
 * @param key 存储键名
 * @returns 是否存在
 */
export const hasKey = (key: string): boolean => {
  if (!isClient) {
    return false;
  }

  try {
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.error(`检查localStorage[${key}]存在性失败:`, error);
    return false;
  }
};

export default {
  getItem,
  setItem,
  removeItem,
  clear,
  getAllKeys,
  hasKey
}; 