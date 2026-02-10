import { describe, it, expect } from 'vitest';
import {
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

  it('should respect max batch count helper', () => {
    const maxBatch = getMaxBatchCount();
    expect(maxBatch).toBeGreaterThan(0);
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

