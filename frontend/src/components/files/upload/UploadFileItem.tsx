import {
  memo,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useId,
} from "react";
import { formatFileSize } from "../../../utils/format";
import { cn } from "../../../utils/cn";
import { getMimeTypeInfo } from "../../../utils/mimeType";
import { createPortal } from "react-dom";
import "./UploadFileItem.css";

export interface UploadFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  /** 上传阶段提示，如「秒传未命中，正在上传…」 */
  statusMessage?: string;
  startTime?: number;
  file?: File;
}

interface UploadFileItemProps {
  file: UploadFile;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

// 共享“每秒 tick”：避免多个上传项各自 setInterval
type NowListener = (now: number) => void;
let nowTimer: number | null = null;
const nowListeners = new Set<NowListener>();

function ensureNowTimer() {
  if (nowTimer != null) return;
  nowTimer = window.setInterval(() => {
    const t = Date.now();
    for (const l of nowListeners) l(t);
  }, 1000);
}

function maybeStopNowTimer() {
  if (nowTimer == null) return;
  if (nowListeners.size > 0) return;
  window.clearInterval(nowTimer);
  nowTimer = null;
}

/**
 * 计算上传剩余时间
 * 使用 match 风格的条件返回
 */
function calculateRemainingTime(
  uploadedBytes: number,
  totalBytes: number,
  elapsedMs: number,
): string {
  // 更稳健的边界处理：避免 NaN / Infinity / 负秒数
  if (totalBytes <= 0) return "";
  if (elapsedMs <= 0) return "";
  if (uploadedBytes <= 0) return "";
  if (uploadedBytes >= totalBytes) return "0 sec left";

  const safeUploadedBytes = Math.min(uploadedBytes, totalBytes);
  const bytesPerMs = safeUploadedBytes / elapsedMs;
  if (!Number.isFinite(bytesPerMs) || bytesPerMs <= 0) return "";

  const remainingBytes = Math.max(0, totalBytes - safeUploadedBytes);
  const remainingSec = Math.max(
    0,
    Math.ceil(remainingBytes / bytesPerMs / 1000),
  );

  return remainingSec < 60
    ? `${remainingSec} sec left`
    : remainingSec < 3600
      ? `${Math.ceil(remainingSec / 60)} min left`
      : `${Math.floor(remainingSec / 3600)}h ${Math.ceil((remainingSec % 3600) / 60)}m left`;
}

/**
 * 上传文件项组件
 * 完美复刻设计稿的样式
 */
const UploadFileItem = memo(function UploadFileItem({
  file,
  onRemove,
  onRetry,
}: UploadFileItemProps) {
  const [now, setNow] = useState(() => (file.startTime ? file.startTime : 0));

  // 上传中时每秒更新一次
  useEffect(() => {
    if (file.status !== "uploading") return;
    if (typeof window === "undefined") return;

    const listener: NowListener = (t) => setNow(t);
    nowListeners.add(listener);
    ensureNowTimer();
    return () => {
      nowListeners.delete(listener);
      maybeStopNowTimer();
    };
  }, [file.status]);

  const elapsedMs = file.startTime ? Math.max(0, now - file.startTime) : 0;
  const progress = Math.max(0, Math.min(100, file.progress));
  const uploadedBytes = (progress / 100) * Math.max(0, file.size);
  const remainingTime =
    file.status === "uploading"
      ? calculateRemainingTime(uploadedBytes, file.size, elapsedMs)
      : "";

  // 使用 useMemo 缓存图标颜色
  const mimeTypeInfo = useMemo(
    () => getMimeTypeInfo(file.mimeType),
    [file.mimeType],
  );

  // 状态文字
  const renderStatusText = () => {
    switch (file.status) {
      case "pending":
        return (
          <span className="text-xs text-[var(--upload-item-muted)]">
            {formatFileSize(file.size)}
          </span>
        );
      case "uploading":
        return (
          <span className="text-xs text-[var(--upload-item-muted)]">
            {formatFileSize(file.size)}
            <span className="mx-1.5 text-[var(--upload-item-muted)]">|</span>
            <span className="text-[var(--upload-item-text)]">{progress}%</span>
            {file.statusMessage && (
              <span className="ml-1.5 text-[var(--upload-item-muted)]">
                {file.statusMessage}
              </span>
            )}
            {remainingTime && (
              <>
                <span className="mx-1.5 text-[var(--upload-item-muted)]">·</span>
                <span>{remainingTime}</span>
              </>
            )}
          </span>
        );
      case "success":
        return (
          <span className="text-xs text-[var(--upload-item-muted)]">
            Upload Successful
            <span className="mx-1.5 text-[var(--upload-item-muted)]">|</span>
            <span className="text-[var(--upload-item-text)]">100%</span>
          </span>
        );
      case "error":
        return <ErrorStatus error={file.error} />;
      default:
        return null;
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-[var(--upload-item-bg)]">
      {/* 主内容 */}
      <div className="flex items-center gap-3 p-3">
        {/* 文件图标 */}
        <div
          className={cn(
            "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--upload-item-icon-border)] bg-[var(--upload-item-icon-bg)] shadow-[var(--upload-item-icon-shadow)] backdrop-blur-sm",
            mimeTypeInfo.bgClass,
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[var(--upload-item-icon-highlight)]" />
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-[var(--upload-item-icon-ring)]" />
          <div
            className="pointer-events-none absolute -inset-px rounded-xl opacity-70"
            style={{
              boxShadow: `0 0 18px ${mimeTypeInfo.color}66, 0 0 28px ${mimeTypeInfo.color}33`,
            }}
          />
          <FileIcon color={mimeTypeInfo.color} />
        </div>

        {/* 文件信息 */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium text-[var(--upload-item-text)]"
            title={file.name}
          >
            {file.name}
          </p>
          {renderStatusText()}
        </div>

        {/* 操作按钮 */}
        <div className="flex shrink-0 items-center gap-1">
          {file.status === "error" && (
            <button
              type="button"
              onClick={() => onRetry(file.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--upload-item-action-text)] transition-colors hover:bg-[var(--upload-item-action-hover-bg)] hover:text-[var(--upload-item-action-hover-text)]"
              title="重试"
              aria-label="重试上传"
            >
              <RetryIcon />
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(file.id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--upload-item-action-text)] transition-colors hover:bg-[var(--upload-item-action-hover-bg)] hover:text-[var(--upload-item-action-hover-text)]"
            title="删除"
            aria-label="删除文件"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* 进度条 - 贯穿底部 */}
      {(file.status === "uploading" || file.status === "success") && (
        <div className="absolute bottom-1 left-3 right-3 h-1">
          <div className="uploadProgressTrack h-full overflow-hidden">
            <progress
              className="uploadProgress"
              value={Math.max(0, Math.min(100, file.progress))}
              max={100}
              aria-label="Upload progress"
            />
          </div>
        </div>
      )}
    </div>
  );
});

// 文件图标
function FileIcon({ color }: { color: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="relative z-[1] drop-shadow-[var(--upload-item-icon-drop-shadow)]"
      aria-hidden
    >
      <defs>
        <linearGradient
          id="uploadFileIconPaper"
          x1="5"
          y1="2"
          x2="19"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="rgb(var(--upload-doc-icon-paper))" stopOpacity="0.26" />
          <stop offset="1" stopColor="rgb(var(--upload-doc-icon-paper))" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient
          id="uploadFileIconFold"
          x1="14"
          y1="2"
          x2="19"
          y2="7"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="rgb(var(--upload-doc-icon-fold-highlight))" stopOpacity="0.85" />
          <stop offset="1" stopColor="rgb(var(--upload-doc-icon-fold-highlight))" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      <path
        d="M6 2C5.44772 2 5 2.44772 5 3V21C5 21.5523 5.44772 22 6 22H18C18.5523 22 19 21.5523 19 21V7L14 2H6Z"
        fill={color}
      />
      <path
        d="M6 2C5.44772 2 5 2.44772 5 3V21C5 21.5523 5.44772 22 6 22H18C18.5523 22 19 21.5523 19 21V7L14 2H6Z"
        fill="url(#uploadFileIconPaper)"
      />
      <path
        d="M14 2L19 7H15C14.4477 7 14 6.55228 14 6V2Z"
        fill="url(#uploadFileIconFold)"
      />
      <path
        d="M8 13.25C8 12.5596 8.55964 12 9.25 12H14.75C15.4404 12 16 12.5596 16 13.25C16 13.9404 15.4404 14.5 14.75 14.5H9.25C8.55964 14.5 8 13.9404 8 13.25Z"
        fill="rgb(var(--upload-doc-icon-detail))"
        fillOpacity="0.7"
      />
      <path
        d="M8 17C8 16.5858 8.33579 16.25 8.75 16.25H13.25C13.6642 16.25 14 16.5858 14 17C14 17.4142 13.6642 17.75 13.25 17.75H8.75C8.33579 17.75 8 17.4142 8 17Z"
        fill="rgb(var(--upload-doc-icon-detail))"
        fillOpacity="0.45"
      />
    </svg>
  );
}

// 重试图标
function RetryIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

// 删除图标
function TrashIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

// 信息图标
function InfoIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

// 错误详情 Tooltip
function ErrorTooltip({
  error,
  anchorRect,
  onClose,
  triggerRef,
}: {
  error: string;
  anchorRect: DOMRect;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  const posClass = useMemo(() => `uploadErrorTooltipPos_${uid}`, [uid]);

  // 点击外部关闭（排除触发按钮）
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // 如果点击的是触发按钮，不处理（让按钮的 onClick 处理）
      if (triggerRef.current?.contains(target)) {
        return;
      }
      // 如果点击的是 tooltip 外部，关闭
      if (tooltipRef.current && !tooltipRef.current.contains(target)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, triggerRef]);

  // 计算位置（显示在按钮上方）
  const top = anchorRect.top - 8;
  const left = Math.min(anchorRect.left - 100, window.innerWidth - 270);

  // 避免 inline style：动态生成 CSS 规则写入 <style>
  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-upload-tooltip-style", posClass);
    styleEl.textContent = `.${posClass}{left:${left}px;top:${top}px;}`;
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, [left, top, posClass]);

  return createPortal(
    <div
      ref={tooltipRef}
      className={cn(
        "fixed z-[9999] w-64 -translate-y-full animate-in fade-in slide-in-from-bottom-2 duration-200",
        posClass,
      )}
    >
      {/* 主容器 - 渐变背景 */}
      <div className="overflow-hidden rounded-sm bg-[var(--upload-tooltip-bg)] shadow-lg ring-1 ring-[var(--upload-tooltip-ring)]">
        {/* 顶部装饰条 */}
        <div className="h-0.5 bg-[var(--upload-tooltip-accent)]" />

        {/* 内容区 */}
        <div className="p-3">
          {/* 标题 */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--upload-tooltip-title)]">
              错误详情
            </span>
            <button
              onClick={onClose}
              className="flex h-5 w-5 items-center justify-center rounded text-[var(--upload-tooltip-close)] transition-colors hover:bg-[var(--upload-tooltip-close-bg)] hover:text-[var(--upload-tooltip-close-hover)]"
              title="关闭"
              aria-label="关闭"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* 错误内容 */}
          <div className="max-h-32 overflow-y-auto">
            <p className="whitespace-pre-line text-[11px] leading-relaxed text-[var(--upload-tooltip-text)]">
              {error}
            </p>
          </div>
        </div>
      </div>

      {/* 小三角箭头 */}
      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
        <div className="h-3 w-3 rotate-45 bg-[var(--upload-tooltip-arrow-bg)] ring-1 ring-[var(--upload-tooltip-ring)]" />
      </div>
    </div>,
    document.body,
  );
}

// 错误状态组件
function ErrorStatus({ error }: { error?: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 切换显示/隐藏
  const handleToggle = useCallback(() => {
    if (showTooltip) {
      setShowTooltip(false);
    } else if (buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
      setShowTooltip(true);
    }
  }, [showTooltip]);

  const handleClose = useCallback(() => {
    setShowTooltip(false);
  }, []);

  // 截取错误信息的第一行或前30个字符
  const shortError = useMemo(() => {
    if (!error) return "上传失败";
    const firstLine = error.split("\n")[0];
    return firstLine.length > 35 ? firstLine.slice(0, 35) + "..." : firstLine;
  }, [error]);

  const hasMoreDetails = error && (error.includes("\n") || error.length > 35);

  return (
    <div className="flex items-center gap-1.5">
      <span className="truncate text-xs text-[var(--upload-error-text)]">{shortError}</span>
      {hasMoreDetails && (
        <>
          <button
            ref={buttonRef}
            type="button"
            onClick={handleToggle}
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors",
              showTooltip
                ? "bg-[var(--upload-error-pill-bg-active)] text-[var(--upload-error-pill-text-active)]"
                : "bg-[var(--upload-error-pill-bg)] text-[var(--upload-error-pill-text)] hover:bg-[var(--upload-error-pill-bg-hover)]",
            )}
            title={showTooltip ? "关闭详情" : "查看详情"}
          >
            <InfoIcon />
          </button>
          {showTooltip && anchorRect && (
            <ErrorTooltip
              error={error}
              anchorRect={anchorRect}
              onClose={handleClose}
              triggerRef={buttonRef}
            />
          )}
        </>
      )}
    </div>
  );
}

export default UploadFileItem;
