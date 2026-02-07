import { sha256 } from 'js-sha256';

/**
 * 是否支持原生 Web Crypto 算 hash（HTTPS 或 localhost 下为 true）。
 * 仅用于统计或降级提示，秒传在 HTTP 下会使用 js-sha256 仍可用。
 */
export function isSha256Supported(): boolean {
  return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined';
}

/**
 * 计算文件内容的 SHA-256，返回 64 位十六进制字符串。
 * 用于秒传：与后端 content_sha256 + file_size 匹配已有文件。
 * - 安全上下文（HTTPS/localhost）：优先使用 crypto.subtle（更快）。
 * - HTTP：使用纯 JS 的 js-sha256，无需安全上下文即可秒传。
 */
export async function sha256FileHex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  if (isSha256Supported()) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256.hex(new Uint8Array(buffer));
}
