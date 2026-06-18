export function computeCollapsedChipVisibility({
  containerWidth,
  chipWidths,
  gap,
  toggleWidth,
}: {
  containerWidth: number;
  chipWidths: number[];
  gap: number;
  toggleWidth: number;
}) {
  if (containerWidth <= 0 || chipWidths.length === 0) {
    return { hasOverflow: false, visibleCount: chipWidths.length };
  }

  const totalWidth =
    chipWidths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, chipWidths.length - 1) * gap;

  if (totalWidth <= containerWidth) {
    return { hasOverflow: false, visibleCount: chipWidths.length };
  }

  const collapsedWidth = Math.max(0, containerWidth - toggleWidth - gap);
  let usedWidth = 0;
  let visibleCount = 0;

  for (const width of chipWidths) {
    const nextWidth = usedWidth + (visibleCount > 0 ? gap : 0) + width;
    if (nextWidth > collapsedWidth) break;
    usedWidth = nextWidth;
    visibleCount += 1;
  }

  return { hasOverflow: true, visibleCount };
}
