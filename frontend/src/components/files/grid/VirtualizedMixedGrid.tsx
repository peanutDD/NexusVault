import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import type { DragEvent } from "react";
import type { FileMetadata } from "../../../types/files";
import type { Folder } from "../../../types/folders";
import FileCard from "./FileCard";
import FolderCard from "./FolderCard";
import type { MixedGridItem } from "./MixedGrid";
import {
  buildRowModel,
  findStartRow,
  findEndRow,
  type GridItemDescriptor,
} from "../../../utils/pretextMeasure";

function getColumnsFromWidth(width: number): number {
  if (width >= 1280) return 10;
  if (width >= 1024) return 8;
  if (width >= 768) return 6;
  if (width >= 640) return 4;
  return 3;
}

interface VirtualizedMixedGridProps {
  items: MixedGridItem[];
  selectedFiles: Set<string>;
  selectedFolders: Set<string>;
  onSelectFile: (fileId: string, selected: boolean) => void;
  onSelectFolder: (folderId: string, selected: boolean) => void;
  onOpenFolder: (folderId: string) => void;
  onPreviewFile: (file: FileMetadata) => void;
  onShareFile: (file: FileMetadata) => void;
  onDownloadFile: (file: FileMetadata) => void;
  onRenameFolder: (folder: Folder) => void;
  onRenameFile: (file: FileMetadata) => void;
  onDelete: (file: FileMetadata | Folder, type: "file" | "folder") => void;
  onFileDragStart: (fileId: string, e: DragEvent) => void;
  onDropOnFolder: (
    folderId: string,
    fileIds: string[],
    folderIds: string[],
  ) => void;
  openFileMenuId: string | null;
  openFolderMenuId: string | null;
  onToggleFileMenu: (id: string) => void;
  onToggleFolderMenu: (id: string) => void;
  onCloseMenu: () => void;
}

export default function VirtualizedMixedGrid({
  items,
  selectedFiles,
  selectedFolders,
  onSelectFile,
  onSelectFolder,
  onOpenFolder,
  onPreviewFile,
  onShareFile,
  onDownloadFile,
  onRenameFolder,
  onRenameFile,
  onDelete,
  onFileDragStart,
  onDropOnFolder,
  openFileMenuId,
  openFolderMenuId,
  onToggleFileMenu,
  onToggleFolderMenu,
  onCloseMenu,
}: VirtualizedMixedGridProps) {
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
  const [containerTop, setContainerTop] = useState(0);
  const [visibleHeight, setVisibleHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  const rafIdRef = useRef<number | null>(null);
  const isUpdatingRef = useRef(false);

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

  const scheduleUpdate = useCallback(() => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;
    rafIdRef.current = requestAnimationFrame(() => {
      updateViewport();
      isUpdatingRef.current = false;
    });
  }, [updateViewport]);

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

  useEffect(() => {
    updateViewport();
    const handleScroll = () => scheduleUpdate();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      isUpdatingRef.current = false;
    };
  }, [updateViewport, scheduleUpdate]);

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

  useEffect(() => {
    updateViewport();
  }, [items.length, columns, updateViewport]);

// ── Pretext-based per-row heights ──────────────────────────────────────────
  const itemDescriptors = useMemo<GridItemDescriptor[]>(
    () => items.map((item) => item.type === "folder" ? { kind: "folder" as const, name: item.folder.name } : { kind: "file" as const, filename: item.file.original_filename }),
    [items],
  );
  const { prefixSums } = useMemo(
    () => buildRowModel(itemDescriptors, columns, containerWidth, typeof window !== "undefined" ? window.innerWidth : 1280),
    [itemDescriptors, columns, containerWidth],
  );
  const rowCount = Math.ceil(items.length / columns);
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

  const handleDeleteFile = useCallback(
    (file: FileMetadata) => onDelete(file, "file"),
    [onDelete],
  );
  const handleDeleteFolder = useCallback(
    (folder: Folder) => onDelete(folder, "folder"),
    [onDelete],
  );
  const handleMobileFolderDrop = useCallback(
    (targetFolderId: string, sourceFolderId: string) => {
      onDropOnFolder(targetFolderId, [], [sourceFolderId]);
    },
    [onDropOnFolder],
  );
  const handleMobileFileDrop = useCallback(
    (targetFolderId: string, sourceFileId: string) => {
      onDropOnFolder(targetFolderId, [sourceFileId], []);
    },
    [onDropOnFolder],
  );

  if (items.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="w-full"
      aria-label="文件列表"
      data-oid="op1m421"
    >
      {topSpacerHeight > 0 && (
        <div ref={topSpacerRef} aria-hidden="true" data-oid="j-f01-:" />
      )}

      {visibleRange.endRow >= visibleRange.startRow &&
        Array.from(
          { length: visibleRange.endRow - visibleRange.startRow + 1 },
          (_, i) => {
            const rowIndex = visibleRange.startRow + i;
            const start = rowIndex * columns;
            const rowItems = items.slice(start, start + columns);
            if (rowItems.length === 0) return null;

            return (
              <div
                key={rowIndex}
                className="virtualized-row mb-2 pt-1 last:mb-0"
                data-oid="jzokoas"
              >
                <div
                  className="grid gap-2 bg-transparent [grid-template-columns:repeat(var(--grid-cols,3),minmax(0,1fr))]"
                  data-oid="u0k78u0"
                >
                  {rowItems.map((item) => {
                    if (item.type === "folder") {
                      const folder = item.folder;
                      return (
                        <FolderCard
                          key={`folder-${folder.id}`}
                          folder={folder}
                          isSelected={selectedFolders.has(folder.id)}
                          onSelect={onSelectFolder}
                          onOpen={onOpenFolder}
                          onRename={onRenameFolder}
                          onDelete={handleDeleteFolder}
                          onDrop={onDropOnFolder}
                          onMobileFolderDrop={handleMobileFolderDrop}
                          isMenuOpen={openFolderMenuId === folder.id}
                          onToggleMenu={onToggleFolderMenu}
                          onCloseMenu={onCloseMenu}
                          data-oid="nqcj-9x"
                        />
                      );
                    }

                    const file = item.file;
                    return (
                      <FileCard
                        key={`file-${file.id}`}
                        file={file}
                        isSelected={selectedFiles.has(file.id)}
                        onSelect={onSelectFile}
                        onPreview={onPreviewFile}
                        onShare={onShareFile}
                        onDownload={onDownloadFile}
                        onRename={onRenameFile}
                        onDelete={handleDeleteFile}
                        onDragStart={onFileDragStart}
                        onMobileFileDrop={handleMobileFileDrop}
                        isMenuOpen={openFileMenuId === file.id}
                        onToggleMenu={onToggleFileMenu}
                        onCloseMenu={onCloseMenu}
                        data-oid="7hvdt_8"
                      />
                    );
                  })}
                </div>
              </div>
            );
          },
        )}

      {bottomSpacerHeight > 0 && (
        <div ref={bottomSpacerRef} aria-hidden="true" data-oid="wn2oua8" />
      )}
    </div>
  );
}
