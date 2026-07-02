import {
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FILE_COLLECTION_COUNTS_QUERY_KEY,
  fileListService,
} from "../../../services/fileListService";
import { tagsService } from "../../../services/tags";
import type {
  FileCollectionCounts,
  FileCollectionCountsQuery,
} from "../../../types/files";
import { cn } from "../../../utils/cn";
import { parseCollectionParam } from "../fileListFilterParams";
import { computeCollapsedChipVisibility } from "./FileListCollectionChipsLayout";

interface FileListCollectionChipsProps {
  activeCollection?: string;
  activeTagId?: string;
  collectionsExpanded?: boolean;
  countQuery?: FileCollectionCountsQuery;
  onCollectionsExpandedChange?: (value: boolean) => void;
  onCollectionChange?: (value: string) => void;
  onResetFilters?: () => void;
  onTagChange?: (value: string) => void;
}

const COLLECTIONS = [
  ["favorites", "收藏", "收藏的文件"],
  ["pinned", "置顶", "置顶的文件"],
  ["recent", "最近", "最近 7 天内打开或下载过的文件，按打开时间从近到远排序"],
  ["untagged", "未标记", "没有任何标签的文件"],
  ["large", "大文件", "大文件：100MB+，实际阈值为 100 MiB"],
  [
    "duplicates",
    "重复",
    "重复文件：仅统计已生成 content_sha256 且哈希相同的文件",
  ],
  ["images", "图片", "MIME 类型为 image/* 的文件"],
  ["pdfs", "PDF", "MIME 类型为 application/pdf 的文件"],
  ["videos", "视频", "MIME 类型为 video/* 的文件"],
] as const;

export default function FileListCollectionChips({
  activeCollection = "",
  activeTagId = "",
  collectionsExpanded: controlledCollectionsExpanded,
  countQuery,
  onCollectionsExpandedChange,
  onCollectionChange,
  onResetFilters,
  onTagChange,
}: FileListCollectionChipsProps) {
  const tagsQuery = useQuery({ queryKey: ["tags"], queryFn: tagsService.list });
  const countsQuery = useQuery({
    queryKey: [...FILE_COLLECTION_COUNTS_QUERY_KEY, countQuery],
    queryFn: () => fileListService.getCollectionCounts(countQuery),
  });
  const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data]);
  const counts: FileCollectionCounts | null = countsQuery.data ?? null;
  const [uncontrolledCollectionsExpanded, setUncontrolledCollectionsExpanded] =
    useState(false);
  const collectionsExpanded =
    controlledCollectionsExpanded ?? uncontrolledCollectionsExpanded;
  const [pendingActiveChip, setPendingActiveChip] = useState<{
    activeCollection: string;
    activeTagId: string;
    key: string;
  } | null>(null);
  const [layout, setLayout] = useState({
    hasOverflow: false,
    visibleCount: Number.POSITIVE_INFINITY,
  });
  const shelfRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const measureToggleRef = useRef<HTMLButtonElement | null>(null);
  const chipWidthsRef = useRef<number[]>([]);

  const activeCollections = useMemo(
    () => parseCollectionParam(activeCollection),
    [activeCollection],
  );
  const pendingActiveChipKey =
    pendingActiveChip?.activeCollection === activeCollection &&
    pendingActiveChip.activeTagId === activeTagId
      ? pendingActiveChip.key
      : null;
  const resetFilters = useCallback(() => {
    setPendingActiveChip(null);
    if (onResetFilters) {
      onResetFilters();
      return;
    }
    onCollectionChange?.("");
    onTagChange?.("");
  }, [onCollectionChange, onResetFilters, onTagChange]);

  const chipItems = useMemo(
    () => [
      {
        key: "reset",
        label: "重置",
        title: "清除当前集合和标签筛选",
        kind: "reset" as const,
      },
      {
        key: "all",
        label: "全部",
        title: "显示当前目录中的全部文件，清除集合和标签筛选",
        kind: "all" as const,
      },
      ...COLLECTIONS.map(([value, label, title]) => ({
        key: `collection-${value}`,
        label,
        title,
        value,
        count: counts?.collections[value],
        kind: "collection" as const,
      })),
      ...tags.map((tag) => ({
        key: `tag-${tag.id}`,
        label: `标签：${tag.name}`,
        title: `标签：${tag.name}`,
        count: counts?.tags[tag.id],
        tag,
        kind: "tag" as const,
      })),
    ],
    [counts, tags],
  );
  const visibleChipItems =
    collectionsExpanded || !layout.hasOverflow
      ? chipItems
      : chipItems.slice(0, layout.visibleCount);
  const shouldShowCollectionToggle = layout.hasOverflow;
  const collectionChipClass = (active: boolean) =>
    cn(
      "neu-flat fileListCollectionChip fileListCollectionChipCompact inline-flex bg-[var(--codepen-neu-bg-secondary)] min-h-[clamp(1.38rem,2.75vw,1.65rem)] min-w-0 max-w-[min(100%,clamp(4.1rem,22vw,7.4rem))] shrink-0 items-center justify-center gap-[clamp(0.18rem,0.5vw,0.28rem)] rounded-full px-[clamp(0.45rem,1.05vw,0.62rem)] py-[clamp(0.12rem,0.35vw,0.2rem)] text-center text-[clamp(0.58rem,1.25vw,0.68rem)] leading-tight [overflow-wrap:anywhere]",
      active
        ? "bg-[var(--filelist-check-bg-checked-on)] fileListCollectionChipActive text-[var(--codepen-neu-bg))]"
        : "text-[var(--rgb-white)] ",
    );
  const countTitle = (title: string, count?: number) =>
    count === undefined ? title : `${title}，${count} 个文件`;
  const markPendingActive = (key: string) => {
    setPendingActiveChip({ activeCollection, activeTagId, key });
  };
  const setCollectionsExpandedState = useCallback(
    (nextValue: boolean | ((current: boolean) => boolean)) => {
      const next =
        typeof nextValue === "function"
          ? nextValue(collectionsExpanded)
          : nextValue;
      if (controlledCollectionsExpanded === undefined) {
        setUncontrolledCollectionsExpanded(next);
      }
      onCollectionsExpandedChange?.(next);
    },
    [
      collectionsExpanded,
      controlledCollectionsExpanded,
      onCollectionsExpandedChange,
    ],
  );
  const stopCollectionChipEvent = (
    event: MouseEvent<HTMLButtonElement> | PointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
  };
  const chipGestureGuards = {
    onMouseDown: stopCollectionChipEvent,
    onMouseUp: stopCollectionChipEvent,
    onPointerUp: stopCollectionChipEvent,
  };
  const handleChipPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    key: string,
    inert = false,
  ) => {
    stopCollectionChipEvent(event);
    if (inert) return;
    markPendingActive(key);
  };
  const handleToggleCollections = (event: MouseEvent<HTMLButtonElement>) => {
    stopCollectionChipEvent(event);
    setCollectionsExpandedState((value) => !value);
  };
  const renderLabel = (label: string, count?: number, extra?: string) => (
    <>
      <span className="min-w-0 truncate">{label}</span>
      {extra && (
        <span className="fileListCollectionChipHint shrink-0">{extra}</span>
      )}
      {count !== undefined && (
        <span
          className="fileListCollectionChipCount shrink-0"
          aria-hidden="true"
        >
          {count}
        </span>
      )}
    </>
  );
  const renderChip = (
    item: (typeof chipItems)[number],
    ref?: (node: HTMLButtonElement | null) => void,
    inert = false,
  ) => {
    const inertProps = inert
      ? ({ "aria-hidden": true, tabIndex: -1 } as const)
      : {};

    if (item.kind === "reset") {
      return (
        <button
          key={item.key}
          ref={ref}
          type="button"
          {...inertProps}
          {...chipGestureGuards}
          onPointerDown={stopCollectionChipEvent}
          onClick={(event) => {
            stopCollectionChipEvent(event);
            if (inert) return;
            resetFilters();
          }}
          className={cn(
            collectionChipClass(false),
            "fileListCollectionResetButton",
            "transition-[transform,box-shadow,color] duration-150 active:scale-[0.94] active:translate-y-[clamp(0.025rem,0.08vw,0.05rem)] active:shadow-[var(--neu-pressed-shadow)]",
          )}
          aria-label="重置筛选"
          title={item.title}
        >
          {renderLabel(item.label)}
        </button>
      );
    }

    if (item.kind === "all") {
      const isActive =
        (activeCollections.length === 0 && !activeTagId) ||
        pendingActiveChipKey === item.key;
      return (
        <button
          key={item.key}
          ref={ref}
          type="button"
          {...inertProps}
          {...chipGestureGuards}
          onPointerDown={(event) =>
            handleChipPointerDown(event, item.key, inert)
          }
          onClick={(event) => {
            stopCollectionChipEvent(event);
            if (inert) return;
            resetFilters();
          }}
          className={collectionChipClass(isActive)}
          aria-label={item.label}
          title={item.title}
        >
          {renderLabel(item.label)}
        </button>
      );
    }

    if (item.kind === "collection") {
      const isActive =
        activeCollections.includes(item.value) ||
        pendingActiveChipKey === item.key;
      return (
        <button
          key={item.key}
          ref={ref}
          type="button"
          {...inertProps}
          {...chipGestureGuards}
          onPointerDown={(event) =>
            handleChipPointerDown(event, item.key, inert)
          }
          onClick={(event) => {
            stopCollectionChipEvent(event);
            if (inert) return;
            onCollectionChange?.(item.value);
          }}
          className={collectionChipClass(isActive)}
          aria-label={item.label}
          title={countTitle(item.title, item.count)}
        >
          {renderLabel(
            item.label,
            item.count,
            item.value === "large" ? "100MB+" : undefined,
          )}
        </button>
      );
    }

    return (
      <button
        key={item.key}
        ref={ref}
        type="button"
        {...inertProps}
        {...chipGestureGuards}
        onPointerDown={(event) => handleChipPointerDown(event, item.key, inert)}
        onClick={(event) => {
          stopCollectionChipEvent(event);
          if (inert) return;
          onTagChange?.(item.tag.id);
        }}
        aria-label={item.label}
        title={countTitle(item.title, item.count)}
        className={cn(
          collectionChipClass(
            activeTagId === item.tag.id || pendingActiveChipKey === item.key,
          ),
          "gap-[clamp(0.18rem,0.55vw,0.28rem)]",
        )}
      >
        <span className="fileListCollectionTagDot bg-[var(--filelist-check-bg-checked-on)] h-[clamp(0.42rem,0.9vw,0.52rem)] w-[clamp(0.42rem,0.9vw,0.52rem)] shrink-0 rounded-full" />
        {renderLabel(item.label, item.count)}
      </button>
    );
  };
  const measureLayout = useCallback(() => {
    const shelf = shelfRef.current;
    const rail = railRef.current;
    const toggle = measureToggleRef.current;
    if (!shelf || !rail || !toggle) return;

    const shelfWidth = shelf.getBoundingClientRect().width;
    const toggleWidth = toggle.getBoundingClientRect().width;
    const styles = window.getComputedStyle(rail);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 8;
    const measureNodes = Array.from(
      shelf.querySelectorAll<HTMLElement>("[data-chip-measure-index]"),
    );
    const measuredWidths = chipItems.map((_, index) => {
      const width = measureNodes[index]?.getBoundingClientRect().width ?? 0;
      return width || chipWidthsRef.current[index] || 0;
    });
    chipWidthsRef.current = measuredWidths;

    const next = computeCollapsedChipVisibility({
      containerWidth: shelfWidth,
      chipWidths: measuredWidths,
      gap,
      toggleWidth,
    });

    setLayout((current) =>
      current.hasOverflow === next.hasOverflow &&
      current.visibleCount === next.visibleCount
        ? current
        : next,
    );
    if (!next.hasOverflow) {
      setCollectionsExpandedState(false);
    }
  }, [chipItems, setCollectionsExpandedState]);

  useLayoutEffect(() => {
    measureLayout();
  }, [measureLayout]);

  useEffect(() => {
    const shelf = shelfRef.current;
    if (!shelf || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measureLayout());
    observer.observe(shelf);
    return () => observer.disconnect();
  }, [measureLayout]);

  useEffect(() => {
    window.addEventListener("resize", measureLayout);
    return () => window.removeEventListener("resize", measureLayout);
  }, [measureLayout]);

  return (
    <div
      ref={shelfRef}
      id="file-list-collection-chips"
      className={cn(
        "fileListCollectionShelf relative z-[1] grid w-full max-w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-[clamp(0.34rem,0.85vw,0.48rem)] overflow-visible",
      )}
      data-testid="file-list-collection-chips"
    >
      <div
        ref={railRef}
        className={cn(
          "fileListCollectionChipRail flex min-w-0 items-center gap-[clamp(0.32rem,0.8vw,0.46rem)]",
          collectionsExpanded
            ? "flex-wrap overflow-visible neu-inset p-[clamp(0.24rem,0.65vw,0.4rem)] rounded-[clamp(0.46rem,1vw,0.62rem)]"
            : "h-[clamp(1.83rem,3.9vw,2.22rem)] flex-nowrap overflow-hidden",
        )}
        data-testid="file-list-collections"
      >
        {visibleChipItems.map((item) => renderChip(item))}
        <div
          className="pointer-events-none absolute -z-10 opacity-0"
          aria-hidden
        >
          {chipItems.map((item, index) => (
            <span key={`measure-${item.key}`} data-chip-measure-index={index}>
              {renderChip(item, undefined, true)}
            </span>
          ))}
          <button
            ref={measureToggleRef}
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className={cn(
              collectionChipClass(false),
              "fileListCollectionMoreButton fileListCollectionMoreButtonCollapsed max-w-none shrink-0",
            )}
          >
            More
          </button>
        </div>
      </div>
      {shouldShowCollectionToggle ? (
        <button
          type="button"
          aria-controls="file-list-collection-chips"
          aria-expanded={collectionsExpanded}
          aria-label={collectionsExpanded ? "收起筛选" : "更多筛选"}
          {...chipGestureGuards}
          onPointerDown={stopCollectionChipEvent}
          onClick={handleToggleCollections}
          className={cn(
            collectionChipClass(false),
            "fileListCollectionMoreButton max-w-none shrink-0",
            collectionsExpanded
              ? "fileListCollectionMoreButtonExpanded"
              : "fileListCollectionMoreButtonCollapsed",
          )}
        >
          {collectionsExpanded ? "收起" : "更多"}
        </button>
      ) : null}
    </div>
  );
}
