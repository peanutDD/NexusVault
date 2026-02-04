import { memo, useMemo } from 'react';
import { Search } from 'lucide-react';
import { MIME_FILTER_FOLDERS } from '../../../constants';
import DropdownMenu from '../../common/DropdownMenu';
import './FileListFilters.css';

export type SortOption = 'created_at_desc' | 'created_at_asc' | 'filename_asc' | 'filename_desc' | 'file_size_desc' | 'file_size_asc' | 'type_group';

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
      { label: 'Group by Type', value: 'type_group' },
      { label: 'Newest Upload', value: 'created_at_desc' },
      { label: 'Oldest Upload', value: 'created_at_asc' },
      { label: 'Filename A–Z', value: 'filename_asc' },
      { label: 'Filename Z–A', value: 'filename_desc' },
      { label: 'File Size ↓', value: 'file_size_desc' },
      { label: 'File Size ↑', value: 'file_size_asc' },
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
    </div>
  );
});

export default FileListFilters;
