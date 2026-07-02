// 分组全选复选框组件
interface GroupSelectCheckboxProps {
  itemIds: string[];
  selectedIds: Set<string>;
  onToggle: (ids: string[], selected: boolean) => void;
}

type GroupCheckboxState = "checked" | "mixed" | "unchecked";

function getGroupCheckboxClassName(state: GroupCheckboxState) {
  const stateClass =
    state === "checked"
      ? "filelist-check-control-checked fileListGroupSelectCheckboxChecked fileListGroupSelectCheckboxSelected"
      : state === "mixed"
        ? "fileListGroupSelectCheckboxMixed"
        : "filelist-check-control-unchecked fileListGroupSelectCheckboxUnchecked";

  return `
    filelist-check-control fileListGroupSelectCheckbox inline-flex shrink-0 items-center justify-center border-0 text-transparent transition-none
    ${stateClass}
  `;
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
      className={getGroupCheckboxClassName(
        allSelected ? "checked" : someSelected ? "mixed" : "unchecked",
      )}
      aria-label={allSelected ? "取消全选此分组" : "全选此分组"}
      data-oid="p0x1673"
    />
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
      className={getGroupCheckboxClassName(
        allSelected ? "checked" : someSelected ? "mixed" : "unchecked",
      )}
      aria-label={allSelected ? "取消全选此分组" : "全选此分组"}
      data-oid="q97dtx-"
    />
  );
}
