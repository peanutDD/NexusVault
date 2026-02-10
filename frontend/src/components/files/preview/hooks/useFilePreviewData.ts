/**
 * useFilePreviewData
 * 预览数据加载：文本、图片、视频、音频、GIF、Ugoira、PDF
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fileService } from '../../../../services/files';
import { useAuthStore } from '../../../../store/authStore';
import { getPreviewKind } from '../../../../utils/mimeType';
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
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const onImageError = useCallback(() => {
    if (!file || file.mime_type.toLowerCase() !== 'image/gif') return;
    if (blobUrl?.startsWith('blob:')) return;
    if (gifFallbackTriedRef.current) {
      setError('GIF 加载失败');
      return;
    }
    gifFallbackTriedRef.current = true;
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
    fileService
      .fetchPreviewBlob(file.id)
      .then((b) => setBlobUrl(URL.createObjectURL(b)))
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [file, blobUrl]);

  const tryVideoAudioFallbackRef = useRef(tryVideoAudioFallback);
  tryVideoAudioFallbackRef.current = tryVideoAudioFallback;

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
      setGifFirstFrameUrl(null);
      setError(null);
      setUseHls(false);
       // 初始化 GIF 转码进度状态
      setGifTranscodeInProgress(true);
      setGifTranscodeProgress(0);

      const videoUrl = getGifVideoUrl(file.id);

      (async () => {
        try {
          // 先触发/检查转码任务
          const initialStatus = await fileService.prepareVideoPreview(file.id);
          if (!isValidRequest()) return;
          if (initialStatus === 'ready') {
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
            const status = await fileService.getVideoPreviewStatus(file.id);
            if (!isValidRequest()) return;
            if (status === 'ready') {
              setBlobUrl(videoUrl);
              setGifTranscodeProgress(100);
              finish();
              return;
            }
            // 粗略估算进度：仅用于 UI 提示，不代表真实编码进度
            const progress = Math.round(((attempt + 1) / maxAttempts) * 100);
            setGifTranscodeProgress(progress);
          }

          // 超时仍未 ready：视为「后台仍在慢速处理」，不弹失败大框，只结束本次等待
          if (import.meta.env.DEV) {
            // 开发环境下在控制台给一点提示，方便排查
            // eslint-disable-next-line no-console
            console.warn(
              '[gif-preview] 转码超过预期时间，后台可能仍在处理，稍后可重新打开预览重试'
            );
          }
          finish();
        } catch (e) {
          if (!isValidRequest()) return;
          const msg = e instanceof Error ? e.message : 'GIF 视频预览加载失败';
          setError(msg);
          finish();
        }
      })();

      return;
    }

    if (kind.isVideo || kind.isAudio) {
      if (!isValidRequest()) return;
      videoFallbackTriedRef.current = false;
      if (kind.isVideo && file.file_size >= HLS_THRESHOLD_BYTES) {
        setBlobUrl(getHlsUrl(file.id));
        setUseHls(true);
      } else {
        setBlobUrl(getStreamUrl(file.id));
        setUseHls(false);
      }
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
  }, [file, kind.supported, kind.isText, kind.isVideo, kind.isAudio]);

  useEffect(() => {
    return () => {
      if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
      setGifTranscodeInProgress(false);
      setGifTranscodeProgress(null);
    };
  }, [blobUrl]);

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
    tryVideoAudioFallback,
    tryVideoAudioFallbackRef,
    onImageError,
  };
}
