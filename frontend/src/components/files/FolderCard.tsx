import { memo, useState, useCallback } from 'react';
import type { Folder } from '../../types';
import { cn } from '../../utils/cn';
import { SelectionCheckbox } from '../common/form/SelectionCheckbox';

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

  const handleSelect = useCallback(() => {
    onSelect(folder.id);
  }, [folder.id, onSelect]);

  return (
    <div
      className={cn(
        'glass-card group relative cursor-pointer p-3',
        // 未选中时：hover 显示选中框
        !isSelected && !isDragOver &&
          'hover:outline hover:outline-2 hover:outline-purple-400 hover:bg-purple-500/5',
        isSelected && 'outline outline-2 outline-purple-500 bg-purple-500/10',
        isDragOver && 'outline outline-2 outline-blue-500 bg-blue-500/10'
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
      <SelectionCheckbox
        isSelected={isSelected}
        onClick={handleSelect}
      />

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
