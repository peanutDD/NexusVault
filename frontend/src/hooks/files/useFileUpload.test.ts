import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileUpload } from './useFileUpload';
import { fileService } from '../../services/files';

vi.mock('../../services/files', () => ({
  fileService: {
    uploadFileWithInstant: vi.fn(),
  },
}));

vi.mock('../../utils/telemetry', () => ({
  trackError: vi.fn(),
  trackEvent: vi.fn(),
}));

const uploadFileWithInstant = vi.mocked(fileService.uploadFileWithInstant);

function makeFile(name: string, body = 'hello'): File {
  return new File([body], name, { type: 'text/plain' });
}

describe('useFileUpload cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes AbortSignal to uploads and aborts it when the item is removed', async () => {
    let capturedSignal: AbortSignal | undefined;
    uploadFileWithInstant.mockImplementation((_file, _onProgress, _folderId, options) => {
      capturedSignal = options?.signal;
      return new Promise((_, reject) => {
        options?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Upload cancelled', 'AbortError')),
          { once: true },
        );
      });
    });

    const { result } = renderHook(() => useFileUpload());
    const file = makeFile('note.txt');

    act(() => result.current.addFiles([file]));
    const uploadId = result.current.uploadFiles[0].id;

    let uploadPromise: Promise<void>;
    act(() => {
      uploadPromise = result.current.startUpload();
    });

    await waitFor(() => expect(capturedSignal).toBeDefined());

    act(() => result.current.removeFile(uploadId));
    await act(async () => uploadPromise!);

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.uploadFiles).toHaveLength(0);
  });
});
