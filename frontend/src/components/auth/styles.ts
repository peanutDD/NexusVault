import { cn } from '../../utils/cn';

/**
 * Auth 组件共享样式常量
 * 提取重复的 className 以提高可维护性
 */

// 输入框样式
export const AUTH_INPUT_CLASSES = cn(
  'w-full px-4 py-3',
  'bg-white/10 dark:bg-gray-800/50',
  'border border-white/20 dark:border-gray-600',
  'rounded-lg',
  'text-white dark:text-gray-100',
  'placeholder-gray-400 dark:placeholder-gray-500',
  'focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent',
  'transition-all duration-200'
);

// 标签样式（统一使用品牌字体）
export const AUTH_LABEL_CLASSES =
  'font-brand block text-sm font-medium text-gray-300 mb-2';

// 错误消息样式
export const AUTH_ERROR_CLASSES = 'font-brand mt-1 text-sm text-red-400';

// 错误提示框样式
export const AUTH_ERROR_BOX_CLASSES = cn(
  'font-brand mb-4 p-3',
  'bg-red-500/20 border border-red-500/50',
  'rounded-lg text-red-200 text-sm'
);

// 主按钮样式
export const AUTH_BUTTON_CLASSES = cn(
  'font-brand w-full py-3 px-4 rounded-xl font-semibold tracking-wide',
  'bg-gradient-to-r from-emerald-500/85 via-cyan-500/85 to-sky-500/85',
  'text-slate-950',
  'hover:from-emerald-500 hover:via-cyan-500 hover:to-sky-500',
  'focus:outline-none focus:ring-2 focus:ring-emerald-300/60',
  'focus:ring-offset-2 focus:ring-offset-slate-950',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'transition-all duration-200',
  'transform hover:scale-[1.02] active:scale-[0.98]'
);

// 页面容器样式（与主页背景一致）
export const AUTH_PAGE_CLASSES = cn(
  'min-h-screen flex items-center justify-center',
  'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900',
  'dark:from-gray-950 dark:via-purple-950 dark:to-gray-950',
  'transition-colors duration-300'
);

// 卡片容器样式（贴近主页玻璃 + 霓虹边框）
export const AUTH_CARD_CLASSES = cn(
  'relative overflow-hidden rounded-2xl',
  'border border-emerald-300/15 bg-slate-950/40',
  'shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_22px_80px_rgba(0,0,0,0.75)]',
  'backdrop-blur-xl',
  'p-8 sm:p-9',
  'transition-all duration-300'
);

// 标题样式（与主页品牌标题接近）
export const AUTH_TITLE_CLASSES = cn(
  'text-2xl sm:text-3xl font-brand font-semibold text-center tracking-widest',
  'text-slate-50',
  'mb-3 transition-colors duration-200'
);

// 副标题样式
export const AUTH_SUBTITLE_CLASSES = cn(
  'font-brand text-center text-slate-300',
  'mb-8 transition-colors duration-200 text-sm sm:text-base'
);
