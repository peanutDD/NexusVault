import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileMetadata } from '../../types/files';
import type { Folder } from '../../types/folders';

type DeleteConfirm =
  | { type: 'file'; id?: string }
  | { type: 'folder'; id?: string }
  | { type: 'batch' }
  | null;

interface UseFileListOptimisticDeleteParams {
  files: FileMetadata[];
  displayFolders: Folder[];
  deleteConfirm: DeleteConfirm;
  selectedFileIds: string[];
  selectedFolderIds: string[];
  executeDelete: () => Promise<void>;
}

export function useFileListOptimisticDelete({
  files,
  displayFolders,
  deleteConfirm,
  selectedFileIds,
  selectedFolderIds,
  executeDelete,
}: UseFileListOptimisticDeleteParams) {
  const [pendingDeleteFileIds, setPendingDeleteFileIds] = useState<Set<string>>(new Set());
  const [pendingDeleteFolderIds, setPendingDeleteFolderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (pendingDeleteFileIds.size === 0) return;
    const currentIds = new Set(files.map((f) => f.id));
    const reappeared = [...pendingDeleteFileIds].filter((id) => currentIds.has(id));
    if (reappeared.length === 0) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setPendingDeleteFileIds((prev) => {
        const n = new Set(prev);
        reappeared.forEach((id) => n.delete(id));
        return n;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [files, pendingDeleteFileIds]);

  const executeDeleteWithHide = useCallback(async () => {
    const snap = deleteConfirm;
    if (snap?.type === 'file' && snap.id) {
      setPendingDeleteFileIds((prev) => new Set([...prev, snap.id!]));
    } else if (snap?.type === 'folder' && snap.id) {
      setPendingDeleteFolderIds((prev) => new Set([...prev, snap.id!]));
    } else if (snap?.type === 'batch') {
      if (selectedFileIds.length > 0)
        setPendingDeleteFileIds((prev) => new Set([...prev, ...selectedFileIds]));
      if (selectedFolderIds.length > 0)
        setPendingDeleteFolderIds((prev) => new Set([...prev, ...selectedFolderIds]));
    }
    await executeDelete();
  }, [deleteConfirm, executeDelete, selectedFileIds, selectedFolderIds]);

  const outFiles = useMemo(
    () =>
      pendingDeleteFileIds.size > 0
        ? files.filter((f) => !pendingDeleteFileIds.has(f.id))
        : files,
    [files, pendingDeleteFileIds],
  );

  const outFolders = useMemo(
    () =>
      pendingDeleteFolderIds.size > 0
        ? displayFolders.filter((f) => !pendingDeleteFolderIds.has(f.id))
        : displayFolders,
    [displayFolders, pendingDeleteFolderIds],
  );

  const outFoldersRef = useRef<Folder[]>(displayFolders);

  useEffect(() => {
    outFoldersRef.current = displayFolders;
  }, [displayFolders]);

  useEffect(() => {
    if (pendingDeleteFolderIds.size === 0) return;
    const currentIds = new Set(outFoldersRef.current.map((f) => f.id));
    const reappeared = [...pendingDeleteFolderIds].filter((id) => currentIds.has(id));
    if (reappeared.length === 0) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setPendingDeleteFolderIds((prev) => {
        const n = new Set(prev);
        reappeared.forEach((id) => n.delete(id));
        return n;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [pendingDeleteFolderIds]);

  return {
    files: outFiles,
    folders: outFolders,
    executeDelete: executeDeleteWithHide,
  };
}
