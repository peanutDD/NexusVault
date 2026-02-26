/**
 * MobilePdfPreview
 * 移动端专用 PDF 预览 —— 使用 PDF.js 渲染到 Canvas
 * 彻底绕开 iframe/blob 在 iOS Safari 等移动端浏览器不支持的限制
 *
 * 特性：
 *   - HiDPI / Retina 屏幕高清渲染
 *   - 页面导航（上一页 / 下一页 / 点击导航）
 *   - 水平滑动手势翻页
 *   - 缩放控制（+ / - 按钮，原生双指缩放）
 *   - 加载骨架 & 每页渲染进度
 *   - 出错时提供"新标签打开"兜底
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

// ---------------------------------------------------------------------------
// PDF.js Worker 初始化
// ---------------------------------------------------------------------------
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/**
 * 检测浏览器是否支持 Module Worker（iOS Safari < 16.4 不支持）
 * 不支持时将 workerSrc 置空，PDF.js 自动降级到主线程 "fake worker" 模式
 */
function initPdfjsWorker() {
  try {
    // 用空 Blob 探测 { type: 'module' } Worker 支持
    const probe = new Worker(
      URL.createObjectURL(new Blob([""], { type: "application/javascript" })),
      { type: "module" },
    );
    probe.terminate();
    // 支持 Module Worker → 使用 Vite 打包的 worker 文件
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  } catch {
    // 不支持 Module Worker（老版本 iOS Safari 等）→ 降级主线程
    pdfjs.GlobalWorkerOptions.workerSrc = "";
  }
}
initPdfjsWorker();

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.25;
// 水平滑动判定：最小触发距离（px）& 水平/垂直比
const SWIPE_MIN_X = 45;
const SWIPE_H_V_RATIO = 1.2;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface MobilePdfPreviewProps {
  /** PDF 的 Blob URL */
  blobUrl: string;
  /** PDF 文件名（aria 标签用） */
  title: string;
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------
function MobilePdfPreview({ blobUrl, title }: MobilePdfPreviewProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [userScale, setUserScale] = useState(1.0); // 用户主动调节的缩放倍率
  const [docLoading, setDocLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const cancelledRef = useRef(false);

  // 手势起点
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // ---------------------------------------------------------------------------
  // 加载 PDF 文档
  // ---------------------------------------------------------------------------
  useEffect(() => {
    cancelledRef.current = false;
    setDocLoading(true);
    setError(null);
    setCurrentPage(1);
    setNumPages(0);

    let loadingTask: ReturnType<typeof pdfjs.getDocument> | null = null;

    /**
     * 尝试用给定的 Uint8Array 数据加载 PDF。
     * 若 Worker 崩溃（"Setting up fake worker failed" 等），自动降级到主线程重试。
     */
    async function loadPdf(data: Uint8Array, isRetry = false): Promise<void> {
      loadingTask = pdfjs.getDocument({ data });
      try {
        const doc = await loadingTask.promise;
        if (cancelledRef.current) {
          doc.destroy();
          return;
        }
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setDocLoading(false);
      } catch (err: unknown) {
        if (cancelledRef.current) return;

        const msg = err instanceof Error ? err.message : String(err);
        const isWorkerError =
          msg.includes("worker") ||
          msg.includes("Worker") ||
          msg.includes("fake worker") ||
          msg.includes("Setting up");

        // Worker 相关错误且未重试过 → 降级主线程再试一次
        if (isWorkerError && !isRetry) {
          console.warn(
            "[MobilePdfPreview] Worker 加载失败，降级到主线程模式重试:",
            msg,
          );
          pdfjs.GlobalWorkerOptions.workerSrc = "";
          return loadPdf(data, true);
        }

        console.error("[MobilePdfPreview] PDF 加载失败:", err);
        setError(`PDF 加载失败：${msg}`);
        setDocLoading(false);
      }
    }

    (async () => {
      try {
        // fetch blob URL → ArrayBuffer，避免 Worker 沙箱内跨源请求 blob 失败
        const response = await fetch(blobUrl);
        if (!response.ok) throw new Error(`网络错误 ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        if (cancelledRef.current) return;
        await loadPdf(new Uint8Array(arrayBuffer));
      } catch (err: unknown) {
        if (cancelledRef.current) return;
        console.error("[MobilePdfPreview] PDF fetch 失败:", err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(`PDF 加载失败：${msg}`);
        setDocLoading(false);
      }
    })();

    return () => {
      cancelledRef.current = true;
      loadingTask?.destroy();
      renderTaskRef.current?.cancel();
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, [blobUrl]);

  // ---------------------------------------------------------------------------
  // 渲染页面
  // ---------------------------------------------------------------------------
  const renderPage = useCallback(async (pageNum: number, scale: number) => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!doc || !canvas || !container) return;

    // 取消正在执行的渲染任务
    renderTaskRef.current?.cancel();
    setPageLoading(true);

    let page: PDFPageProxy | null = null;
    try {
      page = await doc.getPage(pageNum);
      if (cancelledRef.current) return;

      // 以容器宽度为基准计算适配缩放
      const baseViewport = page.getViewport({ scale: 1 });
      const containerW = container.clientWidth - 8; // 留 4px 每侧间距
      const fitScale = Math.max(MIN_SCALE, containerW / baseViewport.width);
      const finalScale = fitScale * scale;

      const viewport = page.getViewport({ scale: finalScale });
      const dpr = window.devicePixelRatio || 1;

      // HiDPI canvas
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
      await renderTaskRef.current.promise;

      if (!cancelledRef.current) setPageLoading(false);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "RenderingCancelledException")
        return;
      if (!cancelledRef.current) {
        setError("页面渲染失败");
        setPageLoading(false);
      }
    } finally {
      page?.cleanup?.();
    }
  }, []);

  // 文档就绪 / 页码 / 缩放变化时重新渲染
  useEffect(() => {
    if (!docLoading && !error) {
      renderPage(currentPage, userScale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docLoading, error, currentPage, userScale]);

  // ---------------------------------------------------------------------------
  // 翻页
  // ---------------------------------------------------------------------------
  const goToPrev = useCallback(
    () => setCurrentPage((p) => Math.max(1, p - 1)),
    [],
  );
  const goToNext = useCallback(
    () => setCurrentPage((p) => Math.min(numPages, p + 1)),
    [numPages],
  );

  // ---------------------------------------------------------------------------
  // 缩放
  // ---------------------------------------------------------------------------
  const zoomIn = useCallback(
    () =>
      setUserScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2))),
    [],
  );
  const zoomOut = useCallback(
    () =>
      setUserScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2))),
    [],
  );

  // ---------------------------------------------------------------------------
  // 手势：水平滑动翻页
  // ---------------------------------------------------------------------------
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartXRef.current === null || touchStartYRef.current === null)
        return;
      const dx = e.changedTouches[0].clientX - touchStartXRef.current;
      const dy = e.changedTouches[0].clientY - touchStartYRef.current;
      touchStartXRef.current = null;
      touchStartYRef.current = null;

      // 多点触控（如双指缩放）时忽略翻页
      if (e.changedTouches.length > 1) return;
      if (
        Math.abs(dx) < SWIPE_MIN_X ||
        Math.abs(dx) < Math.abs(dy) * SWIPE_H_V_RATIO
      )
        return;

      if (dx < 0) goToNext();
      else goToPrev();
    },
    [goToPrev, goToNext],
  );

  // ---------------------------------------------------------------------------
  // 渲染
  // ---------------------------------------------------------------------------
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ------------------------------------------------------------------ */}
      {/* 可滚动内容区（canvas） */}
      {/* ------------------------------------------------------------------ */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-auto flex items-start justify-center"
        /* pan-y 保留原生纵向滚动；pinch-zoom 保留原生双指缩放 */
        style={{ touchAction: "pan-y pinch-zoom" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* 文档加载中 */}
        {docLoading && (
          <div className="flex h-full w-full min-h-[200px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-purple-400" />
              <span className="text-sm text-white/50">正在加载 PDF…</span>
            </div>
          </div>
        )}

        {/* 出错 */}
        {error && !docLoading && (
          <div className="flex h-full w-full min-h-[200px] items-center justify-center px-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20">
                <svg
                  className="h-7 w-7 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
              </div>
              <p className="text-sm text-red-300">{error}</p>
              <a
                href={blobUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white/10 px-5 py-2 text-sm text-white transition-colors hover:bg-white/20 active:bg-white/25"
              >
                在新标签中打开
              </a>
            </div>
          </div>
        )}

        {/* Canvas 页面内容 */}
        {!docLoading && !error && (
          <div className="relative p-1 flex items-start justify-center w-full">
            {/* 每页渲染 Loading 遮罩 */}
            {pageLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-purple-400" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="block max-w-full rounded-lg shadow-2xl"
              aria-label={`${title} — 第 ${currentPage} 页，共 ${numPages} 页`}
              style={{
                opacity: pageLoading ? 0.55 : 1,
                transition: "opacity 0.18s ease",
              }}
            />
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 底部工具栏：缩放 + 页码导航 */}
      {/* ------------------------------------------------------------------ */}
      {numPages > 0 && (
        <div
          className="flex shrink-0 items-center justify-between gap-2 px-3 py-2
                     bg-black/70 backdrop-blur-md border-t border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 上一页 */}
          <button
            type="button"
            onClick={goToPrev}
            disabled={currentPage <= 1}
            className="flex h-9 w-9 items-center justify-center rounded-full
                       bg-white/10 text-white/80 transition-colors
                       disabled:opacity-25 active:bg-white/25"
            aria-label="上一页"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* 缩小 */}
          <button
            type="button"
            onClick={zoomOut}
            disabled={userScale <= MIN_SCALE}
            className="flex h-8 w-8 items-center justify-center rounded-full
                       bg-white/10 text-white/70 text-lg font-bold transition-colors
                       disabled:opacity-25 active:bg-white/25"
            aria-label="缩小"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M20 12H4"
              />
            </svg>
          </button>

          {/* 页码 & 缩放比 */}
          <div className="flex flex-col items-center leading-tight">
            <span className="text-sm font-medium text-white/80">
              {currentPage}
              <span className="text-white/35 mx-1">/</span>
              {numPages}
            </span>
            <span className="text-[10px] text-white/40 tabular-nums">
              {Math.round(userScale * 100)}%
            </span>
          </div>

          {/* 放大 */}
          <button
            type="button"
            onClick={zoomIn}
            disabled={userScale >= MAX_SCALE}
            className="flex h-8 w-8 items-center justify-center rounded-full
                       bg-white/10 text-white/70 transition-colors
                       disabled:opacity-25 active:bg-white/25"
            aria-label="放大"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>

          {/* 下一页 */}
          <button
            type="button"
            onClick={goToNext}
            disabled={currentPage >= numPages}
            className="flex h-9 w-9 items-center justify-center rounded-full
                       bg-white/10 text-white/80 transition-colors
                       disabled:opacity-25 active:bg-white/25"
            aria-label="下一页"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(MobilePdfPreview);
