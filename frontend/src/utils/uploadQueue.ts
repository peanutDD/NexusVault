import { UPLOAD_QUEUE } from '../constants';

/**
 * 单条队列项：支持优先级与成本（大文件占更多并发槽位）
 */
interface QueueItem<T = unknown> {
  id: string;
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  /** 优先级：数值越大越先执行，默认 0 */
  priority: number;
  /** 并发成本：小文件 1，大文件 3，同时运行总成本不超过 maxCost */
  cost: number;
}

export interface UploadQueueAddOptions {
  /** 优先级：越大越先上传，默认 0 */
  priority?: number;
  /** 文件大小（字节），用于计算 cost：≥ 阈值视为大文件 cost=3，否则 cost=1 */
  fileSize?: number;
}

/**
 * 上传队列：按成本限制并发（大文件降低并发），支持优先级（重要文件优先）
 */
export class UploadQueue {
  private queue: QueueItem[] = [];
  private runningCost = 0;
  private readonly maxCost: number;
  private readonly largeThreshold: number;

  constructor(maxCost = UPLOAD_QUEUE.MAX_COST, largeThresholdBytes = UPLOAD_QUEUE.LARGE_FILE_THRESHOLD_BYTES) {
    this.maxCost = maxCost;
    this.largeThreshold = largeThresholdBytes;
  }

  private costForFileSize(fileSize?: number): number {
    if (fileSize == null || fileSize < this.largeThreshold) return 1;
    return 3;
  }

  /**
   * 加入队列。priority 越大越先执行；fileSize 用于计算 cost（大文件占 3 成本，小文件 1）。
   */
  async add<T>(
    id: string,
    task: () => Promise<T>,
    options?: UploadQueueAddOptions
  ): Promise<T> {
    const priority = options?.priority ?? 0;
    const cost = this.costForFileSize(options?.fileSize);

    console.log('[UploadQueue.add] id:', id, 'priority:', priority, 'cost:', cost, 'queueSize:', this.queue.length, 'runningCost:', this.runningCost);

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id,
        task,
        resolve: resolve as (v: unknown) => void,
        reject,
        priority,
        cost,
      });
      this.process();
    });
  }

  /** 选出下一个可执行项：优先级最高且 runningCost + cost <= maxCost */
  private pickNext(): QueueItem | null {
    if (this.queue.length === 0) return null;
    let best: QueueItem | null = null;
    let bestIndex = -1;
    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (item && this.runningCost + item.cost <= this.maxCost) {
        if (best == null || item.priority > best.priority) {
          best = item;
          bestIndex = i;
        }
      }
    }
    if (best != null && bestIndex >= 0) {
      this.queue.splice(bestIndex, 1);
      return best;
    }
    return null;
  }

  private async process(): Promise<void> {
    const item = this.pickNext();
    console.log('[UploadQueue.process] picked item:', item?.id ?? 'null', 'queueSize:', this.queue.length, 'runningCost:', this.runningCost);
    if (!item) return;

    this.runningCost += item.cost;
    const cost = item.cost;
    console.log('[UploadQueue.process] starting task:', item.id, 'runningCost:', this.runningCost);

    try {
      const result = await item.task();
      console.log('[UploadQueue.process] task completed:', item.id);
      item.resolve(result);
    } catch (err) {
      console.log('[UploadQueue.process] task failed:', item.id, err);
      item.reject(err);
    } finally {
      this.runningCost -= cost;
      console.log('[UploadQueue.process] task finished:', item.id, 'runningCost:', this.runningCost);
      this.process();
    }
  }

  clear(): void {
    this.queue = [];
  }

  get size(): number {
    return this.queue.length;
  }

  /** 当前运行中的总成本（1–maxCost） */
  get activeCost(): number {
    return this.runningCost;
  }
}
