/**
 * useFilePreviewNavigation
 * 多文件时的上一页/下一页导航
 */

import { useCallback } from 'react';
import { useThrottledCallback } from '../../../../hooks/useThrottledCallback';
import type { FileMetadata } from '../../../../types/files';

// =============================================================================
// 类型
// =============================================================================

export interface UseFilePreviewNavigationParams {
  files: FileMetadata[];
  currentIndex: number;
  onNavigate?: (file: FileMetadata) => void;
}

export interface UseFilePreviewNavigationResult {
  canGoPrev: boolean;
  canGoNext: boolean;
  goToPrev: () => void;
  goToNext: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useFilePreviewNavigation({
  files,
  currentIndex,
  onNavigate,
}: UseFilePreviewNavigationParams): UseFilePreviewNavigationResult {
  const canGoPrev = files.length > 1 && currentIndex > 0;
  const canGoNext = files.length > 1 && currentIndex < files.length - 1;

  const goToPrevImpl = useCallback(() => {
    if (canGoPrev && onNavigate) onNavigate(files[currentIndex - 1]);
  }, [canGoPrev, currentIndex, files, onNavigate]);

  const goToNextImpl = useCallback(() => {
    if (canGoNext && onNavigate) onNavigate(files[currentIndex + 1]);
  }, [canGoNext, currentIndex, files, onNavigate]);

  const goToPrev = useThrottledCallback(goToPrevImpl, 200);
  const goToNext = useThrottledCallback(goToNextImpl, 200);

  return { canGoPrev, canGoNext, goToPrev, goToNext };
}
