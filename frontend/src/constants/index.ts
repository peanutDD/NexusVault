/**
 * App-wide constants. Avoid magic numbers and duplicated config.
 */

/** 类型筛选项「仅文件夹」的占位值，不传给后端 mime_type */
export const MIME_FILTER_FOLDERS = '__folders__' as const;

export const FILE_LIST = {
  ROW_HEIGHT: 72,
  LIST_HEIGHT: 480,
  /** 网格模式下每行估算高度（用于虚拟列表，需 ≥ 单卡实际高度：缩略图 aspect-square + 文案 + 按钮 + 间距，小屏 2 列时卡更高） */
  VIRTUAL_GRID_ROW_HEIGHT: 360,
  LIMIT: 100,
  CACHE_MINUTES: 5,
  /** 超过该数量时启用虚拟列表 */
  VIRTUAL_THRESHOLD: 24,
} as const;

/**
 * 批量操作限制（避免一次性选择/下载导致卡顿、超时、内存暴涨）
 *
 * 说明：
 * - 前端做“软限制”（提前提示用户），后端仍会做“硬限制”（安全兜底）。
 */
export const BATCH_LIMITS = {
  /** 单次批量下载 ZIP 最多包含的文件数（含从文件夹递归展开出来的文件） */
  MAX_DOWNLOAD_ZIP_FILES: 200,
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

/**
 * 前端降低后端并发压力相关常量
 */
export const REQUEST = {
  /** 全局请求并发上限 */
  LIMITER_MAX_CONCURRENT: 20,
  /** 批量请求收集窗口（ms） */
  BATCH_DELAY_MS: 50,
  /** GET 请求重试次数 */
  RETRY_MAX: 3,
  /** GET 请求重试初始延迟（ms） */
  RETRY_INITIAL_DELAY_MS: 1000,
  /** GET 请求重试最大延迟（ms） */
  RETRY_MAX_DELAY_MS: 10000,
} as const;
