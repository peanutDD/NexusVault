import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import './FileListFilters.css';

export type SortOption = 'created_at_desc' | 'created_at_asc' | 'filename_asc' | 'filename_desc' | 'file_size_desc' | 'file_size_asc' | 'type_group';

interface FileListFiltersProps {
  search: string;
  mimeType: string;
  sortBy: SortOption;
  onSearchChange: (v: string) => void;
  onMimeTypeChange: (v: string) => void;
  onSortChange: (v: SortOption) => void;
}

const FileListFilters = memo(function FileListFilters({
  search,
  mimeType,
  sortBy,
  onSearchChange,
  onMimeTypeChange,
  onSortChange,
}: FileListFiltersProps) {
  const [typeOpen, setTypeOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const typeOptions = useMemo(
    () => [
      { label: 'All Types', value: '' },
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
      { label: 'Newest Upload', value: 'created_at_desc' as const },
      { label: 'Oldest Upload', value: 'created_at_asc' as const },
      { label: 'Filename A–Z', value: 'filename_asc' as const },
      { label: 'Filename Z–A', value: 'filename_desc' as const },
      { label: 'File Size ↓', value: 'file_size_desc' as const },
      { label: 'File Size ↑', value: 'file_size_asc' as const },
      { label: 'Group by Type', value: 'type_group' as const },
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
      if (typeRef.current && !typeRef.current.contains(t)) setTypeOpen(false);
      if (sortRef.current && !sortRef.current.contains(t)) setSortOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  return (
    <div className="filtersGlass" role="search">
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
          <div className={typeOpen ? 'filtersCardBody filtersCardBodyOpen' : 'filtersCardBody'}>
            <div className="filtersList">
              {typeOptions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
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
          </div>
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
          <div className={sortOpen ? 'filtersCardBody filtersCardBodyOpen' : 'filtersCardBody'}>
            <div className="filtersList">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
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
          </div>
        </div>
      </div>
    </div>
  );
});

export default FileListFilters;
