import type { DragEvent } from "react";
import FileGrid from "../grid/FileGrid";
import VirtualizedFileGrid from "../grid/VirtualizedFileGrid";
import FolderGrid from "../grid/FolderGrid";
import MixedGrid from "../grid/MixedGrid";
import VirtualizedMixedGrid from "../grid/VirtualizedMixedGrid";
import type { MixedGridItem } from "../grid/MixedGrid";
import type { FileMetadata } from "../../../types/files";
import type { Folder } from "../../../types/folders";

interface FileListVirtualScrollerProps {
  isPlainSort: boolean;
  shouldUseVirtualList: boolean;
  listKey: string;
  mixedItems: MixedGridItem[];
  files: FileMetadata[];
  displayFolders: Folder[];
  selectedFiles: Set<string>;
  selectedFolders: Set<string>;
  openFileMenuId: string | null;
  openFolderMenuId: string | null;
  onSelectFile: (fileId: string, selected: boolean) => void;
  onSelectFolder: (folderId: string, selected: boolean) => void;
  onOpenFolder: (folderId: string) => void;
  onPreviewFile: (file: FileMetadata) => void;
  onShareFile: (file: FileMetadata) => void;
  onDownloadFile: (file: FileMetadata) => void;
  onRenameFolder: (folder: Folder) => void;
  onRenameFile: (file: FileMetadata) => void;
  onDelete: (file: FileMetadata | Folder, type: "file" | "folder") => void;
  onFileDragStart: (fileId: string, e: DragEvent) => void;
  onDropOnFolder: (
    folderId: string,
    fileIds: string[],
    folderIds: string[],
  ) => void;
  onToggleFileMenu: (id: string) => void;
  onToggleFolderMenu: (id: string) => void;
  onCloseMenu: () => void;
}

export default function FileListVirtualScroller({
  isPlainSort,
  shouldUseVirtualList,
  listKey,
  mixedItems,
  files,
  displayFolders,
  selectedFiles,
  selectedFolders,
  openFileMenuId,
  openFolderMenuId,
  onSelectFile,
  onSelectFolder,
  onOpenFolder,
  onPreviewFile,
  onShareFile,
  onDownloadFile,
  onRenameFolder,
  onRenameFile,
  onDelete,
  onFileDragStart,
  onDropOnFolder,
  onToggleFileMenu,
  onToggleFolderMenu,
  onCloseMenu,
}: FileListVirtualScrollerProps) {
  if (isPlainSort) {
    if (shouldUseVirtualList) {
      return (
        <VirtualizedMixedGrid
          key={`mixed-virtual-${listKey}`}
          items={mixedItems}
          selectedFiles={selectedFiles}
          selectedFolders={selectedFolders}
          onSelectFile={onSelectFile}
          onSelectFolder={onSelectFolder}
          onOpenFolder={onOpenFolder}
          onPreviewFile={onPreviewFile}
          onShareFile={onShareFile}
          onDownloadFile={onDownloadFile}
          onRenameFolder={onRenameFolder}
          onRenameFile={onRenameFile}
          onDelete={onDelete}
          onFileDragStart={onFileDragStart}
          onDropOnFolder={onDropOnFolder}
          openFileMenuId={openFileMenuId}
          openFolderMenuId={openFolderMenuId}
          onToggleFileMenu={onToggleFileMenu}
          onToggleFolderMenu={onToggleFolderMenu}
          onCloseMenu={onCloseMenu}
        />
      );
    }
    return (
      <MixedGrid
        key={`mixed-grid-${listKey}`}
        items={mixedItems}
        selectedFiles={selectedFiles}
        selectedFolders={selectedFolders}
        onSelectFile={onSelectFile}
        onSelectFolder={onSelectFolder}
        onOpenFolder={onOpenFolder}
        onPreviewFile={onPreviewFile}
        onShareFile={onShareFile}
        onDownloadFile={onDownloadFile}
        onRenameFolder={onRenameFolder}
        onRenameFile={onRenameFile}
        onDelete={onDelete}
        onFileDragStart={onFileDragStart}
        onDropOnFolder={onDropOnFolder}
        openFileMenuId={openFileMenuId}
        openFolderMenuId={openFolderMenuId}
        onToggleFileMenu={onToggleFileMenu}
        onToggleFolderMenu={onToggleFolderMenu}
        onCloseMenu={onCloseMenu}
      />
    );
  }

  return (
    <>
      <FolderGrid
        folders={displayFolders}
        selectedFolders={selectedFolders}
        onSelect={onSelectFolder}
        onOpen={onOpenFolder}
        onRename={onRenameFolder}
        onDelete={(folderId) => {
          const folder = displayFolders.find((item) => item.id === folderId);
          if (folder) onDelete(folder, "folder");
        }}
        onDrop={onDropOnFolder}
        openFolderMenuId={openFolderMenuId}
        onToggleMenu={onToggleFolderMenu}
        onCloseMenu={onCloseMenu}
      />
      {shouldUseVirtualList ? (
        <VirtualizedFileGrid
          key={`virtual-${listKey}`}
          files={files}
          selectedFiles={selectedFiles}
          onSelect={onSelectFile}
          onPreview={onPreviewFile}
          onShare={onShareFile}
          onDownload={onDownloadFile}
          onRename={onRenameFile}
          onDelete={onDelete}
          onDragStart={onFileDragStart}
          openFileMenuId={openFileMenuId}
          onToggleMenu={onToggleFileMenu}
          onCloseMenu={onCloseMenu}
        />
      ) : (
        <FileGrid
          key={`grid-${listKey}`}
          files={files}
          selectedFiles={selectedFiles}
          onSelect={onSelectFile}
          onPreview={onPreviewFile}
          onShare={onShareFile}
          onDownload={onDownloadFile}
          onRename={onRenameFile}
          onDelete={onDelete}
          onDragStart={onFileDragStart}
          openFileMenuId={openFileMenuId}
          onToggleMenu={onToggleFileMenu}
          onCloseMenu={onCloseMenu}
        />
      )}
    </>
  );
}
