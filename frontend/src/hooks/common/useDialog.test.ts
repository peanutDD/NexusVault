import { renderHook, act } from '@testing-library/react';
import { useDialog } from './useDialog';

describe('useDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return dialogRef and handleBackdropClick', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDialog({ open: true, onClose }));

    expect(result.current.dialogRef).toBeDefined();
    expect(typeof result.current.handleBackdropClick).toBe('function');
  });

  it('should call onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    renderHook(() => useDialog({ open: true, onClose }));

    // 模拟按下 ESC
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when Escape key is pressed if closeOnEscape is false', () => {
    const onClose = vi.fn();
    renderHook(() => useDialog({ open: true, onClose, closeOnEscape: false }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should not call onClose when Escape key is pressed during loading', () => {
    const onClose = vi.fn();
    renderHook(() => useDialog({ open: true, onClose, loading: true }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should not do anything when Escape is pressed and dialog is closed', () => {
    const onClose = vi.fn();
    renderHook(() => useDialog({ open: false, onClose }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should call onClose when clicking backdrop', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDialog({ open: true, onClose }));

    // 模拟点击背景 - target 和 currentTarget 需要指向同一个对象
    const mockTarget = {};
    act(() => {
      const mockEvent = { target: mockTarget, currentTarget: mockTarget } as React.MouseEvent;
      result.current.handleBackdropClick(mockEvent);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when clicking backdrop if closeOnBackdrop is false', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useDialog({ open: true, onClose, closeOnBackdrop: false })
    );

    act(() => {
      const mockEvent = { target: {}, currentTarget: {} } as React.MouseEvent;
      result.current.handleBackdropClick(mockEvent);
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should not call onClose when clicking backdrop during loading', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useDialog({ open: true, onClose, loading: true })
    );

    act(() => {
      const mockEvent = { target: {}, currentTarget: {} } as React.MouseEvent;
      result.current.handleBackdropClick(mockEvent);
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should not call onClose when clicking inside dialog (not on backdrop)', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDialog({ open: true, onClose }));

    act(() => {
      const dialogElement = document.createElement('div');
      const backdropElement = document.createElement('div');
      const mockEvent = { target: dialogElement, currentTarget: backdropElement } as unknown as React.MouseEvent;
      result.current.handleBackdropClick(mockEvent);
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should focus autoFocusRef when dialog opens', () => {
    const onClose = vi.fn();
    const mockRef = {
      current: {
        focus: vi.fn(),
      },
    } as unknown as React.RefObject<HTMLElement | null>;

    const { rerender } = renderHook(
      (props) => useDialog({ open: props.open, onClose, autoFocusRef: mockRef }),
      { initialProps: { open: false } }
    );

    // 打开对话框
    rerender({ open: true });

    // 快进时间到延迟后
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(mockRef.current?.focus).toHaveBeenCalledTimes(1);
  });

  it('should use custom focus delay', () => {
    const onClose = vi.fn();
    const mockRef = {
      current: {
        focus: vi.fn(),
      },
    } as unknown as React.RefObject<HTMLElement | null>;

    renderHook(() =>
      useDialog({ open: true, onClose, autoFocusRef: mockRef, focusDelay: 500 })
    );

    // 还没到时间
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(mockRef.current?.focus).not.toHaveBeenCalled();

    // 时间到了
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(mockRef.current?.focus).toHaveBeenCalledTimes(1);
  });

  it('should restore previous focus when dialog closes', () => {
    const onClose = vi.fn();
    const previousButton = document.createElement('button');
    
    // 设置当前聚焦元素
    document.body.appendChild(previousButton);
    
    // 先调用 focus 设置初始焦点
    previousButton.focus();
    
    const spy = vi.spyOn(previousButton, 'focus');
    // 清除 spy 的初始调用计数
    spy.mockClear();

    const { rerender } = renderHook(
      (props) => useDialog({ open: props.open, onClose }),
      { initialProps: { open: true } }
    );

    // 关闭对话框
    rerender({ open: false });

    expect(spy).toHaveBeenCalledTimes(1);

    document.body.removeChild(previousButton);
  });
});
