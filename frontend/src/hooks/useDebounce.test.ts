import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 500));
    expect(result.current).toBe('hello');
  });

  it('should update the value after the delay', () => {
    const { result, rerender } = renderHook(
      (props) => useDebounce(props.value, props.delay),
      { initialProps: { value: 'hello', delay: 500 } }
    );

    expect(result.current).toBe('hello');

    // 更新值
    rerender({ value: 'world', delay: 500 });
    expect(result.current).toBe('hello'); // 还没更新

    // 快进时间
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('world');
  });

  it('should cancel previous timeout and reset the delay', () => {
    const { result, rerender } = renderHook(
      (props) => useDebounce(props.value, props.delay),
      { initialProps: { value: 'hello', delay: 500 } }
    );

    // 第一次更新
    rerender({ value: 'world', delay: 500 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('hello'); // 时间不够

    // 再次更新
    rerender({ value: 'test', delay: 500 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('hello'); // 时间又不够

    // 完成剩余时间
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('test');
  });

  it('should work with different types', () => {
    // Number
    const { result: numResult, rerender: numRerender } = renderHook(
      (props) => useDebounce(props.value, props.delay),
      { initialProps: { value: 1, delay: 500 } }
    );
    expect(numResult.current).toBe(1);
    numRerender({ value: 2, delay: 500 });
    act(() => vi.advanceTimersByTime(500));
    expect(numResult.current).toBe(2);

    // Boolean
    const { result: boolResult, rerender: boolRerender } = renderHook(
      (props) => useDebounce(props.value, props.delay),
      { initialProps: { value: true, delay: 500 } }
    );
    expect(boolResult.current).toBe(true);
    boolRerender({ value: false, delay: 500 });
    act(() => vi.advanceTimersByTime(500));
    expect(boolResult.current).toBe(false);

    // Object
    const obj1 = { key: 'value1' };
    const obj2 = { key: 'value2' };
    const { result: objResult, rerender: objRerender } = renderHook(
      (props) => useDebounce(props.value, props.delay),
      { initialProps: { value: obj1, delay: 500 } }
    );
    expect(objResult.current).toEqual(obj1);
    objRerender({ value: obj2, delay: 500 });
    act(() => vi.advanceTimersByTime(500));
    expect(objResult.current).toEqual(obj2);
  });

  it('should respect different delay values', () => {
    const { result, rerender } = renderHook(
      (props) => useDebounce(props.value, props.delay),
      { initialProps: { value: 'hello', delay: 100 } }
    );

    // 短延迟
    rerender({ value: 'world', delay: 100 });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('world');

    // 更长的延迟
    rerender({ value: 'test', delay: 1000 });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe('test');
  });
});
