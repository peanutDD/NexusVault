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
    <div className="all-files-row flex items-center justify-between gap-[clamp(0.75rem,2vw,1rem)]">
      <div className="flex shrink-0 items-center gap-[clamp(0.6rem,1.4vw,0.75rem)]">
        {isRevalidating ? (
          <span
            className="text-[0.65rem] text-[var(--filelist-revalidating-text)]"
            aria-live="polite"
          >
            更新中…
          </span>
        ) : null}
        <label className="font-brand flex cursor-pointer items-center gap-[clamp(0.4rem,1vw,0.5rem)] whitespace-nowrap text-[0.625rem] font-normal leading-none tracking-widest text-[var(--filelist-selection-label)]">
          <input
            type="checkbox"
            checked={allFilesSelected}
            onChange={onToggleSelectAll}
            aria-label="All Files"
            className="sr-only"
          />
          <span
            aria-hidden
            className={`inline-flex h-[clamp(0.875rem,2vw,1rem)] min-h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] min-w-[clamp(0.875rem,2vw,1rem)] shrink-0 items-center justify-center overflow-hidden rounded-[clamp(0.2rem,0.6vw,0.25rem)] border transition-all duration-200 ${
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
