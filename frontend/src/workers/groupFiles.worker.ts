/**
 * Web Worker：按类型分组文件，主线程不阻塞。
 * 输入：{ files, typeOrder: Record<typeKey, order> }
 * 输出：{ key, order, files }[]
 */

function getTypeKey(mime: string): string {
  if (mime === 'image/gif') return 'gif';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'application/pdf';
  if (mime.startsWith('text/')) return 'text';
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'application/zip';
  if (mime.startsWith('application/')) return 'application';
  return 'other';
}

export interface FileMetadataWorker {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  category: string | null;
  folder_id: string | null;
  created_at: string;
}

export interface GroupedResultItem {
  key: string;
  order: number;
  files: FileMetadataWorker[];
}

self.onmessage = (e: MessageEvent<{ files: FileMetadataWorker[]; typeOrder: Record<string, number> }>) => {
  const { files, typeOrder } = e.data;
  const groups = new Map<string, FileMetadataWorker[]>();

  for (const file of files) {
    const key = getTypeKey(file.mime_type);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(file);
  }

  const orderOf = (key: string) => typeOrder[key] ?? 999;
  const result: GroupedResultItem[] = Array.from(groups.entries())
    .map(([key, groupFiles]) => ({ key, order: orderOf(key), files: groupFiles }))
    .sort((a, b) => a.order - b.order);

  self.postMessage(result);
};
