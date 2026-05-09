import { useMemo } from "react";
import { LARGE_FILE_UPLOAD } from "../../../constants";
import UploadFileItem, { type UploadFile } from "./UploadFileItem";

interface UploadProgressListProps {
  uploadFiles: UploadFile[];
  onRemoveFile: (fileId: string) => void;
  onRetryFile: (fileId: string) => void;
  onClearAll: () => void;
  maxBatchCount: number;
  totalAtLimit: boolean;
  largeAtLimit: boolean;
  totalLimitWarning: string;
  largeLimitWarning: string;
  duplicateWarning: string;
}

export default function UploadProgressList({
  uploadFiles,
  onRemoveFile,
  onRetryFile,
  onClearAll,
  maxBatchCount,
  totalAtLimit,
  largeAtLimit,
  totalLimitWarning,
  largeLimitWarning,
  duplicateWarning,
}: UploadProgressListProps) {
  const uploadStats = useMemo(() => {
    const largeFileCount = uploadFiles.filter(
      (f) => f.file && f.size >= LARGE_FILE_UPLOAD.SIZE_THRESHOLD_BYTES,
    ).length;
    const totalSize = uploadFiles.reduce((acc, f) => acc + f.size, 0);
    const completedCount = uploadFiles.filter(
      (f) => f.status === "success",
    ).length;
    const failedCount = uploadFiles.filter((f) => f.status === "error").length;

    return { largeFileCount, totalSize, completedCount, failedCount };
  }, [uploadFiles]);

  return (
    <>
      {/* 总文件数 / 大文件数：分开显示、分开提醒 */}
      {uploadFiles.length > 0 && (
        <div className="font-brand mb-[clamp(0.585rem,1.35vw,0.75rem)] space-y-[clamp(0.39rem,0.9vw,0.5rem)]" data-oid="yznpezc">
          <div
            className="flex items-center justify-between rounded-[clamp(0.4rem,1vw,0.5rem)] bg-[var(--upload-stat-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] font-normal tracking-widest text-[var(--upload-stat-text)]"
            data-oid="g0ntg:8"
          >
            <span data-oid=":i:btah">文件数量</span>
            <span
              className={
                totalAtLimit
                  ? "text-[var(--upload-warning-text)]"
                  : "text-[var(--upload-stat-value)]"
              }
              data-oid="-4lmeu7"
            >
              {uploadFiles.length} / {maxBatchCount} 个
            </span>
          </div>
          <div
            className="flex items-center justify-between rounded-[clamp(0.4rem,1vw,0.5rem)] bg-[var(--upload-stat-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] font-normal tracking-widest text-[var(--upload-stat-text)]"
            data-oid="woge7mu"
          >
            <span data-oid="cg18l.s">大文件（≥100MB）</span>
            <span
              className={
                largeAtLimit
                  ? "text-[var(--upload-warning-text)]"
                  : "text-[var(--upload-stat-value)]"
              }
              data-oid="wmr3zro"
            >
              {uploadStats.largeFileCount} / {LARGE_FILE_UPLOAD.MAX_CONCURRENT}{" "}
              个
            </span>
          </div>
        </div>
      )}
      {totalLimitWarning && (
        <div
          className="font-brand mb-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.4rem,1vw,0.5rem)] bg-[var(--upload-warning-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] font-normal tracking-widest text-[var(--upload-warning-text)]"
          data-oid="pap8bih"
        >
          {totalLimitWarning}
        </div>
      )}
      {largeLimitWarning && (
        <div
          className="font-brand mb-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.4rem,1vw,0.5rem)] bg-[var(--upload-warning-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] font-normal tracking-widest text-[var(--upload-warning-text)]"
          data-oid="n.4sq-9"
        >
          {largeLimitWarning}
        </div>
      )}
      {duplicateWarning && (
        <div
          className="font-brand mb-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.4rem,1vw,0.5rem)] bg-[var(--upload-drop-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] font-normal tracking-widest text-[var(--upload-text-muted)]"
          data-oid="9mpex2h"
        >
          {duplicateWarning}
        </div>
      )}
      {uploadFiles.length > 0 && totalAtLimit && !totalLimitWarning && (
        <div
          className="font-brand mb-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--upload-warning-border)] bg-[var(--upload-warning-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] font-normal tracking-widest text-[var(--upload-warning-text)]"
          data-oid="mkphsir"
        >
          单次最多 {maxBatchCount}{" "}
          个文件，当前已满。请先完成或取消后再添加。
        </div>
      )}
      {uploadFiles.length > 0 && largeAtLimit && !largeLimitWarning && (
        <div
          className="font-brand mb-[clamp(0.585rem,1.35vw,0.75rem)] rounded-[clamp(0.4rem,1vw,0.5rem)] border border-[var(--upload-warning-border)] bg-[var(--upload-warning-bg)] px-[clamp(0.585rem,1.35vw,0.75rem)] py-[clamp(0.39rem,0.9vw,0.5rem)] text-[clamp(0.68rem,1.6vw,0.75rem)] font-normal tracking-widest text-[var(--upload-warning-text)]"
          data-oid="hzvtxeq"
        >
          大文件（≥100MB）最多 {LARGE_FILE_UPLOAD.MAX_CONCURRENT}{" "}
          个，当前已满。请先完成或取消后再添加。
        </div>
      )}

      {/* 已上传文件列表 */}
      {uploadFiles.length > 0 && (
        <div className="mb-[clamp(1rem,2.25vw,1.25rem)]" data-oid="6u.unr8">
          <div
            className="mb-[clamp(0.585rem,1.35vw,0.75rem)] flex items-center justify-between"
            data-oid="t5k3x3w"
          >
            <p
              className="font-brand text-[clamp(0.75rem,1.8vw,0.875rem)] font-normal tracking-widest text-[var(--upload-text)]"
              data-oid="vem_b1r"
            >
              Uploaded Files
            </p>
            <button
              onClick={onClearAll}
              className="font-brand text-[clamp(0.68rem,1.6vw,0.75rem)] font-normal tracking-widest text-[var(--upload-accent)] transition-colors hover:text-[var(--upload-accent-hover)]"
              data-oid="gqxm32m"
            >
              清空全部
            </button>
          </div>
          <div
            className="uploadDialogCyberList max-h-[clamp(12rem,45vh,15rem)] space-y-[clamp(0.39rem,0.9vw,0.5rem)] overflow-y-auto pr-[clamp(0.195rem,0.45vw,0.25rem)]"
            data-oid="wo3szfd"
          >
            {uploadFiles.map((file) => (
              <UploadFileItem
                key={file.id}
                file={file}
                onRemove={() => onRemoveFile(file.id)}
                onRetry={() => onRetryFile(file.id)}
                data-oid="tt0kt07"
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
