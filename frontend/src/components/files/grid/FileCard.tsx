import { memo } from "react";
import {
  Download,
  Send,
  Trash2,
  Eye,
  MoreVertical,
  PencilLine,
} from "lucide-react";
import { formatFileSizeCompact } from "../../../utils/format";
import type { FileMetadata } from "../../../types/files";
import LazyThumbnail from "../preview/LazyThumbnail";
import { cn } from "../../../utils/cn";
import { getMimeTypeLabel } from "../../../utils/mimeType";
import { schedulePreload } from "../../../utils/preloadPreview";
import { SelectionCheckbox } from "../../common/form/SelectionCheckbox";

interface FileCardProps {
  file: FileMetadata;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPreview: (file: FileMetadata) => void;
  onShare: (file: FileMetadata) => void;
  onDownload: (file: FileMetadata) => void;
  onRename: (file: FileMetadata) => void;
  onDelete: (id: string) => void;
  onDragStart?: (e: React.DragEvent, file: FileMetadata) => void;
  isMenuOpen: boolean;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
  thumbnailPriority?: "high" | "low";
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

    const handleMouseEnter = () => {
      schedulePreload(file.id);
    };

    return (
      <article
        className={cn(
          "glass-card group relative rounded-md transition-colors",
          isSelected && "border-[var(--cta-primary-border)]",
        )}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("application/file-id", file.id);
          e.dataTransfer.effectAllowed = "move";
          onDragStart?.(e, file);
        }}
        onMouseEnter={handleMouseEnter}
        data-oid="vkt8wq9"
      >
        <div className="p-3" data-oid="-e0ub1-">
          {/* 缩略图区域 */}
          <div
            className="relative mb-3 aspect-square cursor-pointer overflow-hidden rounded-sm bg-[var(--file-card-thumb-bg)]"
            onClick={() => onPreview(file)}
            data-oid="ota.b1o"
          >
            <SelectionCheckbox
              isSelected={isSelected}
              onClick={() => onSelect(file.id)}
              size="responsive"
              positionClassName="absolute left-[clamp(0.15rem,0.35vw,0.25rem)] top-[clamp(0.15rem,0.35vw,0.25rem)]"
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
              className="absolute inset-0 flex items-center justify-center bg-[var(--file-card-preview-overlay-bg)] opacity-0 transition-opacity group-hover:opacity-100"
              data-oid="i4m.6k2"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(file);
                }}
                aria-label="预览"
                className="rounded-full bg-[var(--file-card-preview-btn-bg)] p-3 backdrop-blur-sm hover:bg-[var(--file-card-preview-btn-bg-hover)] scale-75"
                data-oid="qrd7kd_"
              >
                <Eye
                  className="h-6 w-6 text-[var(--file-card-preview-btn-text)] scale-75"
                  data-oid="f75efee"
                />
              </button>
            </div>
          </div>

          {/* 文件信息 + 设置按钮 */}
          <div
            className="flex w-full items-center justify-between gap-2"
            data-oid="y5j_0ma"
          >
            <div className="min-w-0 flex-1 space-y-0.5" data-oid="4w9i3kj">
              <p
                className="min-w-0 truncate whitespace-nowrap text-[clamp(0.38rem,1.3vw,0.58rem)] font-medium text-[var(--file-card-text)]"
                title={file.original_filename}
                data-oid="b7fv8ct"
              >
                {file.original_filename}
              </p>
              <p
                className="flex min-w-0 items-center gap-1 whitespace-nowrap overflow-hidden text-[clamp(0.38rem,1.25vw,0.55rem)] text-[var(--file-card-text-muted)]"
                data-oid="azlsnn4"
              >
                <span className="shrink-0" data-oid="to09d67">
                  {formatFileSizeCompact(file.file_size)}
                </span>
                <span
                  className="h-0.5 w-0.5 rounded-full bg-[var(--color-border-medium)]"
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
            </div>

            {/* 设置按钮（与文字平行） */}
            <div className="relative flex-shrink-0" data-oid="7ixpkky">
              <button
                type="button"
                onClick={handleToggleMenu}
                className="inline-flex items-center justify-center rounded-md p-[clamp(2px,0.6vw,4px)] text-[var(--file-card-text-muted)] hover:bg-[var(--file-card-menu-trigger-hover-bg)] hover:text-[var(--file-card-text)]"
                aria-label="更多操作"
                data-oid="npjy::1"
              >
                <MoreVertical className="scale-50" data-oid=".q81ma:" />
              </button>

              {/* 玻璃拟态下拉菜单 */}
              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={onCloseMenu}
                    data-oid="gtgz8t7"
                  />

                  <div
                    className="absolute bottom-full right-0 z-50 mb-1 w-max origin-bottom-right scale-[0.7] rounded-md border border-[var(--file-card-menu-border)] bg-[var(--file-card-menu-bg)] py-1 pl-2 pr-4 shadow-xl sm:scale-90 md:scale-100"
                    data-oid="qo212qm"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-start gap-0 rounded px-0 py-0 text-left text-[clamp(8px,2.2vw,10px)] text-[var(--file-card-menu-text)] transition-colors hover:bg-[var(--file-card-menu-item-hover-bg)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseMenu();
                        onDownload(file);
                      }}
                      data-oid="3ttph4t"
                    >
                      <Download
                        className="scale-50 shrink-0 text-[var(--file-card-menu-text)]"
                        data-oid="._hoyss"
                      />

                      <span className="whitespace-nowrap" data-oid="t-t4yk7">
                        下载
                      </span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center justify-start gap-0 rounded px-0 py-0 text-left text-[clamp(8px,2.2vw,10px)] text-[var(--file-card-menu-text)] transition-colors hover:bg-[var(--file-card-menu-item-hover-bg)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseMenu();
                        onShare(file);
                      }}
                      data-oid="2tdrqm8"
                    >
                      <Send
                        className="scale-50 shrink-0 text-[var(--file-card-menu-text)]"
                        data-oid="9ff2t63"
                      />

                      <span className="whitespace-nowrap" data-oid="d4gqrrb">
                        分享
                      </span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center justify-start gap-0 rounded px-0 py-0 text-left text-[clamp(8px,2.2vw,10px)] text-[var(--file-card-menu-text)] transition-colors hover:bg-[var(--file-card-menu-item-hover-bg)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseMenu();
                        onRename(file);
                      }}
                      data-oid="s945:ua"
                    >
                      <PencilLine
                        className="scale-50 shrink-0 text-[var(--file-card-menu-text)]"
                        data-oid="rpc2y2d"
                      />

                      <span className="whitespace-nowrap" data-oid="j-zm97p">
                        重命名
                      </span>
                    </button>
                    <div
                      className="my-0.5 border-t border-[var(--file-card-menu-divider)]"
                      data-oid="qe35:8s"
                    />

                    <button
                      type="button"
                      className="flex w-full items-center justify-start gap-0 rounded px-0 py-0 text-left text-[clamp(8px,2.2vw,10px)] text-[var(--file-card-menu-text)] transition-colors hover:bg-[var(--file-card-menu-item-hover-bg)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseMenu();
                        onDelete(file.id);
                      }}
                      data-oid="opuf8vv"
                    >
                      <Trash2
                        className="scale-50 shrink-0 text-[var(--file-card-menu-text)]"
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
    prev.isSelected === next.isSelected &&
    prev.isMenuOpen === next.isMenuOpen &&
    prev.thumbnailPriority === next.thumbnailPriority,
);

export default FileCard;
