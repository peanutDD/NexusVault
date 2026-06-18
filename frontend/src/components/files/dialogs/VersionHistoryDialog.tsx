import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Modal from "../../common/dialog/Modal";
import ConfirmDialog from "../../common/dialog/ConfirmDialog";
import ErrorMessage from "../../common/feedback/ErrorMessage";
import { fileVersionService } from "../../../services/versions";
import { FILE_COLLECTION_COUNTS_QUERY_KEY } from "../../../services/fileListService";
import type { FileMetadata, FileVersion } from "../../../types/files";
import { formatFileSize } from "../../../utils/format";
import { getErrorMessage } from "../../../utils/error";

interface VersionHistoryDialogProps {
  file: FileMetadata;
  onClose: () => void;
}

export default function VersionHistoryDialog({ file, onClose }: VersionHistoryDialogProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [diffVersion, setDiffVersion] = useState<FileVersion | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<{
    kind: "restore" | "delete";
    version: FileVersion;
  } | null>(null);

  const versions = useQuery({
    queryKey: ["file-versions", file.id],
    queryFn: () => fileVersionService.list(file.id),
  });
  const hasVersions = (versions.data?.versions.length ?? 0) > 0;

  const restore = async (version: FileVersion) => {
    try {
      await fileVersionService.restore(file.id, version.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["files"] }),
        queryClient.invalidateQueries({ queryKey: FILE_COLLECTION_COUNTS_QUERY_KEY }),
      ]);
      await versions.refetch();
    } catch (err) {
      setError(getErrorMessage(err, "恢复版本失败"));
    }
  };

  const remove = async (version: FileVersion) => {
    try {
      await fileVersionService.remove(version.id);
      await versions.refetch();
    } catch (err) {
      setError(getErrorMessage(err, "删除版本失败"));
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    if (action.kind === "restore") {
      await restore(action.version);
      return;
    }
    await remove(action.version);
  };

  const showDiff = async (version: FileVersion) => {
    try {
      setDiffVersion(version);
      setDiff(await fileVersionService.diff(file.id, version.id));
    } catch (err) {
      setError(getErrorMessage(err, "读取 diff 失败"));
    }
  };

  const saveLabel = async (version: FileVersion) => {
    try {
      await fileVersionService.updateLabel(version.id, labels[version.id] ?? version.label ?? "");
      await versions.refetch();
    } catch (err) {
      setError(getErrorMessage(err, "保存备注失败"));
    }
  };

  return (
    <Modal
      title="版本历史"
      description={file.original_filename}
      onClose={onClose}
      maxWidth="lg"
      variant="glass"
      panelClassName="fileActionDialogShell"
      placement="nav-safe-center"
    >
      <div className="space-y-[clamp(0.78rem,1.8vw,1rem)]">
        {error && <ErrorMessage type="error" message={error} onClose={() => setError(null)} />}
        {versions.isLoading ? (
          <p className="text-[var(--dialog-panel-text)]">加载中…</p>
        ) : (
          <div
            data-testid="version-history-list"
            className={`${hasVersions ? "fileActionDialogInsetList" : ""} max-h-[min(58vh,32rem)] overflow-auto pr-[clamp(0.2rem,0.45vw,0.25rem)]`}
          >
            {(versions.data?.versions ?? []).map((version) => (
              <div
                key={version.id}
                data-testid={`version-history-row-${version.id}`}
                className="fileActionDialogRaisedRow mb-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.6rem,1.35vw,0.75rem)] border border-[var(--dialog-panel-border,var(--dialog-field-border))] bg-[var(--dialog-panel-bg)] p-[clamp(0.78rem,1.8vw,1rem)]"
              >
                <div className="flex flex-col gap-[clamp(0.585rem,1.35vw,0.75rem)] sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--dialog-panel-text)]">
                      Version {version.version_number}
                      {version.label ? ` · ${version.label}` : ""}
                    </p>
                    <p className="text-[clamp(0.68rem,1.6vw,0.75rem)] text-[var(--dialog-label-text)]">
                      {formatFileSize(version.file_size)} · {new Date(version.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-[clamp(0.39rem,0.9vw,0.5rem)]">
                    <input
                      value={labels[version.id] ?? version.label ?? ""}
                      onChange={(event) =>
                        setLabels((prev) => ({ ...prev, [version.id]: event.target.value }))
                      }
                      placeholder="备注"
                      className="singleShareDialogField min-w-[var(--app-version-label-min-width)] rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-field-border)] bg-[var(--dialog-field-bg)] px-[clamp(0.58rem,1.35vw,0.75rem)] py-[clamp(0.3rem,0.8vw,0.4rem)] text-[var(--dialog-field-text)]"
                    />
                    <button className="singleShareDialogAction rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-action-border)] bg-[var(--dialog-action-bg)] px-[clamp(0.58rem,1.35vw,0.75rem)] py-[clamp(0.3rem,0.8vw,0.4rem)] text-[var(--dialog-action-text)]" onClick={() => saveLabel(version)}>
                      Save
                    </button>
                    {version.can_diff && (
                      <button className="singleShareDialogAction rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-action-border)] bg-[var(--dialog-action-bg)] px-[clamp(0.58rem,1.35vw,0.75rem)] py-[clamp(0.3rem,0.8vw,0.4rem)] text-[var(--dialog-action-text)]" onClick={() => showDiff(version)}>
                        Diff
                      </button>
                    )}
                    <a className="singleShareDialogAction rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-action-border)] bg-[var(--dialog-action-bg)] px-[clamp(0.58rem,1.35vw,0.75rem)] py-[clamp(0.3rem,0.8vw,0.4rem)] text-[var(--dialog-action-text)]" href={fileVersionService.downloadUrl(version.id)}>
                      Download
                    </a>
                    {version.can_preview && (
                      <a className="singleShareDialogAction rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-action-border)] bg-[var(--dialog-action-bg)] px-[clamp(0.58rem,1.35vw,0.75rem)] py-[clamp(0.3rem,0.8vw,0.4rem)] text-[var(--dialog-action-text)]" href={fileVersionService.previewUrl(version.id)} target="_blank" rel="noreferrer">
                        Preview
                      </a>
                    )}
                    <button
                      aria-label={`Restore version ${version.version_number}`}
                      className="singleShareDialogAction rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-action-border)] bg-[var(--dialog-action-bg)] px-[clamp(0.58rem,1.35vw,0.75rem)] py-[clamp(0.3rem,0.8vw,0.4rem)] text-[var(--dialog-action-text)]"
                      onClick={() => setPendingAction({ kind: "restore", version })}
                    >
                      Restore
                    </button>
                    <button
                      aria-label={`Delete version ${version.version_number}`}
                      className="singleShareDialogAction rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--dialog-action-border)] bg-[var(--dialog-action-bg)] px-[clamp(0.58rem,1.35vw,0.75rem)] py-[clamp(0.3rem,0.8vw,0.4rem)] text-[var(--dialog-action-text)]"
                      onClick={() => setPendingAction({ kind: "delete", version })}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!hasVersions && (
              <p className="fileActionDialogEmptyState fileActionDialogInsetList rounded-[clamp(0.55rem,1.25vw,0.7rem)] px-[clamp(0.78rem,1.8vw,1rem)] py-[clamp(0.58rem,1.35vw,0.75rem)] text-[var(--dialog-panel-text)]">
                暂无历史版本。
              </p>
            )}
          </div>
        )}
        {diffVersion && diff !== null && (
          <pre className="fileActionDialogInsetList max-h-[14rem] overflow-auto rounded-[clamp(0.5rem,1.1vw,0.625rem)] bg-[var(--neu-inset-bg)] p-[clamp(0.78rem,1.8vw,1rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] text-[var(--dialog-panel-text)]">
            {diff || "No text changes."}
          </pre>
        )}
      </div>
      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.kind === "restore" ? "Restore version" : "Delete version"}
        message={
          pendingAction?.kind === "restore"
            ? "Restore this version and keep the current file as a new history entry?"
            : "Delete this stored version? The current file will not be changed."
        }
        confirmText={pendingAction?.kind === "restore" ? "Restore" : "Delete"}
        cancelText="Cancel"
        variant={pendingAction?.kind === "delete" ? "danger" : "warning"}
        appearance="glass"
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </Modal>
  );
}
