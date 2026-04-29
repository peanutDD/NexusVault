interface FileListRowProps {
  isRevalidating: boolean;
  allFilesSelected: boolean;
  selectedCount: number;
  totalText: string;
  onToggleSelectAll: () => void;
}

export default function FileListRow({
  isRevalidating,
  allFilesSelected,
  selectedCount,
  totalText,
  onToggleSelectAll,
}: FileListRowProps) {
  return (
    <div className="all-files-row flex items-center justify-between gap-4">
      <div className="flex shrink-0 items-center gap-3">
        {isRevalidating ? (
          <span
            className="text-[0.65rem] text-[var(--filelist-revalidating-text)]"
            aria-live="polite"
          >
            更新中…
          </span>
        ) : null}
        <label className="font-brand flex cursor-pointer items-center gap-2 whitespace-nowrap text-[0.625rem] font-normal leading-none tracking-widest text-[var(--filelist-selection-label)]">
          <input
            type="checkbox"
            checked={allFilesSelected}
            onChange={onToggleSelectAll}
            aria-label="All Files"
            className="sr-only"
          />
          <span
            aria-hidden
            className={`inline-flex h-4 min-h-4 w-4 min-w-4 shrink-0 items-center justify-center overflow-hidden rounded-sm border transition-all duration-200 ${
              allFilesSelected
                ? "border-[var(--filelist-check-border-checked)] bg-[var(--filelist-check-bg-checked)] text-[var(--filelist-check-text-checked)]"
                : "border-[var(--filelist-check-border)] bg-[var(--filelist-check-bg)] text-transparent hover:border-[var(--filelist-check-border-hover)] hover:bg-[var(--filelist-check-bg-hover)]"
            }`}
          >
            <i
              className={`bi bi-check-lg block text-[0.55rem] font-bold leading-none ${allFilesSelected ? "" : "invisible"}`}
              aria-hidden
            />
          </span>
          <span className="select-none">All Files</span>
        </label>
        <span className="font-brand text-[0.625rem] font-normal leading-none tracking-widest text-[var(--filelist-selection-count)]">
          {selectedCount} selected
        </span>
      </div>
      <span className="font-brand min-w-0 truncate text-[0.625rem] font-normal leading-none tracking-widest text-[var(--filelist-total-text)]">
        {totalText}
      </span>
    </div>
  );
}
