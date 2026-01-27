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
    document.body.appendChild(link);
    link.click();
  } finally {
    // 确保无论是否出错都释放 URL
    link.remove();
    URL.revokeObjectURL(url);
  }
}
