import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigationType, type SetURLSearchParams } from 'react-router-dom';

interface UseFileListNavigationParams {
  currentFolderId: string | null;
  debouncedSearch: string;
  mimeType: string;
  sortBy: string;
  loadingFiles: boolean;
  loadingFolders: boolean;
  setSearchParams: SetURLSearchParams;
  setSelectedFiles: (value: Set<string>) => void;
  setSelectedFolders: (value: Set<string>) => void;
}

export function useFileListNavigation({
  currentFolderId,
  debouncedSearch,
  mimeType,
  sortBy,
  loadingFiles,
  loadingFolders,
  setSearchParams,
  setSelectedFiles,
  setSelectedFolders,
}: UseFileListNavigationParams) {
  const navType = useNavigationType();
  const location = useLocation();
  const lastScrollAppliedLocationKeyRef = useRef<string | null>(null);

  const getScrollStorageKey = useCallback(
    (folderId: string | null) => {
      const folderKey = folderId ?? 'root';
      const q = (debouncedSearch ?? '').trim();
      const mimeKey = mimeType || 'all';
      return `fileListScroll:${folderKey}:${sortBy}:${mimeKey}:${q}`;
    },
    [debouncedSearch, mimeType, sortBy]
  );

  const navigateToFolder = useCallback((folderId: string | null) => {
    try {
      const key = getScrollStorageKey(currentFolderId);
      sessionStorage.setItem(key, String(window.scrollY || 0));
    } catch {
      /* ignore */
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (folderId) {
          next.set('folder', folderId);
        } else {
          next.delete('folder');
        }
        return next;
      },
      { replace: false }
    );
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    });
  }, [
    setSearchParams,
    setSelectedFiles,
    setSelectedFolders,
    currentFolderId,
    getScrollStorageKey,
  ]);

  useEffect(() => {
    if (loadingFiles || loadingFolders) return;
    const key = getScrollStorageKey(currentFolderId);
    if (lastScrollAppliedLocationKeyRef.current === location.key) return;
    lastScrollAppliedLocationKeyRef.current = location.key;

    if (navType !== 'POP') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        });
      });
      return;
    }

    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(key);
    } catch {
      raw = null;
    }
    if (!raw) return;
    const y = Number.parseInt(raw, 10);
    if (!Number.isFinite(y) || y < 0) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: 'auto' });
      });
    });
  }, [currentFolderId, getScrollStorageKey, loadingFiles, loadingFolders, navType, location.key]);

  return {
    navigateToFolder,
  };
}
