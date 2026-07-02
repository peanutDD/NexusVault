import { describe, it, expect } from 'vitest';
import {
  getUploadMimeType,
  getMaxFileSizeBytes,
  validateFile,
  getMaxBatchCount,
  isLargeFile,
  isLargeFileForConcurrentLimit,
} from './uploadValidation';

function makeFile(options: { name: string; size: number; type?: string }): File {
  const { name, size, type } = options;
  return {
    name,
    size,
    type: type ?? '',
  } as unknown as File;
}

describe('uploadValidation', () => {
  it('should accept a normal allowed file type', () => {
    const file = makeFile({
      name: 'photo.jpg',
      size: 1024 * 1024,
      type: 'image/jpeg',
    });

    const result = validateFile(file);
    expect(result.ok).toBe(true);
  });

  it('should reject disallowed mime types', () => {
    const file = makeFile({
      name: 'script.sh',
      size: 10 * 1024,
      type: 'text/x-shellscript',
    });

    const result = validateFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('不允许上传');
    }
  });

  it('should infer common upload mime types from extension when browser mime is missing', () => {
    const file = makeFile({
      name: 'camera-roll.mp4',
      size: 1024 * 1024,
      type: '',
    });

    expect(getUploadMimeType(file)).toBe('video/mp4');
    expect(validateFile(file).ok).toBe(true);
  });

  it('should reject dangerous executable extensions even when browser mime is missing', () => {
    const file = makeFile({
      name: 'deploy.sh',
      size: 10 * 1024,
      type: '',
    });

    const result = validateFile(file);
    expect(result.ok).toBe(false);
  });

  it('should respect max batch count helper', () => {
    const maxBatch = getMaxBatchCount();
    expect(maxBatch).toBeGreaterThan(0);
  });

  it('should expose the byte limit used by preflight upload checks', () => {
    expect(getMaxFileSizeBytes()).toBeGreaterThan(0);
    expect(getMaxFileSizeBytes()).toBe(getMaxFileSizeBytes());
  });

  it('should classify large files correctly', () => {
    expect(isLargeFile(5 * 1024 * 1024)).toBe(false);
    expect(isLargeFile(15 * 1024 * 1024)).toBe(true);
  });

  it('should classify files for concurrent limit by threshold', () => {
    const justBelow = 100 * 1024 * 1024 - 1;
    const justAbove = 100 * 1024 * 1024 + 1;

    expect(isLargeFileForConcurrentLimit(justBelow)).toBe(false);
    expect(isLargeFileForConcurrentLimit(justAbove)).toBe(true);
  });
});
