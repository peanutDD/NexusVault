/**
 * UgoiraPlayer
 * 类 Pixiv うごイラ 播放器：ZIP 内含帧图 + frames.json，Canvas 逐帧绘制
 */

import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { cn } from '../../../utils/cn';

// =============================================================================
// 类型
// =============================================================================

export interface UgoiraFrame {
  file?: string;
  delay: number;
}

export interface UgoiraMetadata {
  frames: UgoiraFrame[];
}

export interface UgoiraPlayerProps {
  /** 预览 URL（含 token），支持 Range */
  src: string;
  /** 无障碍描述 */
  alt?: string;
  className?: string;
  onLoad?: () => void;
  onError?: (err: Error) => void;
}

// =============================================================================
// 组件
// =============================================================================

export function UgoiraPlayer({
  src,
  alt,
  className,
  onLoad,
  onError: _onError,
}: UgoiraPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const frameIndexRef = useRef<number>(0);
  const imageUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const loadAndPlay = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(src, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;

        const zip = await JSZip.loadAsync(blob);
        if (cancelled) return;

        const metaFile = zip.file('frames.json');
        if (!metaFile) throw new Error('缺少 frames.json');
        const metaText = await metaFile.async('string');
        const meta: UgoiraMetadata = JSON.parse(metaText);
        if (!meta.frames?.length) throw new Error('frames.json 格式无效');

        const frames: { blob: Blob; delay: number }[] = [];
        for (let i = 0; i < meta.frames.length; i++) {
          const f = meta.frames[i];
          const fileName = f.file ?? `${i}.png`;
          const file = zip.file(fileName);
          if (!file) throw new Error(`缺少帧文件: ${fileName}`);
          const blob = await file.async('blob');
          frames.push({ blob, delay: f.delay });
        }
        if (cancelled) return;

        const img = new Image();
        const firstUrl = URL.createObjectURL(frames[0].blob);
        img.src = firstUrl;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('首帧加载失败'));
        });
        URL.revokeObjectURL(firstUrl);

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D 不可用');

        const dpr = window.devicePixelRatio ?? 1;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        setLoading(false);
        onLoad?.();

        const imageUrls: string[] = [];
        for (const f of frames) {
          imageUrls.push(URL.createObjectURL(f.blob));
        }

        const preloadedImages: HTMLImageElement[] = [];
        for (let i = 0; i < imageUrls.length; i++) {
          const imgEl = new Image();
          imgEl.src = imageUrls[i];
          await new Promise<void>((resolve, reject) => {
            imgEl.onload = () => resolve();
            imgEl.onerror = () => reject(new Error(`帧 ${i} 加载失败`));
          });
          if (cancelled) {
            for (const u of imageUrls) URL.revokeObjectURL(u);
            return;
          }
          preloadedImages.push(imgEl);
        }

        let totalDelay = 0;
        const delays = frames.map((f) => {
          const t = totalDelay;
          totalDelay += f.delay;
          return t;
        });
        const totalMs = totalDelay;

        const drawFrame = (index: number) => {
          const imgEl = preloadedImages[index];
          if (imgEl && imgEl.complete) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(imgEl, 0, 0, w, h);
          }
        };

        const tick = () => {
          if (cancelled) return;
          const elapsed = (performance.now() - startTimeRef.current) % totalMs;
          let idx = 0;
          for (let i = delays.length - 1; i >= 0; i--) {
            if (elapsed >= delays[i]) {
              idx = i;
              break;
            }
          }
          if (idx !== frameIndexRef.current) {
            frameIndexRef.current = idx;
            drawFrame(idx);
          }
          animRef.current = requestAnimationFrame(tick);
        };

        startTimeRef.current = performance.now();
        frameIndexRef.current = 0;
        drawFrame(0);
        animRef.current = requestAnimationFrame(tick);

        imageUrlsRef.current = imageUrls;
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : '加载失败';
          setError(msg);
          setLoading(false);
          _onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    loadAndPlay();

    return () => {
      cancelled = true;
      if (animRef.current != null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      for (const u of imageUrlsRef.current) URL.revokeObjectURL(u);
      imageUrlsRef.current = [];
    };
  }, [src, onLoad, _onError]);

  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg bg-white/5 p-6 text-white/80',
          className
        )}
      >
        <span className="text-sm">Ugoira 加载失败: {error}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex items-center justify-center min-h-0 min-w-0',
        className
      )}
    >
      <canvas
        ref={canvasRef}
        className={cn('max-h-full max-w-full object-contain', loading && 'hidden')}
        aria-label={alt ?? '动图'}
      />
      {loading && (
        <div className="absolute flex items-center justify-center inset-0">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-purple-500" />
        </div>
      )}
    </div>
  );
}
