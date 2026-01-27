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

// 标签样式
export const AUTH_LABEL_CLASSES = 'block text-sm font-medium text-gray-300 mb-2';

// 错误消息样式
export const AUTH_ERROR_CLASSES = 'mt-1 text-sm text-red-400';

// 错误提示框样式
export const AUTH_ERROR_BOX_CLASSES = cn(
  'mb-4 p-3',
  'bg-red-500/20 border border-red-500/50',
  'rounded-lg text-red-200 text-sm'
);

// 主按钮样式
export const AUTH_BUTTON_CLASSES = cn(
  'w-full py-3 px-4',
  'bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-600 dark:to-pink-600',
  'text-white font-semibold rounded-lg',
  'hover:from-purple-600 hover:to-pink-600 dark:hover:from-purple-700 dark:hover:to-pink-700',
  'focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400',
  'focus:ring-offset-2 focus:ring-offset-gray-900 dark:focus:ring-offset-gray-800',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'transition-all duration-200',
  'transform hover:scale-[1.02] active:scale-[0.98]'
);

// 页面容器样式
export const AUTH_PAGE_CLASSES = cn(
  'min-h-screen flex items-center justify-center',
  'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900',
  'dark:from-gray-950 dark:via-purple-950 dark:to-gray-950',
  'transition-colors duration-300'
);

// 卡片容器样式
export const AUTH_CARD_CLASSES = cn(
  'bg-white/10 dark:bg-gray-900/80',
  'backdrop-blur-lg rounded-2xl shadow-2xl p-8',
  'border border-white/20 dark:border-gray-700/50',
  'transition-all duration-300'
);

// 标题样式
export const AUTH_TITLE_CLASSES = cn(
  'text-3xl font-bold text-center',
  'text-white dark:text-gray-100',
  'mb-2 transition-colors duration-200'
);

// 副标题样式
export const AUTH_SUBTITLE_CLASSES = cn(
  'text-center text-gray-300 dark:text-gray-400',
  'mb-8 transition-colors duration-200'
);
