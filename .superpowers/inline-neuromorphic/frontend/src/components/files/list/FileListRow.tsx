interface FileListRowProps {
  isRevalidating: boolean;
  allFilesSelected: boolean;
  selectedCount: number;
  totalText: string;
  selectionScopeLabel?: string;
  onToggleSelectAll: () => void;
}

export default function FileListRow({
  isRevalidating,
  allFilesSelected,
  selectedCount,
  totalText,
  selectionScopeLabel = "All Files",
  onToggleSelectAll,
}: FileListRowProps) {
  return (
    <div
      className="all-files-row fileListSelectionStatsRow flex flex-row flex-nowrap items-center justify-between gap-[clamp(0.75rem,2vw,1rem)]"
      data-testid="filelist-selection-stats-row"
    >
      <div className="fileListSelectionStatsLeft flex shrink-0 items-center gap-[clamp(0.6rem,1.4vw,0.75rem)]">
        {isRevalidating ? (
          <span
            className="text-[length:var(--font-size-ui-4xs)] text-[var(--filelist-revalidating-text)]"
            aria-live="polite"
          >
            更新中…
          </span>
        ) : null}
        <label
          className="neu-raised-sm fileListSelectionStatChip fileListAllFilesStat font-brand flex cursor-pointer items-center gap-[clamp(0.4rem,1vw,0.5rem)] whitespace-nowrap text-[length:var(--font-size-ui-5xs)] font-normal leading-none tracking-widest text-[var(--filelist-selection-label)]"
          data-testid="filelist-all-files-stat"
        >
          <input
            type="checkbox"
            checked={allFilesSelected}
            onChange={onToggleSelectAll}
            aria-label={selectionScopeLabel}
            className="sr-only"
          />
          <span
            aria-hidden
            className={`filelist-check-control fileListAllFilesCheckbox inline-flex shrink-0 items-center justify-center overflow-hidden border-0 text-transparent transition-none ${
              allFilesSelected
                ? "filelist-check-control-checked fileListAllFilesCheckboxSelected"
                : "filelist-check-control-unchecked fileListAllFilesCheckboxUnchecked"
            }`}
          />
          <span className="select-none">{selectionScopeLabel}</span>
        </label>
        <span
          className="neu-raised-sm fileListSelectionStatChip fileListSelectedCountStat font-brand text-[length:var(--font-size-ui-5xs)] font-normal leading-none tracking-widest text-[var(--filelist-selection-count)]"
          data-testid="filelist-selected-count-stat"
        >
          {selectedCount} selected
        </span>
      </div>
      <span
        className="neu-raised-sm fileListSelectionStatChip fileListTotalStat font-brand shrink-0 whitespace-nowrap text-[length:var(--font-size-ui-5xs)] font-normal leading-none tracking-widest text-[var(--filelist-check-bg-checked-on)]"
        data-testid="filelist-total-stat"
      >
        {totalText}
      </span>
    </div>
  );
}
