import { afterEach, describe, expect, it, vi } from 'vitest';
import './sha256.worker';

const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('sha256 worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('hashes without reading the whole file into memory when Web Crypto is available', async () => {
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn(),
      },
    });
    const messages: unknown[] = [];
    const postMessage = vi.spyOn(self, 'postMessage').mockImplementation((message) => {
      messages.push(message);
    });
    const file = new File(['abc'], 'abc.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockRejectedValue(new Error('whole file read')),
    });

    await (self.onmessage as (event: MessageEvent<File>) => Promise<void>)({
      data: file,
    } as MessageEvent<File>);

    expect(messages).toEqual([{ ok: true, hash: ABC_SHA256 }]);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });
});
