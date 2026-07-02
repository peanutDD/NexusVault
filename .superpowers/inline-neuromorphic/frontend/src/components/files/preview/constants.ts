/**
 * FilePreview constants kept in sync with backend preview thresholds.
 */

/** Files above this size use HLS transcoding, matching the backend threshold. */
export const HLS_THRESHOLD_BYTES = 100 * 1024 * 1024;

/** Small GIFs render directly as images instead of entering the transcode path. */
export const GIF_DIRECT_PREVIEW_BYTES = 5 * 1024 * 1024;
