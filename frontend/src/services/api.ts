import axios, { type InternalAxiosRequestConfig, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { API_BASE_URL } from '../config/env';
import { useAuthStore } from '../store/authStore';
import { retry } from '../utils/retry';
import { REQUEST } from '../constants';
import { globalRequestLimiter } from '../utils/requestLimiter';

// 避免每个请求都同步读 localStorage（高频预览/上传场景会放大开销）
let tokenCache: string | null | undefined = undefined;

function getTokenCached(): string | null {
  if (tokenCache !== undefined) return tokenCache;
  tokenCache = useAuthStore.getState().token ?? localStorage.getItem('token');
  return tokenCache;
}

// 订阅 store/token 与跨标签页 token 变化
if (typeof window !== 'undefined') {
  tokenCache = useAuthStore.getState().token ?? localStorage.getItem('token');
  useAuthStore.subscribe((s) => {
    tokenCache = s.token;
  });
  window.addEventListener('storage', (e) => {
    if (e.key === 'token') tokenCache = e.newValue;
  });
}

/** 请求取消：相同 key 的后发请求会取消前一个（仅对搜索/列表查询生效） */
const abortControllers = new Map<string, AbortController>();

/**
 * 判断是否为需要请求取消的 URL（搜索/列表查询，不包括基础数据）
 */
function shouldCancelRequest(url: string): boolean {
  // 只对文件列表查询应用取消逻辑（搜索、筛选、分页等会频繁变化）
  return url.includes('/api/files') && url.includes('?');
}

function getRequestKey(config: InternalAxiosRequestConfig): string {
  const url = config.url ?? '';
  const params = config.params;
  let query = '';
  if (params != null) {
    if (params instanceof URLSearchParams) {
      query = params.toString();
    } else if (typeof params === 'object' && !Array.isArray(params)) {
      const entries = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)] as [string, string]);
      query = new URLSearchParams(entries).toString();
    } else {
      query = String(params);
    }
  }
  const fullUrl = query ? `${url}?${query}` : url;
  return `${(config.method ?? 'get').toLowerCase()}_${fullUrl}`;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截：鉴权 + 请求取消（GET 同 key 取消前一个）
api.interceptors.request.use(
  (config) => {
    const token = getTokenCached();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (config.data instanceof FormData) delete config.headers['Content-Type'];

    const isGet = (config.method ?? 'get').toLowerCase() === 'get';
    const url = config.url ?? '';
    // 只对搜索/列表查询应用请求取消，避免误取消文件夹等基础数据请求
    if (isGet && config.signal == null && shouldCancelRequest(url)) {
      const key = getRequestKey(config as InternalAxiosRequestConfig);
      const existing = abortControllers.get(key);
      if (existing) {
        existing.abort();
      }
      const controller = new AbortController();
      config.signal = controller.signal;
      abortControllers.set(key, controller);
    }

    return config;
  },
  (e) => Promise.reject(e)
);

function clearAbortController(config: InternalAxiosRequestConfig | undefined): void {
  if (!config || (config.method ?? 'get').toLowerCase() !== 'get') return;
  const url = config.url ?? '';
  if (shouldCancelRequest(url)) {
    abortControllers.delete(getRequestKey(config));
  }
}

// 响应拦截：401 + 清理 AbortController + GET 网络/5xx 重试
api.interceptors.response.use(
  (response) => {
    clearAbortController(response.config as InternalAxiosRequestConfig);
    return response;
  },
  async (err) => {
    const config = err.config as InternalAxiosRequestConfig | undefined;
    clearAbortController(config);

    if (err.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
      return Promise.reject(err);
    }

    const isGet = config?.method === 'get';
    const retryable =
      err.code === 'ERR_NETWORK' ||
      err.code === 'ECONNABORTED' ||
      (err.response?.status != null && err.response.status >= 500);
    const notRetriedYet = config && !(config as InternalAxiosRequestConfig & { __retryDone?: boolean }).__retryDone;
    if (isGet && config && notRetriedYet && retryable) {
      (config as InternalAxiosRequestConfig & { __retryDone?: boolean }).__retryDone = true;
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

    return Promise.reject(err);
  }
);

export default api;

/**
 * 全局限流 API：所有请求经 globalRequestLimiter 排队，防止浏览器连接数耗尽。
 * 用于高频请求（文件列表、搜索、预览等），降低后端并发压力。
 */
export const limitedApi = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return globalRequestLimiter.limit(() => api.get<T>(url, config));
  },
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return globalRequestLimiter.limit(() => api.post<T>(url, data, config));
  },
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return globalRequestLimiter.limit(() => api.put<T>(url, data, config));
  },
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return globalRequestLimiter.limit(() => api.delete<T>(url, config));
  },
  request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return globalRequestLimiter.limit(() => api.request<T>(config));
  },
};
