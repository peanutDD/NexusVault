import { memo, useCallback, useState } from "react";
import { FolderOpen, PencilLine, Trash2, MoreVertical } from "lucide-react";
import type { Folder } from "../../../types/folders";
import { cn } from "../../../utils/cn";
import { SelectionCheckbox } from "../../common/form/SelectionCheckbox";

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
    e.dataTransfer.setData("application/folder-id", folder.id);
    e.dataTransfer.effectAllowed = "move";
    onDragStart?.(e, folder);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const hasFolderId = e.dataTransfer.types.includes("application/folder-id");
    const hasFileId = e.dataTransfer.types.includes("application/file-id");
    if (hasFolderId || hasFileId) {
      e.dataTransfer.dropEffect = "move";
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
        "glass-card group relative cursor-pointer rounded-md transition-colors",
        isSelected && "border-[var(--cta-primary-border)]",
        isDragOver && "border-[var(--color-border-strong)]",
      )}
      onDoubleClick={handleDoubleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(folder);
      }}
      data-oid="y3sabdy"
    >
      <div className="p-3" data-oid="tw-paus">
        {/* 文件夹图标：使用和视频文件相同的主色（text-purple-400），但缩小尺寸避免过于抢眼 */}
        <div
          className="relative mb-3 flex aspect-square items-center justify-center rounded-sm bg-[var(--file-card-thumb-bg)]"
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-oid="69zytmi"
        >
          <SelectionCheckbox
            isSelected={isSelected}
            onClick={handleSelect}
            size="responsive"
            positionClassName="absolute left-[clamp(0.15rem,0.35vw,0.25rem)] top-[clamp(0.15rem,0.35vw,0.25rem)]"
            data-oid="4exa0wc"
          />

          <i
            className="bi bi-folder-fill text-[clamp(1.5rem,3.2vw,2.25rem)] text-[var(--filelist-folder-icon)]"
            aria-hidden
            data-oid="3:fkme9"
          />
        </div>

        {/* 文件夹名称 + 设置按钮 */}
        <div className="relative flex w-full items-start" data-oid="ebqewy5">
          <p
            className="min-w-0 w-full truncate whitespace-nowrap leading-[1.3] px-[clamp(1rem,2.4vw,1.5rem)] text-center text-[clamp(0.38rem,1.3vw,0.58rem)] font-medium text-[var(--file-card-text)]"
            title={folder.name}
            data-oid="7ndc6ny"
          >
            {folder.name}
          </p>

          {/* 设置按钮（与文字同一行，右对齐） */}
          <button
            type="button"
            onClick={handleToggleMenu}
            className="absolute right-0 top-0 z-10 inline-flex translate-x-[0.375rem] items-center justify-center rounded-md leading-none text-[var(--file-card-text-muted)] hover:bg-[var(--filelist-menu-trigger-hover-bg)] hover:text-[var(--file-card-text)]"
            aria-label="更多操作"
            data-oid="v.ta39e"
          >
            <MoreVertical
              className="h-[clamp(0.72rem,1.7vw,0.95rem)] w-[clamp(0.72rem,1.7vw,0.95rem)]"
              data-oid="d8iuuo."
            />
          </button>

          {/* 玻璃拟态菜单 */}
          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={onCloseMenu}
                data-oid="0cciqz9"
              />

              <div
                className="absolute bottom-full right-0 z-50 mb-1 w-max origin-bottom-right scale-[0.7] rounded-md border border-[var(--filelist-menu-border)] bg-[var(--filelist-menu-bg)] py-1 pl-2 pr-4 shadow-xl sm:scale-90 md:scale-100"
                data-oid="9xqi6te"
              >
                  <button
                    type="button"
                    className="flex w-full items-center justify-start gap-0 rounded px-0 py-0 text-left text-[clamp(8px,2.2vw,10px)] text-[var(--filelist-menu-text)] transition-colors hover:bg-[var(--filelist-menu-item-hover-bg)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onOpen(folder);
                    }}
                    data-oid="ishdm9z"
                  >
                    <FolderOpen
                      className="scale-50 shrink-0 text-[var(--filelist-menu-icon)]"
                      data-oid="1_cslmy"
                    />

                    <span className="whitespace-nowrap" data-oid="3sxo2w.">
                      打开
                    </span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-start gap-0 rounded px-0 py-0 text-left text-[clamp(8px,2.2vw,10px)] text-[var(--filelist-menu-text)] transition-colors hover:bg-[var(--filelist-menu-item-hover-bg)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onRename(folder);
                    }}
                    data-oid="otal830"
                  >
                    <PencilLine
                      className="scale-50 shrink-0 text-[var(--filelist-menu-icon)]"
                      data-oid="is04_-l"
                    />

                    <span className="whitespace-nowrap" data-oid="6zseb6d">
                      重命名
                    </span>
                  </button>
                  <div
                    className="my-0.5 border-t border-[var(--filelist-menu-divider)]"
                    data-oid="ux:37vq"
                  />

                  <button
                    type="button"
                    className="flex w-full items-center justify-start gap-0 rounded px-0 py-0 text-left text-[clamp(8px,2.2vw,10px)] text-[var(--filelist-menu-text)] transition-colors hover:bg-[var(--filelist-menu-item-hover-bg)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onDelete(folder.id);
                    }}
                    data-oid="j2_pyh."
                  >
                    <Trash2
                      className="scale-50 shrink-0 text-[var(--filelist-menu-icon)]"
                      data-oid="b5w8:n8"
                    />

                    <span className="whitespace-nowrap" data-oid="_ugimy-">
                      删除
                    </span>
                  </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default FolderCard;
