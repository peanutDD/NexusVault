/**
 * FilePreview 图标组件
 * 抽离的 SVG 图标，便于维护与复用
 */

// =============================================================================
// 关闭图标
// =============================================================================

import { cn } from '../../../utils/cn';

/** 关闭图标，父级设宽高时用 h-full w-full 随父级缩放 */
export function CloseIcon() {
  return (
    <svg
      className="h-full w-full shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="clamp(1.5, 0.4vw, 2.5)"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// =============================================================================
// 下载图标
// =============================================================================

/** 下载图标，适配按钮内的小尺寸 */
export function DownloadIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

// =============================================================================
// 错误图标
// =============================================================================

/** 错误提示图标 */
export function ErrorIcon() {
  return (
    <svg
      className="h-8 w-8 text-red-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

// =============================================================================
// 文件图标
// =============================================================================

/** 通用文件占位图标 */
export function FileIcon() {
  return (
    <svg
      className="h-5 w-5 text-purple-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

// =============================================================================
// 音频图标
// =============================================================================

/** 音频预览占位图标 */
export function AudioIcon() {
  return (
    <svg
      className="h-12 w-12 text-purple-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
      />
    </svg>
  );
}

// =============================================================================
// 循环播放图标
// =============================================================================

/** 循环播放图标，适配预览工具栏按钮 */
export function LoopIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        d="M7 7h9a2 2 0 0 1 2 2v1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 4 7 7l3 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 17H8a2 2 0 0 1-2-2v-1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 20 17 17l-3-3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// =============================================================================
// 加载图标
// =============================================================================

/** 加载旋转图标 */
export function SpinnerIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// =============================================================================
// 认证图标
// =============================================================================
