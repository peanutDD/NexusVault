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
