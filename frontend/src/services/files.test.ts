import { describe, expect, it } from 'vitest';
import { fileService } from './files';

const expectedMethods = [
  'getFilesByIds',
  'getFileMetadata',
  'listFiles',
  'uploadInstant',
  'uploadFileWithInstant',
  'uploadFile',
  'chunkedUploadInit',
  'chunkedUploadChunk',
  'chunkedUploadStatus',
  'chunkedUploadComplete',
  'chunkedUploadAbort',
  'uploadFileChunked',
  'downloadFile',
  'getFileAsBlob',
  'getFileRange',
  'getFileSize',
  'deleteFile',
  'renameFile',
  'batchDelete',
  'listTrash',
  'restoreFile',
  'permanentlyDeleteFile',
  'emptyTrash',
  'downloadZip',
  'getPreviewUrl',
  'getGifVideoPreviewUrl',
  'prepareVideoPreview',
  'getVideoPreviewStatus',
  'getHlsUrl',
  'prepareHlsPreview',
  'getHlsPreviewStatus',
  'getThumbnailUrl',
  'fetchThumbnailBlob',
  'fetchPreviewBlob',
  'cachePreviewBlobUrl',
  'takeCachedPreviewBlobUrl',
  'getCategories',
  'batchMove',
  'getStorageUsage',
] as const;

describe('fileService facade', () => {
  it('keeps the public method contract after domain splitting', () => {
    for (const method of expectedMethods) {
      expect(fileService[method]).toEqual(expect.any(Function));
    }
  });

  it('keeps upload thresholds available for upload orchestration', () => {
    expect(fileService.CHUNK_SIZE).toEqual(expect.any(Number));
    expect(fileService.CHUNK_THRESHOLD).toEqual(expect.any(Number));
  });
});
