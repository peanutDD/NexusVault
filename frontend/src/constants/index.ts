/**
 * App-wide constants. Avoid magic numbers and duplicated config.
 */

export const FILE_LIST = {
  ROW_HEIGHT: 72,
  LIST_HEIGHT: 480,
  LIMIT: 100,
  CACHE_MINUTES: 5,
} as const;

/**
 * 分块上传配置
 * 使用现代上传技术：分块、并行、断点续传
 */
export const CHUNKED_UPLOAD = {
  // 分块大小：10MB（平衡网络效率和内存占用）
  CHUNK_SIZE: 10 * 1024 * 1024,
  // 触发分块上传的阈值：10MB 以上使用分块
  THRESHOLD: 10 * 1024 * 1024,
  // 最大重试次数
  MAX_RETRIES: 5,
  // 并行上传的块数（提高大文件上传速度）
  PARALLEL_CHUNKS: 3,
  // 重试延迟（毫秒），指数退避
  RETRY_DELAY_BASE: 1000,
} as const;

export const SIZES = ['Bytes', 'KB', 'MB', 'GB', 'TB'] as const;
