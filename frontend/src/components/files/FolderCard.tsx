import { memo, useState } from 'react';
import type { Folder } from '../../services/folders';
import { cn } from '../../utils/cn';

interface FolderCardProps {
  folder: Folder;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onOpen: (folder: Folder) => void;
  onRename: (folder: Folder) => void;
  onDelete: (id: string) => void;
  onDragStart?: (e: React.DragEvent, folder: Folder) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, targetFolder: Folder) => void;
}

/**
 * 文件夹卡片组件
 * 支持双击进入、右键菜单、拖拽
 */
const FolderCard = memo(function FolderCard({
  folder,
  isSelected,
  onSelect,
  onOpen,
  onRename,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: FolderCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleDoubleClick = () => {
    onOpen(folder);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/folder-id', folder.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(e, folder);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 检查是否是文件或文件夹
    const hasFolderId = e.dataTransfer.types.includes('application/folder-id');
    const hasFileId = e.dataTransfer.types.includes('application/file-id');
    if (hasFolderId || hasFileId) {
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
      onDragOver?.(e);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDragLeave?.(e);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    onDrop?.(e, folder);
  };

  return (
    <div
      className={cn(
        'group relative rounded-xl bg-gray-800/80 p-3 transition-all duration-200 cursor-pointer',
        'hover:bg-gray-800 hover:shadow-lg hover:shadow-purple-500/10',
        isSelected && 'ring-2 ring-purple-500 bg-purple-500/10',
        isDragOver && 'ring-2 ring-blue-500 bg-blue-500/10'
      )}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {/* 选择框 */}
      <div
        className={cn(
          'absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md transition-all cursor-pointer',
          isSelected
            ? 'bg-purple-500'
            : 'bg-black/40 opacity-0 group-hover:opacity-100'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(folder.id);
        }}
      >
        {isSelected ? (
          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <div className="h-4 w-4 rounded border-2 border-white/60" />
        )}
      </div>

      {/* 文件夹图标 */}
      <div className="mb-3 flex aspect-square items-center justify-center rounded-lg bg-amber-500/20">
        <FolderIcon className="h-12 w-12 text-amber-400" />
      </div>

      {/* 文件夹名称 */}
      <h3
        className="truncate text-center text-sm font-medium text-white"
        title={folder.name}
      >
        {folder.name}
      </h3>

      {/* 右键菜单 */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full z-30 mt-1 w-32 rounded-lg bg-gray-900 py-1 shadow-xl">
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onOpen(folder);
              }}
            >
              打开
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onRename(folder);
              }}
            >
              重命名
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-800"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onDelete(folder.id);
              }}
            >
              删除
            </button>
          </div>
        </>
      )}
    </div>
  );
});

// 文件夹图标
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
    </svg>
  );
}

export default FolderCard;
