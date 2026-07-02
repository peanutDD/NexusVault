/**
 * Web Worker 池管理器
 * 复用 Worker 实例，避免频繁创建/销毁的开销
 *
 * 修复：Worker 不再每次消息后 terminate，而是复用
 */

type WorkerTask<T, R> = {
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
};

interface PooledWorker<T, R> {
  worker: Worker;
  busy: boolean;
  currentTask: WorkerTask<T, R> | null;
}

export class WorkerPool<T, R> {
  private workers: PooledWorker<T, R>[] = [];
  private taskQueue: WorkerTask<T, R>[] = [];
  private readonly maxWorkers: number;
  private readonly createWorker: () => Worker;
  private terminated = false;

  /**
   * 创建 Worker 池
   * @param createWorker Worker 创建函数
   * @param maxWorkers 最大 Worker 数量（默认等于 CPU 核心数，最多 4）
   */
  constructor(createWorker: () => Worker, maxWorkers?: number) {
    this.createWorker = createWorker;
    this.maxWorkers = maxWorkers ?? Math.min(navigator.hardwareConcurrency ?? 2, 4);
  }

  /**
   * 执行任务
   * @param data 任务数据
   * @returns 任务结果
   */
  execute(data: T): Promise<R> {
    if (this.terminated) {
      return Promise.reject(new Error('Worker pool has been terminated'));
    }

    return new Promise<R>((resolve, reject) => {
      const task: WorkerTask<T, R> = { data, resolve, reject };

      // 尝试找一个空闲的 Worker
      const idleWorker = this.workers.find((w) => !w.busy);
      if (idleWorker) {
        this.runTask(idleWorker, task);
        return;
      }

      // 如果还没达到最大 Worker 数，创建新的
      if (this.workers.length < this.maxWorkers) {
        const pooledWorker = this.createPooledWorker();
        this.workers.push(pooledWorker);
        this.runTask(pooledWorker, task);
        return;
      }

      // 否则加入队列等待
      this.taskQueue.push(task);
    });
  }

  /**
   * 创建带包装的 Worker
   */
  private createPooledWorker(): PooledWorker<T, R> {
    const worker = this.createWorker();
    const pooledWorker: PooledWorker<T, R> = {
      worker,
      busy: false,
      currentTask: null,
    };

    worker.onmessage = (e: MessageEvent<R>) => {
      const task = pooledWorker.currentTask;
      if (task) {
        task.resolve(e.data);
      }
      this.onWorkerDone(pooledWorker);
    };

    worker.onerror = (e: ErrorEvent) => {
      const task = pooledWorker.currentTask;
      if (task) {
        task.reject(new Error(e.message || 'Worker error'));
      }
      this.onWorkerDone(pooledWorker);
    };

    return pooledWorker;
  }

  /**
   * 在指定 Worker 上运行任务
   */
  private runTask(pooledWorker: PooledWorker<T, R>, task: WorkerTask<T, R>): void {
    pooledWorker.busy = true;
    pooledWorker.currentTask = task;
    pooledWorker.worker.postMessage(task.data);
  }

  /**
   * Worker 完成任务后的处理
   */
  private onWorkerDone(pooledWorker: PooledWorker<T, R>): void {
    pooledWorker.busy = false;
    pooledWorker.currentTask = null;

    // 检查队列中是否有等待的任务
    const nextTask = this.taskQueue.shift();
    if (nextTask) {
      this.runTask(pooledWorker, nextTask);
    }
  }

  /**
   * 获取池状态（用于调试/监控）
   */
  getStats(): { totalWorkers: number; busyWorkers: number; queuedTasks: number } {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.workers.filter((w) => w.busy).length,
      queuedTasks: this.taskQueue.length,
    };
  }

  /**
   * 终止所有 Worker
   */
  terminate(): void {
    this.terminated = true;

    // 拒绝所有队列中的任务
    const error = new Error('Worker pool terminated');
    for (const task of this.taskQueue) {
      task.reject(error);
    }
    this.taskQueue = [];

    // 终止所有 Worker
    for (const pooledWorker of this.workers) {
      if (pooledWorker.currentTask) {
        pooledWorker.currentTask.reject(error);
      }
      pooledWorker.worker.terminate();
    }
    this.workers = [];
  }
}

// ============== groupFiles Worker 池单例 ==============

import type { FileMetadataWorker, GroupedResultItem } from '../workers/groupFiles.worker';

type GroupFilesInput = { files: FileMetadataWorker[]; typeOrder: Record<string, number> };
type GroupFilesOutput = GroupedResultItem[];

let groupFilesPool: WorkerPool<GroupFilesInput, GroupFilesOutput> | null = null;

/**
 * 获取 groupFiles Worker 池单例
 */
export function getGroupFilesWorkerPool(): WorkerPool<GroupFilesInput, GroupFilesOutput> {
  if (!groupFilesPool) {
    groupFilesPool = new WorkerPool<GroupFilesInput, GroupFilesOutput>(
      () =>
        new Worker(new URL('../workers/groupFiles.worker.ts', import.meta.url), { type: 'module' }),
      2 // 文件分组通常不需要太多并发
    );
  }
  return groupFilesPool;
}

/**
 * 执行文件分组（使用 Worker 池）
 */
export function groupFilesInWorker(
  files: FileMetadataWorker[],
  typeOrder: Record<string, number>
): Promise<GroupFilesOutput> {
  return getGroupFilesWorkerPool().execute({ files, typeOrder });
}
