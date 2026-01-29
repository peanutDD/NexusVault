import { REQUEST } from '../constants';

/**
 * 全局请求限流：同一时刻最多 N 个请求在执行，其余排队。
 * 防止浏览器连接数耗尽、后端瞬时压力过大。
 */
export class RequestLimiter {
  private queue: Array<() => void> = [];
  private running = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent: number = 20) {
    this.maxConcurrent = maxConcurrent;
  }

  async limit<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      try {
        return await fn();
      } finally {
        this.running--;
        this.processQueue();
      }
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        this.running++;
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.running--;
          this.processQueue();
        }
      });
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.running >= this.maxConcurrent) return;
    const next = this.queue.shift();
    if (next) next();
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.running;
  }
}

export const globalRequestLimiter = new RequestLimiter(REQUEST.LIMITER_MAX_CONCURRENT);
