/**
 * 文件上传验证模块
 * 支持图片、视频、音频、文档等多种类型
 */

// 最大文件大小：默认 2GB（支持大视频文件）
const MAX_FILE_SIZE =
  Number(import.meta.env.VITE_MAX_FILE_SIZE) || 2 * 1024 * 1024 * 1024; // 2GB

// 单次批量上传最大文件数量：默认 20
const MAX_BATCH_COUNT = Number(import.meta.env.VITE_MAX_BATCH_COUNT) || 20;

// 允许的 MIME 类型（*/* 表示允许所有）
const ALLOWED_MIME_SPEC =
  import.meta.env.VITE_ALLOWED_MIME_TYPES || '*/*';

function parseAllowedTypes(spec: string): string[] {
  return spec.split(',').map((s) => s.trim().toLowerCase());
}

const ALLOWED = parseAllowedTypes(ALLOWED_MIME_SPEC);

function matchesType(mime: string, pattern: string): boolean {
  const p = pattern.toLowerCase().trim();
  // */* 或 * 表示允许所有
  if (p === '*/*' || p === '*') {
    return true;
  }
  // 通配符匹配（如 video/* 匹配 video/mp4）
  if (p.endsWith('/*')) {
    const prefix = p.slice(0, -2);
    return mime.startsWith(prefix + '/');
  }
  // 精确匹配
  return mime === p;
}

export function validateFile(
  file: File
): { ok: true } | { ok: false; error: string } {
  if (file.size > MAX_FILE_SIZE) {
    const maxGB = (MAX_FILE_SIZE / (1024 * 1024 * 1024)).toFixed(1);
    return {
      ok: false,
      error: `「${file.name}」超过 ${maxGB}GB 限制`,
    };
  }
  const mime = (file.type || 'application/octet-stream').toLowerCase();
  const allowed = ALLOWED.length === 0 || ALLOWED.some((p) => matchesType(mime, p));
  if (!allowed) {
    return {
      ok: false,
      error: `「${file.name}」类型 ${file.type || '未知'} 不允许上传`,
    };
  }
  return { ok: true };
}

export function getMaxFileSizeMB(): number {
  return MAX_FILE_SIZE / (1024 * 1024);
}

export function getMaxFileSizeGB(): number {
  return MAX_FILE_SIZE / (1024 * 1024 * 1024);
}

export function getMaxBatchCount(): number {
  return MAX_BATCH_COUNT;
}

/**
 * 判断是否为大文件（需要分块上传）
 */
export function isLargeFile(size: number): boolean {
  return size >= 10 * 1024 * 1024; // 10MB 以上使用分块上传
}

/**
 * 判断是否为视频文件
 */
export function isVideoFile(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

/**
 * 判断是否为音频文件
 */
export function isAudioFile(mimeType: string): boolean {
  return mimeType.startsWith('audio/');
}
