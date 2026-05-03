import UploadDropzone from "./UploadDropzone";
import UploadProgressList from "./UploadProgressList";
import UploadUrlForm from "./UploadUrlForm";
import { useUploadDialogController } from "./useUploadDialogController";
import "./UploadDialog.css";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

export default function UploadDialog({
  open,
  onClose,
  onUploadComplete,
}: UploadDialogProps) {
  const controller = useUploadDialogController({
    open,
    onClose,
    onUploadComplete,
  });

  if (!open) return null;

  return (
    <div
      className="uploadDialogCyberBackdrop fixed inset-0 z-50 flex items-center justify-center bg-[var(--upload-backdrop)] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-dialog-title"
      data-oid=".7:8wip"
    >
      <div
        className="uploadDialogCyberSurface flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[var(--upload-surface-bg)] text-[var(--upload-text)] shadow-2xl animate-fade-in"
        data-oid="oz49qwv"
      >
        <UploadDialogHeader
          isUploading={controller.isUploading}
          onClose={controller.handleClose}
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-6" data-oid="5gs6vhm">
          <UploadDropzone
            dragActive={controller.dragActive}
            onDragEnter={controller.handleDrag}
            onDragLeave={controller.handleDrag}
            onDragOver={controller.handleDrag}
            onDrop={controller.handleDrop}
            onFilesSelect={controller.appendFilesToState}
            open={open}
          />

          <UploadUrlForm onFileAdd={controller.handleUrlFileAdd} />

          <UploadProgressList
            uploadFiles={controller.uploadFiles}
            onRemoveFile={controller.handleRemove}
            onRetryFile={controller.handleRetry}
            onClearAll={controller.handleClearAll}
            maxBatchCount={controller.maxBatchCount}
            totalAtLimit={controller.totalAtLimit}
            largeAtLimit={controller.largeAtLimit}
            totalLimitWarning={controller.totalLimitWarning}
            largeLimitWarning={controller.largeLimitWarning}
            duplicateWarning={controller.duplicateWarning}
          />
        </div>

        <UploadDialogFooter
          isUploading={controller.isUploading}
          hasPending={controller.hasPending}
          hasFiles={controller.uploadFiles.length > 0}
          onCancel={controller.handleClose}
          onAttach={controller.handleAttach}
        />
      </div>
    </div>
  );
}

function UploadDialogHeader({
  isUploading,
  onClose,
}: {
  isUploading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex-shrink-0 p-6 pb-0" data-oid="-5uz:9s">
      <div className="mb-1 flex items-center justify-between" data-oid="kbqfnqy">
        <h2
          id="upload-dialog-title"
          className="font-brand text-lg font-normal tracking-widest text-[var(--upload-text)]"
          data-oid="zksxhi."
        >
          Upload Files
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={isUploading}
          aria-label="关闭"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--upload-text-muted)] transition-colors hover:bg-[var(--upload-control-hover)] hover:text-[var(--upload-text)] disabled:cursor-not-allowed disabled:opacity-50"
          data-oid="nrse-xn"
        >
          <CloseIcon data-oid="2v7ndiv" />
        </button>
      </div>
      <p
        className="font-brand mb-5 text-sm font-normal tracking-widest text-[var(--upload-text-muted)]"
        data-oid="oa-6jsg"
      >
        Uploaded project attachments
      </p>
    </div>
  );
}

function UploadDialogFooter({
  isUploading,
  hasPending,
  hasFiles,
  onCancel,
  onAttach,
}: {
  isUploading: boolean;
  hasPending: boolean;
  hasFiles: boolean;
  onCancel: () => void;
  onAttach: () => void;
}) {
  return (
    <div className="flex-shrink-0 p-6 pt-4" data-oid="9yo:.vp">
      <div className="flex gap-3" data-oid="3b-ji.z">
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading}
          className="uploadDialogCyberSecondaryBtn font-brand flex-1 rounded-lg bg-[var(--btn-secondary-bg)] px-4 py-2 text-sm font-normal tracking-widest text-[var(--btn-secondary-text)] transition-colors hover:bg-[var(--btn-secondary-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          data-oid="tq87jek"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAttach}
          disabled={!hasFiles || (isUploading && !hasPending)}
          className="uploadDialogCyberPrimaryBtn font-brand flex-1 rounded-lg bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-normal tracking-widest text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--btn-primary-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          data-oid="-49nfvp"
        >
          {hasPending ? "Start Upload" : isUploading ? "Uploading..." : "Attach files"}
        </button>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      data-oid="gj1aoxz"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
        data-oid="-_l5jt3"
      />
    </svg>
  );
}
