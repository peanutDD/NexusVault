/**
 * FilePreview 工具函数
 */

// =============================================================================
// 日期格式化
// =============================================================================

/**
 * 将日期字符串格式化为中文短格式（年 月 日）
 */
export function formatPreviewDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// =============================================================================
// 文件名处理
// =============================================================================

/** 文件名最大显示长度 */
const FILENAME_MAX_LEN = 32;

/** 文件名头部保留比例（中间省略时） */
const FILENAME_HEAD_RATIO = 0.6;

/**
 * 对过长文件名做“中间省略”处理
 * 保留扩展名，名称部分按比例截取头尾
 */
export function truncateFilename(full: string): string {
  if (!full) return '';
  if (full.length <= FILENAME_MAX_LEN) return full;

  const match = full.match(/^(.*?)(\.[^.]+)?$/);
  const namePart = match?.[1] ?? full;
  const extPart = match?.[2] ?? '';
  const budget = FILENAME_MAX_LEN - extPart.length - 1;

  if (budget <= 0) {
    return full.slice(0, FILENAME_MAX_LEN - 1) + '…';
  }

  const head = namePart.slice(0, Math.ceil(budget * FILENAME_HEAD_RATIO));
  const tail = namePart.slice(-Math.floor(budget * (1 - FILENAME_HEAD_RATIO)));
  return `${head}…${tail}${extPart}`;
}
