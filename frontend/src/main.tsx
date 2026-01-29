import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

if (import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
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
