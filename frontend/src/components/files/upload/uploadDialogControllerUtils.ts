import { LARGE_FILE_UPLOAD } from "../../../constants";
import {
  getUploadMimeType,
  isLargeFileForConcurrentLimit,
  validateFile,
} from "../../../utils/uploadValidation";
import type { UploadFile } from "./UploadFileItem";

export function fileDedupKey(f: File): string {
  return `${f.name}-${f.size}-${f.lastModified}`;
}

export function toUploadFile(file: File, baseId: number, index: number): UploadFile {
  const validation = validateFile(file);
  return {
    id: `upload-${baseId}-${index}-${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    mimeType: getUploadMimeType(file),
    status: validation.ok ? "pending" : "error",
    progress: 0,
    error: validation.ok ? undefined : validation.error,
    file: validation.ok ? file : undefined,
  };
}

export function updateLimitWarnings(args: {
  dedupedCount: number;
  filesToAddCount: number;
  largeSkipped: number;
  smallSkipped: number;
  maxBatchCount: number;
  setLargeLimitWarning: (message: string) => void;
  setTotalLimitWarning: (message: string) => void;
}) {
  if (args.largeSkipped > 0) {
    args.setLargeLimitWarning(
      `大文件（≥100MB）最多 ${LARGE_FILE_UPLOAD.MAX_CONCURRENT} 个，${args.largeSkipped} 个大文件未添加。请先完成或取消后再添加。`,
    );
  }

  if (args.smallSkipped > 0 || args.filesToAddCount < args.dedupedCount) {
    const totalSkipped = args.dedupedCount - args.filesToAddCount;
    if (totalSkipped > 0) {
      args.setTotalLimitWarning(
        `单次最多 ${args.maxBatchCount} 个文件（含大文件），${totalSkipped} 个文件未添加。`,
      );
    }
  }
}

export function closeIfAllSuccess(
  files: UploadFile[],
  onUploadComplete: () => void,
  onClose: () => void,
  updateUploadFiles: (files: UploadFile[]) => void,
) {
  const allSuccess = files.length > 0 && files.every((f) => f.status === "success");
  if (!allSuccess) return;
  onUploadComplete();
  onClose();
  updateUploadFiles([]);
}

export function retryFile(files: UploadFile[], id: string): UploadFile[] {
  return files.map((f) =>
    f.id === id && f.file
      ? { ...f, status: "pending", progress: 0, error: undefined }
      : f,
  );
}

export function handleDragEvent(
  e: React.DragEvent,
  setDragActive: (active: boolean) => void,
) {
  e.preventDefault();
  e.stopPropagation();
  if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
  else if (e.type === "dragleave") setDragActive(false);
}

export function getUploadStats(uploadFiles: UploadFile[]) {
  return uploadFiles.reduce(
    (acc, f) => {
      if (f.status === "pending") acc.pendingCount++;
      if (f.status === "uploading") acc.uploadingCount++;
      if (f.status === "success") acc.successCount++;
      if (f.file && isLargeFileForConcurrentLimit(f.file.size)) acc.largeFileCount++;
      return acc;
    },
    { pendingCount: 0, uploadingCount: 0, successCount: 0, largeFileCount: 0 },
  );
}
