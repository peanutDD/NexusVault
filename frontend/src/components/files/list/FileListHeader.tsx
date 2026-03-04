/**
 * FileListHeader 组件
 * 
 * 文件列表的头部组件，包含面包屑导航和顶部工具栏
 * 
 * @param props 组件属性
 * @param props.folderPath 当前文件夹路径
 * @param props.navigateToFolder 导航到文件夹的回调函数
 * @param props.handleDropOnBreadcrumb 拖放到面包屑上的回调函数
 * @param props.search 搜索关键词
 * @param props.mimeType 文件类型过滤器
 * @param props.sortBy 排序方式
 * @param props.onSearchChange 搜索关键词变化的回调函数
 * @param props.onMimeTypeChange 文件类型过滤器变化的回调函数
 * @param props.onSortChange 排序方式变化的回调函数
 * @param props.onOpenUpload 打开上传对话框的回调函数
 */
import React from 'react';
import FolderBreadcrumb from '../FolderBreadcrumb';
import FileListFilters from './FileListFilters';

import type { Folder } from '../../../types/folders';

interface FileListHeaderProps {
  folderPath: Folder[];
  navigateToFolder: (folderId: string | null) => void;
  handleDropOnBreadcrumb: (e: React.DragEvent, folderId: string | null) => void;
  search: string;
  mimeType: string;
  sortBy: string;
  onSearchChange: (value: string) => void;
  onMimeTypeChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onOpenUpload?: () => void;
  setShowCreateFolder: (show: boolean) => void;
}

const FileListHeader: React.FC<FileListHeaderProps> = ({
  folderPath,
  navigateToFolder,
  handleDropOnBreadcrumb,
  search,
  mimeType,
  sortBy,
  onSearchChange,
  onMimeTypeChange,
  onSortChange,
  onOpenUpload,
  setShowCreateFolder,
}) => {
  return (
    <>
      {/* 面包屑：进入文件夹后置顶、左对齐 */}
      {folderPath.length > 0 && (
        <div className="flex justify-start">
          <FolderBreadcrumb
            path={folderPath}
            onNavigate={navigateToFolder}
            onDrop={handleDropOnBreadcrumb}
          />
        </div>
      )}

      {/* 顶部工具区（复刻截图布局，整体缩放到 0.75） */}
      <div className="glass-panel glass-panel-toolbar fileListToolbarScale75 p-3">
        <FileListFilters
          layout="screenshot"
          search={search}
          mimeType={mimeType}
          sortBy={sortBy}
          onSearchChange={onSearchChange}
          onMimeTypeChange={onMimeTypeChange}
          onSortChange={onSortChange}
          actions={
            <div className="flex flex-nowrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigateToFolder(null)}
                className="glass-btn toolbarActionBtn allFilesBtnHighlight font-brand flex items-center gap-1.5 px-2 py-1.5 font-normal tracking-widest text-[0.75rem] leading-none text-[rgba(var(--rgb-slate-50),0.86)] hover:brightness-110 transition-all whitespace-nowrap shrink-0"
                aria-label="All Files"
              >
                <i className="bi bi-folder2-open shrink-0 text-[0.75rem]" aria-hidden />
                <span>All Files</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCreateFolder(true)}
                className="glass-btn toolbarActionBtn font-brand flex items-center gap-1.5 px-2 py-1.5 font-normal tracking-widest text-[0.75rem] leading-none text-[rgba(var(--rgb-slate-50),0.86)] hover:brightness-110 transition-all whitespace-nowrap shrink-0"
                aria-label="New Folder"
              >
                <i className="bi bi-folder-plus shrink-0 text-[0.75rem]" aria-hidden />
                <span>New Folder</span>
              </button>
              {onOpenUpload && (
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="glass-btn toolbarActionBtn uploadBtnHighlight font-brand flex items-center gap-1.5 px-2 py-1.5 font-normal tracking-widest text-[0.75rem] leading-none text-[rgba(var(--rgb-slate-50),0.86)] hover:brightness-110 transition-all whitespace-nowrap shrink-0"
                  aria-label="Upload File"
                >
                  <i className="bi bi-cloud-upload shrink-0 text-[0.75rem]" aria-hidden />
                  <span>Upload File</span>
                </button>
              )}
            </div>
          }
        />
      </div>
    </>
  );
};

export default FileListHeader;
