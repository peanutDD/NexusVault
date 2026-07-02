/**
 * Single implementation for triggering blob downloads. Used by file download + zip.
 * Uses try-finally to ensure URL is always released, preventing memory leaks.
 */

const BLOB_URL_REVOKE_FALLBACK_DELAY_MS = 30_000;
const BLOB_URL_REVOKE_IDLE_TIMEOUT_MS = 5_000;

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  try {
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // 注意：某些浏览器在 click 后立刻 revoke 会导致下载失败/0B 文件
    // 延迟释放，兼顾稳定性与避免内存泄漏
    // - 空闲时尽早释放（减少 ObjectURL/Blob 占用）
    // - 兜底 30s 强制释放（兼容不支持 requestIdleCallback 的环境）
    let revoked = false;
    const revoke = () => {
      if (revoked) return;
      revoked = true;
      URL.revokeObjectURL(url);
    };

    window.setTimeout(revoke, BLOB_URL_REVOKE_FALLBACK_DELAY_MS);
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(revoke, {
        timeout: BLOB_URL_REVOKE_IDLE_TIMEOUT_MS,
      });
    }
  }
}
