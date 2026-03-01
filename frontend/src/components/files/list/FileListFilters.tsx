import { memo, useMemo } from 'react';
import { Search } from 'lucide-react';
import { MIME_FILTER_FOLDERS } from '../../../constants';
import DropdownMenu from '../../common/DropdownMenu';
import './FileListFilters.css';

export type SortOption = 'created_at_desc' | 'created_at_asc' | 'filename_asc' | 'filename_desc' | 'file_size_desc' | 'file_size_asc' | 'type_group' | 'time_group';

interface FileListFiltersProps {
  search: string;
  mimeType: string;
  sortBy: string;
  onSearchChange: (v: string) => void;
  onMimeTypeChange: (v: string) => void;
  onSortChange: (v: string) => void;
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
  const typeOptions = useMemo(
    () => [
      { label: 'All Types', value: '', icon: <i className="bi bi-collection" /> },
      { label: 'Folders', value: MIME_FILTER_FOLDERS, icon: <i className="bi bi-folder" />, divider: true },
      { label: 'Images', value: 'image/', icon: <i className="bi bi-image" /> },
      { label: 'Videos', value: 'video/', icon: <i className="bi bi-file-earmark-play" /> },
      { label: 'Audio', value: 'audio/', icon: <i className="bi bi-music-note-beamed" /> },
      { label: 'GIF', value: 'image/gif', icon: <i className="bi bi-filetype-gif" /> },
      { label: 'PDF', value: 'application/pdf', icon: <i className="bi bi-filetype-pdf" />, divider: true },
      { label: 'MD', value: 'text/markdown', icon: <i className="bi bi-markdown" /> },
      { label: 'Text', value: 'text/', icon: <i className="bi bi-file-text" /> },
      { label: 'Archive', value: 'application/zip', icon: <i className="bi bi-file-zip" /> },
      { label: 'Docs', value: 'application/', icon: <i className="bi bi-filetype-doc" /> },
    ],
    []
  );

  const sortOptions = useMemo(
    () => [
      { label: 'By Type', value: 'type_group', icon: <i className="bi bi-grid-3x3-gap" /> },
      { label: 'By Time', value: 'time_group', icon: <i className="bi bi-calendar3" /> },
      { label: 'Newest', value: 'created_at_desc', icon: <i className="bi bi-sort-down" />, divider: true },
      { label: 'Oldest', value: 'created_at_asc', icon: <i className="bi bi-sort-up" /> },
      { label: 'Name A–Z', value: 'filename_asc', icon: <i className="bi bi-sort-alpha-down" />, divider: true },
      { label: 'Name Z–A', value: 'filename_desc', icon: <i className="bi bi-sort-alpha-up" /> },
      { label: 'Size ↓', value: 'file_size_desc', icon: <i className="bi bi-sort-numeric-down" />, divider: true },
      { label: 'Size ↑', value: 'file_size_asc', icon: <i className="bi bi-sort-numeric-up" /> },
    ],
    []
  );

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
            placeholder="Search… (Ctrl+K)"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="filtersSearchInput"
            aria-label="Search files"
          />
          {search && (
            <button
              type="button"
              className="filtersSearchClearButton"
              onClick={() => {
                onSearchChange('');
                const w = window as unknown as { __fileListSearchInput?: HTMLInputElement };
                w.__fileListSearchInput?.focus();
              }}
              aria-label="Clear search"
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          )}
        </div>

        {layout === 'screenshot' && (
          <div className="filtersInlineFilters" aria-label="Filters">
            <div className="filtersRow">
              {/* Type dropdown card */}
              <DropdownMenu
                title="Type"
                options={typeOptions}
                selectedValue={mimeType}
                onSelect={onMimeTypeChange}
                ariaLabel="Type"
              />

              {/* Sort dropdown card */}
              <DropdownMenu
                title="Sort"
                options={sortOptions}
                selectedValue={sortBy}
                onSelect={onSortChange}
                ariaLabel="Sort"
              />
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
            <DropdownMenu
              title="Type"
              options={typeOptions}
              selectedValue={mimeType}
              onSelect={onMimeTypeChange}
              ariaLabel="Type filter"
            />

            {/* Sort dropdown card */}
            <DropdownMenu
              title="Sort"
              options={sortOptions}
              selectedValue={sortBy}
              onSelect={onSortChange}
              ariaLabel="Sort order"
            />
          </div>
        </div>
      )}
    </div>
  );
});

export default FileListFilters;
