import { fileService } from '../services/files';

const preloaded = new Set<string>();

/**
 * 预加载文件预览（hover 时触发，减轻点击后首帧延迟）。
 * 带鉴权请求，失败静默忽略。
 */
export function preloadPreview(fileId: string): void {
  if (preloaded.has(fileId)) return;
  preloaded.add(fileId);
  fileService
    .fetchPreviewBlob(fileId)
    .catch(() => {})
    .finally(() => {
      // 可选：一段时间后从 Set 移除，允许后续再次预加载
      setTimeout(() => preloaded.delete(fileId), 60_000);
    });
}
