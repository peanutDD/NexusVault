import { memo } from 'react';
import type { Folder } from '../../services/folders';
import { cn } from '../../utils/cn';

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
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    onDrop?.(e, folderId);
  };

  return (
    <nav
      className="flex items-center justify-start gap-1 overflow-x-auto whitespace-nowrap text-sm"
      aria-label="面包屑导航"
    >
      {/* 根目录 */}
      <button
        type="button"
        onClick={() => onNavigate(null)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, null)}
        className={cn(
          'glass-chip flex items-center gap-1 px-2 py-1 transition-colors whitespace-nowrap',
          path.length === 0 && 'text-white font-medium'
        )}
      >
        <HomeIcon className="h-4 w-4" />
        <span>全部文件</span>
      </button>

      {/* 路径项 */}
      {path.map((folder, index) => (
        <div key={folder.id} className="flex shrink-0 items-center">
          <ChevronIcon className="h-4 w-4 text-gray-600" />
          <button
            type="button"
            onClick={() => onNavigate(folder.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, folder.id)}
            className={cn(
              'glass-chip px-2 py-1 transition-colors whitespace-nowrap',
              index === path.length - 1 && 'text-white font-medium'
            )}
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
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
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
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

export default FolderBreadcrumb;
