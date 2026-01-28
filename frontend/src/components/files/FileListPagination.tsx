import { memo, useMemo } from 'react';
import { cn } from '../../utils/cn';

interface FileListPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const FileListPagination = memo(function FileListPagination({
  page,
  totalPages,
  onPageChange,
}: FileListPaginationProps) {
  // 分页页码计算
  const pageNumbers = useMemo(() => {
    const maxVisible = 5;
    const count = Math.min(maxVisible, totalPages);
    
    if (totalPages <= maxVisible) {
      return Array.from({ length: count }, (_, i) => i + 1);
    }
    if (page <= 3) {
      return Array.from({ length: count }, (_, i) => i + 1);
    }
    if (page >= totalPages - 2) {
      return Array.from({ length: count }, (_, i) => totalPages - maxVisible + i + 1);
    }
    return Array.from({ length: count }, (_, i) => page - 2 + i);
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="glass-btn flex items-center gap-1 px-4 py-2 text-sm"
      >
        <ChevronLeftIcon />
        上一页
      </button>
      <div className="flex items-center gap-1">
        {pageNumbers.map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            className={cn(
              "glass-btn h-9 w-9 text-sm font-medium transition-colors",
              page === pageNum
                ? "border-white/30 bg-white/14 text-white"
                : "text-white/70 hover:text-white"
            )}
          >
            {pageNum}
          </button>
        ))}
      </div>
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="glass-btn flex items-center gap-1 px-4 py-2 text-sm"
      >
        下一页
        <ChevronRightIcon />
      </button>
    </div>
  );
});

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default FileListPagination;
