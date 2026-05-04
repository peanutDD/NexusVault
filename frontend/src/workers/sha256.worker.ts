import { sha256 } from 'js-sha256';

const CHUNK_SIZE = 2 * 1024 * 1024;

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob chunk'));
      reader.readAsArrayBuffer(blob);
    });
  }
  return new Response(blob).arrayBuffer();
}

async function hashFile(file: File): Promise<string> {
  const hasher = sha256.create();
  let offset = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await readBlobAsArrayBuffer(chunk);
    hasher.update(new Uint8Array(buffer));
    offset += CHUNK_SIZE;
  }
  return hasher.hex();
}

self.onmessage = async (e: MessageEvent<File>) => {
  try {
    const file = e.data;
    const hash = await hashFile(file);
    self.postMessage({ ok: true, hash });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'sha256 worker failed';
    self.postMessage({ ok: false, error: message });
  }
};
