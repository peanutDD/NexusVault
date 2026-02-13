/* eslint-disable react-refresh/only-export-components -- Context and hook are intentionally co-located */
import { createContext, use } from 'react';
import type { FileMetadata } from '../../../types/files';
import type { Folder } from '../../../types/folders';

/**
 * 文件列表上下文类型
 */
export interface FileListContextValue {
  // 数据
  files: FileMetadata[];
  folders: Folder[];
  displayFolders: Folder[];
  displayFiles: FileMetadata[];
  currentFolderId: string | null;
  folderPath: Folder[];

  // 状态
  isLoading: boolean;
  error: string | null;
  isGroupByType: boolean;

  // 选择状态
  selectedFiles: Set<string>;
  selectedFolders: Set<string>;
  allFilesSelected: boolean;

  // 操作方法
  handleSelectFile: (id: string) => void;
  handleSelectFolder: (id: string) => void;
  toggleSelectAll: () => void;
  handleOpenFolder: (folder: Folder) => void;
  handleRenameFolder: (folder: Folder) => void;
  handleDelete: (id: string) => void;
  handleDownload: (file: FileMetadata) => void;
  handleDropOnFolder: (e: React.DragEvent, folder: Folder) => void;
  handleFileDragStart: (e: React.DragEvent, file: FileMetadata) => void;
  setPreviewFile: (file: FileMetadata | null) => void;
  setShareFile: (file: FileMetadata | null) => void;
}

/**
 * 文件列表 Context
 * 用于在组件树中共享文件列表数据和操作，减少 props 传递
 */
export const FileListContext = createContext<FileListContextValue | null>(null);

/**
 * 使用文件列表 Context 的 Hook
 */
export function useFileListContext(): FileListContextValue {
  const context = use(FileListContext);
  if (!context) {
    throw new Error('useFileListContext must be used within a FileListProvider');
  }
  return context;
}

export default FileListContext;
