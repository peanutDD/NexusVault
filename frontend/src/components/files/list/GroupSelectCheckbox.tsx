// 分组全选复选框组件
interface GroupSelectCheckboxProps {
  itemIds: string[];
  selectedIds: Set<string>;
  onToggle: (ids: string[], selected: boolean) => void;
}

export function GroupSelectCheckbox({
  itemIds,
  selectedIds,
  onToggle,
}: GroupSelectCheckboxProps) {
  const selectedCount = itemIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = selectedCount === itemIds.length && itemIds.length > 0;
  const someSelected = selectedCount > 0 && selectedCount < itemIds.length;

  const handleClick = () => {
    // 如果全选了，则取消全选；否则全选
    onToggle(itemIds, !allSelected);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        flex h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)] shrink-0 items-center justify-center rounded border transition-colors duration-150
        ${
          allSelected
            ? "border-[var(--filelist-check-border-checked)] bg-[var(--filelist-check-bg-checked)] text-[var(--filelist-check-text-checked)]"
            : someSelected
              ? "border-[var(--filelist-check-border-checked)] bg-[var(--filelist-check-bg-checked)] text-[var(--filelist-check-text-checked)]"
              : "border-[var(--filelist-check-border)] bg-[var(--filelist-check-bg)] text-transparent hover:border-[var(--filelist-check-border-hover)] hover:bg-[var(--filelist-check-bg-hover)]"
        }
      `}
      aria-label={allSelected ? "取消全选此分组" : "全选此分组"}
      data-oid="p0x1673"
    >
      {allSelected ? (
        <i
          className="bi bi-check-lg text-[0.5rem] font-bold leading-none"
          aria-hidden
          data-oid="_ai7oj9"
        />
      ) : someSelected ? (
        <i
          className="bi bi-dash text-[0.625rem] font-bold leading-none"
          aria-hidden
          data-oid="fkl17vv"
        />
      ) : null}
    </button>
  );
}

interface GroupSelectCheckboxMixedProps {
  fileIds: string[];
  folderIds: string[];
  selectedFileIds: Set<string>;
  selectedFolderIds: Set<string>;
  onToggle: (fileIds: string[], folderIds: string[], selected: boolean) => void;
}

export function GroupSelectCheckboxMixed({
  fileIds,
  folderIds,
  selectedFileIds,
  selectedFolderIds,
  onToggle,
}: GroupSelectCheckboxMixedProps) {
  const selectedCount =
    fileIds.filter((id) => selectedFileIds.has(id)).length +
    folderIds.filter((id) => selectedFolderIds.has(id)).length;
  const total = fileIds.length + folderIds.length;
  const allSelected = total > 0 && selectedCount === total;
  const someSelected = selectedCount > 0 && selectedCount < total;

  const handleClick = () => {
    onToggle(fileIds, folderIds, !allSelected);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        flex h-[clamp(0.78rem,1.8vw,1rem)] w-[clamp(0.78rem,1.8vw,1rem)] shrink-0 items-center justify-center rounded border transition-colors duration-150
        ${
          allSelected
            ? "border-[var(--filelist-check-border-checked)] bg-[var(--filelist-check-bg-checked)] text-[var(--filelist-check-text-checked)]"
            : someSelected
              ? "border-[var(--filelist-check-border-checked)] bg-[var(--filelist-check-bg-checked)] text-[var(--filelist-check-text-checked)]"
              : "border-[var(--filelist-check-border)] bg-[var(--filelist-check-bg)] text-transparent hover:border-[var(--filelist-check-border-hover)] hover:bg-[var(--filelist-check-bg-hover)]"
        }
      `}
      aria-label="Select group"
      data-oid="q97dtx-"
    >
      <i
        className={`block text-[0.625rem] font-bold leading-none ${allSelected ? "bi bi-check-lg" : someSelected ? "bi bi-dash" : "bi bi-check-lg invisible"}`}
        aria-hidden
        data-oid="2tt2iaq"
      />
    </button>
  );
}