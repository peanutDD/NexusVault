/**
 * 文件状态管理
 * 使用 Zustand 集中管理文件相关的所有状态
 */
import { create } from 'zustand';
import { fileService } from '../services/files';

import { getCachedFileList, setCachedFileList } from '../utils/fileListCache';
import { isRequestCanceled, getErrorMessage } from '../utils/error';
import { FILE_LIST } from '../constants';
import type { FileMetadata, FileListQuery, Folder } from '../types';

/**
 * 文件状态接口
 */
interface FileState {
  // 文件列表状态
  files: FileMetadata[];
  loading: boolean;
  error: string | null;
  loadedPageCount: number;
  loadingMore: boolean;
  total: number;
  isRevalidating: boolean;

  // 文件夹状态
  currentFolderId: string | null;
  folders: Folder[];
  folderPath: Folder[];
  loadingFolders: boolean;

  // 过滤器和排序
  search: string;
  mimeType: string;
  sortBy: string;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  debouncedSearch: string;

  // 选择状态
  selectedFiles: Set<string>;
  selectedFolders: Set<string>;
  allFilesSelected: boolean;

  // 对话框状态
  previewFile: FileMetadata | null;
  shareFile: FileMetadata | null;
  showBatchShare: boolean;
  batchShareFileIds: string[];
  showBatchMove: boolean;
  showCreateFolder: boolean;
  renamingFolder: Folder | null;
  deleteConfirm: {
    type: 'file' | 'folder' | 'batch';
    id?: string;
    name?: string;
    fileCount?: number;
    folderCount?: number;
  } | null;
  deleteLoading: boolean;
  batchDownloading: boolean;

  // 操作方法
  setSearch: (search: string) => void;
  setMimeType: (mimeType: string) => void;
  setSortBy: (sortBy: string) => void;
  setSortField: (field: string) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setDebouncedSearch: (search: string) => void;
  
  toggleSelectFile: (fileId: string) => void;
  toggleSelectFolder: (folderId: string) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  
  setPreviewFile: (file: FileMetadata | null) => void;
  setShareFile: (file: FileMetadata | null) => void;
  setShowBatchShare: (show: boolean) => void;
  setBatchShareFileIds: (ids: string[]) => void;
  setShowBatchMove: (show: boolean) => void;
  setShowCreateFolder: (show: boolean) => void;
  setRenamingFolder: (folder: Folder | null) => void;
  setDeleteConfirm: (confirm: FileState['deleteConfirm']) => void;
  setDeleteLoading: (loading: boolean) => void;
  setBatchDownloading: (downloading: boolean) => void;
  
  loadFiles: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadFolders: () => Promise<void>;
  navigateToFolder: (folderId: string | null) => void;
  resetFileList: () => void;
}

/**
 * 获取缓存键
 */
function getCacheKey(query: Record<string, unknown>): string {
  return JSON.stringify(query);
}

/**
 * 文件状态管理 Store
 */
export const useFileStore = create<FileState>((set, get) => {
  return {
    // 文件列表状态
    files: [],
    loading: true,
    error: null,
    loadedPageCount: 1,
    loadingMore: false,
    total: 0,
    isRevalidating: false,

    // 文件夹状态
    currentFolderId: null,
    folders: [],
    folderPath: [],
    loadingFolders: false,

    // 过滤器和排序
    search: '',
    mimeType: '',
    sortBy: 'name',
    sortField: 'filename',
    sortOrder: 'asc',
    debouncedSearch: '',

    // 选择状态
    selectedFiles: new Set(),
    selectedFolders: new Set(),
    allFilesSelected: false,

    // 对话框状态
    previewFile: null,
    shareFile: null,
    showBatchShare: false,
    batchShareFileIds: [],
    showBatchMove: false,
    showCreateFolder: false,
    renamingFolder: null,
    deleteConfirm: null,
    deleteLoading: false,
    batchDownloading: false,

    // 操作方法
    setSearch: (search) => set({ search }),
    setMimeType: (mimeType) => set({ mimeType }),
    setSortBy: (sortBy) => set({ sortBy }),
    setSortField: (field) => set({ sortField: field }),
    setSortOrder: (order) => set({ sortOrder: order }),
    setDebouncedSearch: (debouncedSearch) => set({ debouncedSearch }),

    toggleSelectFile: (fileId) => {
      const { selectedFiles } = get();
      const newSelectedFiles = new Set(selectedFiles);
      if (newSelectedFiles.has(fileId)) {
        newSelectedFiles.delete(fileId);
      } else {
        newSelectedFiles.add(fileId);
      }
      set({ selectedFiles: newSelectedFiles });
    },

    toggleSelectFolder: (folderId) => {
      const { selectedFolders } = get();
      const newSelectedFolders = new Set(selectedFolders);
      if (newSelectedFolders.has(folderId)) {
        newSelectedFolders.delete(folderId);
      } else {
        newSelectedFolders.add(folderId);
      }
      set({ selectedFolders: newSelectedFolders });
    },

    toggleSelectAll: () => {
    const { files, allFilesSelected } = get();
    if (allFilesSelected) {
      set({ selectedFiles: new Set() });
    } else {
      const allFileIds = new Set(files.map(file => file.id));
      set({ selectedFiles: allFileIds });
    }
  },

    clearSelection: () => {
      set({ selectedFiles: new Set(), selectedFolders: new Set() });
    },

    setPreviewFile: (previewFile) => set({ previewFile }),
    setShareFile: (shareFile) => set({ shareFile }),
    setShowBatchShare: (showBatchShare) => set({ showBatchShare }),
    setBatchShareFileIds: (batchShareFileIds) => set({ batchShareFileIds }),
    setShowBatchMove: (showBatchMove) => set({ showBatchMove }),
    setShowCreateFolder: (showCreateFolder) => set({ showCreateFolder }),
    setRenamingFolder: (renamingFolder) => set({ renamingFolder }),
    setDeleteConfirm: (deleteConfirm) => set({ deleteConfirm }),
    setDeleteLoading: (deleteLoading) => set({ deleteLoading }),
    setBatchDownloading: (batchDownloading) => set({ batchDownloading }),

    loadFiles: async () => {
      const { debouncedSearch, mimeType, currentFolderId, sortField, sortOrder } = get();
      set({ error: null, loading: true });

      const query: FileListQuery = {
        page: 1,
        limit: FILE_LIST.LIMIT,
        search: debouncedSearch,
        mime_type: mimeType,
        folder_id: currentFolderId,
        sort_by: sortField as 'created_at' | 'filename' | 'file_size',
        sort_order: sortOrder,
      };

      const cacheKey = getCacheKey(query as Record<string, unknown>);
      const cached = await getCachedFileList(cacheKey);

      // 如果有缓存，先展示缓存数据
      if (cached) {
        set({ 
          files: cached.files, 
          total: cached.total, 
          loadedPageCount: 1,
          loading: false,
          isRevalidating: true
        });
      }

      try {
        const response = await fileService.listFiles(query);
        set({ 
          files: response.files, 
          total: response.total ?? 0, 
          loadedPageCount: 1,
          loading: false,
          isRevalidating: false
        });
        setCachedFileList(cacheKey, response.files, response.total ?? 0);
      } catch (err) {
        if (isRequestCanceled(err)) return;
        set({ 
          error: getErrorMessage(err, 'Failed to load files'), 
          loading: false,
          isRevalidating: false
        });
      }
    },

    loadMore: async () => {
      const { loadedPageCount, debouncedSearch, mimeType, currentFolderId, sortField, sortOrder, total } = get();
      const nextPage = loadedPageCount + 1;
      const limit = FILE_LIST.LIMIT;

      if (loadedPageCount * limit >= total) return;

      set({ loadingMore: true });

      const query: FileListQuery = {
        page: nextPage,
        limit,
        search: debouncedSearch,
        mime_type: mimeType,
        folder_id: currentFolderId,
        sort_by: sortField as 'created_at' | 'filename' | 'file_size',
        sort_order: sortOrder,
      };

      try {
        const response = await fileService.listFiles(query);
        set((state) => ({
          files: [...state.files, ...response.files],
          loadedPageCount: nextPage,
          loadingMore: false
        }));
      } catch (err) {
        if (isRequestCanceled(err)) return;
        set({ loadingMore: false });
      }
    },

    loadFolders: async () => {
    set({ loadingFolders: true });

    try {
      // 这里需要实现获取文件夹列表的 API 调用
      // 暂时使用模拟数据
      const folders: Folder[] = [];
      const folderPath: Folder[] = [];
      set({ folders, folderPath, loadingFolders: false });
    } catch {
      set({ loadingFolders: false });
    }
  },

    navigateToFolder: (folderId) => {
      set({ 
        currentFolderId: folderId, 
        files: [], 
        loadedPageCount: 1,
        selectedFiles: new Set(),
        selectedFolders: new Set()
      });
    },

    resetFileList: () => {
      set({
        files: [],
        loading: true,
        error: null,
        loadedPageCount: 1,
        loadingMore: false,
        total: 0,
        isRevalidating: false,
        selectedFiles: new Set(),
        selectedFolders: new Set(),
        allFilesSelected: false,
      });
    },
  };
});
