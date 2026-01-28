import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { useAuthStore } from '../store/authStore';

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

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getTokenCached();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (config.data instanceof FormData) delete config.headers['Content-Type'];
    return config;
  },
  (e) => Promise.reject(e)
);

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
