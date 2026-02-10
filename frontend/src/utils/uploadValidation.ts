/**
 * 文件上传验证模块
 * 支持图片、视频、音频、文档等多种类型
 */

// 最大文件大小：默认 2GB（支持大视频文件）
const MAX_FILE_SIZE =
  Number(import.meta.env.VITE_MAX_FILE_SIZE) || 2 * 1024 * 1024 * 1024; // 2GB

// 单次批量上传最大文件数量：默认 20
const MAX_BATCH_COUNT = Number(import.meta.env.VITE_MAX_BATCH_COUNT) || 20;

// 允许的 MIME 类型
// 默认与后端 ALLOWED_MIME_TYPES 对齐，并额外放开常见「正常内容文件」：
// - 图片 / 视频 / 音频 / PDF / 文本
// - 常见 Office 文档：Word / Excel / PowerPoint
// - 开放文档：ODT / ODS / ODP
// - 电子书：EPUB / MOBI
// - 压缩包：ZIP / 7z / RAR / TAR / GZIP / BZIP2
const DEFAULT_ALLOWED_MIME_SPEC =
  [
    'image/*',
    'video/*',
    'audio/*',
    'application/pdf',
    'text/*',
    // Office
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // OpenDocument
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    // 电子书
    'application/epub+zip',
    'application/x-mobipocket-ebook',
    // 压缩包 / 归档
    'application/zip',
    'application/x-7z-compressed',
    'application/x-rar-compressed',
    'application/x-tar',
    'application/gzip',
    'application/x-bzip2',
  ].join(',');

const ALLOWED_MIME_SPEC =
  import.meta.env.VITE_ALLOWED_MIME_TYPES || DEFAULT_ALLOWED_MIME_SPEC;

// 明确禁止的高风险 MIME 类型（即使通配符允许，也强制拒绝）
const BLOCKED_MIME_TYPES = [
  'text/x-shellscript',
  'text/x-sh',
  'application/x-sh',
];

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

  // 命中黑名单时直接拒绝上传
  if (BLOCKED_MIME_TYPES.includes(mime)) {
    return {
      ok: false,
      error: `「${file.name}」类型 ${file.type || '未知'} 不允许上传`,
    };
  }

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

/** 大文件数量限制的阈值（与后端、前端 LARGE_FILE_UPLOAD 一致，≥100MB 计入 5 个上限） */
export const LARGE_FILE_LIMIT_THRESHOLD_BYTES = 100 * 1024 * 1024;

/**
 * 是否计入「大文件数量上限」（≥100MB，与后端分片上传会话数限制一致）
 */
export function isLargeFileForConcurrentLimit(size: number): boolean {
  return size >= LARGE_FILE_LIMIT_THRESHOLD_BYTES;
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
