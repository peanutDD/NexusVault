import { memo } from 'react';
import { Download, Send, Trash2, Eye, MoreVertical } from 'lucide-react';
import { formatFileSize } from '../../../utils/format';
import type { FileMetadata } from '../../../types/files';
import LazyThumbnail from '../preview/LazyThumbnail';
import { cn } from '../../../utils/cn';
import { getMimeTypeLabel } from '../../../utils/mimeType';
import { schedulePreload } from '../../../utils/preloadPreview';
import { SelectionCheckbox } from '../../common/form/SelectionCheckbox';

interface FileCardProps {
  file: FileMetadata;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPreview: (file: FileMetadata) => void;
  onShare: (file: FileMetadata) => void;
  onDownload: (file: FileMetadata) => void;
  onDelete: (id: string) => void;
  onDragStart?: (e: React.DragEvent, file: FileMetadata) => void;
  isMenuOpen: boolean;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
  thumbnailPriority?: 'high' | 'low';
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
    isMenuOpen,
    onToggleMenu,
    onCloseMenu,
    thumbnailPriority,
  }: FileCardProps) {
    const handleToggleMenu = (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleMenu(file.id);
    };

    const formattedDate = new Date(file.created_at).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const mimeTypeLabel = getMimeTypeLabel(file.mime_type, file.original_filename);

    const handleMouseEnter = () => {
      schedulePreload(file.id);
    };

    return (
      <article
        className={cn(
          'group relative rounded-xl transition-colors',
          'bg-white/5 backdrop-blur-sm',
          'hover:bg-white/10 active:bg-white/15',
          isSelected && 'bg-purple-500/15 hover:bg-purple-500/20 active:bg-purple-500/25'
        )}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/file-id', file.id);
          e.dataTransfer.effectAllowed = 'move';
          onDragStart?.(e, file);
        }}
        onMouseEnter={handleMouseEnter}
      >
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
              priority={thumbnailPriority}
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
          <div className="flex w-full items-center justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate whitespace-nowrap text-[clamp(8px,2.2vw,10px)] font-medium text-white" title={file.original_filename}>
                {file.original_filename}
              </p>
              <p className="flex items-center gap-1 whitespace-nowrap text-[clamp(7px,1.8vw,8px)] text-gray-400">
                <span>{formatFileSize(file.file_size)}</span>
                <span className="h-0.5 w-0.5 rounded-full bg-gray-600" aria-hidden />
                <span>{mimeTypeLabel}</span>
              </p>
              <p className="whitespace-nowrap text-[clamp(7px,1.8vw,8px)] text-gray-500">{formattedDate}</p>
            </div>

            {/* 设置按钮（与文字平行） */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={handleToggleMenu}
                className="inline-flex items-center justify-center rounded-md p-[clamp(2px,0.6vw,4px)] text-gray-400 hover:bg-white/10 hover:text-white"
                aria-label="更多操作"
              >
                <MoreVertical className="scale-50" />
              </button>

              {/* 玻璃拟态下拉菜单 */}
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
                        onDownload(file);
                      }}
                    >
                      <Download className="scale-50 shrink-0 text-white" />
                      <span className="whitespace-nowrap">下载</span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center justify-start gap-0 rounded px-0 py-0 text-left text-[clamp(8px,2.2vw,10px)] text-white transition-colors hover:bg-violet-900"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseMenu();
                        onShare(file);
                      }}
                    >
                      <Send className="scale-50 shrink-0 text-white" />
                      <span className="whitespace-nowrap">分享</span>
                    </button>
                    <div className="my-0.5 border-t border-violet-900" />
                    <button
                      type="button"
                      className="flex w-full items-center justify-start gap-0 rounded px-0 py-0 text-left text-[clamp(8px,2.2vw,10px)] text-white transition-colors hover:bg-violet-900"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseMenu();
                        onDelete(file.id);
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
      </article>
    );
  },
  (prev, next) =>
    prev.file.id === next.file.id &&
    prev.file.original_filename === next.file.original_filename &&
    prev.file.file_size === next.file.file_size &&
    prev.isSelected === next.isSelected &&
    prev.isMenuOpen === next.isMenuOpen
);

export default FileCard;
