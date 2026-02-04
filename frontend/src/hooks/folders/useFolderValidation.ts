import { useCallback } from 'react';

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 验证文件夹名称
 * @param name 文件夹名称
 * @returns 验证结果
 */
export function validateFolderName(name: string): ValidationResult {
  const trimmed = name.trim();
  
  if (!trimmed) {
    return { valid: false, error: '文件夹名称不能为空' };
  }
  
  // 检查非法字符
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) {
    return { valid: false, error: '文件夹名称包含非法字符' };
  }
  
  // 检查长度
  if (trimmed.length > 255) {
    return { valid: false, error: '文件夹名称过长（最大 255 字符）' };
  }
  
  // 检查 Windows 保留名称
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
  ];
  if (reservedNames.includes(trimmed.toUpperCase())) {
    return { valid: false, error: '文件夹名称为系统保留名称' };
  }
  
  return { valid: true };
}

/**
 * 文件夹名称验证 Hook
 */
export function useFolderValidation() {
  const validate = useCallback((name: string): ValidationResult => {
    return validateFolderName(name);
  }, []);

  return { validate, validateFolderName };
}

export default useFolderValidation;
