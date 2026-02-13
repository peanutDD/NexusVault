/**
 * Centralized env config. Single source of truth for API/CDN base URLs.
 */

const rawBase =
  import.meta.env.VITE_CDN_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  '';

// 规范化 API_BASE_URL：
// - 默认使用 VITE_API_BASE_URL
// - 如果当前页面是 HTTPS 且 VITE_API_BASE_URL 是 http:// 开头，则改用相对路径，
//   让开发环境通过同源 /api + Vite dev server 代理转发，避免 Mixed Content。
function resolveApiBase(): string {
  let base = import.meta.env.VITE_API_BASE_URL?.trim() || '';

  if (typeof window !== 'undefined') {
    const isHttpsPage = window.location.protocol === 'https:';
    if (isHttpsPage && base.startsWith('http://')) {
      // 在 HTTPS 页面下，不再直接请求 HTTP 后端，改用同源 /api。
      base = '';
    }
  }

  return base;
}

export const API_BASE_URL = resolveApiBase();

export const ORIGIN =
  rawBase ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

export const APP_NAME = 'File Upload Download Server';

export function apiPath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${ORIGIN.replace(/\/$/, '')}/api${p}`;
}
