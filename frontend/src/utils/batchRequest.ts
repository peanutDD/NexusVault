/**
 * 批量请求合并：在时间窗口内收集多个单次请求，合并为一次批量调用。
 * 适用于后端提供批量接口（如 batch get by ids）或需要限制并发单次请求的场景。
 */

type Resolve<T> = (value: T) => void;
type Reject = (reason?: unknown) => void;

interface Pending<T> {
  id: string;
  resolve: Resolve<T>;
  reject: Reject;
}

export class BatchRequestManager<T, Key extends string = string> {
  private pending = new Map<Key, Pending<T>[]>();
  private timers = new Map<Key, ReturnType<typeof setTimeout>>();
  private readonly batchDelayMs: number;
  private readonly batchFn: (ids: string[]) => Promise<T[]>;

  constructor(batchDelayMs: number, batchFn: (ids: string[]) => Promise<T[]>) {
    this.batchDelayMs = batchDelayMs;
    this.batchFn = batchFn;
  }

  /**
   * 请求单条数据。相同 key 的请求会在 batchDelayMs 内被合并为一次批量请求。
   */
  request(key: Key, id: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const list = this.pending.get(key) ?? [];
      list.push({ id, resolve, reject });
      this.pending.set(key, list);

      if (!this.timers.has(key)) {
        const timer = setTimeout(() => this.flush(key), this.batchDelayMs);
        this.timers.set(key, timer);
      }
    });
  }

  private async flush(key: Key): Promise<void> {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }

    const list = this.pending.get(key);
    if (!list || list.length === 0) return;

    this.pending.delete(key);
    const ids = list.map((p) => p.id);

    try {
      const results = await this.batchFn(ids);
      list.forEach((p, i) => {
        const value = results[i];
        if (i < results.length) {
          p.resolve(value);
        } else {
          p.reject(new Error('Batch result missing'));
        }
      });
    } catch (err) {
      list.forEach((p) => p.reject(err));
    }
  }

  /** 取消未发出的批次（用于组件卸载等） */
  cancel(key: Key): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    const list = this.pending.get(key);
    if (list) {
      list.forEach((p) => p.reject(new Error('Batch cancelled')));
      this.pending.delete(key);
    }
  }
}
