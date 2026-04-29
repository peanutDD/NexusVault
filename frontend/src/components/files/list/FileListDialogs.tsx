import { lazy } from "react";
import { clearFileListCache } from "../../../utils/fileListCache";
import type { FileMetadata } from "../../../types/files";
import type { Folder } from "../../../types/folders";
import type { DeleteConfirmState } from "../../../hooks/files/useFileUI";

const FilePreview = lazy(() => import("../preview/FilePreview"));
const ShareDialog = lazy(() => import("../dialogs/ShareDialog"));
const BatchShareDialog = lazy(() => import("../dialogs/BatchShareDialog"));
const BatchMoveDialog = lazy(() => import("../dialogs/BatchMoveDialog"));
const CreateFolderDialog = lazy(() => import("../dialogs/CreateFolderDialog"));
const RenameFolderDialog = lazy(() => import("../dialogs/RenameFolderDialog"));
const RenameFileDialog = lazy(() => import("../dialogs/RenameFileDialog"));
const ConfirmDialog = lazy(() => import("../../common/dialog/ConfirmDialog"));

interface FileListDialogsProps {
  previewFile: FileMetadata | null;
  displayFiles: FileMetadata[];
  displayFileIndexById: Map<string, number>;
  setPreviewFile: (file: FileMetadata | null) => void;
  shareFile: FileMetadata | null;
  setShareFile: (file: FileMetadata | null) => void;
  showBatchShare: boolean;
  setShowBatchShare: (show: boolean) => void;
  batchShareFileIds: string[];
  setBatchShareFileIds: (fileIds: string[]) => void;
  showBatchMove: boolean;
  setShowBatchMove: (show: boolean) => void;
  selectedFileIds: string[];
  selectedFolderIds: string[];
  selectedFiles: Set<string>;
  selectedFolders: Set<string>;
  currentFolderId: string | null;
  clearSelection: () => void;
  refreshListsAfterMove: () => Promise<unknown>;
  getOptimisticMoveRollback: (
    fileIds: string[],
    folderIds: string[],
    targetFolderId: string | null,
  ) => (() => void) | void;
  showCreateFolder: boolean;
  setShowCreateFolder: (show: boolean) => void;
  addFolderToList: () => void;
  renamingFolder: Folder | null;
  setRenamingFolder: (folder: Folder | null) => void;
  handleRenameFolderSubmit: (folderId: string, newName: string) => Promise<void>;
  renamingFile: FileMetadata | null;
  setRenamingFile: (file: FileMetadata | null) => void;
  handleRenameFileSubmit: (fileId: string, newName: string) => Promise<void>;
  deleteConfirm: DeleteConfirmState | null;
  deleteLoading: boolean;
  executeDelete: () => Promise<void>;
  setDeleteConfirm: (state: DeleteConfirmState | null) => void;
}

export default function FileListDialogs({
  previewFile,
  displayFiles,
  displayFileIndexById,
  setPreviewFile,
  shareFile,
  setShareFile,
  showBatchShare,
  setShowBatchShare,
  batchShareFileIds,
  setBatchShareFileIds,
  showBatchMove,
  setShowBatchMove,
  selectedFileIds,
  selectedFolderIds,
  selectedFiles,
  selectedFolders,
  currentFolderId,
  clearSelection,
  refreshListsAfterMove,
  getOptimisticMoveRollback,
  showCreateFolder,
  setShowCreateFolder,
  addFolderToList,
  renamingFolder,
  setRenamingFolder,
  handleRenameFolderSubmit,
  renamingFile,
  setRenamingFile,
  handleRenameFileSubmit,
  deleteConfirm,
  deleteLoading,
  executeDelete,
  setDeleteConfirm,
}: FileListDialogsProps) {
  return (
    <>
      {previewFile && (
        <FilePreview
          key={previewFile.id}
          file={previewFile}
          files={displayFiles}
          currentIndex={displayFileIndexById.get(previewFile.id) ?? -1}
          onClose={() => setPreviewFile(null)}
          onNavigate={(file) => setPreviewFile(file)}
          data-oid="wdj1-t:"
        />
      )}

      {shareFile && (
        <ShareDialog
          fileId={shareFile.id}
          filename={shareFile.original_filename}
          onClose={() => setShareFile(null)}
          data-oid="725q.v6"
        />
      )}

      {showBatchShare && batchShareFileIds.length > 0 && (
        <BatchShareDialog
          fileIds={batchShareFileIds}
          fileCount={batchShareFileIds.length}
          onClose={() => {
            setShowBatchShare(false);
            setBatchShareFileIds([]);
          }}
          onShareCreated={() => {
            setShowBatchShare(false);
            setBatchShareFileIds([]);
          }}
          data-oid="dyor7nn"
        />
      )}

      {showBatchMove && (
        <BatchMoveDialog
          fileIds={selectedFileIds}
          folderIds={selectedFolderIds}
          fileCount={selectedFiles.size}
          folderCount={selectedFolders.size}
          onClose={() => setShowBatchMove(false)}
          onMoved={() => {
            setShowBatchMove(false);
            clearSelection();
            clearFileListCache();
            void refreshListsAfterMove();
          }}
          onPartialMoved={() => {
            clearFileListCache();
            void refreshListsAfterMove();
          }}
          onApplyOptimistic={getOptimisticMoveRollback}
          data-oid="wijc1j6"
        />
      )}

      {showCreateFolder && (
        <CreateFolderDialog
          open={showCreateFolder}
          parentId={currentFolderId}
          onClose={() => setShowCreateFolder(false)}
          onCreated={() => {
            setShowCreateFolder(false);
            addFolderToList();
          }}
          data-oid="q3cg405"
        />
      )}

      {renamingFolder && (
        <RenameFolderDialog
          open={!!renamingFolder}
          folder={renamingFolder}
          onClose={() => setRenamingFolder(null)}
          onRename={handleRenameFolderSubmit}
          onRenamed={() => setRenamingFolder(null)}
          data-oid="bg6aib7"
        />
      )}

      {renamingFile && (
        <RenameFileDialog
          open={!!renamingFile}
          file={renamingFile}
          onClose={() => setRenamingFile(null)}
          onRename={handleRenameFileSubmit}
          onRenamed={() => setRenamingFile(null)}
          data-oid="wlfff9t"
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          open={!!deleteConfirm}
          appearance="glass"
          title={deleteTitle(deleteConfirm)}
          message={<DeleteMessage deleteConfirm={deleteConfirm} />}
          confirmText="删除"
          cancelText="取消"
          variant="danger"
          loading={deleteLoading}
          onConfirm={executeDelete}
          onCancel={() => setDeleteConfirm(null)}
          data-oid="q.3eg77"
        />
      )}
    </>
  );
}

function deleteTitle(deleteConfirm: DeleteConfirmState): string {
  if (deleteConfirm.type === "batch") return "确认批量删除";
  if (deleteConfirm.type === "folder") return "确认删除文件夹";
  return "确认删除文件";
}

function DeleteMessage({ deleteConfirm }: { deleteConfirm: DeleteConfirmState }) {
  if (deleteConfirm.type === "batch") {
    return (
      <>
        <span className="text-[var(--confirm-message-text)]" data-oid="zsildfw">
          即将删除{" "}
          {[
            deleteConfirm.fileCount && `${deleteConfirm.fileCount} 个文件`,
            deleteConfirm.folderCount && `${deleteConfirm.folderCount} 个文件夹`,
          ]
            .filter(Boolean)
            .join(" 和 ")}
          。
        </span>
        <br data-oid="at7fu0h" />
        <br data-oid="rg6ey42" />
        <span
          className="text-[var(--confirm-warning-icon-text)] text-xs font-medium"
          data-oid="9b-_hbd"
        >
          此操作不可撤销！
        </span>
      </>
    );
  }

  const isFolder = deleteConfirm.type === "folder";
  return (
    <>
      <span className="text-[var(--confirm-message-text)] text-xs" data-oid="ds-rov4">
        确定要删除{isFolder ? "文件夹" : "文件"}「
      </span>
      <span
        className="text-[var(--confirm-danger-icon-text)] text-sm font-semibold"
        data-oid="vhgtpiy"
      >
        {truncateNameForConfirm(deleteConfirm.name ?? "")}
      </span>
      <span className="text-[var(--confirm-message-text)] text-xs" data-oid="b2ibywr">
        」吗？
      </span>
      <br data-oid="0zg3ojk" />
      <br data-oid="8:hal45" />
      <span className="text-[var(--confirm-warning-icon-text)] text-xs" data-oid="7fbxfgr">
        {isFolder ? "文件夹内的所有内容也会被删除！" : "此操作不可撤销。"}
      </span>
    </>
  );
}

function truncateNameForConfirm(name: string, maxLen = 19): string {
  if (!name || name.length <= maxLen) return name;
  const extMatch = name.match(/\.[^.]+$/);
  const ext = extMatch ? extMatch[0] : "";
  const base = name.slice(0, name.length - ext.length);
  const budget = maxLen - ext.length - 1;
  if (budget <= 0) return `${name.slice(0, maxLen - 1)}…`;
  const head = base.slice(0, Math.ceil(budget / 2));
  const tail = base.slice(-Math.floor(budget / 2));
  return `${head}…${tail}${ext}`;
}
