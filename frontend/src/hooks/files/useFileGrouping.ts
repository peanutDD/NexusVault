import { useState, useMemo, useEffect } from 'react';
import type { FileMetadata } from '../../types/files';

/** 超过该数量时在 Worker 中分组，避免主线程卡顿 */
const GROUP_FILES_WORKER_THRESHOLD = 50;
const DEFER_WORKER_GROUP_RESET_MS = 0;

/**
 * 文件类型标签配置（简化版，用于 Worker）
 * 注意：完整版带 JSX 的在 components/files/fileTypeLabels.tsx
 */
export const FILE_TYPE_LABELS_SIMPLE: Record<string, { label: string; order: number }> = {
  image: { label: '图片', order: 1 },
  gif: { label: 'GIF', order: 2 },
  video: { label: '视频', order: 3 },
  audio: { label: '音频', order: 4 },
  'application/pdf': { label: 'PDF', order: 5 },
  text: { label: '文本', order: 6 },
  'application/zip': { label: '压缩包', order: 7 },
  application: { label: '应用', order: 8 },
  other: { label: '其他', order: 99 },
};

/**
 * 获取文件类型键
 */
export function getTypeKey(mime: string): string {
  if (mime.toLowerCase().startsWith('image/gif')) return 'gif';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'application/pdf';
  if (mime.startsWith('text/')) return 'text';
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'application/zip';
  if (mime.startsWith('application/')) return 'application';
  return 'other';
}

export interface FileGroup {
  key: string;
  label: string;
  order: number;
  files: FileMetadata[];
}

interface UseFileGroupingReturn {
  /** 分组后的文件列表 */
  groupedFiles: FileGroup[] | null;
  /** 显示用的文件列表（分组时平铺） */
  displayFiles: FileMetadata[];
  /** 文件 ID 到索引的映射 */
  displayFileIndexById: Map<string, number>;
}

/**
 * 文件分组 Hook
 * 支持按类型分组显示，大文件数量使用 Web Worker 处理
 */
export function useFileGrouping(
  files: FileMetadata[],
  isGroupByType: boolean
): UseFileGroupingReturn {
  const typeOrderForWorker = useMemo(
    () => Object.fromEntries(Object.entries(FILE_TYPE_LABELS_SIMPLE).map(([k, v]) => [k, v.order])),
    []
  );

  const [workerGrouped, setWorkerGrouped] = useState<
    Array<{ key: string; order: number; files: FileMetadata[] }> | null
  >(null);

  // 使用 Web Worker 处理大量文件的分组
  useEffect(() => {
    // 不需要 Worker 时，提前返回（不在 effect 中同步设置状态）
    if (files.length <= GROUP_FILES_WORKER_THRESHOLD || !isGroupByType) {
      return;
    }
    
    let isCancelled = false;
    const worker = new Worker(
      new URL('../../workers/groupFiles.worker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.postMessage({ files, typeOrder: typeOrderForWorker });
    worker.onmessage = (e: MessageEvent<Array<{ key: string; order: number; files: FileMetadata[] }>>) => {
      if (!isCancelled) {
        setWorkerGrouped(e.data);
      }
      worker.terminate();
    };
    worker.onerror = () => {
      if (!isCancelled) {
        setWorkerGrouped(null);
      }
      worker.terminate();
    };
    return () => {
      isCancelled = true;
      worker.terminate();
    };
  }, [files, isGroupByType, typeOrderForWorker]);

  // 当不需要分组时，重置 workerGrouped（使用单独的 effect 避免同步 setState 警告）
  useEffect(() => {
    if (files.length <= GROUP_FILES_WORKER_THRESHOLD || !isGroupByType) {
      // 使用 setTimeout 避免同步 setState
      const timer = setTimeout(
        () => setWorkerGrouped(null),
        DEFER_WORKER_GROUP_RESET_MS,
      );
      return () => clearTimeout(timer);
    }
  }, [files.length, isGroupByType]);

  // 主线程分组（小文件数量）
  const memoGrouped = useMemo(() => {
    if (!isGroupByType) return null;

    const groups = new Map<string, FileMetadata[]>();
    files.forEach((file) => {
      const key = getTypeKey(file.mime_type);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(file);
    });

    return Array.from(groups.entries())
      .map(([key, groupFiles]) => ({
        key,
        ...(FILE_TYPE_LABELS_SIMPLE[key] ?? FILE_TYPE_LABELS_SIMPLE.other),
        files: groupFiles,
      }))
      .sort((a, b) => a.order - b.order);
  }, [files, isGroupByType]);

  // 选择 Worker 结果或主线程结果
  const groupedFiles = useMemo(() => {
    if (!isGroupByType) return null;
    if (files.length > GROUP_FILES_WORKER_THRESHOLD && workerGrouped) {
      return workerGrouped.map(({ key, files: groupFiles }) => ({
        key,
        ...(FILE_TYPE_LABELS_SIMPLE[key] ?? FILE_TYPE_LABELS_SIMPLE.other),
        files: groupFiles,
      }));
    }
    return memoGrouped;
  }, [isGroupByType, files.length, workerGrouped, memoGrouped]);

  // 显示用的文件列表
  const displayFiles = useMemo(() => {
    if (!isGroupByType || !groupedFiles) return files;
    return groupedFiles.flatMap((group) => group.files);
  }, [files, isGroupByType, groupedFiles]);

  // 文件 ID 到索引的映射
  const displayFileIndexById = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < displayFiles.length; i += 1) {
      m.set(displayFiles[i]!.id, i);
    }
    return m;
  }, [displayFiles]);

  return {
    groupedFiles,
    displayFiles,
    displayFileIndexById,
  };
}

export default useFileGrouping;
