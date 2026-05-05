import { memo, useEffect, useMemo, useRef } from "react";
import { cn } from "../../../utils/cn";

interface FileListPaginationProps {
  /** 当前已加载页数（无限滚动）或当前页码（传统分页） */
  page: number;
  totalPages: number;
  /** 传统分页：点击页码/上一页/下一页时调用 */
  onPageChange?: (page: number) => void;
  /** 无限滚动：是否有更多页 */
  hasMore?: boolean;
  /** 无限滚动：是否正在加载更多 */
  loadingMore?: boolean;
  /** 无限滚动：加载下一页 */
  onLoadMore?: () => void;
}

const FileListPagination = memo(function FileListPagination({
  page,
  totalPages,
  onPageChange,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: FileListPaginationProps) {
  const isInfinite = typeof onLoadMore === "function";
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isInfinite) return;
    if (!hasMore) return;
    if (loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        onLoadMore?.();
      },
      { root: null, rootMargin: "600px 0px 600px 0px", threshold: 0 }, // fluid-sizing-allow: observer prefetch window
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isInfinite, loadingMore, onLoadMore]);

  // 传统分页：页码 + 上一页 / 下一页（Hooks 必须在 early return 之前）
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
      return Array.from(
        { length: count },
        (_, i) => totalPages - maxVisible + i + 1,
      );
    }
    return Array.from({ length: count }, (_, i) => page - 2 + i);
  }, [page, totalPages]);

  // 无限滚动：仅显示「已加载 x / y 页」+ 加载更多
  if (isInfinite) {
    if (totalPages <= 1) return null;

    return (
      <div className="mt-8 flex items-center justify-center" data-oid="cmewoht">
        <div
          className="flex flex-col items-center justify-center"
          data-oid="wg3:z8y"
        >
          <button
            type="button"
            onClick={onLoadMore}
            disabled={!hasMore || loadingMore}
            className={cn(
              "glass-btn toolbarActionBtn loadMoreCyber font-brand px-6 py-2 text-sm font-normal tracking-widest disabled:opacity-50",
              "scale-[0.8]",
              "flex items-center justify-center gap-2",
            )}
            data-oid="s9zyj-k"
          >
            {loadingMore ? (
              <>
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--spinner-track-color)] border-t-[var(--spinner-accent-color)]"
                  data-oid="fqqa704"
                />
                Loading...
              </>
            ) : (
              <>
                Load more
                <ChevronRightIcon data-oid="daaay68" />
              </>
            )}
          </button>
          <div
            ref={sentinelRef}
            className="h-px w-px"
            aria-hidden
            data-oid="69:izn1"
          />
        </div>
      </div>
    );
  }

  if (totalPages <= 1) return null;

  return (
    <div
      className="mt-8 flex items-center justify-center gap-3"
      data-oid="njc2d5."
    >
      <button
        type="button"
        onClick={() => onPageChange?.(Math.max(1, page - 1))}
        disabled={page === 1}
        className="glass-btn flex items-center gap-1 px-4 py-2 text-sm"
        data-oid="23jcn1t"
      >
        <ChevronLeftIcon data-oid="g28pw:_" />
        上一页
      </button>
      <div className="flex items-center gap-1" data-oid="8.bt50r">
        {pageNumbers.map((pageNum) => (
          <button
            key={pageNum}
            type="button"
            onClick={() => onPageChange?.(pageNum)}
            className={cn(
              "glass-btn h-9 w-9 text-sm font-medium transition-colors",
              page === pageNum
                ? "border-[var(--color-border-medium)] bg-[var(--glass-bg-soft)] text-[var(--glass-text)]"
                : "text-[var(--glass-text-muted)] hover:text-[var(--glass-text)]",
            )}
            data-oid="r4rm.3j"
          >
            {pageNum}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="glass-btn flex items-center gap-1 px-4 py-2 text-sm"
        data-oid="wyq2pvx"
      >
        下一页
        <ChevronRightIcon data-oid="86qqksa" />
      </button>
    </div>
  );
});

function ChevronLeftIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      data-oid="3jge0i4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
        data-oid="s9d1dpc"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      data-oid="z:90p4e"
    >
      {/* 更“艺术”的长箭头：一条主线 + 流线型箭头 */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M5 12h11"
        data-oid="xzvbpk8"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M13 7l6 5-6 5"
        data-oid="0h-_mbm"
      />
    </svg>
  );
}

export default FileListPagination;
