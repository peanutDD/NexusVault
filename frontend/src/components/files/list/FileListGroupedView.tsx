import type { DragEvent, ReactNode } from "react";
import FileGrid from "../grid/FileGrid";
import FolderGrid from "../grid/FolderGrid";
import MixedGrid from "../grid/MixedGrid";
import { GroupSelectCheckbox, GroupSelectCheckboxMixed } from "./GroupSelectCheckbox";
import FileListGroupHeader from "./FileListGroupHeader";
import type { FileMetadata } from "../../../types/files";
import type { Folder } from "../../../types/folders";

interface GroupedFiles {
  key: string;
  files: FileMetadata[];
  icon: ReactNode;
  label: string;
}

interface TimeGroup {
  key: string;
  label: string;
  files: FileMetadata[];
  folders: Folder[];
  items: Array<{ type: "file"; file: FileMetadata } | { type: "folder"; folder: Folder }>;
}

interface FileListGroupedViewProps {
  mode: "type" | "time";
  groupedFiles: GroupedFiles[] | null;
  timeGroupedItems: TimeGroup[] | null;
  displayFolders: Folder[];
  selectedFiles: Set<string>;
  selectedFolders: Set<string>;
  openFileMenuId: string | null;
  openFolderMenuId: string | null;
  onSelectFile: (fileId: string, selected: boolean) => void;
  onSelectFolder: (folderId: string, selected: boolean) => void;
  onOpenFolder: (folderId: string) => void;
  onRenameFolder: (folder: Folder) => void;
  onRenameFile: (file: FileMetadata) => void;
  onDelete: (file: FileMetadata | Folder, type: "file" | "folder") => void;
  onDownload: (file: FileMetadata) => void;
  onFileDragStart: (fileId: string, e: DragEvent) => void;
  onDropOnFolder: (folderId: string, fileIds: string[], folderIds: string[]) => void;
  onPreviewFile: (file: FileMetadata | null) => void;
  onShareFile: (file: FileMetadata | null) => void;
  onToggleFileMenu: (id: string) => void;
  onToggleFolderMenu: (id: string) => void;
  onCloseMenu: () => void;
}

export default function FileListGroupedView({
  mode,
  groupedFiles,
  timeGroupedItems,
  displayFolders,
  selectedFiles,
  selectedFolders,
  openFileMenuId,
  openFolderMenuId,
  onSelectFile,
  onSelectFolder,
  onOpenFolder,
  onRenameFolder,
  onRenameFile,
  onDelete,
  onDownload,
  onFileDragStart,
  onDropOnFolder,
  onPreviewFile,
  onShareFile,
  onToggleFileMenu,
  onToggleFolderMenu,
  onCloseMenu,
}: FileListGroupedViewProps) {
  if (mode === "type") {
    return (
      <div className="space-y-6">
        {displayFolders.length > 0 ? (
          <div>
            <FileListGroupHeader
              label="FOLDERS"
              count={displayFolders.length}
              checkbox={
                <GroupSelectCheckbox
                  itemIds={displayFolders.map((f) => f.id)}
                  selectedIds={selectedFolders}
                  onToggle={(ids, selected) => ids.forEach((id) => onSelectFolder(id, selected))}
                />
              }
              icon={
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--glass-bg-b)] text-base text-[var(--glass-text)]">
                  <i className="bi bi-folder2" aria-hidden />
                </span>
              }
            />
            <FolderGrid
              folders={displayFolders}
              selectedFolders={selectedFolders}
              onSelect={onSelectFolder}
              onOpen={onOpenFolder}
              onRename={onRenameFolder}
              onDelete={(folderId) => {
                const folder = displayFolders.find((f) => f.id === folderId);
                if (folder) onDelete(folder, "folder");
              }}
              onDrop={onDropOnFolder}
              openFolderMenuId={openFolderMenuId}
              onToggleMenu={onToggleFolderMenu}
              onCloseMenu={onCloseMenu}
            />
          </div>
        ) : null}
        {(groupedFiles ?? []).map((group) => (
          <div key={`group-${group.key}`}>
            <FileListGroupHeader
              label={group.label}
              count={group.files.length}
              checkbox={
                <GroupSelectCheckbox
                  itemIds={group.files.map((f) => f.id)}
                  selectedIds={selectedFiles}
                  onToggle={(ids, selected) => ids.forEach((id) => onSelectFile(id, selected))}
                />
              }
              icon={group.icon}
            />
            <FileGrid
              files={group.files}
              selectedFiles={selectedFiles}
              onSelect={onSelectFile}
              onPreview={(file) => onPreviewFile(file)}
              onShare={(file) => onShareFile(file)}
              onDownload={onDownload}
              onRename={onRenameFile}
              onDelete={onDelete}
              onDragStart={onFileDragStart}
              openFileMenuId={openFileMenuId}
              onToggleMenu={onToggleFileMenu}
              onCloseMenu={onCloseMenu}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(timeGroupedItems ?? []).map((group) => (
        <div key={`time-group-${group.key}`}>
          <FileListGroupHeader
            label={group.label}
            count={group.files.length + group.folders.length}
            checkbox={
              <GroupSelectCheckboxMixed
                fileIds={group.files.map((f) => f.id)}
                folderIds={group.folders.map((f) => f.id)}
                selectedFileIds={selectedFiles}
                selectedFolderIds={selectedFolders}
                onToggle={(fileIds, folderIds, selected) => {
                  fileIds.forEach((id) => onSelectFile(id, selected));
                  folderIds.forEach((id) => onSelectFolder(id, selected));
                }}
              />
            }
            icon={
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--glass-bg-b)] text-base text-[var(--glass-text)]">
                <i className="bi bi-calendar3" aria-hidden />
              </span>
            }
          />
          <MixedGrid
            key={`time-group-mixed-${group.key}`}
            items={group.items}
            selectedFiles={selectedFiles}
            selectedFolders={selectedFolders}
            onSelectFile={onSelectFile}
            onSelectFolder={onSelectFolder}
            onOpenFolder={onOpenFolder}
            onPreviewFile={(file) => onPreviewFile(file)}
            onShareFile={(file) => onShareFile(file)}
            onDownloadFile={onDownload}
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
        </div>
      ))}
    </div>
  );
}
