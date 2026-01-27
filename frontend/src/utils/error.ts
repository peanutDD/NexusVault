import axios from 'axios';

export interface ErrorDetails {
  message: string;
  code?: string;
  field?: string;
  details?: Record<string, unknown>;
}

export function getErrorMessage(err: unknown, fallback: string): string {
  const details = getErrorDetails(err, fallback);
  return details.message;
}

export function getErrorDetails(err: unknown, fallback: string): ErrorDetails {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof data === 'object') {
      // 尝试提取详细错误信息
      if ('message' in data && typeof data.message === 'string') {
        return {
          message: data.message,
          code: 'code' in data && typeof data.code === 'string' ? data.code : undefined,
          field: 'field' in data && typeof data.field === 'string' ? data.field : undefined,
          details: data as Record<string, unknown>,
        };
      }
      // 如果有 error 字段
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
        message: '无法连接到服务器，请确保后端服务正在运行（http://localhost:3000）',
        code: 'NETWORK_ERROR',
      };
    }
    if (typeof err.message === 'string') {
      return { message: err.message };
    }
  }
  if (err instanceof Error) {
    // 处理网络错误
    if (err.message === 'Network Error' || err.message.includes('ERR_NETWORK')) {
      return {
        message: '无法连接到服务器，请确保后端服务正在运行（http://localhost:3000）',
        code: 'NETWORK_ERROR',
      };
    }
    return { message: err.message };
  }
  return { message: fallback };
}
