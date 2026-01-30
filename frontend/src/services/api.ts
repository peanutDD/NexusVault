/**
 * API 服务基础配置
 * 提供 axios 实例创建、请求/响应拦截器、请求去重、请求取消等功能
 */
import axios, { type InternalAxiosRequestConfig, type AxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';
import { API_BASE_URL } from '../config/env';
import { useAuthStore } from '../store/authStore';
import { retry } from '../utils/retry';
import { REQUEST } from '../constants';
import { globalRequestLimiter } from '../utils/requestLimiter';
import { createDedupAdapter, type AxiosAdapter } from '../utils/globalRequestDedup';

/**
 * 扩展 AxiosRequestConfig 类型，添加重试标记
 */
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  __retryDone?: boolean;
}

// 避免每个请求都同步读 localStorage（高频预览/上传场景会放大开销）
let tokenCache: string | null | undefined = undefined;

/**
 * 获取缓存的认证 token
 * @returns 认证 token 或 null
 */
function getTokenCached(): string | null {
  if (tokenCache !== undefined) return tokenCache;
  tokenCache = useAuthStore.getState().token ?? localStorage.getItem('token');
  return tokenCache;
}

/**
 * 订阅 store/token 与跨标签页 token 变化
 */
if (typeof window !== 'undefined') {
  // 初始化 token 缓存
  tokenCache = useAuthStore.getState().token ?? localStorage.getItem('token');
  
  // 订阅 store 中 token 的变化
  useAuthStore.subscribe((state) => {
    tokenCache = state.token;
  });
  
  // 监听跨标签页 token 变化
  window.addEventListener('storage', (event) => {
    if (event.key === 'token') tokenCache = event.newValue;
  });
}

/**
 * 请求取消控制器映射：相同 key 的后发请求会取消前一个
 * 仅对搜索/列表查询生效
 */
const abortControllers = new Map<string, AbortController>();

/**
 * 判断是否为需要请求取消的 URL
 * @param url 请求 URL
 * @returns 是否需要请求取消
 */
function shouldCancelRequest(url: string): boolean {
  // 只对文件列表查询应用取消逻辑（搜索、筛选、分页等会频繁变化）
  return url.includes('/api/files') && url.includes('?');
}

/**
 * 生成请求唯一标识 key
 * @param config 请求配置
 * @returns 请求 key
 */
function getRequestKey(config: InternalAxiosRequestConfig): string {
  const url = config.url ?? '';
  const params = config.params;
  let query = '';
  
  if (params != null) {
    if (params instanceof URLSearchParams) {
      query = params.toString();
    } else if (typeof params === 'object' && !Array.isArray(params)) {
      const entries = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)] as [string, string]);
      query = new URLSearchParams(entries).toString();
    } else {
      query = String(params);
    }
  }
  
  const fullUrl = query ? `${url}?${query}` : url;
  return `${(config.method ?? 'get').toLowerCase()}_${fullUrl}`;
}

/**
 * 清理请求取消控制器
 * @param config 请求配置
 */
function clearAbortController(config: InternalAxiosRequestConfig | undefined): void {
  if (!config || (config.method ?? 'get').toLowerCase() !== 'get') return;
  const url = config.url ?? '';
  if (shouldCancelRequest(url)) {
    abortControllers.delete(getRequestKey(config));
  }
}

/**
 * 处理 API 错误
 * @param error Axios 错误对象
 * @returns 处理后的错误
 */
function handleApiError(error: AxiosError): Promise<never> {
  // 处理 401 未授权错误
  if (error.response?.status === 401) {
    useAuthStore.getState().clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
  
  // 处理其他错误
  return Promise.reject(error);
}

/**
 * 处理 GET 请求重试逻辑
 * @param error Axios 错误对象
 * @param config 请求配置
 * @returns 重试后的响应或拒绝的错误
 */
async function handleGetRequestRetry(error: AxiosError, config: ExtendedAxiosRequestConfig): Promise<AxiosResponse | never> {
  const isGet = config.method === 'get';
  const retryable =
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNABORTED' ||
    (error.response?.status != null && error.response.status >= 500);
  const notRetriedYet = !config.__retryDone;
  
  if (isGet && notRetriedYet && retryable) {
    config.__retryDone = true;
    try {
      return await retry(
        () => api.request(config),
        {
          maxRetries: REQUEST.RETRY_MAX,
          initialDelay: REQUEST.RETRY_INITIAL_DELAY_MS,
          maxDelay: REQUEST.RETRY_MAX_DELAY_MS,
        }
      );
    } catch (retryErr) {
      return Promise.reject(retryErr);
    }
  }
  
  return Promise.reject(error);
}

// 创建 axios 实例
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 全局请求去重 + TTL 内复用：相同请求 5 秒内不重复发送，复用缓存或飞行中 Promise
// axios.defaults.adapter 可能是数组 ['xhr','http','fetch'] 而非函数，需用 getAdapter 解析后再包装
const rawAdapter = api.defaults.adapter ?? axios.defaults.adapter;
const getAdapter = (axios as unknown as { getAdapter?: (a: unknown, c: InternalAxiosRequestConfig) => AxiosAdapter }).getAdapter;
const adapterFn: AxiosAdapter | null =
  typeof rawAdapter === 'function'
    ? (rawAdapter as AxiosAdapter)
    : rawAdapter != null && typeof getAdapter === 'function'
      ? getAdapter(rawAdapter, {} as InternalAxiosRequestConfig)
      : null;

if (adapterFn) {
  api.defaults.adapter = createDedupAdapter(adapterFn);
}

// 请求拦截器：添加认证 token + 处理请求取消
api.interceptors.request.use(
  (config) => {
    // 添加认证 token
    const token = getTokenCached();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 处理 FormData 请求（自动设置 Content-Type）
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    // 处理请求取消（仅对 GET 请求的搜索/列表查询生效）
    const isGet = (config.method ?? 'get').toLowerCase() === 'get';
    const url = config.url ?? '';
    
    if (isGet && config.signal == null && shouldCancelRequest(url)) {
      const key = getRequestKey(config as InternalAxiosRequestConfig);
      
      // 取消之前的相同请求
      const existing = abortControllers.get(key);
      if (existing) {
        existing.abort();
      }
      
      // 创建新的取消控制器
      const controller = new AbortController();
      config.signal = controller.signal;
      abortControllers.set(key, controller);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：处理 401 错误 + 清理取消控制器 + GET 请求重试
api.interceptors.response.use(
  (response) => {
    // 清理取消控制器
    clearAbortController(response.config as InternalAxiosRequestConfig);
    return response;
  },
  async (error) => {
    // 清理取消控制器
    const config = error.config as ExtendedAxiosRequestConfig | undefined;
    if (config) {
      clearAbortController(config);
    }

    // 处理 API 错误
    const handledError = await handleApiError(error);
    
    // 处理 GET 请求重试
    if (config) {
      return handleGetRequestRetry(error, config);
    }
    
    return handledError;
  }
);

export default api;

/**
 * 全局限流 API：所有请求经 globalRequestLimiter 排队，防止浏览器连接数耗尽
 * 用于高频请求（文件列表、搜索、预览等），降低后端并发压力
 */
export const limitedApi = {
  /**
   * 发送 GET 请求
   * @param url 请求 URL
   * @param config 请求配置
   * @returns 响应Promise
   */
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return globalRequestLimiter.limit(() => api.get<T>(url, config));
  },
  
  /**
   * 发送 POST 请求
   * @param url 请求 URL
   * @param data 请求数据
   * @param config 请求配置
   * @returns 响应Promise
   */
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return globalRequestLimiter.limit(() => api.post<T>(url, data, config));
  },
  
  /**
   * 发送 PUT 请求
   * @param url 请求 URL
   * @param data 请求数据
   * @param config 请求配置
   * @returns 响应Promise
   */
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return globalRequestLimiter.limit(() => api.put<T>(url, data, config));
  },
  
  /**
   * 发送 DELETE 请求
   * @param url 请求 URL
   * @param config 请求配置
   * @returns 响应Promise
   */
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return globalRequestLimiter.limit(() => api.delete<T>(url, config));
  },
  
  /**
   * 发送通用请求
   * @param config 请求配置
   * @returns 响应Promise
   */
  request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return globalRequestLimiter.limit(() => api.request<T>(config));
  },
};
