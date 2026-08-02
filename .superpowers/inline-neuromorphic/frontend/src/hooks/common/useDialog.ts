import { useEffect, useCallback, useRef } from 'react';

interface UseDialogOptions {
  /** 对话框是否打开 */
  open: boolean;
  /** 关闭对话框的回调 */
  onClose: () => void;
  /** 是否在 loading 时禁止关闭 */
  loading?: boolean;
  /** 自动聚焦的元素引用 */
  autoFocusRef?: React.RefObject<HTMLElement | null>;
  /** 是否在按 ESC 时关闭，默认 true */
  closeOnEscape?: boolean;
  /** 是否在点击背景时关闭，默认 true */
  closeOnBackdrop?: boolean;
  /** 聚焦延迟（毫秒），默认 100 */
  focusDelay?: number;
  /** 是否锁定背景页面滚动，默认 true */
  lockScroll?: boolean;
}

interface UseDialogReturn {
  /** 用于背景元素的点击处理器 */
  handleBackdropClick: (e: React.MouseEvent) => void;
  /** 用于对话框容器的 ref，防止背景点击穿透 */
  dialogRef: React.RefObject<HTMLDivElement | null>;
}

let scrollLockDepth = 0;
let scrollLockSnapshot: {
  bodyOverflow: string;
  rootOverflow: string;
} | null = null;

function lockDocumentScroll() {
  if (typeof document === 'undefined') return () => undefined;

  const body = document.body;
  const root = document.documentElement;

  if (scrollLockDepth === 0) {
    scrollLockSnapshot = {
      bodyOverflow: body.style.overflow,
      rootOverflow: root.style.overflow,
    };
    body.style.overflow = 'hidden';
    root.style.overflow = 'hidden';
  }

  scrollLockDepth += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLockDepth = Math.max(0, scrollLockDepth - 1);

    if (scrollLockDepth === 0 && scrollLockSnapshot) {
      body.style.overflow = scrollLockSnapshot.bodyOverflow;
      root.style.overflow = scrollLockSnapshot.rootOverflow;
      scrollLockSnapshot = null;
    }
  };
}

/**
 * 对话框通用逻辑 Hook
 * 统一处理 ESC 关闭、自动聚焦、背景点击关闭等
 */
export function useDialog(options: UseDialogOptions): UseDialogReturn {
  const {
    open,
    onClose,
    loading = false,
    autoFocusRef,
    closeOnEscape = true,
    closeOnBackdrop = true,
    focusDelay = 100,
    lockScroll = true,
  } = options;

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || !lockScroll) return undefined;
    return lockDocumentScroll();
  }, [open, lockScroll]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;

        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null);

        if (focusables.length === 0) {
          e.preventDefault();
          root.focus();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || !root.contains(active) || active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (!active || !root.contains(active) || active === last) {
            e.preventDefault();
            first.focus();
          }
        }
        return;
      }

      if (e.key === 'Escape' && !loading) {
        if (closeOnEscape) {
          onClose();
        }
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, closeOnEscape, loading]);

  // 关闭时恢复焦点
  useEffect(() => {
    if (!open) return;

    if (typeof document !== 'undefined') {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
    }

    return () => {
      const el = previousFocusRef.current;
      if (!el) return;
      if (typeof document !== 'undefined' && document.contains(el)) {
        el.focus();
      }
    };
  }, [open]);

  // 自动聚焦
  useEffect(() => {
    if (open && autoFocusRef?.current) {
      const timer = setTimeout(() => {
        autoFocusRef.current?.focus();
      }, focusDelay);
      return () => clearTimeout(timer);
    }
  }, [open, autoFocusRef, focusDelay]);

  // 背景点击关闭
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdrop && !loading && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdrop, loading, onClose]
  );

  return { handleBackdropClick, dialogRef };
}

export default useDialog;
