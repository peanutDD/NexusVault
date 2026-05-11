/**
 * InfiniteScrollSentinel：滚到底部时触发加载更多。
 * 仅当「当前列表长度 > 上次触发时的列表长度」时才允许触发，避免单纯滚动上下就重复发请求。
 */
import React, { useEffect, useRef } from "react";

interface InfiniteScrollSentinelProps {
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  requireUserScroll?: boolean;
  listSize?: number;
}

const InfiniteScrollSentinel: React.FC<InfiniteScrollSentinelProps> = ({
  hasMore,
  loadingMore,
  onLoadMore,
  requireUserScroll = false,
  listSize = 0,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  const onLoadMoreRef = useRef(onLoadMore);
  const userScrolledRecentlyRef = useRef(!requireUserScroll);
  const listSizeRef = useRef(listSize);
  const wasIntersectingRef = useRef(false);
  const lastScrollYRef = useRef(
    typeof window !== "undefined" ? window.scrollY : 0,
  );
  const scrollDirectionRef = useRef<"up" | "down">("down");
  /** 上次触发 loadMore 时的列表长度，只有 listSize > 此值时才允许再次触发 */
  const lastTriggeredListSizeRef = useRef(-1);

  useEffect(() => {
    hasMoreRef.current = hasMore;
    loadingMoreRef.current = loadingMore;
    onLoadMoreRef.current = onLoadMore;
    listSizeRef.current = listSize;
    if (listSize < lastTriggeredListSizeRef.current) {
      lastTriggeredListSizeRef.current = -1;
    }
  }, [hasMore, loadingMore, onLoadMore, listSize]);

  useEffect(() => {
    if (!requireUserScroll) {
      userScrolledRecentlyRef.current = true;
      return;
    }
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollYRef.current) {
        scrollDirectionRef.current = "down";
      } else if (currentY < lastScrollYRef.current) {
        scrollDirectionRef.current = "up";
      }
      lastScrollYRef.current = currentY;
      userScrolledRecentlyRef.current = true;
      window.setTimeout(() => {
        userScrolledRecentlyRef.current = false;
      }, 1200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [requireUserScroll]);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          wasIntersectingRef.current = false;
          return;
        }
        if (wasIntersectingRef.current) return;
        wasIntersectingRef.current = true;
        if (!hasMoreRef.current || loadingMoreRef.current) return;
        if (requireUserScroll && !userScrolledRecentlyRef.current) return;
        if (requireUserScroll && scrollDirectionRef.current !== "down") return;
        const size = listSizeRef.current;
        if (size <= lastTriggeredListSizeRef.current) return;
        lastTriggeredListSizeRef.current = size;
        onLoadMoreRef.current();
      },
      { rootMargin: "200px", threshold: 0 }, // fluid-sizing-allow: observer prefetch window
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, requireUserScroll]);

  if (!hasMore) return null;
  return (
    <div
      ref={sentinelRef}
      className="h-[clamp(0.195rem,0.45vw,0.25rem)] w-full"
      aria-hidden
      data-oid="t6v14rz"
    />
  );
};

export default InfiniteScrollSentinel;
