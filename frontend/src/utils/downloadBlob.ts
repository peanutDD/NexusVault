/**
 * Single implementation for triggering blob downloads. Used by file download + zip.
 * Uses try-finally to ensure URL is always released, preventing memory leaks.
 */

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
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 30_000);
  }
}
