import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Send,
  Trash2,
  Eye,
  MoreVertical,
  PencilLine,
  History,
  ListChecks,
  Pin,
  Star,
  Tags,
} from "lucide-react";
import { formatFileSizeCompact } from "../../../utils/format";
import type { FileMetadata } from "../../../types/files";
import LazyThumbnail from "../preview/LazyThumbnail";
import { cn } from "../../../utils/cn";
import { getMimeTypeLabel } from "../../../utils/mimeType";
import { schedulePreload } from "../../../utils/preloadPreview";
import { findFolderDropTargetFromPoint } from "../../../utils/dropTargets";
import {
  stopDragAutoScroll,
  updateDragAutoScroll,
} from "../../../utils/dragAutoScroll";
import { SelectionCheckbox } from "../../common/form/SelectionCheckbox";
import { useNativeDragEnabled } from "../../../hooks/useNativeDragEnabled";

interface FileCardProps {
  file: FileMetadata;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onPreview: (file: FileMetadata) => void;
  onShare: (file: FileMetadata) => void;
  onDownload: (file: FileMetadata) => void;
  onRename: (file: FileMetadata) => void;
  onDelete: (file: FileMetadata) => void;
  onShowActivity?: (file: FileMetadata) => void;
  onShowVersions?: (file: FileMetadata) => void;
  onManageTags?: (file: FileMetadata) => void;
  onToggleFavorite?: (file: FileMetadata) => void;
  onTogglePinned?: (file: FileMetadata) => void;
  onDragStart?: (fileId: string, e: React.DragEvent) => void;
  onMobileFileDragStart?: (fileId: string) => void;
  onMobileFileDragEnd?: () => void;
  onMobileFileDrop?: (targetFolderId: string, sourceFileId: string) => void;
  isMenuOpen: boolean;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
  thumbnailPriority?: "high" | "low";
}

const MOBILE_FILE_DRAG_LONG_PRESS_MS = 450;
const MOBILE_FILE_DRAG_CANCEL_DISTANCE_PX = 10;

function isInteractivePointerTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const interactiveTarget = target.closest(
    'button, input, select, textarea, a, [role="checkbox"], [data-file-menu]',
  );
  return Boolean(
    interactiveTarget &&
    !interactiveTarget.closest("[data-file-preview-action]"),
  );
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
    onRename,
    onDelete,
    onShowActivity,
    onShowVersions,
    onManageTags,
    onToggleFavorite,
    onTogglePinned,
    onDragStart,
    onMobileFileDragStart,
    onMobileFileDragEnd,
    onMobileFileDrop,
    isMenuOpen,
    onToggleMenu,
    onCloseMenu,
    thumbnailPriority,
  }: FileCardProps) {
    const nativeDragEnabled = useNativeDragEnabled();
    const [isMobileDragging, setIsMobileDragging] = useState(false);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );
    const mobileDragActiveRef = useRef(false);
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
    const suppressNextPreviewRef = useRef(false);
    const cleanupGlobalPointerListenersRef = useRef<(() => void) | null>(null);

    const clearLongPressTimer = useCallback(() => {
      if (longPressTimerRef.current !== null) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }, []);

    const cleanupGlobalPointerListeners = useCallback(() => {
      cleanupGlobalPointerListenersRef.current?.();
      cleanupGlobalPointerListenersRef.current = null;
    }, []);

    useEffect(
      () => () => {
        clearLongPressTimer();
        cleanupGlobalPointerListeners();
      },
      [clearLongPressTimer, cleanupGlobalPointerListeners],
    );

    const handleToggleMenu = (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleMenu(file.id);
    };

    const formattedDate = new Date(file.created_at).toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const mimeTypeLabel = getMimeTypeLabel(
      file.mime_type,
      file.original_filename,
    );
    const matchSourceLabel =
      file.match_source === "ocr"
        ? "OCR"
        : file.match_source === "filename"
          ? "Name"
          : file.match_source === "category"
            ? "Tag"
            : "Text";

    const handleMouseEnter = () => {
      schedulePreload(file.id);
    };

    const handleContextMenu = useCallback(
      (e: React.MouseEvent<HTMLElement>) => {
        if (!nativeDragEnabled && pointerStartRef.current) {
          e.preventDefault();
        }
      },
      [nativeDragEnabled],
    );

    const finishMobileFileDragAtPoint = useCallback(
      (
        clientX: number,
        clientY: number,
        event?: { preventDefault: () => void; stopPropagation: () => void },
      ) => {
        const wasDragging = mobileDragActiveRef.current;
        cleanupGlobalPointerListeners();
        clearLongPressTimer();
        pointerStartRef.current = null;

        if (!wasDragging) return;

        event?.preventDefault();
        event?.stopPropagation();
        mobileDragActiveRef.current = false;
        suppressNextPreviewRef.current = true;
        setIsMobileDragging(false);
        stopDragAutoScroll();

        const target = findFolderDropTargetFromPoint(clientX, clientY);
        const targetFolderId = target?.dataset.folderId;
        if (targetFolderId !== undefined) {
          onMobileFileDrop?.(targetFolderId, file.id);
        }
        onMobileFileDragEnd?.();
      },
      [
        clearLongPressTimer,
        cleanupGlobalPointerListeners,
        file.id,
        onMobileFileDragEnd,
        onMobileFileDrop,
      ],
    );

    const finishMobileFileDrag = useCallback(
      (e: React.PointerEvent<HTMLElement>) => {
        finishMobileFileDragAtPoint(e.clientX, e.clientY, e);
      },
      [finishMobileFileDragAtPoint],
    );

    const cancelMobileFileDrag = useCallback(() => {
      cleanupGlobalPointerListeners();
      clearLongPressTimer();
      pointerStartRef.current = null;
      if (mobileDragActiveRef.current) {
        mobileDragActiveRef.current = false;
        setIsMobileDragging(false);
        stopDragAutoScroll();
        onMobileFileDragEnd?.();
      }
    }, [
      clearLongPressTimer,
      cleanupGlobalPointerListeners,
      onMobileFileDragEnd,
    ]);

    const registerGlobalPointerListeners = useCallback(
      (pointerId: number) => {
        cleanupGlobalPointerListeners();
        const handlePointerUp = (event: PointerEvent) => {
          if (event.pointerId !== pointerId) return;
          finishMobileFileDragAtPoint(event.clientX, event.clientY, event);
        };
        const handlePointerCancel = (event: PointerEvent) => {
          if (event.pointerId !== pointerId) return;
          cancelMobileFileDrag();
        };

        window.addEventListener("pointerup", handlePointerUp, true);
        window.addEventListener("pointercancel", handlePointerCancel, true);
        cleanupGlobalPointerListenersRef.current = () => {
          window.removeEventListener("pointerup", handlePointerUp, true);
          window.removeEventListener(
            "pointercancel",
            handlePointerCancel,
            true,
          );
        };
      },
      [
        cancelMobileFileDrag,
        cleanupGlobalPointerListeners,
        finishMobileFileDragAtPoint,
      ],
    );

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType === "mouse" || !e.isPrimary) return;
        if (isInteractivePointerTarget(e.target)) return;

        suppressNextPreviewRef.current = false;
        registerGlobalPointerListeners(e.pointerId);
        clearLongPressTimer();
        pointerStartRef.current = { x: e.clientX, y: e.clientY };
        longPressTimerRef.current = setTimeout(() => {
          mobileDragActiveRef.current = true;
          setIsMobileDragging(true);
          onMobileFileDragStart?.(file.id);
        }, MOBILE_FILE_DRAG_LONG_PRESS_MS);

        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
      [
        clearLongPressTimer,
        file.id,
        onMobileFileDragStart,
        registerGlobalPointerListeners,
      ],
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType === "mouse") return;
        const start = pointerStartRef.current;
        if (!start) return;

        const distance = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (
          !mobileDragActiveRef.current &&
          distance > MOBILE_FILE_DRAG_CANCEL_DISTANCE_PX
        ) {
          cancelMobileFileDrag();
          return;
        }

        if (mobileDragActiveRef.current) {
          e.preventDefault();
          updateDragAutoScroll(e.clientY);
        }
      },
      [cancelMobileFileDrag],
    );

    const handlePointerCancel = useCallback(() => {
      cancelMobileFileDrag();
    }, [cancelMobileFileDrag]);

    return (
      <article
        className={cn(
          "neu-raised fileCardSurface group relative rounded-[clamp(0.3rem,0.8vw,0.375rem)] transition-[box-shadow,color]",
          isSelected && "border-[var(--cta-primary-border)]",
          isMenuOpen && "fileCardMenuOpen",
          isMobileDragging &&
            "border-[var(--color-border-strong)] opacity-80 pointer-events-none",
        )}
        data-file-id={file.id}
        data-mobile-file-dragging={isMobileDragging ? "true" : undefined}
        draggable={nativeDragEnabled}
        onDragStart={(e) => {
          if (!nativeDragEnabled) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData("application/file-id", file.id);
          e.dataTransfer.effectAllowed = "move";
          onDragStart?.(file.id, e);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishMobileFileDrag}
        onPointerCancel={handlePointerCancel}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        data-oid="vkt8wq9"
      >
        <div className="p-[clamp(0.6rem,1.4vw,0.75rem)]" data-oid="-e0ub1-">
          {/* 缩略图区域 */}
          <div
            className="neu-inset relative mb-[clamp(0.6rem,1.4vw,0.75rem)] aspect-square cursor-pointer overflow-hidden rounded-[clamp(0.2rem,0.6vw,0.25rem)]"
            onClick={(e) => {
              if (suppressNextPreviewRef.current) {
                suppressNextPreviewRef.current = false;
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              onPreview(file);
            }}
            data-oid="ota.b1o"
          >
            {(file.is_favorite || file.is_pinned) && (
              <div className="absolute right-[clamp(0.1rem,0.3vw,0.15rem)] top-[clamp(0.1rem,0.3vw,0.15rem)] z-10 flex gap-[clamp(0.1rem,0.3vw,0.15rem)]">
                {file.is_pinned && (
                  <span className="neu-raised-sm fileCardFlagBadge rounded-full p-[clamp(0.16rem,0.4vw,0.2rem)] text-[var(--neu-primary)]">
                    <Pin className="fileCardFlagBadgeGlyph h-[clamp(0.55rem,1.6vw,0.7rem)] w-[clamp(0.55rem,1.6vw,0.7rem)] text-[var(--neu-primary)]" />
                  </span>
                )}
                {file.is_favorite && (
                  <span className="neu-raised-sm fileCardFlagBadge rounded-full p-[clamp(0.16rem,0.4vw,0.2rem)] text-[var(--neu-primary)]">
                    <Star className="fileCardFlagBadgeGlyph h-[clamp(0.55rem,1.6vw,0.7rem)] w-[clamp(0.55rem,1.6vw,0.7rem)] text-[var(--neu-primary)]" />
                  </span>
                )}
              </div>
            )}
            <SelectionCheckbox
              isSelected={isSelected}
              onClick={() => onSelect(file.id, !isSelected)}
              size="responsive"
              positionClassName="absolute left-[clamp(0.06rem,0.16vw,0.1rem)] top-[clamp(0.06rem,0.16vw,0.1rem)]"
              data-oid="jgxtjef"
            />

            <LazyThumbnail
              fileId={file.id}
              mimeType={file.mime_type}
              filename={file.original_filename}
              className="h-full w-full"
              priority={thumbnailPriority}
              data-oid="yvuiqd0"
            />

            {/* 悬浮预览按钮 */}
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
              data-oid="i4m.6k2"
            >
              <button
                type="button"
                data-file-preview-action="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(file);
                }}
                aria-label="预览"
                className="neu-raised-sm rounded-full p-[clamp(0.6rem,1.4vw,0.75rem)] scale-75 active:shadow-[var(--neu-pressed-shadow)]"
                data-oid="qrd7kd_"
              >
                <Eye
                  className="h-[clamp(1.25rem,3vw,1.5rem)] w-[clamp(1.25rem,3vw,1.5rem)] text-[var(--file-card-preview-btn-text)] scale-75"
                  data-oid="f75efee"
                />
              </button>
            </div>
          </div>

          {/* 文件信息 + 设置按钮 */}
          <div className="relative flex w-full items-start" data-oid="y5j_0ma">
            <div
              className="min-w-0 w-full space-y-[clamp(0.0975rem,0.3vw,0.125rem)]"
              data-oid="4w9i3kj"
            >
              <p
                className="min-w-0 w-full truncate whitespace-nowrap leading-[1.3] pr-[clamp(1rem,2.4vw,1.5rem)] text-left text-[clamp(0.38rem,1.3vw,0.58rem)] font-medium text-[var(--file-card-text)]"
                title={file.original_filename}
                data-oid="b7fv8ct"
              >
                {file.original_filename}
              </p>
              <p
                className="flex min-w-0 items-center gap-[clamp(0.2rem,0.7vw,0.25rem)] whitespace-nowrap overflow-hidden text-[clamp(0.38rem,1.25vw,0.55rem)] text-[var(--file-card-text-muted)]"
                data-oid="azlsnn4"
              >
                <span className="shrink-0" data-oid="to09d67">
                  {formatFileSizeCompact(file.file_size)}
                </span>
                <span
                  className="h-[clamp(0.1rem,0.3vw,0.125rem)] w-[clamp(0.1rem,0.3vw,0.125rem)] rounded-full bg-slate-500/55"
                  aria-hidden="true"
                  data-oid="ozf:i9g"
                ></span>
                <span className="min-w-0 flex-1 truncate" data-oid="9gt02dl">
                  {mimeTypeLabel}
                </span>
              </p>
              <p
                className="min-w-0 truncate whitespace-nowrap text-[clamp(0.38rem,1.25vw,0.55rem)] text-[var(--file-card-text-muted)]"
                data-oid="gpoln58"
              >
                {formattedDate}
              </p>
              {file.search_snippet && (
                <p
                  className="flex min-w-0 items-center gap-[clamp(0.2rem,0.7vw,0.25rem)] truncate whitespace-nowrap text-[clamp(0.38rem,1.25vw,0.55rem)] text-[var(--file-card-text-muted)]"
                  title={file.search_snippet}
                  data-oid="fulltext-snippet"
                >
                  <span className="neu-raised-sm shrink-0 rounded-full border-0 px-[clamp(0.2rem,0.7vw,0.25rem)] py-[clamp(0.05rem,0.2vw,0.08rem)] font-medium leading-none text-[var(--file-card-text)]">
                    {matchSourceLabel}
                  </span>
                  <span className="min-w-0 truncate">
                    {file.search_snippet}
                  </span>
                </p>
              )}
            </div>

            {/* 设置按钮（与文字平行） */}
            <button
              type="button"
              onClick={handleToggleMenu}
              className="absolute right-0 top-0 z-10 inline-flex translate-x-[0.4375rem] items-center justify-center rounded-[clamp(0.3rem,0.8vw,0.375rem)] border-0 leading-none text-[var(--file-card-text-muted)] transition-[box-shadow,color] hover:text-[var(--file-card-text)] active:shadow-[var(--neu-pressed-shadow)]"
              aria-label="更多操作"
              data-oid="npjy::1"
            >
              <MoreVertical
                className="h-[clamp(0.68rem,2.2vw,1rem)] w-[clamp(0.68rem,2.2vw,1rem)]"
                data-oid=".q81ma:"
              />
            </button>

            {/* 玻璃拟态下拉菜单 */}
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={onCloseMenu}
                  data-file-menu="true"
                  data-oid="gtgz8t7"
                />

                <div
                  className="neu-raised fileCardActionMenu fileCardActionMenuFile absolute bottom-full right-0 z-50 mb-[clamp(0.24rem,0.7vw,0.34rem)] origin-bottom-right"
                  data-file-menu="true"
                  data-oid="qo212qm"
                >
                  <button
                    type="button"
                    className="fileCardActionMenuItem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onDownload(file);
                    }}
                    data-oid="3ttph4t"
                  >
                    <Download
                      className="fileCardActionMenuIcon shrink-0"
                      data-oid="._hoyss"
                    />

                    <span className="whitespace-nowrap" data-oid="t-t4yk7">
                      下载
                    </span>
                  </button>
                  <button
                    type="button"
                    className="fileCardActionMenuItem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onShare(file);
                    }}
                    data-oid="2tdrqm8"
                  >
                    <Send
                      className="fileCardActionMenuIcon shrink-0"
                      data-oid="9ff2t63"
                    />

                    <span className="whitespace-nowrap" data-oid="d4gqrrb">
                      分享
                    </span>
                  </button>
                  <button
                    type="button"
                    className="fileCardActionMenuItem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onRename(file);
                    }}
                    data-oid="s945:ua"
                  >
                    <PencilLine
                      className="fileCardActionMenuIcon shrink-0"
                      data-oid="rpc2y2d"
                    />

                    <span className="whitespace-nowrap" data-oid="j-zm97p">
                      重命名
                    </span>
                  </button>
                  <button
                    type="button"
                    className="fileCardActionMenuItem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onShowVersions?.(file);
                    }}
                  >
                    <History className="fileCardActionMenuIcon shrink-0" />
                    <span className="whitespace-nowrap">版本历史</span>
                  </button>
                  <button
                    type="button"
                    className="fileCardActionMenuItem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onShowActivity?.(file);
                    }}
                  >
                    <ListChecks className="fileCardActionMenuIcon shrink-0" />
                    <span className="whitespace-nowrap">活动记录</span>
                  </button>
                  <button
                    type="button"
                    className="fileCardActionMenuItem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onManageTags?.(file);
                    }}
                  >
                    <Tags className="fileCardActionMenuIcon shrink-0" />
                    <span className="whitespace-nowrap">标签</span>
                  </button>
                  <button
                    type="button"
                    className="fileCardActionMenuItem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onToggleFavorite?.(file);
                    }}
                  >
                    <Star className="fileCardActionMenuIcon shrink-0" />
                    <span className="whitespace-nowrap">
                      {file.is_favorite ? "取消收藏" : "收藏"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="fileCardActionMenuItem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onTogglePinned?.(file);
                    }}
                  >
                    <Pin className="fileCardActionMenuIcon shrink-0" />
                    <span className="whitespace-nowrap">
                      {file.is_pinned ? "取消置顶" : "置顶"}
                    </span>
                  </button>
                  <div
                    className="fileCardActionMenuDivider border-t"
                    data-oid="qe35:8s"
                  />

                  <button
                    type="button"
                    className="fileCardActionMenuItem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseMenu();
                      onDelete(file);
                    }}
                    data-oid="opuf8vv"
                  >
                    <Trash2
                      className="fileCardActionMenuIcon shrink-0"
                      data-oid="pc2osxw"
                    />

                    <span className="whitespace-nowrap" data-oid="o2n.9ot">
                      删除
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </article>
    );
  },
  (prev, next) =>
    prev.file.id === next.file.id &&
    prev.file.original_filename === next.file.original_filename &&
    prev.file.file_size === next.file.file_size &&
    prev.file.created_at === next.file.created_at &&
    prev.file.mime_type === next.file.mime_type &&
    prev.file.is_favorite === next.file.is_favorite &&
    prev.file.is_pinned === next.file.is_pinned &&
    prev.isSelected === next.isSelected &&
    prev.isMenuOpen === next.isMenuOpen &&
    prev.thumbnailPriority === next.thumbnailPriority &&
    prev.onSelect === next.onSelect &&
    prev.onPreview === next.onPreview &&
    prev.onShare === next.onShare &&
    prev.onDownload === next.onDownload &&
    prev.onRename === next.onRename &&
    prev.onDelete === next.onDelete &&
    prev.onShowActivity === next.onShowActivity &&
    prev.onShowVersions === next.onShowVersions &&
    prev.onManageTags === next.onManageTags &&
    prev.onToggleFavorite === next.onToggleFavorite &&
    prev.onTogglePinned === next.onTogglePinned &&
    prev.onDragStart === next.onDragStart &&
    prev.onMobileFileDrop === next.onMobileFileDrop &&
    prev.onMobileFileDragStart === next.onMobileFileDragStart &&
    prev.onMobileFileDragEnd === next.onMobileFileDragEnd &&
    prev.onToggleMenu === next.onToggleMenu &&
    prev.onCloseMenu === next.onCloseMenu,
);

export default FileCard;
