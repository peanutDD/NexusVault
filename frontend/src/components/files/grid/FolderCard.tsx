import { memo, useCallback, useState } from 'react';
import { FolderOpen, PencilLine, Trash2, MoreVertical } from 'lucide-react';
import type { Folder } from '../../../types';
import { cn } from '../../../utils/cn';
import { SelectionCheckbox } from '../../common/form/SelectionCheckbox';

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
  isMenuOpen: boolean;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
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
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
}: FolderCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleMenu(folder.id);
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
        'group relative cursor-pointer rounded-xl transition-colors',
        'bg-white/5 backdrop-blur-sm',
        'hover:bg-white/10 active:bg-white/15',
        isSelected && 'bg-purple-500/15 hover:bg-purple-500/20 active:bg-purple-500/25',
        isDragOver && 'bg-blue-500/20 hover:bg-blue-500/25 active:bg-blue-500/30'
      )}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDoubleClick={handleDoubleClick}
    >
      <div className="p-3">
        {/* 文件夹图标：使用和视频文件相同的主色（text-purple-400），但缩小尺寸避免过于抢眼 */}
        <div className="relative mb-3 flex aspect-square items-center justify-center rounded-lg bg-black/20">
          <SelectionCheckbox
            isSelected={isSelected}
            onClick={handleSelect}
          />
          <i className="bi bi-folder-fill text-[clamp(1.5rem,3.2vw,2.25rem)] text-purple-400" aria-hidden />
        </div>

        {/* 文件夹名称 + 设置按钮 */}
        <div className="flex w-full items-center justify-between gap-2">
          <h3
            className="min-w-0 flex-1 truncate whitespace-nowrap text-center text-[clamp(8px,2.2vw,10px)] font-medium text-white"
            title={folder.name}
          >
            {folder.name}
          </h3>

          {/* 设置按钮（与文字同一行，右对齐） */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={handleToggleMenu}
              className="inline-flex items-center justify-center rounded-md p-[clamp(2px,0.6vw,4px)] text-gray-400 hover:bg-white/10 hover:text-white"
              aria-label="更多操作"
            >
              <MoreVertical className="scale-50" />
            </button>

            {/* 玻璃拟态菜单 */}
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={onCloseMenu}
                />
                <div className="absolute bottom-full right-0 z-50 mb-1 w-max origin-bottom-right scale-[0.7] rounded-md border border-violet-950 bg-violet-950 py-1 pl-2 pr-4 shadow-xl sm:scale-90 md:scale-100">
                  <button
                    type="button"
                    className="flex w-full items-center justify-start gap-0 rounded px-0 py-0 text-left text-[clamp(8px,2.2vw,10px)] text-white transition-colors hover:bg-violet-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onOpen(folder);
                    }}
                  >
                    <FolderOpen className="scale-50 shrink-0 text-white" />
                    <span className="whitespace-nowrap">打开</span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-start gap-0 rounded px-0 py-0 text-left text-[clamp(8px,2.2vw,10px)] text-white transition-colors hover:bg-violet-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onRename(folder);
                    }}
                  >
                    <PencilLine className="scale-50 shrink-0 text-white" />
                    <span className="whitespace-nowrap">重命名</span>
                  </button>
                  <div className="my-0.5 border-t border-violet-900" />
                  <button
                    type="button"
                    className="flex w-full items-center justify-start gap-0 rounded px-0 py-0 text-left text-[clamp(8px,2.2vw,10px)] text-white transition-colors hover:bg-violet-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onDelete(folder.id);
                    }}
                  >
                    <Trash2 className="scale-50 shrink-0 text-white" />
                    <span className="whitespace-nowrap">删除</span>
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
