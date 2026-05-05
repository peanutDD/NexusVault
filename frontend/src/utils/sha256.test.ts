import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256FileHex } from './sha256';

const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('sha256FileHex', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not read the whole file into memory when Web Crypto is available', async () => {
    vi.stubGlobal('Worker', undefined);
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn(),
      },
    });
    const file = new File(['abc'], 'abc.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockRejectedValue(new Error('whole file read')),
    });

    await expect(sha256FileHex(file)).resolves.toBe(ABC_SHA256);
  });
});
