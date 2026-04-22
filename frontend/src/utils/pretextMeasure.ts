/**
 * pretextMeasure.ts — DOM-free text measurement via @chenglou/pretext
 * Powers VirtualizedFileGrid / VirtualizedMixedGrid row-height calculations.
 */
import { prepare, layout, clearCache } from '@chenglou/pretext'

type PreparedText = ReturnType<typeof prepare>

const FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export const GRID_CARD = {
  H_PAD: 24, V_PAD: 24, THUMB_MB: 12, MAX_NAME_LINES: 2,
  NAME_LH_FACTOR: 1.3, NAME_RIGHT_RESERVED: 20, FILE_META_H: 28, ROW_GAP: 8,
} as const

const _cache = new Map<string, PreparedText>()
const MAX_CACHE = 2000

function getCached(text: string, font: string): PreparedText {
  const key = `${font}\0${text}`
  let p = _cache.get(key)
  if (p) return p
  p = prepare(text, font)
  if (_cache.size >= MAX_CACHE) { const k = _cache.keys().next().value; if (k !== undefined) _cache.delete(k) }
  _cache.set(key, p)
  return p
}

export function clearPretextMeasureCache(): void { _cache.clear(); clearCache() }

function evalClamp(a: number, b: number, c: number, vw: number): number {
  return Math.max(a * 16, Math.min(c * 16, b * vw))
}
export function fileNameFontSizePx(vw: number): number { return evalClamp(0.38, 0.013, 0.58, vw) }
export function folderNameFontSizePx(vw: number): number { return evalClamp(0.6, 0.022, 0.82, vw) }

export function measureLineCount(text: string, font: string, maxWidth: number, lineHeight: number): number {
  if (maxWidth <= 0 || !text.trim()) return 1
  try { const { lineCount } = layout(getCached(text, font), maxWidth, lineHeight); return Math.max(1, lineCount) }
  catch { return 1 }
}

export function computeFileCardHeight(filename: string, cardWidth: number, viewportWidth: number): number {
  const innerW = Math.max(0, cardWidth - GRID_CARD.H_PAD)
  const fs = fileNameFontSizePx(viewportWidth)
  const lineH = Math.ceil(fs * GRID_CARD.NAME_LH_FACTOR)
  const lc = Math.min(measureLineCount(filename, `500 ${fs}px ${FONT_FAMILY}`, Math.max(0, innerW - GRID_CARD.NAME_RIGHT_RESERVED), lineH), GRID_CARD.MAX_NAME_LINES)
  return GRID_CARD.V_PAD + innerW + GRID_CARD.THUMB_MB + lc * lineH + GRID_CARD.FILE_META_H
}

export function computeFolderCardHeight(folderName: string, cardWidth: number, viewportWidth: number): number {
  const innerW = Math.max(0, cardWidth - GRID_CARD.H_PAD)
  const fs = folderNameFontSizePx(viewportWidth)
  const lineH = Math.ceil(fs * GRID_CARD.NAME_LH_FACTOR)
  const namePad = evalClamp(0.7, 0.02, 1.0, viewportWidth) * 2
  const lc = Math.min(measureLineCount(folderName, `500 ${fs}px ${FONT_FAMILY}`, Math.max(0, innerW - namePad - GRID_CARD.NAME_RIGHT_RESERVED), lineH), GRID_CARD.MAX_NAME_LINES)
  return GRID_CARD.V_PAD + innerW + GRID_CARD.THUMB_MB + lc * lineH
}

export type GridItemDescriptor = { kind: 'file'; filename: string } | { kind: 'folder'; name: string }

export function buildRowModel(items: GridItemDescriptor[], columns: number, containerWidth: number, viewportWidth: number): { rowHeights: number[]; prefixSums: number[] } {
  if (!items.length || columns <= 0 || containerWidth <= 0) return { rowHeights: [], prefixSums: [0] }
  const gap = 8
  const cardWidth = Math.max(0, (containerWidth - gap * (columns - 1)) / columns)
  const rowCount = Math.ceil(items.length / columns)
  const rowHeights = new Array<number>(rowCount)
  for (let r = 0; r < rowCount; r++) {
    const s = r * columns, e = Math.min(s + columns, items.length)
    let maxH = 0
    for (let i = s; i < e; i++) {
      const item = items[i]
      const h = item.kind === 'file' ? computeFileCardHeight(item.filename, cardWidth, viewportWidth) : computeFolderCardHeight(item.name, cardWidth, viewportWidth)
      if (h > maxH) maxH = h
    }
    rowHeights[r] = maxH + GRID_CARD.ROW_GAP
  }
  const prefixSums = new Array<number>(rowCount + 1)
  prefixSums[0] = 0
  for (let i = 0; i < rowCount; i++) prefixSums[i + 1] = prefixSums[i] + rowHeights[i]
  return { rowHeights, prefixSums }
}

export function findStartRow(prefixSums: number[], scrollTop: number): number {
  let lo = 0, hi = prefixSums.length - 2
  if (hi < 0) return 0
  while (lo < hi) { const mid = (lo + hi) >> 1; if (prefixSums[mid + 1] <= scrollTop) lo = mid + 1; else hi = mid }
  return lo
}

export function findEndRow(prefixSums: number[], scrollBottom: number): number {
  let lo = 0, hi = prefixSums.length - 2
  if (hi < 0) return 0
  while (lo < hi) { const mid = ((lo + hi) >> 1) + 1; if (prefixSums[mid] < scrollBottom) lo = mid; else hi = mid - 1 }
  return lo
}
