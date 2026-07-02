import { memo, useMemo } from "react";
import { Search } from "lucide-react";
import { MIME_FILTER_FOLDERS } from "../../../constants";
import DropdownMenu from "../../common/DropdownMenu";
import "./FileListFilters.css";

export type SortOption =
  | "created_at_desc"
  | "created_at_asc"
  | "filename_asc"
  | "filename_desc"
  | "file_size_desc"
  | "file_size_asc"
  | "type_group"
  | "time_group";

interface FileListFiltersProps {
  search: string;
  mimeType: string;
  sortBy: string;
  onSearchChange: (v: string) => void;
  onMimeTypeChange: (v: string) => void;
  onSortChange: (v: string) => void;
  actions?: React.ReactNode;
  layout?: "inline" | "screenshot";
}

const FileListFilters = memo(function FileListFilters({
  search,
  mimeType,
  sortBy,
  onSearchChange,
  onMimeTypeChange,
  onSortChange,
  actions,
  layout = "inline",
}: FileListFiltersProps) {
  const typeOptions = useMemo(
    () => [
      {
        label: "All Types",
        value: "",
        icon: <i className="bi bi-collection" data-oid="-5x6thc" />,
      },
      {
        label: "Folders",
        value: MIME_FILTER_FOLDERS,
        icon: <i className="bi bi-folder" data-oid="3v_gc2n" />,
        divider: true,
      },
      {
        label: "Images",
        value: "image/",
        icon: <i className="bi bi-image" data-oid="sw9k_m9" />,
      },
      {
        label: "Videos",
        value: "video/",
        icon: <i className="bi bi-file-earmark-play" data-oid="ae_.ris" />,
      },
      {
        label: "Audio",
        value: "audio/",
        icon: <i className="bi bi-music-note-beamed" data-oid="r.x748t" />,
      },
      {
        label: "GIF",
        value: "image/gif",
        icon: <i className="bi bi-filetype-gif" data-oid="7d0cnaw" />,
      },
      {
        label: "PDF",
        value: "application/pdf",
        icon: <i className="bi bi-filetype-pdf" data-oid="embnpmw" />,
        divider: true,
      },
      {
        label: "MD",
        value: "text/markdown",
        icon: <i className="bi bi-markdown" data-oid="1yyo8mj" />,
      },
      {
        label: "Text",
        value: "text/",
        icon: <i className="bi bi-file-text" data-oid="g1b61u4" />,
      },
      {
        label: "Archive",
        value: "application/zip",
        icon: <i className="bi bi-file-zip" data-oid="2mmnx2c" />,
      },
      {
        label: "Docs",
        value: "application/",
        icon: <i className="bi bi-filetype-doc" data-oid="l6wdvdv" />,
      },
    ],

    [],
  );

  const sortOptions = useMemo(
    () => [
      {
        label: "By Type",
        value: "type_group",
        icon: <i className="bi bi-grid-3x3-gap" data-oid="cpim5fa" />,
      },
      {
        label: "By Time",
        value: "time_group",
        icon: <i className="bi bi-calendar3" data-oid="6qw--vu" />,
      },
      {
        label: "Newest",
        value: "created_at_desc",
        icon: <i className="bi bi-sort-down" data-oid="n:8upxc" />,
        divider: true,
      },
      {
        label: "Oldest",
        value: "created_at_asc",
        icon: <i className="bi bi-sort-up" data-oid="5-yrzgj" />,
      },
      {
        label: "Name A–Z",
        value: "filename_asc",
        icon: <i className="bi bi-sort-alpha-down" data-oid="eohd1z:" />,
        divider: true,
      },
      {
        label: "Name Z–A",
        value: "filename_desc",
        icon: <i className="bi bi-sort-alpha-up" data-oid="gvhd-67" />,
      },
      {
        label: "Size ↓",
        value: "file_size_desc",
        icon: <i className="bi bi-sort-numeric-down" data-oid="af2m8bc" />,
        divider: true,
      },
      {
        label: "Size ↑",
        value: "file_size_asc",
        icon: <i className="bi bi-sort-numeric-up" data-oid="xizqubb" />,
      },
    ],

    [],
  );

  return (
    <div
      className={
        layout === "screenshot"
          ? "filtersSurface filtersSurfaceScreenshot"
          : "filtersSurface"
      }
      role="search"
      data-oid="k2c0gq-"
    >
      <div
        className={layout === "screenshot" ? "filtersTopRow" : undefined}
        data-oid="21w-szn"
      >
        {/* Search */}
        <div className="neu-inset filtersSearchPill" data-oid="y.p8i6s">
          <Search
            className="filtersSearchIcon"
            aria-hidden="true"
            data-oid="k07vrbg"
          />

          <input
            ref={(el) => {
              // 用于键盘快捷键聚焦
              const w = window as unknown as {
                __fileListSearchInput?: HTMLInputElement;
              };
              w.__fileListSearchInput = el ?? undefined;
            }}
            type="text"
            placeholder="Search… (Ctrl+K)"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="filtersSearchInput"
            aria-label="Search files"
            data-oid="qsvjw7:"
          />

          {search && (
            <button
              type="button"
              className="filtersSearchClearButton"
              onClick={() => {
                onSearchChange("");
                const w = window as unknown as {
                  __fileListSearchInput?: HTMLInputElement;
                };
                w.__fileListSearchInput?.focus();
              }}
              aria-label="Clear search"
              data-oid="lnl9qeq"
            >
              <i className="bi bi-x-lg" aria-hidden="true" data-oid="o4tc2yt" />
            </button>
          )}
        </div>

        {layout === "screenshot" && (
          <div
            className="filtersInlineFilters"
            aria-label="Filters"
            data-oid="it9n1q4"
          >
            <div className="filtersRow" data-oid="0z2m29e">
              {/* Type dropdown card */}
              <DropdownMenu
                title="Type"
                options={typeOptions}
                selectedValue={mimeType}
                onSelect={onMimeTypeChange}
                ariaLabel="Type"
                data-oid="7ps3idf"
              />

              {/* Sort dropdown card */}
              <DropdownMenu
                title="Sort"
                options={sortOptions}
                selectedValue={sortBy}
                onSelect={onSortChange}
                ariaLabel="Sort"
                data-oid="b09bbl9"
              />
            </div>
          </div>
        )}

        {layout === "screenshot" && actions && (
          <div
            className="filtersActions"
            aria-label="Actions"
            data-oid="2uh0qzc"
          >
            {actions}
          </div>
        )}
      </div>

      {layout !== "screenshot" && (
        <div data-oid="yz_2lgy">
          <div className="filtersRow" data-oid=".124_m8">
            {/* Type dropdown card */}
            <DropdownMenu
              title="Type"
              options={typeOptions}
              selectedValue={mimeType}
              onSelect={onMimeTypeChange}
              ariaLabel="Type filter"
              data-oid="kn-e566"
            />

            {/* Sort dropdown card */}
            <DropdownMenu
              title="Sort"
              options={sortOptions}
              selectedValue={sortBy}
              onSelect={onSortChange}
              ariaLabel="Sort order"
              data-oid="_obw2zq"
            />
          </div>
        </div>
      )}
    </div>
  );
});

export default FileListFilters;
