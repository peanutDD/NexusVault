/**
 * Centralized env config. Single source of truth for API/CDN base URLs.
 */

// Extend Window interface for Tauri check
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const rawBase =
  import.meta.env.VITE_CDN_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  '';

export const LOCAL_DEV_API_ORIGIN = 'http://localhost:3000'; // hardcoding-allow: local dev fallback for non-browser rendering

// 规范化 API_BASE_URL：
// - 默认使用 VITE_API_BASE_URL
// - 如果当前页面是 HTTPS 且 VITE_API_BASE_URL 是 http:// 开头，则改用相对路径，
//   让开发环境通过同源 /api + Vite dev server 代理转发，避免 Mixed Content。
function resolveApiBase(): string {
  let base = import.meta.env.VITE_API_BASE_URL?.trim() || '';

  if (typeof window !== 'undefined') {
    if ('__TAURI_INTERNALS__' in window) {
      return base;
    }

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
  (typeof window !== 'undefined' ? window.location.origin : LOCAL_DEV_API_ORIGIN);

export function apiBaseForMessage(): string {
  return API_BASE_URL || LOCAL_DEV_API_ORIGIN;
}

export const APP_NAME = 'File Upload Download Server';

export function apiPath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  // 统一使用 API_BASE_URL 而不是 ORIGIN，确保与 axios 行为一致
  // 如果 API_BASE_URL 为空（同源），则使用当前 origin
  const baseUrl = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${baseUrl.replace(/\/$/, '')}/api${p}`;
}
