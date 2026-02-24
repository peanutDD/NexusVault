/**
 * useFilePreviewData
 * 预览数据加载：文本、图片、视频、音频、GIF、Ugoira、PDF
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fileService } from '../../../../services/files';
import { useAuthStore } from '../../../../store/authStore';
import { getPreviewKind } from '../../../../utils/mimeType';
import { GIF_DIRECT_PREVIEW_BYTES, HLS_THRESHOLD_BYTES } from '../constants';

function getStreamUrl(fileId: string): string {
  const base = fileService.getPreviewUrl(fileId);
  const token = useAuthStore.getState().token ?? localStorage.getItem('token');
  if (!token) return base;
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}token=${encodeURIComponent(token)}`;
}

function getHlsUrl(fileId: string): string {
  const base = fileService.getHlsUrl(fileId);
  const token = useAuthStore.getState().token ?? localStorage.getItem('token');
  if (!token) return base;
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}token=${encodeURIComponent(token)}`;
}

function getGifVideoUrl(fileId: string): string {
  const base = fileService.getGifVideoPreviewUrl(fileId);
  const token = useAuthStore.getState().token ?? localStorage.getItem('token');
  if (!token) return base;
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}token=${encodeURIComponent(token)}`;
}

export interface UseFilePreviewDataParams {
  file: { id: string; mime_type: string; file_size: number } | null;
  kind: ReturnType<typeof getPreviewKind>;
}

export interface UseFilePreviewDataResult {
  blobUrl: string | null;
  gifFirstFrameUrl: string | null;
  textContent: string | null;
  error: string | null;
  loading: boolean;
  gifTranscodeInProgress: boolean;
  gifTranscodeProgress: number | null;
  useHls: boolean;
  imageLoaded: boolean;
  setImageLoaded: (v: boolean) => void;
  setGifFirstFrameUrl: (v: string | null) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hlsStartTimeRef: React.MutableRefObject<number | null>;
  hlsStartPausedRef: React.MutableRefObject<boolean | null>;
  hlsStartVolumeRef: React.MutableRefObject<number | null>;
  hlsStartMutedRef: React.MutableRefObject<boolean | null>;
  tryVideoAudioFallback: () => void;
  tryVideoAudioFallbackRef: React.MutableRefObject<() => void>;
  onImageError: () => void;
}

export function useFilePreviewData({
  file,
  kind,
}: UseFilePreviewDataParams): UseFilePreviewDataResult {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [gifFirstFrameUrl, setGifFirstFrameUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => (file ? kind.supported : false));
  const [gifTranscodeInProgress, setGifTranscodeInProgress] = useState(false);
  const [gifTranscodeProgress, setGifTranscodeProgress] = useState<number | null>(null);
  const [useHls, setUseHls] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const requestIdRef = useRef(0);
  const videoFallbackTriedRef = useRef(false);
  const gifFallbackTriedRef = useRef(false);
  const imageFallbackTriedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsStartTimeRef = useRef<number | null>(null);
  const hlsStartPausedRef = useRef<boolean | null>(null);
  const hlsStartVolumeRef = useRef<number | null>(null);
  const hlsStartMutedRef = useRef<boolean | null>(null);

  const onImageError = useCallback(() => {
    if (!file) return;
    const isImage = file.mime_type.toLowerCase().startsWith('image/');
    if (!isImage) return;
    if (blobUrl?.startsWith('blob:')) {
      setError('图片加载失败');
      setLoading(false);
      return;
    }
    if (imageFallbackTriedRef.current) {
      setError('图片加载失败');
      setLoading(false);
      return;
    }
    imageFallbackTriedRef.current = true;
    setError(null);
    setLoading(true);
    fileService
      .fetchPreviewBlob(file.id)
      .then((b) => {
        setBlobUrl(URL.createObjectURL(b));
        setImageLoaded(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [file, blobUrl]);

  const tryVideoAudioFallback = useCallback(() => {
    if (!file) return;
    // GIF 视频预览失败时，不走通用的视频/音频回退逻辑，避免在转码过程中跳到
    // 「视频加载或播放失败」的大提示框，交给 prepare/status + 进度条自己处理。
    if (file.mime_type.toLowerCase() === 'image/gif') {
      return;
    }
    if (videoFallbackTriedRef.current) {
      setError('视频加载或播放失败');
      return;
    }
    if (blobUrl?.startsWith('blob:')) return;
    videoFallbackTriedRef.current = true;
    setError(null);
    setLoading(true);
    if (file.mime_type.toLowerCase().startsWith('video/') || file.mime_type.toLowerCase().startsWith('audio/')) {
      setUseHls(false);
      setBlobUrl(getStreamUrl(file.id));
      setLoading(false);
      return;
    }
    fileService
      .fetchPreviewBlob(file.id)
      .then((b) => setBlobUrl(URL.createObjectURL(b)))
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [file, blobUrl]);

  const tryVideoAudioFallbackRef = useRef(tryVideoAudioFallback);

  useEffect(() => {
    tryVideoAudioFallbackRef.current = tryVideoAudioFallback;
  }, [tryVideoAudioFallback]);

  useEffect(() => {
    if (!file || !kind.supported) return;
    const currentRequestId = ++requestIdRef.current;
    const isValidRequest = () => currentRequestId === requestIdRef.current;
    const finish = () => {
      if (isValidRequest()) setLoading(false);
      if (isValidRequest()) {
        setGifTranscodeInProgress(false);
        setGifTranscodeProgress(null);
      }
    };
    const isGif = file.mime_type.toLowerCase() === 'image/gif';
    imageFallbackTriedRef.current = false;

    if (kind.isText) {
      fileService
        .fetchPreviewBlob(file.id)
        .then((b) => b.text())
        .then((text) => {
          if (!isValidRequest()) return;
          setTextContent(text);
        })
        .catch((e) => {
          if (!isValidRequest()) return;
          setError(e instanceof Error ? e.message : '加载失败');
        })
        .finally(finish);
      return;
    }

    // 先处理 GIF：虽然 MIME 是 image/gif，但预览时按“视频”走 GIF → mp4 管线
    if (isGif) {
      if (!isValidRequest()) return;
      gifFallbackTriedRef.current = false;
      const setGifFallbackUrl = (url: string | null) => {
        setGifFirstFrameUrl((prev) => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
          return url;
        });
        setImageLoaded(false);
      };

      if (file.file_size <= GIF_DIRECT_PREVIEW_BYTES) {
        Promise.resolve().then(() => {
          if (!isValidRequest()) return;
          setError(null);
          setUseHls(false);
          setGifFallbackUrl(getStreamUrl(file.id));
          finish();
        });
        return;
      }

      Promise.resolve().then(() => {
        if (!isValidRequest()) return;
        setGifFirstFrameUrl(null);
        setError(null);
        setUseHls(false);
        setGifTranscodeInProgress(true);
        setGifTranscodeProgress(0);
        setImageLoaded(false);
      });

      fileService
        .fetchThumbnailBlob(file.id, { width: 800 })
        .then((b) => {
          if (!isValidRequest()) return;
          if (!b) return;
          const url = URL.createObjectURL(b);
          setGifFallbackUrl(url);
        })
        .catch(() => {});

      const videoUrl = getGifVideoUrl(file.id);

      (async () => {
        try {
          // 先触发/检查转码任务
          const initialStatus = await fileService.prepareVideoPreview(file.id);
          if (!isValidRequest()) return;
          if (initialStatus === 'ready') {
            setGifFallbackUrl(null);
            setBlobUrl(videoUrl);
            finish();
            return;
          }

          // initialStatus 为 processing：轮询状态，直到 ready 或超时
          const maxAttempts = 20; // 约 20 * 1.5s ≈ 30s
          const intervalMs = 1500;
          for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            if (!isValidRequest()) return;
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
            const result = await fileService.getVideoPreviewStatus(file.id);
            if (!isValidRequest()) return;
            if (result.status === 'ready') {
              setGifFallbackUrl(null);
              setBlobUrl(videoUrl);
              setGifTranscodeProgress(100);
              finish();
              return;
            }
            if (result.status === 'failed') {
              setError(null);
              setGifFallbackUrl(getStreamUrl(file.id));
              finish();
              return;
            }
            // 粗略估算进度：仅用于 UI 提示，不代表真实编码进度
            const progress = Math.round(((attempt + 1) / maxAttempts) * 100);
            setGifTranscodeProgress(progress);
          }

          // 超时仍未 ready：提示用户后台仍在处理
          console.warn(
            '[gif-preview] 转码超过预期时间，后台可能仍在处理，稍后可重新打开预览重试'
          );
          setError(null);
          setGifFallbackUrl(getStreamUrl(file.id));
          finish();
        } catch {
          if (!isValidRequest()) return;
          setError(null);
          setGifFallbackUrl(getStreamUrl(file.id));
          finish();
        }
      })();

      return;
    }

    if (kind.isVideo || kind.isAudio) {
      if (!isValidRequest()) return;
      videoFallbackTriedRef.current = false;
      Promise.resolve().then(() => {
        if (!isValidRequest()) return;
        if (kind.isVideo && file.file_size >= HLS_THRESHOLD_BYTES) {
          setUseHls(false);
          setBlobUrl(getStreamUrl(file.id));
          (async () => {
            try {
              const initial = await fileService.prepareHlsPreview(file.id);
              if (!isValidRequest()) return;
              if (initial === 'ready') {
                setUseHls(true);
                setBlobUrl(getHlsUrl(file.id));
                return;
              }
              if (initial === 'unsupported') return;
              const maxAttempts = 20;
              const intervalMs = 1500;
              for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
                const status = await fileService.getHlsPreviewStatus(file.id);
                if (!isValidRequest()) return;
                if (status === 'ready') {
                const canSwap = !videoRef.current || videoRef.current.currentTime < 2;
                const currentVideo = videoRef.current;
                const currentTime = currentVideo?.currentTime ?? 0;
                const isPaused = currentVideo ? currentVideo.paused : null;
                const volume =
                  typeof currentVideo?.volume === 'number' ? currentVideo.volume : null;
                const muted = typeof currentVideo?.muted === 'boolean' ? currentVideo.muted : null;
                if (canSwap || currentTime > 0) {
                  hlsStartTimeRef.current = currentTime > 0 ? currentTime : null;
                  hlsStartPausedRef.current = isPaused;
                  hlsStartVolumeRef.current = volume;
                  hlsStartMutedRef.current = muted;
                  setUseHls(true);
                  setBlobUrl(getHlsUrl(file.id));
                }
                  return;
                }
                if (status === 'unsupported') return;
              }
            } catch {
              return;
            }
          })();
        } else {
          setBlobUrl(getStreamUrl(file.id));
          setUseHls(false);
        }
      });
      finish();
      return;
    }

    if (kind.isImage) {
      if (!isValidRequest()) return;
      Promise.resolve().then(() => {
        if (!isValidRequest()) return;
        const cached = fileService.takeCachedPreviewBlobUrl(file.id);
        if (cached) {
          setBlobUrl(cached);
          return;
        }
        setBlobUrl(getStreamUrl(file.id));
      });
      finish();
      return;
    }

    fileService
      .fetchPreviewBlob(file.id)
      .then((b) => {
        if (!isValidRequest()) return;
        setBlobUrl(URL.createObjectURL(b));
      })
      .catch((e) => {
        if (!isValidRequest()) return;
        setError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(finish);
  }, [file, kind.supported, kind.isText, kind.isVideo, kind.isAudio, kind.isImage]);

  useEffect(() => {
    return () => {
      if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
      setGifTranscodeInProgress(false);
      setGifTranscodeProgress(null);
    };
  }, [blobUrl]);

  useEffect(() => {
    return () => {
      if (gifFirstFrameUrl?.startsWith('blob:')) URL.revokeObjectURL(gifFirstFrameUrl);
    };
  }, [gifFirstFrameUrl]);

  return {
    blobUrl,
    gifFirstFrameUrl,
    textContent,
    error,
    loading,
    gifTranscodeInProgress,
    gifTranscodeProgress,
    useHls,
    imageLoaded,
    setImageLoaded,
    setGifFirstFrameUrl,
    videoRef,
    hlsStartTimeRef,
    hlsStartPausedRef,
    hlsStartVolumeRef,
    hlsStartMutedRef,
    tryVideoAudioFallback,
    tryVideoAudioFallbackRef,
    onImageError,
  };
}
