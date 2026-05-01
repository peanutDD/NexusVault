import { renderHook, act } from '@testing-library/react';
import { useThrottle } from './useThrottle';

describe('useThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useThrottle('hello', 500));
    expect(result.current).toBe('hello');
  });

  it('should update the value after the delay', () => {
    const { result, rerender } = renderHook(
      (props) => useThrottle(props.value, props.delay),
      { initialProps: { value: 'hello', delay: 500 } }
    );

    expect(result.current).toBe('hello');

    // 更新值
    rerender({ value: 'world', delay: 500 });

    // 立即检查，还没更新
    expect(result.current).toBe('hello');

    // 快进时间到延迟后
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('world');
  });

  it('should not update more than once per delay period', () => {
    const { result, rerender } = renderHook(
      (props) => useThrottle(props.value, props.delay),
      { initialProps: { value: 'v1', delay: 500 } }
    );

    // 第一次更新
    rerender({ value: 'v2', delay: 500 });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('v1');

    // 在延迟期内再次更新
    rerender({ value: 'v3', delay: 500 });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('v1');

    // 再一次更新
    rerender({ value: 'v4', delay: 500 });
    act(() => vi.advanceTimersByTime(300));

    // 现在应该是 v4（trailing）
    expect(result.current).toBe('v4');
  });

  it('should use the latest value when throttling multiple updates', () => {
    const { result, rerender } = renderHook(
      (props) => useThrottle(props.value, props.delay),
      { initialProps: { value: 'start', delay: 500 } }
    );

    // 连续多次更新
    rerender({ value: 'update1', delay: 500 });
    act(() => vi.advanceTimersByTime(100));

    rerender({ value: 'update2', delay: 500 });
    act(() => vi.advanceTimersByTime(100));

    rerender({ value: 'final', delay: 500 });

    // 剩余时间
    act(() => vi.advanceTimersByTime(300));

    // 应该使用最后一次的值
    expect(result.current).toBe('final');
  });

  it('should work with different types', () => {
    // Number
    const { result: numResult, rerender: numRerender } = renderHook(
      (props) => useThrottle(props.value, props.delay),
      { initialProps: { value: 1, delay: 500 } }
    );
    numRerender({ value: 2, delay: 500 });
    act(() => vi.advanceTimersByTime(500));
    expect(numResult.current).toBe(2);

    // Boolean
    const { result: boolResult, rerender: boolRerender } = renderHook(
      (props) => useThrottle(props.value, props.delay),
      { initialProps: { value: true, delay: 500 } }
    );
    boolRerender({ value: false, delay: 500 });
    act(() => vi.advanceTimersByTime(500));
    expect(boolResult.current).toBe(false);

    // Object
    const obj1 = { key: 'value1' };
    const obj2 = { key: 'value2' };
    const { result: objResult, rerender: objRerender } = renderHook(
      (props) => useThrottle(props.value, props.delay),
      { initialProps: { value: obj1, delay: 500 } }
    );
    objRerender({ value: obj2, delay: 500 });
    act(() => vi.advanceTimersByTime(500));
    expect(objResult.current).toEqual(obj2);
  });

  it('should respect different delay values', () => {
    const { result, rerender } = renderHook(
      (props) => useThrottle(props.value, props.delay),
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
