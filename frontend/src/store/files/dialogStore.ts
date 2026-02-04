/**
 * 对话框状态管理
 * 管理文件相关对话框的显示/隐藏状态
 */
import { create } from 'zustand';
import type { FileMetadata, Folder } from '../../types';

/**
 * 删除确认信息
 */
interface DeleteConfirm {
  type: 'file' | 'folder' | 'batch';
  id?: string;
  name?: string;
  fileCount?: number;
  folderCount?: number;
}

/**
 * 对话框状态接口
 */
interface DialogState {
  // 预览
  previewFile: FileMetadata | null;
  setPreviewFile: (file: FileMetadata | null) => void;

  // 分享
  shareFile: FileMetadata | null;
  setShareFile: (file: FileMetadata | null) => void;

  // 批量分享
  showBatchShare: boolean;
  batchShareFileIds: string[];
  setShowBatchShare: (show: boolean) => void;
  setBatchShareFileIds: (ids: string[]) => void;

  // 批量移动
  showBatchMove: boolean;
  setShowBatchMove: (show: boolean) => void;

  // 创建文件夹
  showCreateFolder: boolean;
  setShowCreateFolder: (show: boolean) => void;

  // 重命名文件夹
  renamingFolder: Folder | null;
  setRenamingFolder: (folder: Folder | null) => void;

  // 删除确认
  deleteConfirm: DeleteConfirm | null;
  deleteLoading: boolean;
  setDeleteConfirm: (confirm: DeleteConfirm | null) => void;
  setDeleteLoading: (loading: boolean) => void;

  // 批量下载
  batchDownloading: boolean;
  setBatchDownloading: (downloading: boolean) => void;

  // 关闭所有对话框
  closeAllDialogs: () => void;
}

/**
 * 对话框状态 Store
 */
export const useDialogStore = create<DialogState>((set) => ({
  // 初始状态
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

  // 设置方法
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

  // 关闭所有对话框
  closeAllDialogs: () => {
    set({
      previewFile: null,
      shareFile: null,
      showBatchShare: false,
      showBatchMove: false,
      showCreateFolder: false,
      renamingFolder: null,
      deleteConfirm: null,
    });
  },
}));

export default useDialogStore;
