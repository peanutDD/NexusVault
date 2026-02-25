import type { DragEvent } from 'react';
import type { FileMetadata } from '../../../types/files';
import type { Folder } from '../../../types/folders';
import FileCard from './FileCard';
import FolderCard from './FolderCard';

export type MixedGridItem =
  | { type: 'file'; file: FileMetadata }
  | { type: 'folder'; folder: Folder };

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
  onDelete: (file: FileMetadata | Folder, type: 'file' | 'folder') => void;
  onFileDragStart: (fileId: string, e: DragEvent) => void;
  onDropOnFolder: (folderId: string, fileIds: string[], folderIds: string[]) => void;
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
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
      {items.map((item) => {
        if (item.type === 'folder') {
          const folder = item.folder;
          return (
            <FolderCard
              key={`folder-${folder.id}`}
              folder={folder}
              isSelected={selectedFolders.has(folder.id)}
              onSelect={(id) => onSelectFolder(id, !selectedFolders.has(id))}
              onOpen={(f) => onOpenFolder(f.id)}
              onRename={onRenameFolder}
              onDelete={() => onDelete(folder, 'folder')}
              onDrop={(e, target) => {
                const fileId = e.dataTransfer.getData('application/file-id');
                const folderId = e.dataTransfer.getData('application/folder-id');
                onDropOnFolder(target.id, fileId ? [fileId] : [], folderId ? [folderId] : []);
              }}
              isMenuOpen={openFolderMenuId === folder.id}
              onToggleMenu={onToggleFolderMenu}
              onCloseMenu={onCloseMenu}
            />
          );
        }

        const file = item.file;
        return (
          <FileCard
            key={`file-${file.id}`}
            file={file}
            isSelected={selectedFiles.has(file.id)}
            onSelect={(id) => onSelectFile(id, !selectedFiles.has(id))}
            onPreview={onPreviewFile}
            onShare={onShareFile}
            onDownload={onDownloadFile}
            onRename={() => onRenameFile(file)}
            onDelete={() => onDelete(file, 'file')}
            onDragStart={(e) => onFileDragStart(file.id, e)}
            isMenuOpen={openFileMenuId === file.id}
            onToggleMenu={onToggleFileMenu}
            onCloseMenu={onCloseMenu}
          />
        );
      })}
    </div>
  );
}
