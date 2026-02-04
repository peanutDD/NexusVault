import { memo, useState, useEffect } from 'react';
import { Download, Send, Trash2, Eye, MoreVertical } from 'lucide-react';
import { formatFileSize } from '../../../utils/format';
import type { FileMetadata } from '../../../types';
import LazyThumbnail from '../preview/LazyThumbnail';
import { cn } from '../../../utils/cn';
import { getMimeTypeLabel } from '../../../utils/mimeType';
import { schedulePreload } from '../../../utils/preloadPreview';
import { SelectionCheckbox } from '../../common/form/SelectionCheckbox';

// 全局事件：关闭所有卡片菜单
const CLOSE_ALL_MENUS_EVENT = 'closeAllCardMenus';

interface FileCardProps {
  file: FileMetadata;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPreview: (file: FileMetadata) => void;
  onShare: (file: FileMetadata) => void;
  onDownload: (file: FileMetadata) => void;
  onDelete: (id: string) => void;
  onDragStart?: (e: React.DragEvent, file: FileMetadata) => void;
}

/**
 * 文件卡片组件 v4
 */
const FileCard = memo(
  function FileCard({
    file,
    isSelected,
    onSelect,
    onPreview,
    onShare,
    onDownload,
    onDelete,
    onDragStart,
  }: FileCardProps) {
    const [showMenu, setShowMenu] = useState(false);

    // 监听全局关闭事件
    useEffect(() => {
      const handleCloseAll = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        // 如果不是自己触发的，就关闭菜单
        if (detail !== file.id) {
          setShowMenu(false);
        }
      };
      window.addEventListener(CLOSE_ALL_MENUS_EVENT, handleCloseAll);
      return () => window.removeEventListener(CLOSE_ALL_MENUS_EVENT, handleCloseAll);
    }, [file.id]);

    const handleToggleMenu = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!showMenu) {
        // 打开前先关闭其他菜单
        window.dispatchEvent(new CustomEvent(CLOSE_ALL_MENUS_EVENT, { detail: file.id }));
      }
      setShowMenu(!showMenu);
    };

    const formattedDate = new Date(file.created_at).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const mimeTypeLabel = getMimeTypeLabel(file.mime_type);

    return (
      <article
        className={cn(
          'group relative rounded-xl',
          'bg-white/5 backdrop-blur-sm',
          'hover:bg-white/10',
          isSelected && 'bg-purple-500/15 hover:bg-purple-500/20'
        )}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/file-id', file.id);
          e.dataTransfer.effectAllowed = 'move';
          onDragStart?.(e, file);
        }}
        onMouseEnter={() => schedulePreload(file.id)}
      >
        {/* 选中指示条 */}
        {isSelected && (
          <div className="absolute left-0 top-0 h-full w-1 bg-purple-500" />
        )}

        <div className="p-3">
          {/* 缩略图区域 */}
          <div
            className="relative mb-3 aspect-square cursor-pointer overflow-hidden rounded-lg bg-black/20"
            onClick={() => onPreview(file)}
          >
            <SelectionCheckbox
              isSelected={isSelected}
              onClick={() => onSelect(file.id)}
            />

            <LazyThumbnail
              fileId={file.id}
              mimeType={file.mime_type}
              filename={file.original_filename}
              className="h-full w-full"
            />

            {/* 悬浮预览按钮 */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(file);
                }}
                aria-label="预览"
                className="rounded-full bg-white/20 p-3 backdrop-blur-sm hover:bg-white/30"
              >
                <Eye className="h-6 w-6 text-white" />
              </button>
            </div>
          </div>

          {/* 文件信息 + 设置按钮 */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-0.5">
              <h3 className="truncate text-[10px] font-medium text-white" title={file.original_filename}>
                {file.original_filename}
              </h3>
              <p className="flex items-center gap-1 text-[8px] text-gray-400">
                <span>{formatFileSize(file.file_size)}</span>
                <span className="h-0.5 w-0.5 rounded-full bg-gray-600" aria-hidden />
                <span>{mimeTypeLabel}</span>
              </p>
              <p className="text-[8px] text-gray-500">{formattedDate}</p>
            </div>

            {/* 设置按钮 */}
            <div className="relative">
              <button
                type="button"
                onClick={handleToggleMenu}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-white/10 hover:text-white"
                aria-label="更多操作"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {/* 玻璃拟态下拉菜单 */}
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
                        onDownload(file);
                      }}
                    >
                      <Download className="h-2 w-2 text-purple-300" />
                      下载
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] text-white transition-colors hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onShare(file);
                      }}
                    >
                      <Send className="h-2 w-2 text-blue-300" />
                      分享
                    </button>
                    <div className="my-0.5 border-t border-white/20" />
                    <button
                      type="button"
                      className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] text-rose-300 transition-colors hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onDelete(file.id);
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
      </article>
    );
  },
  (prev, next) =>
    prev.file.id === next.file.id &&
    prev.file.original_filename === next.file.original_filename &&
    prev.file.file_size === next.file.file_size &&
    prev.isSelected === next.isSelected
);

export default FileCard;
