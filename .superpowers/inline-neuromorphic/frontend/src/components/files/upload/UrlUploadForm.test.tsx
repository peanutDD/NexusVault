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

  it('keeps the Add file URL input focusable and editable', () => {
    render(<UrlUploadForm onFileAdd={vi.fn()} />);

    const input = screen.getByLabelText('File URL') as HTMLInputElement;
    expect(input).not.toBeDisabled();
    expect(input).toHaveClass('uploadUrlInput', 'min-w-0');

    input.focus();
    expect(input).toHaveFocus();

    fireEvent.change(input, {
      target: { value: 'https://example.com/photo.jpg' },
    });

    expect(input).toHaveValue('https://example.com/photo.jpg');
    expect(screen.getByRole('button', { name: 'Upload' })).not.toBeDisabled();
  });

  it('puts the caret in the URL input when the URL panel is tapped', () => {
    render(<UrlUploadForm onFileAdd={vi.fn()} />);

    const input = screen.getByLabelText('File URL') as HTMLInputElement;
    fireEvent.pointerDown(screen.getByTestId('upload-url-panel'), {
      pointerType: 'touch',
    });

    expect(input).toHaveFocus();

    fireEvent.change(input, {
      target: { value: 'https://example.com/pasted-link.zip' },
    });

    expect(input).toHaveValue('https://example.com/pasted-link.zip');
  });
});
