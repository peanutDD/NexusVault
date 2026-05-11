import { sha256 } from 'js-sha256';

/**
 * 是否支持原生 Web Crypto 算 hash（HTTPS 或 localhost 下为 true）。
 * 仅用于统计或降级提示，秒传在 HTTP 下会使用 js-sha256 仍可用。
 */
export function isSha256Supported(): boolean {
  return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined';
}

const CHUNK_SIZE = 2 * 1024 * 1024;
const IDLE_CALLBACK_TIMEOUT_MS = 50;
const YIELD_TO_EVENT_LOOP_MS = 0;

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException('File hash cancelled', 'AbortError');
}

async function yieldToMain(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: IDLE_CALLBACK_TIMEOUT_MS });
      return;
    }
    setTimeout(() => resolve(), YIELD_TO_EVENT_LOOP_MS);
  });
}

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob chunk'));
      reader.readAsArrayBuffer(blob);
    });
  }
  return new Response(blob).arrayBuffer();
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
    let settled = false;
    const abort = () => {
      finish(() => reject(new DOMException('File hash cancelled', 'AbortError')));
    };
    function finish(settle: () => void) {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      settle();
    }
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (e: MessageEvent<{ ok: boolean; hash?: string; error?: string }>) => {
      if (e.data.ok && e.data.hash) {
        finish(() => resolve(e.data.hash!));
      } else {
        finish(() => reject(new Error(e.data.error || 'sha256 worker failed')));
      }
    };
    worker.onerror = (e: ErrorEvent) => {
      finish(() => reject(new Error(e.message || 'sha256 worker error')));
    };
    worker.postMessage(file);
  });
}

/**
 * 计算文件内容的 SHA-256，返回 64 位十六进制字符串。
 * 用于秒传：与后端 content_sha256 + file_size 匹配已有文件。
 * 使用分块增量哈希，避免大文件在浏览器中一次性读入内存。
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
  return sha256BlobIncrementalHex(file, signal);
}

export async function sha256BlobIncrementalHex(blob: Blob, signal?: AbortSignal): Promise<string> {
  const hasher = sha256.create();
  let offset = 0;
  while (offset < blob.size) {
    const chunk = blob.slice(offset, offset + CHUNK_SIZE);
    const buffer = await readBlobAsArrayBuffer(chunk);
    throwIfAborted(signal);
    hasher.update(new Uint8Array(buffer));
    offset += CHUNK_SIZE;
    if (offset < blob.size) {
      await yieldToMain();
    }
  }
  return hasher.hex();
}

export async function sha256BlobHex(blob: Blob, signal?: AbortSignal): Promise<string> {
  throwIfAborted(signal);
  return sha256BlobIncrementalHex(blob, signal);
}
