import { useState, useCallback } from 'react';
import { cn } from '../../../utils/cn';
import { validateFile } from '../../../utils/uploadValidation';
import type { UploadFile } from './UploadFileItem';

interface UrlUploadFormProps {
  /** 添加文件到上传列表 */
  onFileAdd: (file: UploadFile) => void;
}

/**
 * 获取 URL 上传错误消息
 */
function getUrlErrorMessage(err: unknown, url: string): string {
  if (err instanceof TypeError && err.message.includes('URL')) {
    return `URL 格式无效: "${url}"。请输入完整的 URL，例如 https://example.com/file.jpg`;
  }
  
  if (err instanceof TypeError) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      return `无法访问该 URL。可能的原因：
• 目标服务器不允许跨域请求 (CORS)
• URL 地址不存在或无法访问
• 网络连接问题`;
    }
    return `网络请求失败: ${err.message}`;
  }
  
  if (err instanceof Error) {
    const httpMatch = err.message.match(/^HTTP (\d+)(?:\s*-\s*(.+))?$/);
    if (httpMatch) {
      const status = parseInt(httpMatch[1], 10);
      const statusMessages: Record<number, string> = {
        400: '请求无效',
        401: '需要身份验证',
        403: '访问被拒绝（无权限）',
        404: '文件不存在',
        405: '请求方法不允许',
        408: '请求超时',
        410: '资源已被删除',
        429: '请求过于频繁',
        500: '服务器内部错误',
        502: '网关错误',
        503: '服务暂时不可用',
        504: '网关超时',
      };
      const statusText = statusMessages[status] || '请求失败';
      return `下载失败 (HTTP ${status}): ${statusText}`;
    }
    return err.message;
  }
  
  return 'URL 下载失败，请检查地址是否正确';
}

/**
 * URL 上传表单组件
 */
export default function UrlUploadForm({ onFileAdd }: UrlUploadFormProps) {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = useCallback(async () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) return;

    setLoading(true);
    try {
      // 验证 URL 格式
      let urlObj: URL;
      try {
        urlObj = new URL(trimmedUrl);
      } catch {
        throw new TypeError(`Invalid URL: ${trimmedUrl}`);
      }
      
      // 验证协议
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error(`不支持的协议: ${urlObj.protocol}。仅支持 http:// 和 https://`);
      }
      
      const pathname = urlObj.pathname;
      const filename = decodeURIComponent(pathname.split('/').pop() || 'downloaded-file');

      // 使用 AbortController 设置超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      let response: Response;
      try {
        response = await fetch(trimmedUrl, { 
          signal: controller.signal,
          mode: 'cors',
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          throw new Error('HTTP 408 - 请求超时（超过30秒）');
        }
        throw fetchErr;
      }
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('下载的文件为空');
      }
      
      const file = new File([blob], filename, { type: blob.type });
      const validation = validateFile(file);
      
      const uploadFile: UploadFile = {
        id: `url-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: filename,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        status: validation.ok ? 'pending' : 'error',
        progress: 0,
        error: validation.ok ? undefined : validation.error,
        file: validation.ok ? file : undefined,
      };

      onFileAdd(uploadFile);
      setUrlInput('');
    } catch (err) {
      const errorFile: UploadFile = {
        id: `url-error-${Date.now()}`,
        name: trimmedUrl.length > 50 ? trimmedUrl.slice(0, 50) + '...' : trimmedUrl,
        size: 0,
        mimeType: 'unknown',
        status: 'error',
        progress: 0,
        error: getUrlErrorMessage(err, trimmedUrl),
      };
      onFileAdd(errorFile);
    } finally {
      setLoading(false);
    }
  }, [urlInput, onFileAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleUpload();
    },
    [handleUpload]
  );

  return (
    <div className="mb-5">
      <p className="font-brand mb-2 text-sm font-normal tracking-widest text-gray-500">
        Or upload from URL
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Add file URL"
          className={cn(
            'font-brand flex-1 rounded-lg border bg-transparent px-4 py-2.5 text-sm font-normal tracking-widest text-white placeholder-gray-600 transition-colors focus:outline-none',
            urlInput.trim()
              ? 'border-[#6C5DD3]'
              : 'border-[#2A2A3C] focus:border-[#6C5DD3]'
          )}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={!urlInput.trim() || loading}
          className="font-brand rounded-lg bg-[#6C5DD3] px-5 py-2.5 text-sm font-normal tracking-widest text-white transition-colors hover:bg-[#7C6DE3] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? '...' : 'Upload'}
        </button>
      </div>
    </div>
  );
}
