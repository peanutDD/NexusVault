import { useEffect, useRef, useState } from "react";
import type { FileMetadata } from "../../../types/files";
import type { Folder } from "../../../types/folders";
import { fileService } from "../../../services/files";
import { useAuthStore } from "../../../store/authStore";
import {
  getCachedThumbnailUrl,
  setCachedThumbnailUrl,
} from "../../../utils/thumbnailBlobCache";
import { isImageType } from "../../../utils/mimeType";
import FileCard from "./FileCard";

interface FileGridProps {
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
 * 文件网格组件 v2
 *
 * 设计原则：
 * 1. 不使用 memo - 组件本身足够简单，memo 开销反而更大
 * 2. 子组件 FileCard 自带 memo + 自定义比较，已足够高效
 * 3. 使用 CSS content-visibility 实现原生虚拟化（浏览器自动优化）
 */
export default function FileGrid({
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
}: FileGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [priorityCount, setPriorityCount] = useState(6);
  const preheatedRef = useRef(new Set<string>());

  useEffect(() => {
    const calc = () => {
      const el = gridRef.current;
      if (!el || typeof window === "undefined") return;
      const rect = el.getBoundingClientRect();
      const styles = getComputedStyle(el);
      const columns = Math.max(1, styles.gridTemplateColumns.split(" ").length);
      const first = el.firstElementChild as HTMLElement | null;
      if (!first) return;
      const itemRect = first.getBoundingClientRect();
      const rowGap = Number.parseFloat(styles.rowGap || "0");
      const rowHeight = itemRect.height + rowGap;
      const visibleHeight = Math.max(
        0,
        Math.min(rect.height, window.innerHeight - Math.max(0, rect.top)),
      );
      const rows =
        rowHeight > 0 ? Math.max(1, Math.ceil(visibleHeight / rowHeight)) : 2;
      const count = Math.min(files.length, Math.max(6, (rows + 1) * columns));
      setPriorityCount(count);
    };
    const schedule = () => window.requestAnimationFrame(calc);
    schedule();
    window.addEventListener("resize", schedule);
    const el = gridRef.current;
    const observer = el ? new ResizeObserver(schedule) : null;
    if (el && observer) observer.observe(el);
    return () => {
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [files.length]);

  useEffect(() => {
    if (priorityCount <= 0) return;
    let cancelled = false;
    const targets = files.slice(0, priorityCount);
    const token =
      useAuthStore.getState().token ??
      (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    targets.forEach((file) => {
      if (!isImageType(file.mime_type)) return;
      if (preheatedRef.current.has(file.id)) return;
      preheatedRef.current.add(file.id);
      const cached = getCachedThumbnailUrl(file.id);
      if (cached) return;
      const url = fileService.getThumbnailUrl(file.id, { width: 400, token });
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      img.onerror = () => {
        if (cancelled) return;
        fileService
          .fetchThumbnailBlob(file.id)
          .then((blob) => {
            if (cancelled || !blob) {
              preheatedRef.current.delete(file.id);
              return;
            }
            const blobUrl = URL.createObjectURL(blob);
            setCachedThumbnailUrl(file.id, blobUrl);
          })
          .catch(() => {
            if (!cancelled) preheatedRef.current.delete(file.id);
          });
      };
    });
    return () => {
      cancelled = true;
    };
  }, [priorityCount, files]);

  if (files.length === 0) return null;

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
      data-oid="vrpg5nb"
    >
      {files.map((file, index) => (
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
          onDragStart={(e) => onDragStart(file.id, e)}
          isMenuOpen={openFileMenuId === file.id}
          onToggleMenu={onToggleMenu}
          onCloseMenu={onCloseMenu}
          thumbnailPriority={index < priorityCount ? "high" : "low"}
          data-oid="ch9:3cv"
        />
      ))}
    </div>
  );
}
