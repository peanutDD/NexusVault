/**
 * Centralized env config. Single source of truth for API/CDN base URLs.
 */

const base =
  import.meta.env.VITE_CDN_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  '';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const ORIGIN =
  base ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

export const APP_NAME = 'File Upload Download Server';

export function apiPath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${ORIGIN.replace(/\/$/, '')}/api${p}`;
}
