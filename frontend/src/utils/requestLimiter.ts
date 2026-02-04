import { REQUEST } from '../constants';

/**
 * 全局请求限流：同一时刻最多 N 个请求在执行，其余排队。
 * 防止浏览器连接数耗尽、后端瞬时压力过大。
 *
 * 修复：确保 running 计数器在正确的时机更新，避免竞态条件。
 * - 直接执行时：先 running++，再执行
 * - 从队列取出时：先 running++，再调用任务
 */
export class RequestLimiter {
  private queue: Array<{
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }> = [];
  private running = 0;
  private readonly maxConcurrent: number;
  private readonly maxQueueSize: number;

  constructor(maxConcurrent: number = 20, maxQueueSize: number = 1000) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueueSize = maxQueueSize;
  }

  async limit<T>(fn: () => Promise<T>): Promise<T> {
    // 同步检查并递增，确保原子性（JavaScript 单线程内同步代码不会被打断）
    if (this.running < this.maxConcurrent) {
      this.running++;
      try {
        return await fn();
      } finally {
        this.running--;
        this.processQueue();
      }
    }

    // 队列大小限制，防止内存无限增长
    if (this.queue.length >= this.maxQueueSize) {
      return Promise.reject(new Error('Request queue is full'));
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.running >= this.maxConcurrent) return;

    const item = this.queue.shift();
    if (!item) return;

    // 先递增 running，再执行任务，确保计数正确
    this.running++;

    item
      .fn()
      .then((result) => {
        item.resolve(result);
      })
      .catch((err) => {
        item.reject(err);
      })
      .finally(() => {
        this.running--;
        this.processQueue();
      });
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.running;
  }

  /**
   * 清空队列（拒绝所有等待中的请求）
   */
  clear(): void {
    const error = new Error('Request queue cleared');
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) item.reject(error);
    }
  }
}

export const globalRequestLimiter = new RequestLimiter(REQUEST.LIMITER_MAX_CONCURRENT);
