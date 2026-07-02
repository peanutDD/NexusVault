export function findFolderDropTargetFromPoint(
  clientX: number,
  clientY: number,
  excludedFolderId?: string,
) {
  const candidates =
    typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(clientX, clientY)
      : document.elementFromPoint
        ? [document.elementFromPoint(clientX, clientY)].filter(Boolean)
        : [];

  for (const candidate of candidates) {
    const target = candidate?.closest<HTMLElement>("[data-folder-id]");
    const folderId = target?.dataset.folderId;
    if (folderId !== undefined && folderId !== excludedFolderId) {
      return target;
    }
  }

  return null;
}
