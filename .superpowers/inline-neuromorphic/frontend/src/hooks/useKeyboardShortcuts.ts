//! # Keyboard Shortcuts Hook
//!
//! 提供键盘快捷键功能，提升用户操作效率。

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  /** 快捷键组合，如 'ctrl+k', 'escape', 'ctrl+shift+d' */
  key: string;
  /** 回调函数 */
  handler: (e: KeyboardEvent) => void;
  /** 是否在输入框中禁用（默认 true） */
  preventInInput?: boolean;
  /** 描述（用于帮助文档） */
  description?: string;
}

/**
 * 解析快捷键字符串
 *
 * @example
 * parseShortcut('ctrl+k') => { ctrl: true, key: 'k' }
 * parseShortcut('escape') => { key: 'Escape' }
 */
function parseShortcut(shortcut: string): {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  key: string;
} {
  const parts = shortcut.toLowerCase().split('+');
  const result: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
    key: string;
  } = { key: '' };

  for (const part of parts) {
    const trimmed = part.trim();
    switch (trimmed) {
      case 'ctrl':
      case 'control':
        result.ctrl = true;
        break;
      case 'shift':
        result.shift = true;
        break;
      case 'alt':
        result.alt = true;
        break;
      case 'meta':
      case 'cmd':
        result.meta = true;
        break;
      default:
        result.key = trimmed === 'escape' ? 'Escape' : trimmed;
    }
  }

  return result;
}

/**
 * 检查是否在输入元素中
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  
  const tagName = target.tagName.toLowerCase();
  const isInput = tagName === 'input' || tagName === 'textarea';
  const isContentEditable = target.isContentEditable;
  
  return isInput || isContentEditable;
}

/**
 * 检查快捷键是否匹配
 */
function matchesShortcut(
  e: KeyboardEvent,
  parsed: ReturnType<typeof parseShortcut>
): boolean {
  if (e.key.toLowerCase() !== parsed.key.toLowerCase()) return false;
  if (parsed.ctrl && !e.ctrlKey) return false;
  if (parsed.shift && !e.shiftKey) return false;
  if (parsed.alt && !e.altKey) return false;
  if (parsed.meta && !e.metaKey) return false;
  
  // 确保没有额外的修饰键
  if (!parsed.ctrl && e.ctrlKey) return false;
  if (!parsed.shift && e.shiftKey) return false;
  if (!parsed.alt && e.altKey) return false;
  if (!parsed.meta && e.metaKey) return false;

  return true;
}

/**
 * 键盘快捷键 Hook
 *
 * 使用 ref 存储 shortcuts，避免 shortcuts 变化时重新注册事件监听器
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   {
 *     key: 'ctrl+k',
 *     handler: () => setSearchFocused(true),
 *     description: '聚焦搜索框'
 *   },
 *   {
 *     key: 'ctrl+shift+d',
 *     handler: () => handleBatchDelete(),
 *     description: '批量删除选中文件'
 *   },
 *   {
 *     key: 'escape',
 *     handler: () => closeModal(),
 *     preventInInput: false, // Escape 在输入框中也生效
 *   }
 * ]);
 * ```
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  // 使用 ref 存储 shortcuts，避免依赖变化导致重新注册
  const shortcutsRef = useRef(shortcuts);
  
  // 同步更新 ref
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  // 事件处理器不依赖 shortcuts，避免重复注册
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 使用 find 替代 for...of + break，语义更清晰
    const matched = shortcutsRef.current.find((shortcut) => {
      // 检查是否在输入框中（默认阻止）
      if (shortcut.preventInInput !== false && isInputElement(e.target)) {
        return false;
      }
      return matchesShortcut(e, parseShortcut(shortcut.key));
    });

    if (matched) {
      e.preventDefault();
      matched.handler(e);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * 常用快捷键组合
 */
export const SHORTCUTS = {
  SEARCH: 'ctrl+k',
  DELETE: 'delete',
  BATCH_DELETE: 'ctrl+shift+d',
  SELECT_ALL: 'ctrl+a',
  UPLOAD: 'ctrl+u',
  ESCAPE: 'escape',
  REFRESH: 'ctrl+r',
} as const;
