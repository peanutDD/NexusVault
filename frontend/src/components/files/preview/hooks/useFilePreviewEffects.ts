/**
 * useFilePreviewEffects
 * HLS 初始化、键盘事件、背景滚动锁定、相邻图片预加载
 */

import { useEffect } from 'react';
import type { ErrorData } from 'hls.js';
import { fileService } from '../../../../services/files';
import { useAuthStore } from '../../../../store/authStore';
import { getPreviewKind } from '../../../../utils/mimeType';
import type { FileMetadata } from '../../../../types/files';

// =============================================================================
// 类型
// =============================================================================

export interface UseFilePreviewEffectsParams {
  kind: ReturnType<typeof getPreviewKind>;
  useHls: boolean;
  blobUrl: string | null;
  loading: boolean;
  file: FileMetadata | null;
  files: FileMetadata[];
  currentIndex: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hlsStartTimeRef: React.MutableRefObject<number | null>;
  hlsStartPausedRef: React.MutableRefObject<boolean | null>;
  hlsStartVolumeRef: React.MutableRefObject<number | null>;
  hlsStartMutedRef: React.MutableRefObject<boolean | null>;
  tryVideoAudioFallbackRef: React.MutableRefObject<() => void>;
  onClose: () => void;
  goToPrev: () => void;
  goToNext: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useFilePreviewEffects({
  kind,
  useHls,
  blobUrl,
  loading,
  file,
  files,
  currentIndex,
  canGoPrev,
  canGoNext,
  videoRef,
  hlsStartTimeRef,
  hlsStartPausedRef,
  hlsStartVolumeRef,
  hlsStartMutedRef,
  tryVideoAudioFallbackRef,
  onClose,
  goToPrev,
  goToNext,
}: UseFilePreviewEffectsParams): void {
  // -------------------------------------------------------------------------
  // HLS 初始化（超大视频 >100MB）
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!kind.isVideo || !useHls || !blobUrl) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let retryTimer: number | undefined;
    let manifestTimer: number | undefined;
    let manifestReady = false;
    let hls: import('hls.js').default | null = null;
    const applyStartTime = () => {
      const startAt = hlsStartTimeRef.current;
      if (startAt === null) return;
      if (!Number.isFinite(startAt)) {
        hlsStartTimeRef.current = null;
        return;
      }
      if (Number.isNaN(video.duration) || video.readyState < 1) return;
      const duration = Number.isFinite(video.duration) ? video.duration : startAt;
      const safeTime = Math.min(startAt, Math.max(0, duration - 0.5));
      video.currentTime = safeTime;
      hlsStartTimeRef.current = null;
      const volume = hlsStartVolumeRef.current;
      const muted = hlsStartMutedRef.current;
      hlsStartVolumeRef.current = null;
      hlsStartMutedRef.current = null;
      if (typeof muted === 'boolean') {
        video.muted = muted;
      }
      if (typeof volume === 'number' && Number.isFinite(volume)) {
        const safeVolume = Math.min(1, Math.max(0, volume));
        video.volume = safeVolume;
      }
      const shouldPause = hlsStartPausedRef.current;
      hlsStartPausedRef.current = null;
      if (shouldPause === null) return;
      if (shouldPause) {
        video.pause();
      } else {
        void video.play();
      }
    };

    const setup = async () => {
      const { default: Hls } = await import('hls.js');
      if (cancelled) return;
      if (Hls.isSupported()) {
        const token = useAuthStore.getState().token ?? localStorage.getItem('token');
        let processingRetries = 0;
        hls = new Hls({
          xhrSetup(xhr) {
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          },
          manifestLoadingMaxRetry: 20,
          levelLoadingMaxRetry: 20,
          fragLoadingMaxRetry: 20,
          manifestLoadingRetryDelay: 1000,
          levelLoadingRetryDelay: 1000,
          fragLoadingRetryDelay: 1000,
        });
        hls.loadSource(blobUrl);
        hls.attachMedia(video);
        video.addEventListener('loadedmetadata', applyStartTime);
        video.addEventListener('canplay', applyStartTime);
        manifestTimer = window.setTimeout(() => {
          if (!manifestReady) {
            tryVideoAudioFallbackRef.current();
          }
        }, 20000);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          manifestReady = true;
          if (manifestTimer) window.clearTimeout(manifestTimer);
          applyStartTime();
        });
        hls.on(Hls.Events.LEVEL_LOADED, () => {
          manifestReady = true;
          if (manifestTimer) window.clearTimeout(manifestTimer);
          applyStartTime();
        });
        hls.on(Hls.Events.FRAG_LOADED, () => {
          manifestReady = true;
          if (manifestTimer) window.clearTimeout(manifestTimer);
          applyStartTime();
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          const errorData = data as ErrorData;
          const code =
            typeof errorData.response?.code === 'number' ? errorData.response.code : undefined;
          const isProcessing = code === 503;
          if (isProcessing) {
            if (retryTimer) window.clearTimeout(retryTimer);
            processingRetries += 1;
            const delay = Math.min(10000, 1000 + processingRetries * 500);
            retryTimer = window.setTimeout(() => {
              hls?.startLoad(-1);
            }, delay);
            return;
          }
          if (data.fatal) tryVideoAudioFallbackRef.current();
        });
        return;
      }
      tryVideoAudioFallbackRef.current();
    };

    void setup();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (manifestTimer) window.clearTimeout(manifestTimer);
      video.removeEventListener('loadedmetadata', applyStartTime);
      video.removeEventListener('canplay', applyStartTime);
      hls?.destroy();
    };
  }, [
    kind.isVideo,
    useHls,
    blobUrl,
    videoRef,
    hlsStartTimeRef,
    hlsStartPausedRef,
    hlsStartVolumeRef,
    hlsStartMutedRef,
    tryVideoAudioFallbackRef,
  ]);

  // -------------------------------------------------------------------------
  // 键盘事件：ESC 关闭，左右箭头切换
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goToPrev, goToNext]);

  // -------------------------------------------------------------------------
  // 打开预览时锁定背景滚动
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!file) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [file]);

  // -------------------------------------------------------------------------
  // 预加载相邻图片
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (loading || !file) return;

    const preloadImage = (fileToPreload: FileMetadata) => {
      const preloadKind = getPreviewKind(
        fileToPreload.mime_type,
        fileToPreload.original_filename
      );
      if (!preloadKind.isImage) return;
      fileService
        .fetchPreviewBlob(fileToPreload.id)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.src = url;
          img.onload = () => URL.revokeObjectURL(url);
          img.onerror = () => URL.revokeObjectURL(url);
        })
        .catch(() => {});
    };

    const timer = setTimeout(() => {
      if (canGoPrev) preloadImage(files[currentIndex - 1]);
      if (canGoNext) preloadImage(files[currentIndex + 1]);
    }, 300);

    return () => clearTimeout(timer);
  }, [loading, file, currentIndex, files, canGoPrev, canGoNext]);
}
