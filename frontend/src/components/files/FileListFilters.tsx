import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { MIME_FILTER_FOLDERS } from '../../constants';
import './FileListFilters.css';

export type SortOption = 'created_at_desc' | 'created_at_asc' | 'filename_asc' | 'filename_desc' | 'file_size_desc' | 'file_size_asc' | 'type_group';

interface FileListFiltersProps {
  search: string;
  mimeType: string;
  sortBy: SortOption;
  onSearchChange: (v: string) => void;
  onMimeTypeChange: (v: string) => void;
  onSortChange: (v: SortOption) => void;
  actions?: React.ReactNode;
  layout?: 'inline' | 'screenshot';
}

const FileListFilters = memo(function FileListFilters({
  search,
  mimeType,
  sortBy,
  onSearchChange,
  onMimeTypeChange,
  onSortChange,
  actions,
  layout = 'inline',
}: FileListFiltersProps) {
  const [typeOpen, setTypeOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const [typeMenuPos, setTypeMenuPos] = useState<{ left: number; top: number; width: number } | null>(
    null
  );
  const [sortMenuPos, setSortMenuPos] = useState<{ left: number; top: number; width: number } | null>(
    null
  );

  const typeOptions = useMemo(
    () => [
      { label: 'All Types', value: '' },
      { label: 'Folders', value: MIME_FILTER_FOLDERS },
      { label: 'Images', value: 'image/' },
      { label: 'Videos', value: 'video/' },
      { label: 'Audio', value: 'audio/' },
      { label: 'PDF', value: 'application/pdf' },
      { label: 'Text', value: 'text/' },
      { label: 'ZIP', value: 'application/zip' },
      { label: 'Apps/Docs', value: 'application/' },
    ],
    []
  );

  const sortOptions = useMemo(
    () => [
      { label: 'Group by Type', value: 'type_group' as const },
      { label: 'Newest Upload', value: 'created_at_desc' as const },
      { label: 'Oldest Upload', value: 'created_at_asc' as const },
      { label: 'Filename A–Z', value: 'filename_asc' as const },
      { label: 'Filename Z–A', value: 'filename_desc' as const },
      { label: 'File Size ↓', value: 'file_size_desc' as const },
      { label: 'File Size ↑', value: 'file_size_asc' as const },
    ],
    []
  );

  const selectedTypeLabel = useMemo(() => {
    return typeOptions.find((o) => o.value === mimeType)?.label ?? 'All Types';
  }, [mimeType, typeOptions]);

  const selectedSortLabel = useMemo(() => {
    return sortOptions.find((o) => o.value === sortBy)?.label ?? 'Newest Upload';
  }, [sortBy, sortOptions]);

  // 点击外部关闭
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const inTypeTrigger = typeRef.current?.contains(t) ?? false;
      const inSortTrigger = sortRef.current?.contains(t) ?? false;
      const inTypeMenu = typeMenuRef.current?.contains(t) ?? false;
      const inSortMenu = sortMenuRef.current?.contains(t) ?? false;

      if (!inTypeTrigger && !inTypeMenu) setTypeOpen(false);
      if (!inSortTrigger && !inSortMenu) setSortOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  /** 下拉框位置：可指定宽度来源（与 Sort 组件同宽时传 sortRef） */
  const computeMenuPos = (el: HTMLElement, widthFrom?: HTMLElement | null) => {
    const r = el.getBoundingClientRect();
    const source = widthFrom ?? el;
    const w = Math.max(120, source.getBoundingClientRect().width);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const top = Math.min(r.bottom + 8, window.innerHeight - 8);
    return { left, top, width: w };
  };

  const samePos = (
    a: { left: number; top: number; width: number } | null,
    b: { left: number; top: number; width: number } | null
  ) => !!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width;

  useEffect(() => {
    let rafId: number | null = null;
    let disposed = false;
    let lastResize = 0;
    const RESIZE_THROTTLE_MS = 150;

    const update = () => {
      if (disposed) return;
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (disposed) return;

        const nextTypePos =
          typeOpen && typeRef.current
            ? computeMenuPos(typeRef.current, sortRef.current)
            : null;
        const nextSortPos =
          sortOpen && sortRef.current ? computeMenuPos(sortRef.current) : null;

        setTypeMenuPos((prev) => (samePos(prev, nextTypePos) ? prev : nextTypePos));
        setSortMenuPos((prev) => (samePos(prev, nextSortPos) ? prev : nextSortPos));
      });
    };

    const onResize = () => {
      const now = Date.now();
      if (now - lastResize >= RESIZE_THROTTLE_MS) {
        lastResize = now;
        update();
      }
    };

    update();
    if (!typeOpen && !sortOpen) return;

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    return () => {
      disposed = true;
      if (rafId != null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', update, { capture: true } as AddEventListenerOptions);
    };
  }, [typeOpen, sortOpen]);

  // 避免 JSX inline style（遵循项目 lint 规则）
  useEffect(() => {
    if (!typeMenuRef.current || !typeMenuPos) return;
    typeMenuRef.current.style.left = `${typeMenuPos.left}px`;
    typeMenuRef.current.style.top = `${typeMenuPos.top}px`;
    typeMenuRef.current.style.width = `${typeMenuPos.width}px`;
  }, [typeMenuPos]);

  useEffect(() => {
    if (!sortMenuRef.current || !sortMenuPos) return;
    sortMenuRef.current.style.left = `${sortMenuPos.left}px`;
    sortMenuRef.current.style.top = `${sortMenuPos.top}px`;
    sortMenuRef.current.style.width = `${sortMenuPos.width}px`;
  }, [sortMenuPos]);

  return (
    <div
      className={layout === 'screenshot' ? 'filtersGlass filtersGlassScreenshot' : 'filtersGlass'}
      role="search"
    >
      <div className={layout === 'screenshot' ? 'filtersTopRow' : undefined}>
        {/* Search */}
        <div className="filtersSearchPill">
          <Search className="filtersSearchIcon" aria-hidden="true" />
          <input
            ref={(el) => {
              // 用于键盘快捷键聚焦
              const w = window as unknown as { __fileListSearchInput?: HTMLInputElement };
              w.__fileListSearchInput = el ?? undefined;
            }}
            type="text"
            placeholder="Search files… (Ctrl+K)"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="filtersSearchInput"
            aria-label="Search files"
          />
        </div>

        {layout === 'screenshot' && (
          <div className="filtersInlineFilters" aria-label="Filters">
            <div className="filtersRow">
              {/* Type dropdown card */}
              <div ref={typeRef} className="filtersCard">
                <button
                  type="button"
                  className="filtersCardHeader"
                  onClick={() => {
                    setTypeOpen((v) => !v);
                    setSortOpen(false);
                  }}
                  aria-label="Type"
                >
                  <span className="filtersCardTitle">Type</span>
                  <span className="filtersCardHeaderRight">
                    <span className="filtersCardSelected" title={selectedTypeLabel}>
                      {selectedTypeLabel}
                    </span>
                    <ChevronDown
                      className={typeOpen ? 'filtersChevron filtersChevronOpen' : 'filtersChevron'}
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </div>

              {/* Sort dropdown card */}
              <div ref={sortRef} className="filtersCard">
                <button
                  type="button"
                  className="filtersCardHeader"
                  onClick={() => {
                    setSortOpen((v) => !v);
                    setTypeOpen(false);
                  }}
                  aria-label="Sort"
                >
                  <span className="filtersCardTitle">Sort</span>
                  <span className="filtersCardHeaderRight">
                    <span className="filtersCardSelected" title={selectedSortLabel}>
                      {selectedSortLabel}
                    </span>
                    <ChevronDown
                      className={sortOpen ? 'filtersChevron filtersChevronOpen' : 'filtersChevron'}
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {layout === 'screenshot' && actions && (
          <div className="filtersActions" aria-label="Actions">
            {actions}
          </div>
        )}
      </div>

      {layout !== 'screenshot' && (
        <div>
          <div className="filtersRow">
          {/* Type dropdown card */}
          <div ref={typeRef} className="filtersCard">
            <button
              type="button"
              className="filtersCardHeader"
              onClick={() => {
                setTypeOpen((v) => !v);
                setSortOpen(false);
              }}
              aria-label="Type"
            >
              <span className="filtersCardTitle">Type</span>
              <span className="filtersCardHeaderRight">
                <span className="filtersCardSelected" title={selectedTypeLabel}>
                  {selectedTypeLabel}
                </span>
                <ChevronDown
                  className={typeOpen ? 'filtersChevron filtersChevronOpen' : 'filtersChevron'}
                  aria-hidden="true"
                />
              </span>
            </button>
          </div>

          {/* Sort dropdown card */}
          <div ref={sortRef} className="filtersCard">
            <button
              type="button"
              className="filtersCardHeader"
              onClick={() => {
                setSortOpen((v) => !v);
                setTypeOpen(false);
              }}
              aria-label="Sort"
            >
              <span className="filtersCardTitle">Sort</span>
              <span className="filtersCardHeaderRight">
                <span className="filtersCardSelected" title={selectedSortLabel}>
                  {selectedSortLabel}
                </span>
                <ChevronDown
                  className={sortOpen ? 'filtersChevron filtersChevronOpen' : 'filtersChevron'}
                  aria-hidden="true"
                />
              </span>
            </button>
          </div>
        </div>
        </div>
      )}

      {typeOpen &&
        typeMenuPos &&
        createPortal(
          <div
            ref={typeMenuRef}
            className="filtersDropdownPortal"
            role="menu"
            aria-label="Type options"
          >
            <div className="filtersList">
              {typeOptions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  role="menuitem"
                  className={opt.value === mimeType ? 'filtersItem filtersItemSelected' : 'filtersItem'}
                  onClick={() => {
                    onMimeTypeChange(opt.value);
                    setTypeOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}

      {sortOpen &&
        sortMenuPos &&
        createPortal(
          <div
            ref={sortMenuRef}
            className="filtersDropdownPortal"
            role="menu"
            aria-label="Sort options"
          >
            <div className="filtersList">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  className={opt.value === sortBy ? 'filtersItem filtersItemSelected' : 'filtersItem'}
                  onClick={() => {
                    onSortChange(opt.value);
                    setSortOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});

export default FileListFilters;
