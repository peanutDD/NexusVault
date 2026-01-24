import { useRef } from 'react';
import { fileService } from '../../services/files';
import type { FileMetadata } from '../../services/files';

interface FilePreviewProps {
  file: FileMetadata | null;
  onClose: () => void;
}

export default function FilePreview({ file, onClose }: FilePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (!file) return null;

  const isImage = file.mime_type.startsWith('image/');
  const isPDF = file.mime_type === 'application/pdf';
  const isText =
    file.mime_type.startsWith('text/') ||
    file.mime_type === 'application/json' ||
    file.mime_type === 'application/xml';

  const previewUrl = fileService.getPreviewUrl(file.id);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-white font-medium">{file.original_filename}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isImage && (
            <img
              src={previewUrl}
              alt={file.original_filename}
              className="max-w-full max-h-[70vh] mx-auto"
            />
          )}
          {isPDF && (
            <iframe
              ref={iframeRef}
              src={previewUrl}
              className="w-full h-[70vh] border-0"
              title={file.original_filename}
            />
          )}
          {isText && (
            <iframe
              ref={iframeRef}
              src={previewUrl}
              className="w-full h-[70vh] border border-gray-700 rounded bg-white"
              title={file.original_filename}
            />
          )}
          {!isImage && !isPDF && !isText && (
            <div className="text-center text-gray-400 py-12">
              不支持预览此文件类型
              <br />
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 mt-2 inline-block"
              >
                在新窗口打开
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
