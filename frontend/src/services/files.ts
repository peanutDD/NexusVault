import { fileCategoryService } from './fileCategoryService';
import { fileDownloadService } from './fileDownloadService';
import { fileListService } from './fileListService';
import { filePreviewService } from './filePreviewService';
import { fileUploadService } from './fileUploadService';

export { fileCategoryService } from './fileCategoryService';
export { fileDownloadService } from './fileDownloadService';
export { fileListService } from './fileListService';
export { filePreviewService } from './filePreviewService';
export { fileShareService } from './fileShareService';
export { fileUploadService } from './fileUploadService';

export const fileService = {
  ...fileListService,
  ...fileUploadService,
  ...fileDownloadService,
  ...filePreviewService,
  ...fileCategoryService,
};

export type FileService = typeof fileService;
