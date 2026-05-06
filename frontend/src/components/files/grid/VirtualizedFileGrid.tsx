import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import type { FileMetadata } from "../../../types/files";
import type { Folder } from "../../../types/folders";
import FileCard from "./FileCard";
import {
  buildRowModel,
  findStartRow,
  findEndRow,
  type GridItemDescriptor,
} from "../../../utils/pretextMeasure";

/** 根据窗口宽度估算网格列数（与 FileGrid/FolderGrid 保持一致） */
function getColumnsFromWidth(width: number): number {
  if (width >= 1280) return 10;
  if (width >= 1024) return 8;
  if (width >= 768) return 6;
  if (width >= 640) return 4;
  return 3;
}

interface VirtualizedFileGridProps {
  files: FileMetadata[];
  selectedFiles: Set<string>;
  onSelect: (fileId: string, selected: boolean) => void;
  onPreview: (file: FileMetadata) => void;
  onShare: (file: FileMetadata) => void;
  onDownload: (file: FileMetadata) => void;
  onRename: (file: FileMetadata) => void;
  onDelete: (file: FileMetadata | Folder, type: "file" | "folder") => void;
  onDragStart: (fileId: string, e: React.DragEvent) => void;
  openFileMenuId: string | null;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
}

/**
 * 虚拟化文件网格（基于浏览器窗口滚动）：
 * - 内嵌「窗口」= 浏览器视口，列表参与整页滚动，有足够可视空间。
 * - 只渲染视口内行 + overscan，减少大列表 DOM 与渲染压力。
 *
 * 修复：
 * - 移除嵌套 RAF，使用单一更新机制
 * - 对 scroll 事件使用 RAF 节流，避免过于频繁的计算
 * - 合并 resize 监听器，避免重复
 */
export default function VirtualizedFileGrid({
  files,
  selectedFiles,
  onSelect,
  onPreview,
  onShare,
  onDownload,
  onRename,
  onDelete,
  onDragStart,
  openFileMenuId,
  onToggleMenu,
  onCloseMenu,
}: VirtualizedFileGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const topSpacerRef = useRef<HTMLDivElement>(null);
  const bottomSpacerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(() =>
    getColumnsFromWidth(
      typeof window !== "undefined" ? window.innerWidth : 1280,
    ),
  );
  const [containerWidth, setContainerWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );
  /** 容器顶部相对于视口顶部的偏移（<0 表示已向上滚过） */
  const [containerTop, setContainerTop] = useState(0);
  /** 容器在视口内的可见高度（像素） */
  const [visibleHeight, setVisibleHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  // 使用 refs 跟踪 RAF 和节流状态
  const rafIdRef = useRef<number | null>(null);
  const isUpdatingRef = useRef(false);

  // 更新视口位置
  const updateViewport = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setContainerTop(rect.top);
    const viewportBottom = window.innerHeight;
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(viewportBottom, rect.bottom);
    setVisibleHeight(Math.max(0, visibleBottom - visibleTop));
  }, []);

  // 使用 RAF 节流的更新函数
  const scheduleUpdate = useCallback(() => {
    // 如果已经在等待更新，跳过
    if (isUpdatingRef.current) return;

    isUpdatingRef.current = true;
    rafIdRef.current = requestAnimationFrame(() => {
      updateViewport();
      isUpdatingRef.current = false;
    });
  }, [updateViewport]);

  // 统一的 resize 处理（节流 + 更新 columns 和 viewport）
  useEffect(() => {
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    const RESIZE_THROTTLE_MS = 150;

    const handleResize = () => {
      if (resizeTimeout !== null) return;

      resizeTimeout = setTimeout(() => {
        resizeTimeout = null;
        setColumns(getColumnsFromWidth(window.innerWidth));
        updateViewport();
      }, RESIZE_THROTTLE_MS);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimeout !== null) clearTimeout(resizeTimeout);
    };
  }, [updateViewport]);

  // scroll 事件监听（使用 RAF 节流）
  useEffect(() => {
    // 初始更新
    updateViewport();

    // scroll 事件处理
    const handleScroll = () => {
      scheduleUpdate();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      // 清理挂起的 RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      isUpdatingRef.current = false;
    };
  }, [updateViewport, scheduleUpdate]);

  // 监听容器宽度变化：行高估算依赖“每卡的实际宽度”（aspect-square）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // 当 files 或 columns 变化时重新计算
  useEffect(() => {
    updateViewport();
  }, [files.length, columns, updateViewport]);

// ── Pretext-based per-row heights ──────────────────────────────────────────
  const itemDescriptors = useMemo<GridItemDescriptor[]>(
    () => files.map((f) => ({ kind: "file" as const, filename: f.original_filename })),
    [files],
  );
  const { prefixSums } = useMemo(
    () => buildRowModel(itemDescriptors, columns, containerWidth, typeof window !== "undefined" ? window.innerWidth : 1280),
    [itemDescriptors, columns, containerWidth],
  );
  const rowCount = Math.ceil(files.length / columns);
  const overscan = 2;
  const scrollTopInContainer = Math.max(0, -containerTop);
  const visibleRange = useMemo(() => {
    if (rowCount === 0) return { startRow: 0, endRow: -1 };
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
    if (visibleHeight <= 0 || containerTop > viewportHeight) {
      return { startRow: 0, endRow: Math.min(rowCount - 1, overscan * 2) };
    }
    const scrollBottom = scrollTopInContainer + visibleHeight;
    const startRow = Math.max(0, findStartRow(prefixSums, scrollTopInContainer) - overscan);
    const endRow = Math.min(rowCount - 1, findEndRow(prefixSums, scrollBottom) + overscan);
    return { startRow, endRow };
  }, [scrollTopInContainer, visibleHeight, prefixSums, rowCount, containerTop]);
  const topSpacerHeight = prefixSums[visibleRange.startRow] ?? 0;
  const totalHeight = prefixSums[rowCount] ?? 0;
  const bottomSpacerHeight = Math.max(0, totalHeight - (prefixSums[visibleRange.endRow + 1] ?? totalHeight));

  // 将 columns / spacer 高度同步到 DOM，避免内联 style 触发 lint
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.style.setProperty("--grid-cols", String(columns));
  }, [columns]);
  useEffect(() => {
    const el = topSpacerRef.current;
    if (el) el.style.setProperty("height", `${topSpacerHeight}px`);
  }, [topSpacerHeight]);
  useEffect(() => {
    const el = bottomSpacerRef.current;
    if (el) el.style.setProperty("height", `${bottomSpacerHeight}px`);
  }, [bottomSpacerHeight]);

  if (files.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="w-full"
      aria-label="文件列表"
      data-oid="l.ic_.p"
    >
      {/* 顶部占位，保证滚动高度接近真实高度 */}
      {topSpacerHeight > 0 && (
        <div ref={topSpacerRef} aria-hidden="true" data-oid="cp-0vp-" />
      )}

      {visibleRange.endRow >= visibleRange.startRow &&
        Array.from(
          { length: visibleRange.endRow - visibleRange.startRow + 1 },
          (_, i) => {
            const rowIndex = visibleRange.startRow + i;
            const start = rowIndex * columns;
            const rowFiles = files.slice(start, start + columns);
            if (rowFiles.length === 0) return null;

            return (
              <div
                key={rowIndex}
                className="virtualized-row mb-2 pt-1 last:mb-0"
                data-oid="qbzn4v8"
              >
                <div
                  className="grid gap-2 bg-transparent [grid-template-columns:repeat(var(--grid-cols,3),minmax(0,1fr))]"
                  data-oid="pq_c030"
                >
                  {rowFiles.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      isSelected={selectedFiles.has(file.id)}
                      onSelect={(id) => onSelect(id, !selectedFiles.has(id))}
                      onPreview={onPreview}
                      onShare={onShare}
                      onDownload={onDownload}
                      onRename={() => onRename(file)}
                      onDelete={() => onDelete(file, "file")}
                      onDragStart={(e, file) => onDragStart(file.id, e)}
                      isMenuOpen={openFileMenuId === file.id}
                      onToggleMenu={onToggleMenu}
                      onCloseMenu={onCloseMenu}
                      data-oid="yl4xq88"
                    />
                  ))}
                </div>
              </div>
            );
          },
        )}

      {/* 底部占位，补齐剩余高度 */}
      {bottomSpacerHeight > 0 && (
        <div ref={bottomSpacerRef} aria-hidden="true" data-oid="badkmi9" />
      )}
    </div>
  );
}
