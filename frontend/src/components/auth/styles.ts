import { cn } from "../../utils/cn";

/**
 * Auth 组件共享样式常量
 * 使用集中化 Design Tokens，减少硬编码颜色/阴影
 */

// 输入框样式
export const AUTH_INPUT_CLASSES = cn(
  "w-full px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.4rem,1vw,0.5rem)]",
  "[background:var(--auth-input-bg)]",
  "border border-[var(--auth-input-border)] shadow-[var(--auth-input-shadow)]",
  "text-[var(--auth-input-text)]",
  "placeholder:text-[var(--auth-input-placeholder)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-[var(--auth-input-border-focus)] focus:shadow-[var(--auth-input-shadow-focus)]",
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
  "font-brand mb-[clamp(0.78rem,1.8vw,1rem)] p-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.4rem,1vw,0.5rem)] text-[clamp(0.75rem,1.8vw,0.875rem)]",
  "[background:var(--auth-error-bg)] border border-[var(--auth-error-border)] text-[var(--auth-error-text)] shadow-[var(--auth-error-shadow)]",
);

// 主按钮样式
export const AUTH_BUTTON_CLASSES = cn(
  "font-brand w-full py-[clamp(0.585rem,1.35vw,0.75rem)] px-[clamp(0.78rem,1.8vw,1rem)] rounded-[clamp(0.6rem,1.4vw,0.75rem)] font-semibold tracking-wide",
  "bg-[image:var(--auth-button-gradient)]",
  "text-[var(--auth-button-text)]",
  "hover:bg-[image:var(--auth-button-gradient-hover)]",
  "shadow-[var(--auth-button-shadow)] hover:shadow-[var(--auth-button-shadow-hover)] active:shadow-[var(--auth-button-shadow-active)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--auth-button-ring)]",
  "focus:ring-offset-2 focus:ring-offset-[var(--auth-button-ring-offset)]",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "transition-all duration-200",
);

export const AUTH_OAUTH_BUTTON_CLASSES = cn(
  "font-brand w-full inline-flex items-center justify-center rounded-[clamp(0.6rem,1.4vw,0.75rem)] border border-[var(--auth-oauth-button-border)] [background:var(--auth-oauth-button-bg)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.585rem,1.35vw,0.75rem)] text-[clamp(0.75rem,1.8vw,0.875rem)] font-medium",
  "text-[var(--auth-oauth-button-text)] shadow-[var(--auth-oauth-button-shadow)]",
  "transition-all duration-200 hover:[background:var(--auth-oauth-button-bg-hover)] hover:shadow-[var(--auth-oauth-button-shadow-hover)] active:shadow-[var(--auth-oauth-button-shadow-active)]",
);

export const AUTH_OAUTH_DISABLED_CLASSES = cn(
  "font-brand w-full inline-flex items-center justify-center rounded-[clamp(0.6rem,1.4vw,0.75rem)] border border-[var(--auth-oauth-disabled-border)] [background:var(--auth-oauth-disabled-bg)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.585rem,1.35vw,0.75rem)] text-[clamp(0.75rem,1.8vw,0.875rem)] font-medium cursor-not-allowed",
  "text-[var(--auth-oauth-disabled-text)] shadow-[var(--auth-oauth-disabled-shadow)]",
);

// 页面容器样式
export const AUTH_PAGE_CLASSES = cn(
  "relative isolate min-h-screen overflow-hidden flex items-center justify-center",
  "bg-[image:var(--auth-page-bg)]",
  "transition-colors duration-300",
);

// 卡片容器样式
export const AUTH_CARD_CLASSES = cn(
  "relative overflow-hidden rounded-[clamp(0.8rem,2vw,1rem)]",
  "border border-[var(--auth-card-border)] [background:var(--auth-card-bg)]",
  "shadow-[var(--auth-card-shadow)]",
  "backdrop-blur-[var(--auth-card-backdrop)]",
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
