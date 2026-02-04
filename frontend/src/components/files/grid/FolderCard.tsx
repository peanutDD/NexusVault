import { memo, useState, useCallback, useEffect } from 'react';
import { FolderOpen, Pencil, Trash2, MoreVertical } from 'lucide-react';
import type { Folder } from '../../../types';
import { cn } from '../../../utils/cn';
import { SelectionCheckbox } from '../../common/form/SelectionCheckbox';

// 全局事件：关闭所有卡片菜单
const CLOSE_ALL_MENUS_EVENT = 'closeAllCardMenus';

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
 * 文件夹卡片组件 v4
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

  // 监听全局关闭事件
  useEffect(() => {
    const handleCloseAll = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== folder.id) {
        setShowMenu(false);
      }
    };
    window.addEventListener(CLOSE_ALL_MENUS_EVENT, handleCloseAll);
    return () => window.removeEventListener(CLOSE_ALL_MENUS_EVENT, handleCloseAll);
  }, [folder.id]);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showMenu) {
      window.dispatchEvent(new CustomEvent(CLOSE_ALL_MENUS_EVENT, { detail: folder.id }));
    }
    setShowMenu(!showMenu);
  };

  const handleDoubleClick = () => {
    onOpen(folder);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/folder-id', folder.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(e, folder);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
        'group relative cursor-pointer rounded-xl',
        'bg-white/5 backdrop-blur-sm',
        'hover:bg-white/10',
        isSelected && 'bg-purple-500/15 hover:bg-purple-500/20',
        isDragOver && 'bg-blue-500/20 hover:bg-blue-500/25'
      )}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDoubleClick={handleDoubleClick}
    >
      {/* 选中指示条 */}
      {isSelected && (
        <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-purple-500" />
      )}

      {/* 拖拽指示条 */}
      {isDragOver && !isSelected && (
        <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-blue-500" />
      )}

      <div className="p-3">
        {/* 文件夹图标 */}
        <div className="relative mb-3 flex aspect-square items-center justify-center rounded-lg bg-black/20">
          <SelectionCheckbox
            isSelected={isSelected}
            onClick={handleSelect}
          />
          <i className="bi bi-folder2 text-5xl text-white/80" aria-hidden />
        </div>

        {/* 文件夹名称 + 设置按钮 */}
        <div className="relative">
          <h3
            className="truncate text-center text-[10px] font-medium text-white pr-4"
            title={folder.name}
          >
            {folder.name}
          </h3>

          {/* 设置按钮 - 绝对定位在右侧 */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <button
              type="button"
              onClick={handleToggleMenu}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-white/10 hover:text-white"
              aria-label="更多操作"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {/* 玻璃拟态菜单 */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute bottom-full right-0 z-50 mb-1 w-14 rounded-md border border-white/30 bg-white/20 p-0.5 shadow-xl backdrop-blur-2xl">
                  <button
                    type="button"
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] text-white transition-colors hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onOpen(folder);
                    }}
                  >
                    <FolderOpen className="h-2 w-2 text-amber-300" />
                    打开
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] text-white transition-colors hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onRename(folder);
                    }}
                  >
                    <Pencil className="h-2 w-2 text-blue-300" />
                    重命名
                  </button>
                  <div className="my-0.5 border-t border-white/20" />
                  <button
                    type="button"
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] text-rose-300 transition-colors hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete(folder.id);
                    }}
                  >
                    <Trash2 className="h-2 w-2" />
                    删除
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default FolderCard;
