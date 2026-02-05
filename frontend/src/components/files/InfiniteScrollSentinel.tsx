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
  /** 仅在用户最近有滚动行为时才允许触发 */
  requireUserScroll?: boolean;
}

const InfiniteScrollSentinel: React.FC<InfiniteScrollSentinelProps> = ({
  hasMore,
  loadingMore,
  onLoadMore,
  requireUserScroll = false,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  const onLoadMoreRef = useRef(onLoadMore);
  const wasIntersectingRef = useRef(false);
  const userScrolledRecentlyRef = useRef(!requireUserScroll);

  useEffect(() => {
    hasMoreRef.current = hasMore;
    loadingMoreRef.current = loadingMore;
    onLoadMoreRef.current = onLoadMore;
  }, [hasMore, loadingMore, onLoadMore]);

  useEffect(() => {
    if (!requireUserScroll) {
      userScrolledRecentlyRef.current = true;
      return;
    }
    const onScroll = () => {
      userScrolledRecentlyRef.current = true;
      window.setTimeout(() => {
        userScrolledRecentlyRef.current = false;
      }, 1200);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [requireUserScroll]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry) return;
        if (!entry.isIntersecting) {
          wasIntersectingRef.current = false;
          return;
        }
        // 仅在“从未相交 -> 相交”的跃迁时触发，避免连续触发
        if (wasIntersectingRef.current) return;
        wasIntersectingRef.current = true;
        if (!hasMoreRef.current || loadingMoreRef.current) return;
        if (requireUserScroll && !userScrolledRecentlyRef.current) return;
        onLoadMoreRef.current();
      },
      { rootMargin: '200px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!hasMore) return null;
  return <div ref={sentinelRef} className="h-1 w-full" aria-hidden />;
};

export default InfiniteScrollSentinel;
