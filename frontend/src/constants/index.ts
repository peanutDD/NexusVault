/**
 * App-wide constants. Avoid magic numbers and duplicated config.
 */

export const FILE_LIST = {
  ROW_HEIGHT: 72,
  LIST_HEIGHT: 480,
  LIMIT: 100,
  CACHE_MINUTES: 5,
} as const;

export const CHUNKED_UPLOAD = {
  CHUNK_SIZE: 5 * 1024 * 1024,
  THRESHOLD: 5 * 1024 * 1024,
  MAX_RETRIES: 3,
} as const;

export const SIZES = ['Bytes', 'KB', 'MB', 'GB', 'TB'] as const;
