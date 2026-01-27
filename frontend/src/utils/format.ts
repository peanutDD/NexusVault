/**
 * Pure formatters. Reusable across components.
 */

import { SIZES } from '../constants';

const K = 1024;

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return `0 ${SIZES[0]}`;
  const i = Math.floor(Math.log(bytes) / Math.log(K));
  const v = Math.round((bytes / Math.pow(K, i)) * 100) / 100;
  return `${v} ${SIZES[Math.min(i, SIZES.length - 1)]}`;
}

/** Alias for storage display (same logic, explicit name). */
export const formatBytes = formatFileSize;

/**
 * 计算上传剩余时间
 * @param uploadedBytes 已上传字节数
 * @param totalBytes 总字节数
 * @param elapsedMs 已耗时（毫秒）
 * @returns 格式化的剩余时间字符串
 */
export function calculateRemainingTime(
  uploadedBytes: number,
  totalBytes: number,
  elapsedMs: number
): string {
  if (uploadedBytes === 0 || elapsedMs === 0) return '';

  const speed = uploadedBytes / elapsedMs; // bytes/ms
  const remainingBytes = totalBytes - uploadedBytes;
  const remainingMs = remainingBytes / speed;
  const remainingSec = Math.ceil(remainingMs / 1000);

  if (remainingSec < 60) {
    return `${remainingSec} sec left`;
  }
  if (remainingSec < 3600) {
    const mins = Math.ceil(remainingSec / 60);
    return `${mins} min left`;
  }
  const hours = Math.floor(remainingSec / 3600);
  const mins = Math.ceil((remainingSec % 3600) / 60);
  return `${hours}h ${mins}m left`;
}
