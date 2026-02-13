/**
 * MIME 类型工具函数
 *
 * 提供统一的 MIME 类型判断和标签生成函数，避免跨组件的代码重复。
 */

// ============================================================================
// 类型判断函数
// ============================================================================

/** 判断是否为图片类型 */
export const isImageType = (mime: string): boolean => mime.startsWith('image/');

/** 判断是否为 GIF 图片（部分场景下按“视频”处理以获得更好的预览体验） */
export const isGifType = (mime: string): boolean =>
  mime.toLowerCase() === 'image/gif';

/** 判断是否为视频类型 */
export const isVideoType = (mime: string): boolean => mime.startsWith('video/');

/** 判断是否为 PDF 类型 */
export const isPdfType = (mime: string): boolean => mime === 'application/pdf';

/** 判断是否为音频类型 */
export const isAudioType = (mime: string): boolean => mime.startsWith('audio/');

/** 判断是否为文本类型（包括代码文件） */
export const isTextType = (mime: string): boolean =>
  mime.startsWith('text/') ||
  mime === 'application/json' ||
  mime === 'application/xml' ||
  mime === 'application/javascript';

/** 判断是否为 Markdown（基于 MIME 与文件名） */
export const isMarkdownType = (mime: string, filename?: string): boolean => {
  const lowerMime = mime.toLowerCase();
  const lowerName = filename?.toLowerCase() ?? '';
  return (
    lowerMime === 'text/markdown' ||
    lowerMime === 'text/x-markdown' ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.markdown')
  );
};

/** 判断是否为文档类型 */
export const isDocumentType = (mime: string): boolean =>
  mime.includes('word') || mime.includes('document');

/** 判断是否为表格类型 */
export const isSpreadsheetType = (mime: string): boolean =>
  mime.includes('excel') || mime.includes('spreadsheet');

/** 判断是否为压缩包类型 */
export const isArchiveType = (mime: string): boolean =>
  mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar');

// ============================================================================
// 标签生成函数
// ============================================================================

/** MIME 类型分类信息 */
export interface MimeTypeInfo {
  /** 分类标签 */
  label: string;
  /** 图标颜色 */
  color: string;
  /** 背景色类名 */
  bgClass: string;
}

/** 获取 MIME 类型的分类标签 */
export function getMimeTypeLabel(mime: string, filename?: string): string {
  // 使用条件表达式链替代 if-else
  return isImageType(mime)
    ? mime.split('/')[1]?.toUpperCase() || 'Image'
    : isVideoType(mime)
      ? 'Video'
      : isAudioType(mime)
        ? 'Audio'
        : isPdfType(mime)
          ? 'PDF'
          : isDocumentType(mime)
            ? 'Document'
            : isSpreadsheetType(mime)
              ? 'Spreadsheet'
              : isArchiveType(mime)
                ? 'Archive'
                : isMarkdownType(mime, filename)
                  ? 'md'
                  : isTextType(mime)
                    ? mime === 'application/json'
                      ? 'JSON'
                      : 'Text'
                    : 'File';
}

/** 获取 MIME 类型的完整信息（标签、颜色、背景） */
export function getMimeTypeInfo(mime: string): MimeTypeInfo {
  // 使用 Map 查找替代多个 if-else
  const typeMap: Array<[() => boolean, MimeTypeInfo]> = [
    [() => isVideoType(mime), { label: 'VIDEO', color: '#8B5CF6', bgClass: 'bg-purple-900/30' }],
    [() => isPdfType(mime), { label: 'PDF', color: '#EF4444', bgClass: 'bg-red-900/30' }],
    [() => isAudioType(mime), { label: 'AUDIO', color: '#22C55E', bgClass: 'bg-green-900/30' }],
    [() => isImageType(mime), { label: 'IMAGE', color: '#6C5DD3', bgClass: 'bg-indigo-900/30' }],
    [() => isDocumentType(mime), { label: 'DOC', color: '#3B82F6', bgClass: 'bg-blue-900/30' }],
    [() => isSpreadsheetType(mime), { label: 'SHEET', color: '#10B981', bgClass: 'bg-emerald-900/30' }],
    [() => isArchiveType(mime), { label: 'ZIP', color: '#F59E0B', bgClass: 'bg-amber-900/30' }],
    // 文本等其他类型：占位背景与视频卡片保持一致的紫色系
    [() => isTextType(mime), { label: 'TEXT', color: '#6B7280', bgClass: 'bg-purple-900/30' }],
  ];

  const match = typeMap.find(([predicate]) => predicate());
  return match?.[1] ?? { label: 'FILE', color: '#6B7280', bgClass: 'bg-purple-900/30' };
}

/** 获取图标颜色（用于 UploadFileItem 等组件） */
export function getMimeTypeColor(mime: string): string {
  return getMimeTypeInfo(mime).color;
}

// ============================================================================
// 预览支持判断
// ============================================================================

/** 判断文件类型是否支持预览 */
export function isPreviewSupported(mime: string): boolean {
  return (
    isImageType(mime) ||
    isPdfType(mime) ||
    isTextType(mime) ||
    isVideoType(mime) ||
    isAudioType(mime)
  );
}

/** 获取预览类型信息 */
export function getPreviewKind(mime: string, filename?: string) {
  const isGif = isGifType(mime);

  return {
    supported: isPreviewSupported(mime),
    // GIF 在预览层面按“视频”处理（走 <video> 管线），避免大 GIF 卡顿
    isImage: isImageType(mime) && !isGif,
    isPDF: isPdfType(mime),
    isText: isTextType(mime),
    isMarkdown: isMarkdownType(mime, filename),
    isVideo: isVideoType(mime) || isGif,
    isAudio: isAudioType(mime),
    // Ugoira 支持已移除，这里固定为 false，避免前端再走任何 Ugoira 分支
    isUgoira: false,
  };
}
