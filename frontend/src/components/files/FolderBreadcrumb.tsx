import { memo } from "react";
import type { Folder } from "../../types/folders";
import { cn } from "../../utils/cn";

interface FolderBreadcrumbProps {
  path: Folder[];
  onNavigate: (folderId: string | null) => void;
  onDrop?: (e: React.DragEvent, targetFolderId: string | null) => void;
}

/**
 * 文件夹面包屑导航组件
 * 显示当前路径，支持点击跳转和拖拽放置
 */
const FolderBreadcrumb = memo(function FolderBreadcrumb({
  path,
  onNavigate,
  onDrop,
}: FolderBreadcrumbProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    onDrop?.(e, folderId);
  };

  return (
    <nav
      className="font-brand flex items-center justify-start gap-[clamp(0.195rem,0.45vw,0.25rem)] overflow-x-auto whitespace-nowrap font-normal tracking-widest text-[length:var(--font-size-ui-5xs)] leading-none text-[var(--filelist-breadcrumb-text)]"
      aria-label="面包屑导航"
      data-oid="im_2rc0"
    >
      {/* 根目录 */}
      <button
        type="button"
        onClick={() => onNavigate(null)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, null)}
        className={cn(
          "glass-chip flex items-center gap-[clamp(0.195rem,0.45vw,0.25rem)] px-[clamp(0.39rem,0.9vw,0.5rem)] py-[clamp(0.195rem,0.45vw,0.25rem)] transition-colors whitespace-nowrap",
          path.length === 0
            ? "text-[var(--filelist-breadcrumb-text-active)]"
            : "text-[var(--filelist-breadcrumb-text-muted)] hover:text-[var(--filelist-breadcrumb-text-active)]",
        )}
        data-oid="ha.a-tv"
      >
        <HomeIcon className="h-[clamp(0.6825rem,1.575vw,0.875rem)] w-[clamp(0.6825rem,1.575vw,0.875rem)] shrink-0" data-oid="dj:zxma" />
        <span data-oid="1t0:uam">Home</span>
      </button>

      {/* 路径项 */}
      {path.map((folder, index) => (
        <div
          key={folder.id}
          className="flex shrink-0 items-center"
          data-oid="m0m6tsp"
        >
          <ChevronIcon
            className="h-[clamp(0.6825rem,1.575vw,0.875rem)] w-[clamp(0.6825rem,1.575vw,0.875rem)] shrink-0 text-[var(--filelist-breadcrumb-separator)]"
            data-oid="12ne7sn"
          />

          <button
            type="button"
            onClick={() => onNavigate(folder.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, folder.id)}
            className={cn(
              "glass-chip px-[clamp(0.39rem,0.9vw,0.5rem)] py-[clamp(0.195rem,0.45vw,0.25rem)] transition-colors whitespace-nowrap",
              index === path.length - 1
                ? "text-[var(--filelist-breadcrumb-text-active)]"
                : "text-[var(--filelist-breadcrumb-text-muted)] hover:text-[var(--filelist-breadcrumb-text-active)]",
            )}
            data-oid=".qzvcbd"
          >
            {folder.name}
          </button>
        </div>
      ))}
    </nav>
  );
});

// 主页图标
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      data-oid="mk2dy7x"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        data-oid="34feupn"
      />
    </svg>
  );
}

// 箭头图标
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      data-oid="y3beha3"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
        data-oid="dk1x:d."
      />
    </svg>
  );
}

export default FolderBreadcrumb;
