import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@chenglou/pretext', () => {
  const prepare = vi.fn((text: string) => ({ _text: text }))
  const layout = vi.fn((p: { _text: string }, maxWidth: number, lh: number) => {
    const lc = maxWidth > 0 ? Math.max(1, Math.ceil((p._text.length * 7) / maxWidth)) : 1
    return { height: lc * lh, lineCount: lc }
  })
  return { prepare, layout, clearCache: vi.fn() }
})

import {
  fileNameFontSizePx, folderNameFontSizePx, measureLineCount,
  computeFileCardHeight, computeFolderCardHeight,
  buildRowModel, findStartRow, findEndRow,
  clearPretextMeasureCache, GRID_CARD,
} from './pretextMeasure'

beforeEach(() => clearPretextMeasureCache())

describe('fileNameFontSizePx', () => {
  it('min', () => expect(fileNameFontSizePx(320)).toBeCloseTo(6.08, 1))
  it('max', () => expect(fileNameFontSizePx(1600)).toBeCloseTo(9.28, 1))
  it('mid', () => expect(fileNameFontSizePx(600)).toBeCloseTo(7.8, 1))
})
describe('folderNameFontSizePx', () => {
  it('min', () => expect(folderNameFontSizePx(320)).toBeCloseTo(9.6, 1))
  it('max', () => expect(folderNameFontSizePx(1600)).toBeCloseTo(13.12, 1))
})
describe('measureLineCount', () => {
  it('1 empty',   () => expect(measureLineCount('', 'f', 200, 12)).toBe(1))
  it('1 spaces',  () => expect(measureLineCount('  ', 'f', 200, 12)).toBe(1))
  it('1 zero w',  () => expect(measureLineCount('hi', 'f', 0, 12)).toBe(1))
  it('>=1 text',  () => expect(measureLineCount('x.jpg', 'f', 200, 12)).toBeGreaterThanOrEqual(1))
})
describe('computeFileCardHeight', () => {
  it('positive',  () => expect(computeFileCardHeight('a.jpg', 120, 1280)).toBeGreaterThan(0))
  it('keeps card titles single-line', () => expect(GRID_CARD.MAX_NAME_LINES).toBe(1))
  it('formula',   () => {
    const iW = 120 - GRID_CARD.H_PAD, fs = fileNameFontSizePx(1280), lh = Math.ceil(fs * GRID_CARD.NAME_LH_FACTOR)
    expect(computeFileCardHeight('a.jpg', 120, 1280)).toBeCloseTo(GRID_CARD.V_PAD + iW + GRID_CARD.THUMB_MB + lh + GRID_CARD.FILE_META_H, 0)
  })
  it('does not grow for long names', () => expect(computeFileCardHeight('x'.repeat(80), 120, 1280)).toBe(computeFileCardHeight('x.jpg', 120, 1280)))
  it('capped',    () => {
    const iW = 120 - GRID_CARD.H_PAD, fs = fileNameFontSizePx(1280), lh = Math.ceil(fs * GRID_CARD.NAME_LH_FACTOR)
    expect(computeFileCardHeight('x'.repeat(500), 120, 1280)).toBeLessThanOrEqual(GRID_CARD.V_PAD + iW + GRID_CARD.THUMB_MB + GRID_CARD.MAX_NAME_LINES * lh + GRID_CARD.FILE_META_H)
  })
})
describe('computeFolderCardHeight', () => {
  it('positive',  () => expect(computeFolderCardHeight('Docs', 120, 1280)).toBeGreaterThan(0))
  it('< file',    () => expect(computeFolderCardHeight('Photos', 120, 1280)).toBeLessThan(computeFileCardHeight('a.jpg', 120, 1280)))
})
describe('buildRowModel', () => {
  const items = [
    { kind: 'file' as const, filename: 'a.jpg' }, { kind: 'file' as const, filename: 'b.jpg' },
    { kind: 'file' as const, filename: 'c.jpg' }, { kind: 'folder' as const, name: 'Docs' },
  ]
  it('empty',     () => expect(buildRowModel([], 3, 400, 1280).prefixSums).toEqual([0]))
  it('2 rows',    () => expect(buildRowModel(items, 3, 400, 1280).rowHeights).toHaveLength(2))
  it('reserves hover-safe vertical spacing', () => expect(GRID_CARD.ROW_GAP).toBeGreaterThanOrEqual(12))
  it('monotone',  () => { const { prefixSums: ps } = buildRowModel(items, 3, 400, 1280); for (let i = 1; i < ps.length; i++) expect(ps[i]).toBeGreaterThan(ps[i-1]) })
  it('total',     () => { const { rowHeights: rh, prefixSums: ps } = buildRowModel(items, 3, 400, 1280); expect(ps[rh.length]).toBeCloseTo(rh.reduce((a,b)=>a+b,0)) })
})
const ps = [0, 100, 200, 300, 400, 500]
describe('findStartRow', () => {
  it('0',  () => expect(findStartRow(ps, 0)).toBe(0))
  it('1a', () => expect(findStartRow(ps, 100)).toBe(1))
  it('1b', () => expect(findStartRow(ps, 150)).toBe(1))
  it('2',  () => expect(findStartRow(ps, 200)).toBe(2))
  it('4',  () => expect(findStartRow(ps, 450)).toBe(4))
})
describe('findEndRow', () => {
  it('0',  () => expect(findEndRow(ps, 50)).toBe(0))
  it('1',  () => expect(findEndRow(ps, 150)).toBe(1))
  it('2',  () => expect(findEndRow(ps, 250)).toBe(2))
  it('4',  () => expect(findEndRow(ps, 500)).toBe(4))
})
