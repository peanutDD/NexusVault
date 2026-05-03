import { sha256 } from 'js-sha256';

/**
 * 是否支持原生 Web Crypto 算 hash（HTTPS 或 localhost 下为 true）。
 * 仅用于统计或降级提示，秒传在 HTTP 下会使用 js-sha256 仍可用。
 */
export function isSha256Supported(): boolean {
  return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined';
}

const CHUNK_SIZE = 2 * 1024 * 1024;

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException('File hash cancelled', 'AbortError');
}

async function yieldToMain(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 50 });
      return;
    }
    setTimeout(() => resolve(), 0);
  });
}

function sha256WithWorker(file: File, signal?: AbortSignal): Promise<string> {
  if (typeof Worker === 'undefined') {
    return Promise.reject(new Error('Worker is not supported'));
  }
  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('File hash cancelled', 'AbortError'));
      return;
    }
    const worker = new Worker(new URL('../workers/sha256.worker.ts', import.meta.url), {
      type: 'module',
    });
    let cleanup = () => {
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('File hash cancelled', 'AbortError'));
    };
    cleanup = () => {
      signal?.removeEventListener('abort', abort);
      worker.terminate();
    };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (e: MessageEvent<{ ok: boolean; hash?: string; error?: string }>) => {
      if (e.data.ok && e.data.hash) {
        resolve(e.data.hash);
      } else {
        reject(new Error(e.data.error || 'sha256 worker failed'));
      }
      cleanup();
    };
    worker.onerror = (e: ErrorEvent) => {
      reject(new Error(e.message || 'sha256 worker error'));
      cleanup();
    };
    worker.postMessage(file);
  });
}

/**
 * 计算文件内容的 SHA-256，返回 64 位十六进制字符串。
 * 用于秒传：与后端 content_sha256 + file_size 匹配已有文件。
 * - 安全上下文（HTTPS/localhost）：优先使用 crypto.subtle（更快）。
 * - HTTP：使用纯 JS 的 js-sha256，无需安全上下文即可秒传。
 */
export async function sha256FileHex(file: File, signal?: AbortSignal): Promise<string> {
  throwIfAborted(signal);
  const workerResult = await sha256WithWorker(file, signal).catch((err) => {
    if (signal?.aborted) throw err;
    return null;
  });
  if (workerResult) {
    return workerResult;
  }
  throwIfAborted(signal);
  if (isSha256Supported()) {
    const buffer = await file.arrayBuffer();
    throwIfAborted(signal);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    throwIfAborted(signal);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const hasher = sha256.create();
  let offset = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await chunk.arrayBuffer();
    throwIfAborted(signal);
    hasher.update(new Uint8Array(buffer));
    offset += CHUNK_SIZE;
    if (offset < file.size) {
      await yieldToMain();
    }
  }
  return hasher.hex();
}
