/**
 * UgoiraPlayer
 * 
 * 对齐 Pixiv zip_player：使用 HTTP Range 请求流式加载 ZIP 文件
 * - 先读取 ZIP central directory（在文件末尾）
 * - 解析目录后按需请求每个帧的字节范围
 * - 边下载边播放，快速开始播放
 * 
 * @see https://github.com/pixiv/zip_player
 */

import { useEffect, useRef, useState } from 'react';
import { readZipEntryWithZipJs } from '../../../utils/zipStreaming';
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
  const [progress, setProgress] = useState(0); // 加载进度 0-100
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const frameIndexRef = useRef<number>(0);
  const lastDrawnRef = useRef<number>(-1);
  /** 预加载后的全部帧（当前实现：一次解析，内存播放） */
  const framesRef = useRef<(HTMLImageElement | null)[]>([]);
  const urlsToRevokeRef = useRef<string[]>([]);
  const loadingFramesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const loadAndPlay = async () => {
      try {
        setLoading(true);
        setError(null);
        setProgress(0);

        // 步骤 1: 使用 zip.js 读取 frames.json（Range 请求，只下载需要的部分）
        setProgress(10);
        const metaBlob = await readZipEntryWithZipJs(fileId, 'frames.json', cancelled ? new AbortController().signal : undefined);
        if (cancelled) return;
        
        const metaText = await metaBlob.text();
        const meta: UgoiraMetadata = JSON.parse(metaText);
        if (!meta.frames?.length) throw new Error('frames.json 格式无效');
        if (cancelled) return;

        setProgress(20);
        const { frames: metaFrames } = meta;
        const delays: number[] = [];
        let totalDelay = 0;
        for (const f of metaFrames) {
          delays.push(totalDelay);
          totalDelay += Math.max(0, f.delay ?? 100);
        }
        const totalMs = Math.max(1, totalDelay);

        // 初始化 frames 数组
        framesRef.current = new Array(metaFrames.length).fill(null);

        // 步骤 2: 优先加载首帧，快速开始播放（Range 请求，只下载首帧）
        const loadImage = async (name: string, index: number): Promise<HTMLImageElement> => {
          // 如果已取消，直接返回已加载的帧（如果有）
          if (cancelled && index > 0) {
            const existing = framesRef.current[index];
            if (existing) return existing;
            throw new Error('cancelled');
          }

          if (loadingFramesRef.current.has(index)) {
            // 已在加载中，等待现有加载完成
            return new Promise((resolve, reject) => {
              const checkInterval = setInterval(() => {
                if (cancelled && index > 0) {
                  clearInterval(checkInterval);
                  const existing = framesRef.current[index];
                  if (existing) {
                    resolve(existing);
                  } else {
                    reject(new Error('cancelled'));
                  }
                  return;
                }
                if (framesRef.current[index]) {
                  clearInterval(checkInterval);
                  resolve(framesRef.current[index]!);
                } else if (!loadingFramesRef.current.has(index)) {
                  clearInterval(checkInterval);
                  reject(new Error(`帧 ${index} 加载失败`));
                }
              }, 50);
            });
          }

          loadingFramesRef.current.add(index);
          try {
            // 使用 zip.js 的 Range 请求加载单个帧（只下载该帧的字节范围）
            const frameBlob = await readZipEntryWithZipJs(fileId, name, undefined);
            
            // 检查是否在加载过程中被取消（仅对非首帧）
            if (cancelled && index > 0) {
              loadingFramesRef.current.delete(index);
              throw new Error('cancelled');
            }
            
            const url = URL.createObjectURL(frameBlob);
            urlsToRevokeRef.current.push(url);
            return new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                // 再次检查是否被取消（仅对非首帧）
                if (cancelled && index > 0) {
                  loadingFramesRef.current.delete(index);
                  URL.revokeObjectURL(url);
                  reject(new Error('cancelled'));
                  return;
                }
                framesRef.current[index] = img;
                loadingFramesRef.current.delete(index);
                // 更新进度：metadata(20%) + 首帧(10%) + 后续帧(70%)
                if (index === 0) {
                  setProgress(30);
                } else {
                  const frameProgress = 30 + Math.floor((index / metaFrames.length) * 70);
                  setProgress(frameProgress);
                }
                resolve(img);
              };
              img.onerror = () => {
                loadingFramesRef.current.delete(index);
                URL.revokeObjectURL(url);
                reject(new Error(`帧加载失败: ${name}`));
              };
              img.src = url;
            });
          } catch (err) {
            loadingFramesRef.current.delete(index);
            throw err;
          }
        };

        // 优先加载首帧，快速开始播放
        const firstFrameName = metaFrames[0]?.file ?? '0.png';
        const firstImage = await loadImage(firstFrameName, 0);
        if (cancelled) return;

        const w = firstImage.naturalWidth;
        const h = firstImage.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D 不可用');
        const dpr = window.devicePixelRatio ?? 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        // 先绘制首帧，立即显示（此时只下载了 metadata 和首帧，对齐 Pixiv 的快速开始播放）
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(firstImage, 0, 0, w, h);
        lastDrawnRef.current = 0;
        frameIndexRef.current = 0;

        setLoading(false);
        setProgress(30); // 首帧加载完成，可以开始播放
        onLoad?.();

        // 步骤 3: 边播放边按需加载后续帧（Range 请求，只下载需要的帧）
        // 预加载接下来 2-3 帧，然后按播放进度加载
        const preloadNextFrames = async (startIndex: number, count: number) => {
          const endIndex = Math.min(startIndex + count, metaFrames.length);
          for (let i = startIndex; i < endIndex; i++) {
            if (cancelled) break; // 使用 break 而不是 return，确保已启动的加载能继续
            const frameName = metaFrames[i]?.file ?? `${i}.png`;
            try {
              await loadImage(frameName, i);
            } catch (err) {
              // 只记录非 cancelled 的错误
              if (err instanceof Error && err.message !== 'cancelled') {
                console.warn(`帧 ${i} 预加载失败:`, err);
              }
              // cancelled 错误静默处理，不影响其他帧的加载
            }
          }
        };

        // 立即预加载接下来 2 帧
        preloadNextFrames(1, 2).catch(() => {
          // 忽略预加载错误
        });

        // 监听播放进度，按需加载后续帧
        let lastPreloadedIndex = 2;
        const checkAndPreload = () => {
          if (cancelled) return;
          // 如果当前播放帧接近已预加载的帧，继续预加载
          if (frameIndexRef.current >= lastPreloadedIndex - 1 && lastPreloadedIndex < metaFrames.length) {
            const nextBatch = Math.min(3, metaFrames.length - lastPreloadedIndex);
            preloadNextFrames(lastPreloadedIndex, nextBatch).catch(() => {});
            lastPreloadedIndex += nextBatch;
          }
        };

        const drawFrame = (index: number) => {
          const img = framesRef.current[index];
          if (img?.complete) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            lastDrawnRef.current = index;
          } else {
            // 帧未加载完成，尝试显示上一帧，或者如果这是首帧则显示首帧
            const fallbackIndex = lastDrawnRef.current >= 0 ? lastDrawnRef.current : 0;
            const fallbackImg = framesRef.current[fallbackIndex];
            if (fallbackImg?.complete) {
              ctx.clearRect(0, 0, w, h);
              ctx.drawImage(fallbackImg, 0, 0, w, h);
            }
            // 如果当前帧未加载，尝试立即加载它（紧急加载）
            if (!loadingFramesRef.current.has(index) && !framesRef.current[index]) {
              const frameName = metaFrames[index]?.file ?? `${index}.png`;
              loadImage(frameName, index).catch(() => {
                // 静默处理错误，避免控制台噪音
              });
            }
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
            // 检查是否需要预加载更多帧
            checkAndPreload();
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
        <div className="absolute flex flex-col items-center justify-center gap-3 inset-0">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-purple-500" />
          {progress > 0 && progress < 100 && (
            <div className="text-xs text-white/60">
              加载中 {progress}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
