import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import { fileUploadService } from './fileUploadService';
import { sha256FileHex } from '../utils/sha256';

vi.mock('./api', () => ({
  default: {
    post: vi.fn(),
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../utils/sha256', () => ({
  sha256FileHex: vi.fn(),
}));

vi.mock('../utils/telemetry', () => ({
  trackError: vi.fn(),
  trackEvent: vi.fn(),
}));

const mockedApi = vi.mocked(api);
const apiPost = mockedApi.post as unknown as ReturnType<typeof vi.fn>;
const apiGet = mockedApi.get as unknown as ReturnType<typeof vi.fn>;
const apiDelete = mockedApi.delete as unknown as ReturnType<typeof vi.fn>;
const mockedSha256 = sha256FileHex as unknown as ReturnType<typeof vi.fn>;

function makeFile(name: string, type: string, body = 'hello'): File {
  return new File([body], name, { type });
}

describe('fileUploadService upload orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSha256.mockResolvedValue('a'.repeat(64));
  });

  it('passes AbortSignal through hash, instant check, and normal upload requests', async () => {
    const controller = new AbortController();
    const file = makeFile('note.txt', 'text/plain');

    apiPost
      .mockResolvedValueOnce({ status: 200, data: { instant: false } })
      .mockResolvedValueOnce({
        data: {
          file: {
            id: 'file-1',
            filename: 'note.txt',
          },
        },
      });

    await fileUploadService.uploadFileWithInstant(
      file,
      undefined,
      null,
      { signal: controller.signal },
    );

    expect(mockedSha256).toHaveBeenCalledWith(file, controller.signal);
    expect(apiPost).toHaveBeenNthCalledWith(
      1,
      '/api/files/upload/instant',
      expect.objectContaining({ filename: 'note.txt' }),
      expect.objectContaining({ signal: controller.signal }),
    );
    expect(apiPost).toHaveBeenNthCalledWith(
      2,
      '/api/files/upload',
      expect.any(FormData),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('aborts the server chunked upload session when a queued upload is cancelled after init', async () => {
    const controller = new AbortController();
    const file = makeFile('movie.mp4', 'video/mp4', 'video');

    apiPost.mockImplementationOnce(async () => {
      controller.abort();
      return {
        data: {
          upload_id: 'upload-1',
          chunk_size: 2,
          total_parts: 3,
        },
      };
    });
    apiGet.mockResolvedValue({ data: { uploaded_parts: [], total_parts: 3 } });
    apiDelete.mockResolvedValue({ data: {} });

    await expect(
      fileUploadService.uploadFileChunked(file, undefined, null, {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(apiDelete).toHaveBeenCalledWith(
      '/api/files/upload/chunked/upload-1/abort',
    );
  });
});
