import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, PencilLine, Trash2, MoreVertical } from "lucide-react";
import type { Folder } from "../../../types/folders";
import { cn } from "../../../utils/cn";
import { findFolderDropTargetFromPoint } from "../../../utils/dropTargets";
import {
  stopDragAutoScroll,
  updateDragAutoScroll,
} from "../../../utils/dragAutoScroll";
import { SelectionCheckbox } from "../../common/form/SelectionCheckbox";
import { useNativeDragEnabled } from "../../../hooks/useNativeDragEnabled";

interface FolderCardProps {
  folder: Folder;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onOpen: (folderId: string) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  onDragStart?: (e: React.DragEvent, folder: Folder) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (
    targetFolderId: string,
    fileIds: string[],
    folderIds: string[],
  ) => void;
  onMobileFolderDragStart?: (folderId: string) => void;
  onMobileFolderDragEnd?: () => void;
  onMobileFolderDrop?: (targetFolderId: string, sourceFolderId: string) => void;
  isMenuOpen: boolean;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
}

const MOBILE_FOLDER_DRAG_LONG_PRESS_MS = 450;
const MOBILE_FOLDER_DRAG_CANCEL_DISTANCE_PX = 10;
const MOBILE_FOLDER_DOUBLE_TAP_MS = 320;
const MOBILE_FOLDER_DOUBLE_TAP_DISTANCE_PX = 24;

function isInteractivePointerTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, input, select, textarea, a, [role="checkbox"], [data-folder-menu]',
    ),
  );
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
  onMobileFolderDragStart,
  onMobileFolderDragEnd,
  onMobileFolderDrop,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
}: FolderCardProps) {
  const nativeDragEnabled = useNativeDragEnabled();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMobileDragging, setIsMobileDragging] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileDragActiveRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(
    null,
  );
  const lastMobileOpenTimeRef = useRef<number | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleMenu(folder.id);
  };

  const handleDoubleClick = () => {
    const lastMobileOpenTime = lastMobileOpenTimeRef.current;
    if (
      lastMobileOpenTime !== null &&
      Date.now() - lastMobileOpenTime <= MOBILE_FOLDER_DOUBLE_TAP_MS
    ) {
      return;
    }
    onOpen(folder.id);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!nativeDragEnabled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/folder-id", folder.id);
    e.dataTransfer.effectAllowed = "move";
    onDragStart?.(e, folder);
  };

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!nativeDragEnabled && pointerStartRef.current) {
        e.preventDefault();
      }
    },
    [nativeDragEnabled],
  );

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
    const fileId = e.dataTransfer.getData("application/file-id");
    const folderId = e.dataTransfer.getData("application/folder-id");
    onDrop?.(folder.id, fileId ? [fileId] : [], folderId ? [folderId] : []);
  };

  const finishMobileFolderDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const wasDragging = mobileDragActiveRef.current;
      const pointerStart = pointerStartRef.current;
      clearLongPressTimer();
      pointerStartRef.current = null;

      if (!wasDragging) {
        if (e.pointerType !== "mouse" && pointerStart) {
          const travelDistance = Math.hypot(
            e.clientX - pointerStart.x,
            e.clientY - pointerStart.y,
          );
          if (travelDistance <= MOBILE_FOLDER_DRAG_CANCEL_DISTANCE_PX) {
            const now = Date.now();
            const lastTap = lastTapRef.current;
            const doubleTapDistance = lastTap
              ? Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y)
              : Number.POSITIVE_INFINITY;
            if (
              lastTap &&
              now - lastTap.time <= MOBILE_FOLDER_DOUBLE_TAP_MS &&
              doubleTapDistance <= MOBILE_FOLDER_DOUBLE_TAP_DISTANCE_PX
            ) {
              lastTapRef.current = null;
              e.preventDefault();
              e.stopPropagation();
              lastMobileOpenTimeRef.current = now;
              onOpen(folder.id);
              return;
            }
            lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
          }
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      mobileDragActiveRef.current = false;
      setIsMobileDragging(false);
      stopDragAutoScroll();

      const target = findFolderDropTargetFromPoint(
        e.clientX,
        e.clientY,
        folder.id,
      );
      const targetFolderId = target?.dataset.folderId;
      if (targetFolderId !== undefined) {
        onMobileFolderDrop?.(targetFolderId, folder.id);
      }
      onMobileFolderDragEnd?.();
    },
    [
      clearLongPressTimer,
      folder.id,
      onMobileFolderDragEnd,
      onMobileFolderDrop,
      onOpen,
    ],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" || !e.isPrimary) return;
      if (isInteractivePointerTarget(e.target)) return;

      clearLongPressTimer();
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      longPressTimerRef.current = setTimeout(() => {
        mobileDragActiveRef.current = true;
        setIsMobileDragging(true);
        onMobileFolderDragStart?.(folder.id);
      }, MOBILE_FOLDER_DRAG_LONG_PRESS_MS);

      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [clearLongPressTimer, folder.id, onMobileFolderDragStart],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse") return;
      const start = pointerStartRef.current;
      if (!start) return;

      const distance = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (
        !mobileDragActiveRef.current &&
        distance > MOBILE_FOLDER_DRAG_CANCEL_DISTANCE_PX
      ) {
        clearLongPressTimer();
        lastTapRef.current = null;
        pointerStartRef.current = null;
        return;
      }

      if (mobileDragActiveRef.current) {
        e.preventDefault();
        updateDragAutoScroll(e.clientY);
      }
    },
    [clearLongPressTimer],
  );

  const handlePointerCancel = useCallback(() => {
    clearLongPressTimer();
    lastTapRef.current = null;
    pointerStartRef.current = null;
    if (mobileDragActiveRef.current) {
      mobileDragActiveRef.current = false;
      setIsMobileDragging(false);
      stopDragAutoScroll();
      onMobileFolderDragEnd?.();
    }
  }, [clearLongPressTimer, onMobileFolderDragEnd]);

  const handleSelect = useCallback(() => {
    onSelect(folder.id, !isSelected);
  }, [folder.id, isSelected, onSelect]);

  return (
    <div
      className={cn(
        "neu-raised fileCardSurface group relative cursor-pointer rounded-[clamp(0.3rem,0.8vw,0.375rem)] transition-[box-shadow,color]",
        isSelected && "border-[var(--cta-primary-border)]",
        isDragOver && "border-[var(--color-border-strong)]",
        isMenuOpen && "fileCardMenuOpen",
        isMobileDragging &&
          "border-[var(--color-border-strong)] opacity-80 pointer-events-none",
      )}
      data-folder-id={folder.id}
      data-mobile-folder-dragging={isMobileDragging ? "true" : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishMobileFolderDrag}
      onPointerCancel={handlePointerCancel}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(folder.id);
      }}
      data-oid="y3sabdy"
    >
      <div className="p-[clamp(0.6rem,1.4vw,0.75rem)]" data-oid="tw-paus">
        {/* 文件夹图标：使用和视频文件相同的主色（text-purple-400），但缩小尺寸避免过于抢眼 */}
        <div
          className="neu-inset relative mb-[clamp(0.6rem,1.4vw,0.75rem)] flex aspect-square items-center justify-center rounded-[clamp(0.2rem,0.6vw,0.25rem)]"
          draggable={nativeDragEnabled}
          onDragStart={handleDragStart}
          data-oid="69zytmi"
        >
          <SelectionCheckbox
            isSelected={isSelected}
            onClick={handleSelect}
            size="responsive"
            positionClassName="absolute left-[clamp(0.06rem,0.16vw,0.1rem)] top-[clamp(0.06rem,0.16vw,0.1rem)]"
            data-oid="4exa0wc"
          />

          <i
            className="bi bi-folder-fill text-[clamp(1.5rem,3.2vw,2.25rem)] text-[var(--filelist-folder-icon)]"
            aria-hidden
            data-oid="3:fkme9"
          />
        </div>

        {/* 文件夹名称 + 设置按钮 */}
        <div className="relative flex w-full items-center" data-oid="ebqewy5">
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
            className="absolute right-0 top-1/2 z-10 inline-flex translate-x-[0.375rem] -translate-y-1/2 items-center justify-center rounded-[clamp(0.3rem,0.8vw,0.375rem)] border-0 leading-none text-[var(--file-card-text-muted)] transition-[box-shadow,color] hover:text-[var(--file-card-text)] active:shadow-[var(--neu-pressed-shadow)]"
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
                data-folder-menu="true"
                data-oid="0cciqz9"
              />

              <div
                className="neu-raised fileCardActionMenu fileCardActionMenuFolder absolute bottom-full right-0 z-50 mb-[clamp(0.24rem,0.7vw,0.34rem)] origin-bottom-right"
                data-folder-menu="true"
                data-oid="9xqi6te"
              >
                <button
                  type="button"
                  className="fileCardActionMenuItem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onOpen(folder.id);
                  }}
                  data-oid="ishdm9z"
                >
                  <FolderOpen
                    className="fileCardActionMenuIcon shrink-0"
                    data-oid="1_cslmy"
                  />

                  <span className="whitespace-nowrap" data-oid="3sxo2w.">
                    打开
                  </span>
                </button>
                <button
                  type="button"
                  className="fileCardActionMenuItem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onRename(folder);
                  }}
                  data-oid="otal830"
                >
                  <PencilLine
                    className="fileCardActionMenuIcon shrink-0"
                    data-oid="is04_-l"
                  />

                  <span className="whitespace-nowrap" data-oid="6zseb6d">
                    重命名
                  </span>
                </button>
                <div
                  className="fileCardActionMenuDivider border-t"
                  data-oid="ux:37vq"
                />

                <button
                  type="button"
                  className="fileCardActionMenuItem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onDelete(folder);
                  }}
                  data-oid="j2_pyh."
                >
                  <Trash2
                    className="fileCardActionMenuIcon shrink-0"
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
