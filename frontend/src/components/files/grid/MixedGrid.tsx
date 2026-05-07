import { useCallback } from "react";
import type { DragEvent } from "react";
import type { FileMetadata } from "../../../types/files";
import type { Folder } from "../../../types/folders";
import FileCard from "./FileCard";
import FolderCard from "./FolderCard";

export type MixedGridItem =
  | { type: "file"; file: FileMetadata }
  | { type: "folder"; folder: Folder };

interface MixedGridProps {
  items: MixedGridItem[];
  selectedFiles: Set<string>;
  selectedFolders: Set<string>;
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
  openFileMenuId: string | null;
  openFolderMenuId: string | null;
  onToggleFileMenu: (id: string) => void;
  onToggleFolderMenu: (id: string) => void;
  onCloseMenu: () => void;
}

export default function MixedGrid({
  items,
  selectedFiles,
  selectedFolders,
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
  openFileMenuId,
  openFolderMenuId,
  onToggleFileMenu,
  onToggleFolderMenu,
  onCloseMenu,
}: MixedGridProps) {
  const handleDeleteFile = useCallback(
    (file: FileMetadata) => onDelete(file, "file"),
    [onDelete],
  );
  const handleDeleteFolder = useCallback(
    (folder: Folder) => onDelete(folder, "folder"),
    [onDelete],
  );
  const handleMobileFolderDrop = useCallback(
    (targetFolderId: string, sourceFolderId: string) => {
      onDropOnFolder(targetFolderId, [], [sourceFolderId]);
    },
    [onDropOnFolder],
  );
  const handleMobileFileDrop = useCallback(
    (targetFolderId: string, sourceFileId: string) => {
      onDropOnFolder(targetFolderId, [sourceFileId], []);
    },
    [onDropOnFolder],
  );

  if (items.length === 0) return null;

  return (
    <div
      className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
      data-oid="kt4n62z"
    >
      {items.map((item) => {
        if (item.type === "folder") {
          const folder = item.folder;
          return (
            <FolderCard
              key={`folder-${folder.id}`}
              folder={folder}
              isSelected={selectedFolders.has(folder.id)}
              onSelect={onSelectFolder}
              onOpen={onOpenFolder}
              onRename={onRenameFolder}
              onDelete={handleDeleteFolder}
              onDrop={onDropOnFolder}
              onMobileFolderDrop={handleMobileFolderDrop}
              isMenuOpen={openFolderMenuId === folder.id}
              onToggleMenu={onToggleFolderMenu}
              onCloseMenu={onCloseMenu}
              data-oid="3fvb5qm"
            />
          );
        }

        const file = item.file;
        return (
          <FileCard
            key={`file-${file.id}`}
            file={file}
            isSelected={selectedFiles.has(file.id)}
            onSelect={onSelectFile}
            onPreview={onPreviewFile}
            onShare={onShareFile}
            onDownload={onDownloadFile}
            onRename={onRenameFile}
            onDelete={handleDeleteFile}
            onDragStart={onFileDragStart}
            onMobileFileDrop={handleMobileFileDrop}
            isMenuOpen={openFileMenuId === file.id}
            onToggleMenu={onToggleFileMenu}
            onCloseMenu={onCloseMenu}
            data-oid="no510gx"
          />
        );
      })}
    </div>
  );
}
