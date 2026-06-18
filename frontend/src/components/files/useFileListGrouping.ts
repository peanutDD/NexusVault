import { useEffect, useMemo, useRef, useState } from 'react';
import type { FileMetadata } from '../../types/files';
import type { Folder } from '../../types/folders';
import { groupFilesInWorker } from '../../utils/workerPool';
import { FILE_TYPE_LABELS } from './fileTypeLabels';

const GROUP_FILES_WORKER_THRESHOLD = 50;
const PINNED_GROUP_KEY = "pinned";

function isPinnedCollectionActive(activeCollection = "") {
  return activeCollection
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(PINNED_GROUP_KEY);
}

function partitionPinnedFiles(files: FileMetadata[], activeCollection = "") {
  if (isPinnedCollectionActive(activeCollection)) {
    return { pinnedFiles: [], groupableFiles: files };
  }

  const pinnedFiles: FileMetadata[] = [];
  const groupableFiles: FileMetadata[] = [];
  for (const file of files) {
    if (file.is_pinned) {
      pinnedFiles.push(file);
    } else {
      groupableFiles.push(file);
    }
  }
  return { pinnedFiles, groupableFiles };
}

function getTypeKey(mime: string): string {
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

function getTimeGroupInfo(dateStr: string): { key: string; label: string; sortKey: number } {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = `${monthNames[month - 1]} ${day}, ${year}`;
  const sortKey = year * 10000 + month * 100 + day;
  return { key, label, sortKey };
}

export function useFileGroupingWithIcons(
  files: FileMetadata[],
  isGroupByType: boolean,
  activeCollection = "",
) {
  const typeOrderForWorker = useMemo(
    () => Object.fromEntries(Object.entries(FILE_TYPE_LABELS).map(([k, v]) => [k, v.order])),
    []
  );

  const [workerGrouped, setWorkerGrouped] = useState<
    Array<{ key: string; order: number; files: FileMetadata[] }> | null
  >(null);
  const requestIdRef = useRef(0);
  const { pinnedFiles, groupableFiles } = useMemo(
    () => partitionPinnedFiles(files, activeCollection),
    [files, activeCollection],
  );

  useEffect(() => {
    if (groupableFiles.length <= GROUP_FILES_WORKER_THRESHOLD || !isGroupByType) {
      requestIdRef.current += 1;
      return;
    }

    const currentRequestId = ++requestIdRef.current;

    groupFilesInWorker(groupableFiles as Parameters<typeof groupFilesInWorker>[0], typeOrderForWorker)
      .then((result) => {
        if (requestIdRef.current === currentRequestId) {
          setWorkerGrouped(result as Array<{ key: string; order: number; files: FileMetadata[] }>);
        }
      })
      .catch(() => {
        if (requestIdRef.current === currentRequestId) {
          setWorkerGrouped(null);
        }
      });

    return () => {
      requestIdRef.current = currentRequestId + 1;
    };
  }, [groupableFiles, isGroupByType, typeOrderForWorker]);

  const memoGrouped = useMemo(() => {
    if (!isGroupByType) return null;

    const groups = new Map<string, FileMetadata[]>();
    groupableFiles.forEach((file) => {
      const key = getTypeKey(file.mime_type);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(file);
    });

    return Array.from(groups.entries())
      .map(([key, groupFiles]) => ({
        key,
        ...(FILE_TYPE_LABELS[key] ?? FILE_TYPE_LABELS.other),
        files: groupFiles,
      }))
      .sort((a, b) => a.order - b.order);
  }, [groupableFiles, isGroupByType]);

  const groupedFiles = useMemo(() => {
    if (!isGroupByType) return null;
    const pinnedGroup = pinnedFiles.length > 0
      ? [{
          key: PINNED_GROUP_KEY,
          ...FILE_TYPE_LABELS[PINNED_GROUP_KEY],
          files: pinnedFiles,
        }]
      : [];

    if (groupableFiles.length > GROUP_FILES_WORKER_THRESHOLD && workerGrouped) {
      const groups = workerGrouped.map(({ key, files: groupFiles }) => ({
        key,
        ...(FILE_TYPE_LABELS[key] ?? FILE_TYPE_LABELS.other),
        files: groupFiles,
      }));
      return [...pinnedGroup, ...groups];
    }
    return memoGrouped ? [...pinnedGroup, ...memoGrouped] : pinnedGroup;
  }, [isGroupByType, groupableFiles.length, workerGrouped, memoGrouped, pinnedFiles]);

  const displayFiles = useMemo(() => {
    if (!isGroupByType || !groupedFiles) return files;
    return groupedFiles.flatMap((group) => group.files);
  }, [files, isGroupByType, groupedFiles]);

  return {
    groupedFiles,
    displayFiles,
  };
}

export function useTimeGrouping(files: FileMetadata[], isGroupByTime: boolean) {
  const timeGroupedFiles = useMemo(() => {
    if (!isGroupByTime) return null;

    const groups = new Map<string, { label: string; sortKey: number; files: FileMetadata[] }>();

    for (const file of files) {
      const createdAt = file.created_at;
      const { key, label, sortKey } = getTimeGroupInfo(createdAt);
      const existing = groups.get(key);
      if (existing) {
        existing.files.push(file);
      } else {
        groups.set(key, { label, sortKey, files: [file] });
      }
    }

    return Array.from(groups.entries())
      .map(([key, { label, sortKey, files: groupFiles }]) => ({
        key,
        label,
        sortKey,
        files: groupFiles,
      }))
      .sort((a, b) => b.sortKey - a.sortKey);
  }, [files, isGroupByTime]);

  const displayFilesForTime = useMemo(() => {
    if (!isGroupByTime || !timeGroupedFiles) return files;
    return timeGroupedFiles.flatMap((group) => group.files);
  }, [files, isGroupByTime, timeGroupedFiles]);

  return {
    timeGroupedFiles,
    displayFilesForTime,
  };
}

export function useTimeGroupingMixed(
  files: FileMetadata[],
  folders: Folder[],
  isGroupByTime: boolean
) {
  const timeGroupedItems = useMemo(() => {
    if (!isGroupByTime) return null;
    const groups = new Map<
      string,
      { label: string; sortKey: number; files: FileMetadata[]; folders: Folder[] }
    >();

    for (const folder of folders) {
      const { key, label, sortKey } = getTimeGroupInfo(folder.created_at);
      const existing = groups.get(key);
      if (existing) {
        existing.folders.push(folder);
      } else {
        groups.set(key, { label, sortKey, files: [], folders: [folder] });
      }
    }

    for (const file of files) {
      const { key, label, sortKey } = getTimeGroupInfo(file.created_at);
      const existing = groups.get(key);
      if (existing) {
        existing.files.push(file);
      } else {
        groups.set(key, { label, sortKey, files: [file], folders: [] });
      }
    }

    const compareName = (a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    const getTime = (v: string) => {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : 0;
    };

    return Array.from(groups.entries())
      .map(([key, { label, sortKey, files: gFiles, folders: gFolders }]) => {
        const items = [
          ...gFolders.map((folder) => ({ type: 'folder' as const, folder })),
          ...gFiles.map((file) => ({ type: 'file' as const, file })),
        ].sort((a, b) => {
          const at = a.type === 'folder' ? getTime(a.folder.created_at) : getTime(a.file.created_at);
          const bt = b.type === 'folder' ? getTime(b.folder.created_at) : getTime(b.file.created_at);
          const r = bt - at;
          if (r !== 0) return r;
          const an = a.type === 'folder' ? a.folder.name : a.file.original_filename;
          const bn = b.type === 'folder' ? b.folder.name : b.file.original_filename;
          return compareName(an, bn);
        });
        return { key, label, sortKey, files: gFiles, folders: gFolders, items };
      })
      .sort((a, b) => b.sortKey - a.sortKey);
  }, [files, folders, isGroupByTime]);

  return { timeGroupedItems };
}
