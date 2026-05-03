import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UrlUploadForm from './UrlUploadForm';
import { getMaxFileSizeBytes } from '../../../utils/uploadValidation';

describe('UrlUploadForm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects oversized remote files before reading the response body', async () => {
    const blob = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-length': String(getMaxFileSizeBytes() + 1),
        }),
        blob,
      }),
    );

    const onFileAdd = vi.fn();
    render(<UrlUploadForm onFileAdd={onFileAdd} />);

    fireEvent.change(screen.getByLabelText('File URL'), {
      target: { value: 'https://example.com/big-video.mp4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() =>
      expect(onFileAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error: expect.stringContaining('超过'),
        }),
      ),
    );
    expect(blob).not.toHaveBeenCalled();
  });
});
