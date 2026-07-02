/**
 * 邮箱校验工具
 * 结合 Zod 与常见拼写错误检测，提供完整的邮箱合法性校验
 */
import { z } from 'zod';

const EMAIL_MAX_LENGTH = 254;

const emailSchema = z
  .string()
  .min(1, '请填写邮箱')
  .max(EMAIL_MAX_LENGTH, '邮箱长度超出限制')
  .email('请输入正确的邮箱格式');

/** 常见域名拼写错误：pattern 匹配错误，suggest 为正确写法提示 */
const TYPO_PATTERNS: { pattern: RegExp; suggest: string }[] = [
  { pattern: /@qq\.co$/i, suggest: 'qq.com' },
  { pattern: /@qq\.con$/i, suggest: 'qq.com' },
  { pattern: /@qq\.comm$/i, suggest: 'qq.com' },
  { pattern: /@qq\.com\.$/i, suggest: 'qq.com' },
  { pattern: /@(163|126|sina|sohu|yeah|vip|tom)\.con$/i, suggest: '.com' },
  { pattern: /@(163|126|sina|sohu|yeah|vip|tom)\.co$/i, suggest: '.com' },
  { pattern: /@(gmail|google)\.con$/i, suggest: '.com' },
  { pattern: /@(gmail|google)\.co$/i, suggest: '.com' },
  { pattern: /@(outlook|hotmail|live)\.con$/i, suggest: '.com' },
  { pattern: /@(outlook|hotmail|live)\.co$/i, suggest: '.com' },
  { pattern: /@(yahoo|icloud)\.con$/i, suggest: '.com' },
  { pattern: /@(yahoo|icloud)\.co$/i, suggest: '.com' },
  { pattern: /\.cnm$/i, suggest: '.com' },
  { pattern: /\.comm$/i, suggest: '.com' },
  { pattern: /\.con$/i, suggest: '.com' },
];

/** 明显无效的域名（单字符或纯数字 TLD 等） */
const INVALID_DOMAIN_PATTERNS: RegExp[] = [
  /@[^.@]+\.$/, // 以 . 结尾
  /@[^.@]+$/, // 无 TLD
  /@\.[^.@]+/, // @ 后直接跟 .
  /@[^.@]+\.\.[^.@]+/, // 双点
  /\s/, // 含空格
  /\.\./, // 连续点
  /^\.|\.$/, // 以点开头或结尾
];

export interface EmailValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * 校验邮箱格式是否合法
 * @param email 待校验邮箱
 * @returns 校验结果，valid 为 true 表示合法
 */
export function validateEmail(email: string): EmailValidationResult {
  const trimmed = email.trim();

  if (!trimmed) {
    return { valid: false, message: '请填写邮箱' };
  }

  if (trimmed.length > EMAIL_MAX_LENGTH) {
    return { valid: false, message: '邮箱长度超出限制' };
  }

  for (const pattern of INVALID_DOMAIN_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, message: '请输入正确的邮箱格式' };
    }
  }

  for (const { pattern, suggest } of TYPO_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        message: `邮箱格式可能有误，请检查域名是否正确（如 ${suggest}）`,
      };
    }
  }

  const result = emailSchema.safeParse(trimmed);
  if (!result.success) {
    const msg = result.error.issues[0]?.message;
    return { valid: false, message: msg || '请输入正确的邮箱格式' };
  }

  return { valid: true };
}
