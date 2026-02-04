/**
 * 批量请求合并：在时间窗口内收集多个单次请求，合并为一次批量调用。
 * 适用于后端提供批量接口（如 batch get by ids）或需要限制并发单次请求的场景。
 *
 * 修复：
 * - 正确处理 null/undefined 结果
 * - 添加全局清理机制防止内存泄漏
 * - 改进错误处理
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
  private readonly batchFn: (ids: string[]) => Promise<(T | null)[]>;
  private isFlushing = new Set<Key>();

  constructor(batchDelayMs: number, batchFn: (ids: string[]) => Promise<(T | null)[]>) {
    this.batchDelayMs = batchDelayMs;
    this.batchFn = batchFn;
  }

  /**
   * 请求单条数据。相同 key 的请求会在 batchDelayMs 内被合并为一次批量请求。
   * 如果后端返回 null（未找到），会 reject 并抛出错误。
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
    // 防止取消正在执行的批次
    if (this.isFlushing.has(key)) return;

    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }

    const list = this.pending.get(key);
    if (!list || list.length === 0) return;

    this.pending.delete(key);
    this.isFlushing.add(key);

    const ids = list.map((p) => p.id);

    try {
      const results = await this.batchFn(ids);

      // 遍历请求列表，正确映射结果
      list.forEach((p, i) => {
        // 检查索引是否越界
        if (i >= results.length) {
          p.reject(new Error(`Batch result missing for id: ${p.id}`));
          return;
        }

        const value = results[i];

        // 处理 null/undefined 结果（后端返回 null 表示未找到）
        if (value === null || value === undefined) {
          p.reject(new Error(`Item not found: ${p.id}`));
        } else {
          p.resolve(value);
        }
      });
    } catch (err) {
      // 整个批量请求失败，拒绝所有等待者
      list.forEach((p) => p.reject(err));
    } finally {
      this.isFlushing.delete(key);
    }
  }

  /**
   * 取消未发出的批次（用于组件卸载等）
   * 注意：不会取消正在执行的批次
   */
  cancel(key: Key): void {
    // 不取消正在执行的批次
    if (this.isFlushing.has(key)) return;

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

  /**
   * 取消所有未发出的批次（用于全局清理）
   */
  cancelAll(): void {
    // 清理所有定时器
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // 拒绝所有等待中的请求（跳过正在执行的）
    const error = new Error('All batches cancelled');
    for (const [key, list] of this.pending.entries()) {
      if (!this.isFlushing.has(key)) {
        list.forEach((p) => p.reject(error));
      }
    }

    // 只清理非执行中的
    for (const key of this.pending.keys()) {
      if (!this.isFlushing.has(key)) {
        this.pending.delete(key);
      }
    }
  }

  /**
   * 获取当前等待中的请求数量
   */
  get pendingCount(): number {
    let count = 0;
    for (const list of this.pending.values()) {
      count += list.length;
    }
    return count;
  }
}
