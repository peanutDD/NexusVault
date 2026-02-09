/**
 * UgoiraPlayer
 * 对齐 Pixiv うごイラ 的 zip 模式：一次请求拉取整包 ZIP，在浏览器内用 JSZip 解析后从内存播放，无按帧请求。
 * @see https://github.com/pixiv/zip_player
 */

import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { fileService } from '../../../services/files';
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
  /** 文件 ID，用于一次拉取整包 .ugoira (ZIP) */
  fileId: string;
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
  fileId,
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
  const lastDrawnRef = useRef<number>(-1);
  /** 预加载后的全部帧（与 Pixiv zip 模式一致：一次解析，内存播放） */
  const framesRef = useRef<HTMLImageElement[]>([]);
  const urlsToRevokeRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const loadAndPlay = async () => {
      try {
        setLoading(true);
        setError(null);

        // 一次请求拉取整包（与 Pixiv zip 模式一致）
        const blob = await fileService.getFileAsBlob(fileId);
        if (cancelled) return;

        const zip = await JSZip.loadAsync(blob);
        if (cancelled) return;

        const metaFile = zip.file('frames.json');
        if (!metaFile) throw new Error('缺少 frames.json');
        const metaText = await metaFile.async('string');
        const meta: UgoiraMetadata = JSON.parse(metaText);
        if (!meta.frames?.length) throw new Error('frames.json 格式无效');
        if (cancelled) return;

        const { frames: metaFrames } = meta;
        const delays: number[] = [];
        let totalDelay = 0;
        for (const f of metaFrames) {
          delays.push(totalDelay);
          totalDelay += Math.max(0, f.delay ?? 100);
        }
        const totalMs = Math.max(1, totalDelay);

        // 在内存中解出全部帧（无后续网络请求）
        const loadImage = (name: string): Promise<HTMLImageElement> => {
          const entry = zip.file(name);
          if (!entry) return Promise.reject(new Error(`缺少帧: ${name}`));
          return entry.async('blob').then((frameBlob) => {
            if (cancelled) throw new Error('cancelled');
            const url = URL.createObjectURL(frameBlob);
            urlsToRevokeRef.current.push(url);
            return new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error(`帧加载失败: ${name}`));
              img.src = url;
            });
          });
        };

        const images = await Promise.all(
          metaFrames.map((f, i) =>
            loadImage(f.file ?? `${i}.png`)
          )
        );
        if (cancelled) return;

        framesRef.current = images;
        const w = images[0].naturalWidth;
        const h = images[0].naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D 不可用');
        const dpr = window.devicePixelRatio ?? 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        setLoading(false);
        onLoad?.();

        const drawFrame = (index: number) => {
          const img = framesRef.current[index];
          if (img?.complete) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            lastDrawnRef.current = index;
          }
        };

        drawFrame(0);
        frameIndexRef.current = 0;
        lastDrawnRef.current = 0;

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
          }
          drawFrame(idx);
          animRef.current = requestAnimationFrame(tick);
        };

        startTimeRef.current = performance.now();
        animRef.current = requestAnimationFrame(tick);
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
      for (const u of urlsToRevokeRef.current) URL.revokeObjectURL(u);
      urlsToRevokeRef.current = [];
      framesRef.current = [];
    };
  }, [fileId, onLoad, _onError]);

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
