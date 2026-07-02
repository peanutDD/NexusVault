import { cn } from "../../utils/cn";

/**
 * Auth 组件共享样式常量
 * 使用集中化 Design Tokens，减少硬编码颜色/阴影
 */

// 输入框样式
export const AUTH_INPUT_CLASSES = cn(
  "neu-inset",
  "w-full px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.4rem,1vw,0.5rem)]",
  "text-[var(--auth-input-text)]",
  "placeholder:text-[var(--auth-input-placeholder)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]",
  "transition-all duration-200",
);

// 标签样式（统一使用品牌字体）
export const AUTH_LABEL_CLASSES =
  "font-brand block text-[clamp(0.75rem,1.8vw,0.875rem)] font-medium text-[var(--auth-label-text)] mb-[clamp(0.39rem,0.9vw,0.5rem)]";

// 错误消息样式
export const AUTH_ERROR_CLASSES =
  "font-brand mt-[clamp(0.195rem,0.45vw,0.25rem)] text-[clamp(0.75rem,1.8vw,0.875rem)] text-[var(--auth-error-text)]";

// 错误提示框样式
export const AUTH_ERROR_BOX_CLASSES = cn(
  "neu-inset",
  "font-brand mb-[clamp(0.78rem,1.8vw,1rem)] p-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.4rem,1vw,0.5rem)] text-[clamp(0.75rem,1.8vw,0.875rem)]",
  "text-[var(--auth-error-text)]",
);

// 主按钮样式
export const AUTH_BUTTON_CLASSES = cn(
  "neu-raised-sm",
  "font-brand w-full py-[clamp(0.585rem,1.35vw,0.75rem)] px-[clamp(0.78rem,1.8vw,1rem)] rounded-[clamp(0.6rem,1.4vw,0.75rem)] font-semibold tracking-wide",
  "bg-indigo-500 text-[var(--auth-button-text)] hover:bg-indigo-600",
  "active:shadow-[var(--neu-pressed-shadow)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--auth-button-ring)]",
  "focus:ring-offset-2 focus:ring-offset-[var(--auth-button-ring-offset)]",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "transition-all duration-200",
);

export const AUTH_OAUTH_BUTTON_CLASSES = cn(
  "neu-raised-sm font-brand w-full inline-flex items-center justify-center rounded-[clamp(0.6rem,1.4vw,0.75rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.585rem,1.35vw,0.75rem)] text-[clamp(0.75rem,1.8vw,0.875rem)] font-medium",
  "text-[var(--auth-oauth-button-text)]",
  "transition-all duration-200 active:shadow-[var(--neu-pressed-shadow)]",
);

export const AUTH_OAUTH_DISABLED_CLASSES = cn(
  "neu-raised-sm font-brand w-full inline-flex items-center justify-center rounded-[clamp(0.6rem,1.4vw,0.75rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.585rem,1.35vw,0.75rem)] text-[clamp(0.75rem,1.8vw,0.875rem)] font-medium cursor-not-allowed",
  "text-[var(--auth-oauth-disabled-text)]",
);

// 页面容器样式
export const AUTH_PAGE_CLASSES = cn(
  "neu-flat relative isolate min-h-screen overflow-hidden flex items-center justify-center",
  "transition-colors duration-300",
);

// 卡片容器样式
export const AUTH_CARD_CLASSES = cn(
  "neu-raised relative overflow-hidden rounded-[clamp(0.8rem,2vw,1rem)]",
  "p-[clamp(1.75rem,3.6vw,2rem)] sm:p-[clamp(2rem,4.05vw,2.25rem)]",
  "transition-all duration-300",
);

// 标题样式
export const AUTH_TITLE_CLASSES = cn(
  "text-[clamp(1.25rem,3.5vw,1.5rem)] sm:text-[clamp(1.5rem,4.4vw,1.875rem)] font-brand font-semibold text-center tracking-widest",
  "text-[var(--auth-title-text)]",
  "mb-[clamp(0.585rem,1.35vw,0.75rem)] transition-colors duration-200",
);

// 副标题样式
export const AUTH_SUBTITLE_CLASSES = cn(
  "font-brand text-center text-[var(--auth-subtitle-text)]",
  "mb-[clamp(1.75rem,3.6vw,2rem)] transition-colors duration-200 text-[clamp(0.75rem,1.8vw,0.875rem)] sm:text-[clamp(0.875rem,2vw,1rem)]",
);
