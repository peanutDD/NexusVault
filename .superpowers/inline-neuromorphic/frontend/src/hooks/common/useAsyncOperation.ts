import { useState, useCallback, useRef } from 'react';
import { getErrorMessage } from '../../utils/error';

interface UseAsyncOperationOptions<T> {
  /** 异步操作函数 */
  operation: () => Promise<T>;
  /** 成功回调 */
  onSuccess?: (result: T) => void;
  /** 失败回调 */
  onError?: (error: string) => void;
  /** 默认错误消息 */
  defaultErrorMessage?: string;
}

interface UseAsyncOperationReturn<T> {
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 操作结果 */
  result: T | null;
  /** 执行操作 */
  execute: () => Promise<T | null>;
  /** 重置状态 */
  reset: () => void;
  /** 清除错误 */
  clearError: () => void;
  /** 设置错误 */
  setError: (error: string | null) => void;
}

/**
 * 异步操作通用 Hook
 * 统一处理 loading、error、execute 模式
 */
export function useAsyncOperation<T = void>(
  options: UseAsyncOperationOptions<T>
): UseAsyncOperationReturn<T> {
  const { operation, onSuccess, onError, defaultErrorMessage = '操作失败' } = options;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  
  // 用于防止组件卸载后更新状态
  const mountedRef = useRef(true);

  const execute = useCallback(async (): Promise<T | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await operation();
      if (mountedRef.current) {
        setResult(res);
        setLoading(false);
        onSuccess?.(res);
      }
      return res;
    } catch (err) {
      if (mountedRef.current) {
        const errorMsg = getErrorMessage(err, defaultErrorMessage);
        setError(errorMsg);
        setLoading(false);
        onError?.(errorMsg);
      }
      return null;
    }
  }, [operation, onSuccess, onError, defaultErrorMessage]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setResult(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    result,
    execute,
    reset,
    clearError,
    setError,
  };
}

/**
 * 简化版异步操作 Hook
 * 适用于简单的 loading + error 场景
 */
export function useLoadingState() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startLoading = useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  const stopLoading = useCallback(() => {
    setLoading(false);
  }, []);

  const setErrorMessage = useCallback((message: string | null) => {
    setError(message);
    setLoading(false);
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return {
    loading,
    error,
    startLoading,
    stopLoading,
    setError: setErrorMessage,
    reset,
  };
}

export default useAsyncOperation;
