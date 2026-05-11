/**
 * 错误处理工具
 * 提供统一的错误处理、错误消息提取和错误类型判断功能
 */
import axios from 'axios';
import type { ErrorDetails } from '../types/api';
import { apiBaseForMessage } from '../config/env';

/**
 * 判断是否为请求被取消的错误
 * 用于识别刷新、导航、同 key 后发请求取消前一个等场景的错误
 * @param err 错误对象
 * @returns 是否为取消错误
 */
export function isRequestCanceled(err: unknown): boolean {
  // 检查 Axios 取消错误
  if (axios.isAxiosError(err)) {
    if (err.code === 'ERR_CANCELED') return true;
    if (typeof err.message === 'string' && err.message.toLowerCase() === 'canceled') return true;
  }
  // 检查 AbortError（Fetch API 取消错误）
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}

/**
 * 获取错误消息
 * @param err 错误对象
 * @param fallback 默认错误消息
 * @returns 错误消息字符串
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  const details = getErrorDetails(err, fallback);
  return details.message;
}

/**
 * 获取详细的错误信息
 * @param err 错误对象
 * @param fallback 默认错误消息
 * @returns 错误详情对象
 */
export function getErrorDetails(err: unknown, fallback: string): ErrorDetails {
  // 处理 Axios 错误
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    
    // 尝试从响应数据中提取错误信息
    if (data && typeof data === 'object') {
      // 尝试提取 message 字段
      if ('message' in data && typeof data.message === 'string') {
        return {
          message: data.message,
          code: 'code' in data && typeof data.code === 'string' ? data.code : undefined,
          field: 'field' in data && typeof data.field === 'string' ? data.field : undefined,
          details: data as Record<string, unknown>,
        };
      }
      // 尝试提取 error 字段
      if ('error' in data && typeof data.error === 'string') {
        return {
          message: data.error,
          code: 'code' in data && typeof data.code === 'string' ? data.code : undefined,
          details: data as Record<string, unknown>,
        };
      }
    }
    
    // 根据 HTTP 状态码提供更友好的错误消息
    const status = err.response?.status;
    if (status === 401) {
      return {
        message: '登录已过期，请重新登录',
        code: 'UNAUTHORIZED',
      };
    }
    if (status === 403) {
      return {
        message: '没有权限执行此操作',
        code: 'FORBIDDEN',
      };
    }
    if (status === 404) {
      return {
        message: '请求的资源不存在',
        code: 'NOT_FOUND',
      };
    }
    if (status === 413) {
      return {
        message: '文件或分块超过限制，单文件最大 100MB。请重启后端后重试。',
        code: 'FILE_TOO_LARGE',
      };
    }
    if (status === 422) {
      return {
        message: '请求数据验证失败',
        code: 'VALIDATION_ERROR',
      };
    }
    if (status === 429) {
      return {
        message: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMIT_EXCEEDED',
      };
    }
    if (status && status >= 500) {
      return {
        message: '服务器错误，请稍后重试',
        code: 'SERVER_ERROR',
      };
    }
    
    // 处理网络错误（无法连接到服务器）
    if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
      return {
        message: `无法连接到服务器，请确保后端服务正在运行（${apiBaseForMessage()}）`,
        code: 'NETWORK_ERROR',
      };
    }
    
    // 请求被取消，不向用户展示
    if (err.code === 'ERR_CANCELED' || (typeof err.message === 'string' && err.message.toLowerCase() === 'canceled')) {
      return { message: '', code: 'CANCELED' };
    }
    
    // 使用 Axios 错误消息
    if (typeof err.message === 'string') {
      return { message: err.message };
    }
  }
  
  // 处理通用错误
  if (err instanceof Error) {
    // 处理网络错误
    if (err.message === 'Network Error' || err.message.includes('ERR_NETWORK')) {
      return {
        message: `无法连接到服务器，请确保后端服务正在运行（${apiBaseForMessage()}）`,
        code: 'NETWORK_ERROR',
      };
    }
    return { message: err.message };
  }
  
  // 默认错误消息
  return { message: fallback };
}

/**
 * 处理 API 错误
 * @param err 错误对象
 * @param onError 错误回调函数
 * @param fallback 默认错误消息
 */
export function handleApiError(err: unknown, onError: (message: string) => void, fallback: string = '操作失败'): void {
  // 忽略取消错误
  if (isRequestCanceled(err)) return;
  
  // 获取错误消息并调用回调
  const errorMessage = getErrorMessage(err, fallback);
  if (errorMessage) {
    onError(errorMessage);
  }
}
