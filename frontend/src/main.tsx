import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { API_BASE_URL } from './config/env';
import { trackError } from './utils/telemetry';

// 关键资源预连接：API 跨域时提前建立连接，减少首屏请求延迟
if (typeof document !== 'undefined' && API_BASE_URL.startsWith('http')) {
  try {
    const origin = new URL(API_BASE_URL).origin;
    if (origin !== window.location.origin) {
      const existing = document.querySelector(`link[rel="preconnect"][href="${origin}"]`);
      if (!existing) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        link.setAttribute('crossorigin', '');
        document.head.appendChild(link);
      }
    }
  } catch {
    // ignore invalid URL
  }
}

if (import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}

// 全局错误与未捕获 Promise 拒绝上报
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    // 某些情况下 event.error 可能为 undefined，仅记录 message
    trackError(event.error ?? event.message, {
      action: 'window_error',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    trackError(event.reason, {
      action: 'unhandled_rejection',
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 可选：通过 `?vitals=1` 输出 Web Vitals（默认关闭，零侵入）
try {
  const params = new URLSearchParams(window.location.search);
  if (params.has('vitals')) {
    void import('./vitals').then((m) => m.reportVitals());
  }
} catch {
  // no-op: 非浏览器环境/极端情况下忽略
}
