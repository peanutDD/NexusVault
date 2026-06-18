export interface ChunkedUploadSessionRecord {
  uploadId: string;
  chunkSize: number;
  totalParts: number;
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  mimeType: string;
  folderId: string | null;
  contentSha256: string;
  updatedAt: number;
}

const DB_NAME = 'file-storage-upload-journal';
const DB_VERSION = 1;
const STORE_NAME = 'chunked_sessions';

let openPromise: Promise<IDBDatabase | null> | null = null;

function hasIndexedDb(): boolean {
  return typeof globalThis.indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  if (openPromise) return openPromise;

  openPromise = new Promise((resolve) => {
    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return openPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = run(store);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
    tx.onerror = () => resolve(null);
  });
}

function readFallback(key: string): ChunkedUploadSessionRecord | null {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as ChunkedUploadSessionRecord;
  } catch {
    return null;
  }
}

function writeFallback(key: string, record: ChunkedUploadSessionRecord): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(record));
  } catch {
    // Persistent resume state is best-effort.
  }
}

function removeFallback(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

export async function readChunkedSessionRecord(
  key: string,
): Promise<ChunkedUploadSessionRecord | null> {
  const indexedDbRecord = await withStore<ChunkedUploadSessionRecord>('readonly', (store) =>
    store.get(key),
  );
  return indexedDbRecord ?? readFallback(key);
}

export async function writeChunkedSessionRecord(
  key: string,
  record: ChunkedUploadSessionRecord,
): Promise<void> {
  const written = await withStore<IDBValidKey>('readwrite', (store) => store.put(record, key));
  if (written === null) writeFallback(key, record);
}

export async function removeChunkedSessionRecord(key: string): Promise<void> {
  await withStore<undefined>('readwrite', (store) => store.delete(key));
  removeFallback(key);
}
