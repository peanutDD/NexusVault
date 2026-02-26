import { cn } from "../../utils/cn";

/**
 * Auth 组件共享样式常量
 * 使用集中化 Design Tokens，减少硬编码颜色/阴影
 */

// 输入框样式
export const AUTH_INPUT_CLASSES = cn(
  "w-full px-4 py-3 rounded-lg",
  "bg-[var(--auth-input-bg)] dark:bg-[var(--auth-input-bg-dark)]",
  "border border-[var(--auth-input-border)] dark:border-[var(--auth-input-border-dark)]",
  "text-[var(--auth-input-text)]",
  "placeholder:text-[var(--auth-input-placeholder)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-transparent",
  "transition-all duration-200",
);

// 标签样式（统一使用品牌字体）
export const AUTH_LABEL_CLASSES =
  "font-brand block text-sm font-medium text-[var(--auth-label-text)] mb-2";

// 错误消息样式
export const AUTH_ERROR_CLASSES =
  "font-brand mt-1 text-sm text-[var(--auth-error-text)]";

// 错误提示框样式
export const AUTH_ERROR_BOX_CLASSES = cn(
  "font-brand mb-4 p-3 rounded-lg text-sm",
  "bg-[var(--auth-error-bg)] border border-[var(--auth-error-border)] text-[var(--auth-error-text)]",
);

// 主按钮样式
export const AUTH_BUTTON_CLASSES = cn(
  "font-brand w-full py-3 px-4 rounded-xl font-semibold tracking-wide",
  "bg-[image:var(--auth-button-gradient)]",
  "text-[var(--auth-button-text)]",
  "hover:bg-[image:var(--auth-button-gradient-hover)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--auth-button-ring)]",
  "focus:ring-offset-2 focus:ring-offset-[var(--auth-button-ring-offset)]",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "transition-all duration-200",
  "transform hover:scale-[1.02] active:scale-[0.98]",
);

// 页面容器样式
export const AUTH_PAGE_CLASSES = cn(
  "min-h-screen flex items-center justify-center",
  "bg-[image:var(--auth-page-bg)] dark:bg-[image:var(--auth-page-bg-dark)]",
  "transition-colors duration-300",
);

// 卡片容器样式
export const AUTH_CARD_CLASSES = cn(
  "relative overflow-hidden rounded-2xl",
  "border border-[var(--auth-card-border)] bg-[var(--auth-card-bg)]",
  "shadow-[var(--auth-card-shadow)]",
  "backdrop-blur-xl",
  "p-8 sm:p-9",
  "transition-all duration-300",
);

// 标题样式
export const AUTH_TITLE_CLASSES = cn(
  "text-2xl sm:text-3xl font-brand font-semibold text-center tracking-widest",
  "text-[var(--auth-title-text)]",
  "mb-3 transition-colors duration-200",
);

// 副标题样式
export const AUTH_SUBTITLE_CLASSES = cn(
  "font-brand text-center text-[var(--auth-subtitle-text)]",
  "mb-8 transition-colors duration-200 text-sm sm:text-base",
);
