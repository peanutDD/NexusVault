const MAX_FILE_SIZE =
  Number(import.meta.env.VITE_MAX_FILE_SIZE) || 104_857_600; // 100MB
const ALLOWED_MIME_SPEC =
  import.meta.env.VITE_ALLOWED_MIME_TYPES ||
  'image/*,application/pdf,text/*,application/zip,application/x-zip-compressed';

function parseAllowedTypes(spec: string): string[] {
  return spec.split(',').map((s) => s.trim().toLowerCase());
}

const ALLOWED = parseAllowedTypes(ALLOWED_MIME_SPEC);

function matchesType(mime: string, pattern: string): boolean {
  const p = pattern.toLowerCase();
  if (p.endsWith('/*')) {
    const prefix = p.slice(0, -2);
    return mime.startsWith(prefix + '/');
  }
  return mime === p;
}

export function validateFile(
  file: File
): { ok: true } | { ok: false; error: string } {
  if (file.size > MAX_FILE_SIZE) {
    const maxMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      error: `「${file.name}」超过 ${maxMB}MB 限制`,
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
