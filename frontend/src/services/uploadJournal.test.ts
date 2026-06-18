import { beforeEach, describe, expect, it } from 'vitest';
import {
  readChunkedSessionRecord,
  removeChunkedSessionRecord,
  writeChunkedSessionRecord,
  type ChunkedUploadSessionRecord,
} from './uploadJournal';

const record: ChunkedUploadSessionRecord = {
  uploadId: 'upload-1',
  chunkSize: 5,
  totalParts: 2,
  fileName: 'movie.mp4',
  fileSize: 10,
  fileLastModified: 123,
  mimeType: 'video/mp4',
  folderId: null,
  contentSha256: 'a'.repeat(64),
  updatedAt: 1,
};

describe('uploadJournal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists chunked upload sessions outside the in-memory upload queue', async () => {
    await writeChunkedSessionRecord('session-key', record);

    await expect(readChunkedSessionRecord('session-key')).resolves.toEqual(record);
  });

  it('removes completed sessions from the persistent journal', async () => {
    await writeChunkedSessionRecord('session-key', record);
    await removeChunkedSessionRecord('session-key');

    await expect(readChunkedSessionRecord('session-key')).resolves.toBeNull();
  });
});
