import { UPLOAD_QUEUE } from '../constants';

const PROCESS_LOOP_DEFER_MS = 0;

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
  /** 是否已被取消 */
  cancelled: boolean;
}

export interface UploadQueueAddOptions {
  /** 优先级：越大越先上传，默认 0 */
  priority?: number;
  /** 文件大小（字节），用于计算 cost：≥ 阈值视为大文件 cost=3，否则 cost=1 */
  fileSize?: number;
}

/**
 * 最大堆实现：按 priority 排序
 * 修复：使用堆实现 O(log n) 的优先级调度，替代 O(n) 遍历
 */
class MaxHeap<T extends { priority: number }> {
  private heap: T[] = [];

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * 插入元素，O(log n)
   */
  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * 查看堆顶元素（不移除），O(1)
   */
  peek(): T | undefined {
    return this.heap[0];
  }

  /**
   * 移除并返回堆顶元素，O(log n)
   */
  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const result = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return result;
  }

  /**
   * 从堆中移除指定元素（按引用比较），O(n)
   * 用于取消任务
   */
  remove(item: T): boolean {
    const index = this.heap.indexOf(item);
    if (index === -1) return false;

    if (index === this.heap.length - 1) {
      this.heap.pop();
      return true;
    }

    this.heap[index] = this.heap.pop()!;
    // 可能需要上浮或下沉
    const parent = Math.floor((index - 1) / 2);
    if (index > 0 && this.heap[index].priority > this.heap[parent].priority) {
      this.bubbleUp(index);
    } else {
      this.bubbleDown(index);
    }
    return true;
  }

  /**
   * 清空堆
   */
  clear(): void {
    this.heap = [];
  }

  /**
   * 获取所有元素（用于遍历，如检查 cost）
   */
  toArray(): T[] {
    return [...this.heap];
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[index].priority <= this.heap[parent].priority) break;
      [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let largest = index;

      if (left < length && this.heap[left].priority > this.heap[largest].priority) {
        largest = left;
      }
      if (right < length && this.heap[right].priority > this.heap[largest].priority) {
        largest = right;
      }

      if (largest === index) break;

      [this.heap[index], this.heap[largest]] = [this.heap[largest], this.heap[index]];
      index = largest;
    }
  }
}

/**
 * 上传队列：按成本限制并发（大文件降低并发），支持优先级（重要文件优先）
 *
 * 修复：
 * - 使用最大堆实现 O(log n) 的优先级调度
 * - 添加队列大小限制
 * - 添加任务取消机制
 * - 使用 setTimeout 代替递归，避免栈溢出
 */
export class UploadQueue {
  private heap = new MaxHeap<QueueItem>();
  private itemsById = new Map<string, QueueItem>();
  private runningCost = 0;
  private readonly maxCost: number;
  private readonly largeThreshold: number;
  private readonly maxQueueSize: number;
  private isProcessing = false;

  constructor(
    maxCost = UPLOAD_QUEUE.MAX_COST,
    largeThresholdBytes = UPLOAD_QUEUE.LARGE_FILE_THRESHOLD_BYTES,
    maxQueueSize = 1000
  ) {
    this.maxCost = maxCost;
    this.largeThreshold = largeThresholdBytes;
    this.maxQueueSize = maxQueueSize;
  }

  private costForFileSize(fileSize?: number): number {
    if (fileSize == null || fileSize < this.largeThreshold) return 1;
    return 3;
  }

  /**
   * 加入队列。priority 越大越先执行；fileSize 用于计算 cost（大文件占 3 成本，小文件 1）。
   * 返回的 Promise 可以通过 cancel(id) 取消。
   */
  async add<T>(
    id: string,
    task: () => Promise<T>,
    options?: UploadQueueAddOptions
  ): Promise<T> {
    // 队列大小限制
    if (this.heap.size >= this.maxQueueSize) {
      return Promise.reject(new Error('Upload queue is full'));
    }

    // 如果已存在相同 id 的任务，拒绝添加
    if (this.itemsById.has(id)) {
      return Promise.reject(new Error(`Task with id "${id}" already exists`));
    }

    const priority = options?.priority ?? 0;
    const cost = this.costForFileSize(options?.fileSize);

    return new Promise<T>((resolve, reject) => {
      const item: QueueItem = {
        id,
        task,
        resolve: resolve as (v: unknown) => void,
        reject,
        priority,
        cost,
        cancelled: false,
      };

      this.heap.push(item);
      this.itemsById.set(id, item);
      this.scheduleProcess();
    });
  }

  /**
   * 取消指定任务
   * 如果任务还在队列中，会被移除并 reject
   * 如果任务正在执行，会立即 reject 队列 Promise；调用方仍需中止底层网络请求
   */
  cancel(id: string): boolean {
    const item = this.itemsById.get(id);
    if (!item) return false;

    // 标记为已取消
    item.cancelled = true;

    // 从堆中移除
    if (this.heap.remove(item)) {
      this.itemsById.delete(id);
      item.reject(new DOMException('Task cancelled', 'AbortError'));
      return true;
    }

    item.reject(new DOMException('Task cancelled', 'AbortError'));
    return true;
  }

  /**
   * 使用 setTimeout 调度处理，避免递归栈溢出
   */
  private scheduleProcess(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    setTimeout(() => this.processLoop(), PROCESS_LOOP_DEFER_MS);
  }

  /**
   * 处理循环：在 cost 容量内尽可能多地启动任务（并行），每个任务完成后再调度下一批
   */
  private processLoop(): void {
    while (true) {
      const item = this.pickNext();
      if (!item) {
        this.isProcessing = false;
        return;
      }

      if (item.cancelled) continue;

      const cost = item.cost;
      this.runningCost += cost;

      item
        .task()
        .then((result) => {
          if (!item.cancelled) item.resolve(result);
        })
        .catch((err) => {
          if (!item.cancelled) item.reject(err);
        })
        .finally(() => {
          this.runningCost -= cost;
          this.itemsById.delete(item.id);
          this.scheduleProcess();
        });
    }
  }

  /**
   * 选出下一个可执行项：优先级最高且 runningCost + cost <= maxCost
   * 使用堆实现 O(log n) 复杂度（最坏情况下需要检查多个元素）
   */
  private pickNext(): QueueItem | null {
    // 尝试取出堆顶
    const top = this.heap.peek();
    if (!top) return null;

    // 检查是否有足够的 cost 容量
    if (this.runningCost + top.cost <= this.maxCost) {
      return this.heap.pop()!;
    }

    // 堆顶 cost 太大，检查是否有更小 cost 的任务可以执行
    // 这需要遍历堆，但只在 cost 受限时发生
    const items = this.heap.toArray();
    let bestItem: QueueItem | null = null;
    let bestPriority = -Infinity;

    for (const item of items) {
      if (this.runningCost + item.cost <= this.maxCost) {
        if (item.priority > bestPriority) {
          bestPriority = item.priority;
          bestItem = item;
        }
      }
    }

    if (bestItem) {
      this.heap.remove(bestItem);
      return bestItem;
    }

    return null;
  }

  /**
   * 清空队列，拒绝所有等待和运行中的队列 Promise
   */
  clear(): void {
    const error = new DOMException('Queue cleared', 'AbortError');
    const items = Array.from(this.itemsById.values());
    for (const item of items) {
      item.cancelled = true;
      item.reject(error);
    }
    this.heap.clear();
    this.itemsById.clear();
  }

  get size(): number {
    return this.heap.size;
  }

  /** 当前运行中的总成本（1–maxCost） */
  get activeCost(): number {
    return this.runningCost;
  }

  /** 检查指定任务是否在队列中 */
  has(id: string): boolean {
    return this.itemsById.has(id);
  }
}
