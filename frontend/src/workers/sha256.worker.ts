import { sha256 } from 'js-sha256';

const CHUNK_SIZE = 2 * 1024 * 1024;

async function hashWithCrypto(file: File): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return null;
  }
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashWithJs(file: File): Promise<string> {
  const hasher = sha256.create();
  let offset = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await chunk.arrayBuffer();
    hasher.update(new Uint8Array(buffer));
    offset += CHUNK_SIZE;
  }
  return hasher.hex();
}

self.onmessage = async (e: MessageEvent<File>) => {
  try {
    const file = e.data;
    const cryptoHash = await hashWithCrypto(file);
    if (cryptoHash) {
      self.postMessage({ ok: true, hash: cryptoHash });
      return;
    }
    const jsHash = await hashWithJs(file);
    self.postMessage({ ok: true, hash: jsHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'sha256 worker failed';
    self.postMessage({ ok: false, error: message });
  }
};
