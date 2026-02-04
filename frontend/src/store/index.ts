/**
 * 状态管理统一导出
 */

// 认证
export { useAuthStore } from './authStore';

// 主题
export { useThemeStore } from './themeStore';

// 水合
export { useHydrationStore } from './hydrationStore';

// 文件相关
export * from './files';

// 原有的 fileStore（保持向后兼容）
export { useFileStore } from './fileStore';
