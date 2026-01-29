import { useRef, useState, useEffect, useMemo } from 'react';
import type { FileMetadata } from '../../services/files';
import FileCard from './FileCard';
import { FILE_LIST } from '../../constants';
import { useThrottledCallback } from '../../hooks/useThrottledCallback';

/** 根据窗口宽度估算网格列数（与 Tailwind grid-cols-2 … xl:grid-cols-6 一致） */
function getColumnsFromWidth(width: number): number {
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

interface VirtualizedFileGridProps {
  files: FileMetadata[];
  selectedFiles: Set<string>;
  onSelect: (fileId: string) => void;
  onPreview: (file: FileMetadata) => void;
  onShare: (file: FileMetadata) => void;
  onDownload: (file: FileMetadata) => void;
  onDelete: (fileId: string) => void;
  onDragStart: (e: React.DragEvent, file: FileMetadata) => void;
}

/**
 * 虚拟化文件网格（基于浏览器窗口滚动）：
 * - 内嵌「窗口」= 浏览器视口，列表参与整页滚动，有足够可视空间。
 * - 只渲染视口内行 + overscan，减少大列表 DOM 与渲染压力。
 */
export default function VirtualizedFileGrid({
  files,
  selectedFiles,
  onSelect,
  onPreview,
  onShare,
  onDownload,
  onDelete,
  onDragStart,
}: VirtualizedFileGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const topSpacerRef = useRef<HTMLDivElement>(null);
  const bottomSpacerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(() =>
    getColumnsFromWidth(typeof window !== 'undefined' ? window.innerWidth : 1280)
  );
  /** 容器顶部相对于视口顶部的偏移（<0 表示已向上滚过） */
  const [containerTop, setContainerTop] = useState(0);
  /** 容器在视口内的可见高度（像素） */
  const [visibleHeight, setVisibleHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 800
  );

  const throttledSetColumns = useThrottledCallback(
    () => setColumns(getColumnsFromWidth(window.innerWidth)),
    150
  );
  useEffect(() => {
    window.addEventListener('resize', throttledSetColumns);
    return () => window.removeEventListener('resize', throttledSetColumns);
  }, [throttledSetColumns]);

  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setContainerTop(rect.top);
      const viewportBottom = window.innerHeight;
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(viewportBottom, rect.bottom);
      setVisibleHeight(Math.max(0, visibleBottom - visibleTop));
    };

    const rafId = requestAnimationFrame(() => {
      update();
      requestAnimationFrame(update);
    });

    let lastResize = 0;
    const RESIZE_THROTTLE_MS = 150;
    const onResize = () => {
      const now = Date.now();
      if (now - lastResize >= RESIZE_THROTTLE_MS) {
        lastResize = now;
        update();
      }
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', onResize);
    };
  }, [files.length, columns]);

  const rowHeight = FILE_LIST.VIRTUAL_GRID_ROW_HEIGHT;
  const rowCount = Math.ceil(files.length / columns);
  const overscan = 2;

  // 视口内可见的「滚动偏移」（容器顶部被滚过多少）
  const scrollTopInContainer = Math.max(0, -containerTop);

  const visibleRange = useMemo(() => {
    if (rowCount === 0) return { startRow: 0, endRow: -1 };

    // 如果列表不在视口内或可见高度为 0，至少渲染前几行
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    if (visibleHeight <= 0 || containerTop > viewportHeight) {
      return { startRow: 0, endRow: Math.min(rowCount - 1, overscan * 2) };
    }

    const startRow = Math.max(0, Math.floor(scrollTopInContainer / rowHeight) - overscan);
    const endRow = Math.min(
      rowCount - 1,
      Math.ceil((scrollTopInContainer + visibleHeight) / rowHeight) + overscan
    );
    return { startRow, endRow };
  }, [scrollTopInContainer, visibleHeight, rowHeight, rowCount, overscan, containerTop]);

  const topSpacerHeight = Math.max(0, visibleRange.startRow * rowHeight);
  const bottomSpacerHeight = Math.max(0, (rowCount - visibleRange.endRow - 1) * rowHeight);

  // 将 columns / spacer 高度同步到 DOM，避免内联 style 触发 lint
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.style.setProperty('--grid-cols', String(columns));
  }, [columns]);
  useEffect(() => {
    const el = topSpacerRef.current;
    if (el) el.style.setProperty('height', `${topSpacerHeight}px`);
  }, [topSpacerHeight]);
  useEffect(() => {
    const el = bottomSpacerRef.current;
    if (el) el.style.setProperty('height', `${bottomSpacerHeight}px`);
  }, [bottomSpacerHeight]);

  if (files.length === 0) return null;

  return (
    <div ref={containerRef} className="w-full" aria-label="文件列表">
      {/* 顶部占位，保证滚动高度接近真实高度 */}
      {topSpacerHeight > 0 && <div ref={topSpacerRef} aria-hidden="true" />}

      {visibleRange.endRow >= visibleRange.startRow &&
        Array.from({ length: visibleRange.endRow - visibleRange.startRow + 1 }, (_, i) => {
          const rowIndex = visibleRange.startRow + i;
          const start = rowIndex * columns;
          const rowFiles = files.slice(start, start + columns);
          if (rowFiles.length === 0) return null;

          return (
            <div key={rowIndex} className="mb-4 last:mb-0">
              <div
                className="grid gap-4 [grid-template-columns:repeat(var(--grid-cols,2),minmax(0,1fr))]"
              >
                {rowFiles.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    isSelected={selectedFiles.has(file.id)}
                    onSelect={onSelect}
                    onPreview={onPreview}
                    onShare={onShare}
                    onDownload={onDownload}
                    onDelete={onDelete}
                    onDragStart={onDragStart}
                  />
                ))}
              </div>
            </div>
          );
        })}

      {/* 底部占位，补齐剩余高度 */}
      {bottomSpacerHeight > 0 && <div ref={bottomSpacerRef} aria-hidden="true" />}
    </div>
  );
}
