/**
 * InfiniteScrollSentinel 组件
 * 
 * 无限滚动哨兵组件，当进入视口时触发加载更多数据
 * 
 * @param props 组件属性
 * @param props.hasMore 是否有更多数据
 * @param props.loadingMore 是否正在加载更多数据
 * @param props.onLoadMore 加载更多数据的回调函数
 */
import React, { useEffect, useRef } from 'react';

interface InfiniteScrollSentinelProps {
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

const InfiniteScrollSentinel: React.FC<InfiniteScrollSentinelProps> = ({
  hasMore,
  loadingMore,
  onLoadMore,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loadingMore) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) onLoadMore();
      },
      { rootMargin: '200px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (!hasMore) return null;
  return <div ref={sentinelRef} className="h-1 w-full" aria-hidden />;
};

export default InfiniteScrollSentinel;
