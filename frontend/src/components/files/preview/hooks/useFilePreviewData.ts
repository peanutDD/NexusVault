/**
 * useFilePreviewData
 * 预览数据加载：文本、图片、视频、音频、GIF、Ugoira、PDF
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fileService } from '../../../../services/files';
import { useAuthStore } from '../../../../store/authStore';
import { getPreviewKind, isGifType } from '../../../../utils/mimeType';
import { HLS_THRESHOLD_BYTES } from '../constants';

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
    if (isGifType(file.mime_type)) {
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
    const isGif = isGifType(file.mime_type);
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

      const startGifVideoPreview = () => {
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
        const hlsUrl = getHlsUrl(file.id);
        const useHlsForGif = file.file_size >= HLS_THRESHOLD_BYTES;

        const runMp4Preview = async () => {
          try {
            const initialStatus = await fileService.prepareVideoPreview(file.id);
            if (!isValidRequest()) return;
            if (initialStatus === 'ready') {
              setGifFallbackUrl(null);
              setBlobUrl(videoUrl);
              finish();
              return;
            }

            const intervalMs = 1500;
            let attempt = 0;
            while (isValidRequest()) {
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
                setError(result.error || 'GIF 视频预览生成失败，请稍后重试');
                finish();
                return;
              }
              attempt += 1;
              const progress = Math.min(95, Math.round((attempt / 40) * 100));
              setGifTranscodeProgress(progress);
            }
          } catch {
            if (!isValidRequest()) return;
            setError('GIF 视频预览生成失败，请稍后重试');
            finish();
          }
        };

        const runHlsPreview = async () => {
          try {
            const initial = await fileService.prepareHlsPreview(file.id);
            if (!isValidRequest()) return;
            if (initial === 'ready') {
              setGifFallbackUrl(null);
              setUseHls(true);
              setBlobUrl(hlsUrl);
              setGifTranscodeProgress(100);
              finish();
              return;
            }
            if (initial === 'unsupported') {
              await runMp4Preview();
              return;
            }
            const intervalMs = 1500;
            let attempt = 0;
            while (isValidRequest()) {
              if (!isValidRequest()) return;
              await new Promise((resolve) => setTimeout(resolve, intervalMs));
              const status = await fileService.getHlsPreviewStatus(file.id);
              if (!isValidRequest()) return;
              if (status === 'ready') {
                setGifFallbackUrl(null);
                setUseHls(true);
                setBlobUrl(hlsUrl);
                setGifTranscodeProgress(100);
                finish();
                return;
              }
              attempt += 1;
              const progress = Math.min(95, Math.round((attempt / 40) * 100));
              setGifTranscodeProgress(progress);
            }
          } catch {
            if (!isValidRequest()) return;
            setError('GIF 视频预览生成失败，请稍后重试');
            finish();
          }
        };

        if (useHlsForGif) {
          runHlsPreview();
        } else {
          runMp4Preview();
        }
      };

      startGifVideoPreview();

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
