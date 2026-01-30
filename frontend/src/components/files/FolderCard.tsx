import { memo, useState } from 'react';
import type { Folder } from '../../types';
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
        'glass-card group relative cursor-pointer p-3',
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
      {/* 选择框 - 纯色紫圈 + 外圈水晶，选中闪动（固定尺寸避免切换时位移） */}
      <div
        className="absolute left-2 top-2 z-10 flex h-5 w-5 cursor-pointer items-center justify-center transition-all"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(folder.id);
        }}
      >
        {isSelected ? (
          <div className="card-checkbox-outer-crystal card-checkbox-selected flex h-5 w-5 items-center justify-center rounded-full">
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-500">
              <svg className="h-3 w-3 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100">
            <div className="h-3 w-3 rounded-full border-2 border-white/60" />
          </div>
        )}
      </div>

      {/* 文件夹图标 */}
      <div className="glass-thumb mb-3 flex aspect-square items-center justify-center">
        <i className="bi bi-folder2 text-5xl text-white/90" aria-hidden />
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
          <div className="glass-panel-soft absolute right-0 top-full z-30 mt-2 w-36 py-1">
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
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
              className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
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
              className="w-full px-3 py-2 text-left text-sm text-rose-300 hover:bg-white/10"
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

export default FolderCard;
