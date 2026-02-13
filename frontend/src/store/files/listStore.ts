/**
 * 文件列表状态管理
 * 管理文件列表、加载状态、分页等
 */
import { create } from 'zustand';
import { fileService } from '../../services/files';
import { getCachedFileList, setCachedFileList } from '../../utils/fileListCache';
import { isRequestCanceled, getErrorMessage } from '../../utils/error';
import { FILE_LIST } from '../../constants';
import type { FileMetadata, FileListQuery } from '../../types/files';
import type { Folder } from '../../types/folders';

/**
 * 文件列表状态接口
 */
interface FileListState {
  // 文件列表
  files: FileMetadata[];
  loading: boolean;
  error: string | null;
  loadedPageCount: number;
  loadingMore: boolean;
  total: number;
  isRevalidating: boolean;

  // 文件夹
  currentFolderId: string | null;
  folders: Folder[];
  folderPath: Folder[];
  loadingFolders: boolean;

  // 操作方法
  setFiles: (files: FileMetadata[]) => void;
  setFolders: (folders: Folder[]) => void;
  setFolderPath: (path: Folder[]) => void;
  setCurrentFolderId: (folderId: string | null) => void;
  setError: (error: string | null) => void;
  setTotal: (total: number) => void;

  loadFiles: (query: FileListQuery) => Promise<void>;
  loadMore: (query: FileListQuery) => Promise<void>;
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
 * 文件列表状态 Store
 */
export const useFileListStore = create<FileListState>((set, get) => ({
  // 初始状态
  files: [],
  loading: true,
  error: null,
  loadedPageCount: 1,
  loadingMore: false,
  total: 0,
  isRevalidating: false,

  currentFolderId: null,
  folders: [],
  folderPath: [],
  loadingFolders: false,

  // 简单设置方法
  setFiles: (files) => set({ files }),
  setFolders: (folders) => set({ folders }),
  setFolderPath: (folderPath) => set({ folderPath }),
  setCurrentFolderId: (currentFolderId) => set({ currentFolderId }),
  setError: (error) => set({ error }),
  setTotal: (total) => set({ total }),

  // 加载文件
  loadFiles: async (query) => {
    set({ error: null, loading: true });

    const cacheKey = getCacheKey(query as Record<string, unknown>);
    const cached = await getCachedFileList(cacheKey);

    if (cached) {
      set({
        files: cached.files,
        total: cached.total,
        loadedPageCount: 1,
        loading: false,
        isRevalidating: true,
      });
    }

    try {
      const response = await fileService.listFiles(query);
      set({
        files: response.files,
        total: response.total ?? 0,
        loadedPageCount: 1,
        loading: false,
        isRevalidating: false,
      });
      setCachedFileList(cacheKey, response.files, response.total ?? 0);
    } catch (err) {
      if (isRequestCanceled(err)) return;
      set({
        error: getErrorMessage(err, 'Failed to load files'),
        loading: false,
        isRevalidating: false,
      });
    }
  },

  // 加载更多
  loadMore: async (query) => {
    const { loadedPageCount, total } = get();
    const limit = FILE_LIST.LIMIT;

    if (loadedPageCount * limit >= total) return;

    set({ loadingMore: true });

    try {
      const response = await fileService.listFiles(query);
      set((state) => ({
        files: [...state.files, ...response.files],
        loadedPageCount: loadedPageCount + 1,
        loadingMore: false,
      }));
    } catch (err) {
      if (isRequestCanceled(err)) return;
      set({ loadingMore: false });
    }
  },

  // 导航到文件夹
  navigateToFolder: (folderId) => {
    set({
      currentFolderId: folderId,
      files: [],
      loadedPageCount: 1,
    });
  },

  // 重置文件列表
  resetFileList: () => {
    set({
      files: [],
      loading: true,
      error: null,
      loadedPageCount: 1,
      loadingMore: false,
      total: 0,
      isRevalidating: false,
    });
  },
}));

export default useFileListStore;
