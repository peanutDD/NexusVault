/**
 * PdfPreview
 * PDF 预览组件，提取自 FilePreviewContent 以支持动态导入
 */

import { memo } from 'react';

interface PdfPreviewProps {
  blobUrl: string;
  title: string;
  onClose?: () => void;
}

function PdfPreview({ blobUrl, title, onClose }: PdfPreviewProps) {
  return (
    <div className="flex h-full w-full min-h-0 items-center justify-center pointer-events-none">
      <div
        className="pointer-events-auto h-full max-h-full w-full max-w-full overflow-hidden rounded-lg shadow-2xl"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
      >
        <iframe
          src={blobUrl}
          title={title}
          className="h-full w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}

export default memo(PdfPreview);
