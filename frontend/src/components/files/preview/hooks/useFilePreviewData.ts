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
    };
    const isGif = file.mime_type.toLowerCase() === 'image/gif';
    const isUgoira = kind.isUgoira ?? false;

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

    if (isGif) {
      if (!isValidRequest()) return;
      gifFallbackTriedRef.current = false;
      setGifFirstFrameUrl(null);
      setError(null);
      setBlobUrl(getStreamUrl(file.id));
      finish();
      return;
    }

    if (isUgoira) {
      if (!isValidRequest()) return;
      setGifFirstFrameUrl(null);
      setError(null);
      setBlobUrl(getStreamUrl(file.id));
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
  }, [file, kind.supported, kind.isText, kind.isVideo, kind.isAudio, kind.isUgoira]);

  useEffect(() => {
    return () => {
      if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  return {
    blobUrl,
    gifFirstFrameUrl,
    textContent,
    error,
    loading,
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
