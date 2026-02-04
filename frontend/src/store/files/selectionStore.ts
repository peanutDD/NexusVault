/**
 * 文件选择状态管理
 * 管理文件和文件夹的多选状态
 */
import { create } from 'zustand';

/**
 * 选择状态接口
 */
interface SelectionState {
  /** 选中的文件 ID */
  selectedFiles: Set<string>;
  /** 选中的文件夹 ID */
  selectedFolders: Set<string>;

  /** 切换选中文件 */
  toggleSelectFile: (fileId: string) => void;
  /** 切换选中文件夹 */
  toggleSelectFolder: (folderId: string) => void;
  /** 全选文件 */
  selectAllFiles: (fileIds: string[]) => void;
  /** 全选文件夹 */
  selectAllFolders: (folderIds: string[]) => void;
  /** 清空选择 */
  clearSelection: () => void;
  /** 设置选中的文件 */
  setSelectedFiles: (files: Set<string>) => void;
  /** 设置选中的文件夹 */
  setSelectedFolders: (folders: Set<string>) => void;
}

/**
 * 选择状态 Store
 */
export const useSelectionStore = create<SelectionState>((set) => ({
  selectedFiles: new Set(),
  selectedFolders: new Set(),

  toggleSelectFile: (fileId) => {
    set((state) => {
      const newSelectedFiles = new Set(state.selectedFiles);
      if (newSelectedFiles.has(fileId)) {
        newSelectedFiles.delete(fileId);
      } else {
        newSelectedFiles.add(fileId);
      }
      return { selectedFiles: newSelectedFiles };
    });
  },

  toggleSelectFolder: (folderId) => {
    set((state) => {
      const newSelectedFolders = new Set(state.selectedFolders);
      if (newSelectedFolders.has(folderId)) {
        newSelectedFolders.delete(folderId);
      } else {
        newSelectedFolders.add(folderId);
      }
      return { selectedFolders: newSelectedFolders };
    });
  },

  selectAllFiles: (fileIds) => {
    set({ selectedFiles: new Set(fileIds) });
  },

  selectAllFolders: (folderIds) => {
    set({ selectedFolders: new Set(folderIds) });
  },

  clearSelection: () => {
    set({
      selectedFiles: new Set(),
      selectedFolders: new Set(),
    });
  },

  setSelectedFiles: (files) => {
    set({ selectedFiles: files });
  },

  setSelectedFolders: (folders) => {
    set({ selectedFolders: folders });
  },
}));

export default useSelectionStore;
