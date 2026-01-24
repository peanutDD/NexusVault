/**
 * Upload queue with concurrency control. Processes uploads in order with max concurrent limit.
 */
interface QueueItem<T = unknown> {
  id: string;
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export class UploadQueue {
  private queue: QueueItem[] = [];
  private running = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(id: string, task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ id, task, resolve: resolve as (v: unknown) => void, reject });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return;

    this.running++;
    const item = this.queue.shift();
    if (!item) {
      this.running--;
      return;
    }

    try {
      const result = await item.task();
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    } finally {
      this.running--;
      this.process();
    }
  }

  clear(): void {
    this.queue = [];
  }

  get size(): number {
    return this.queue.length;
  }

  get active(): number {
    return this.running;
  }
}
