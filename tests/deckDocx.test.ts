import { describe, it, expect } from 'vitest'
import {
  buildDeckDocx,
  zipStore,
  crc32,
  ARSENAL_GRID,
  BACKLASH_GRID,
  type DeckDocxDeps,
} from '../src/export/deckDocx'

/** 1x1 red PNG. */
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
)

interface ZipEntry {
  name: string
  data: Uint8Array
  method: number
  crc: number
}

function unzip(bytes: Uint8Array): ZipEntry[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out: ZipEntry[] = []
  let off = 0
  while (off + 4 <= bytes.length && dv.getUint32(off, true) === 0x04034b50) {
    const method = dv.getUint16(off + 8, true)
    const crc = dv.getUint32(off + 14, true)
    const size = dv.getUint32(off + 18, true)
    const nameLen = dv.getUint16(off + 26, true)
    const extraLen = dv.getUint16(off + 28, true)
    const name = new TextDecoder().decode(bytes.subarray(off + 30, off + 30 + nameLen))
    const start = off + 30 + nameLen + extraLen
    out.push({ name, data: bytes.subarray(start, start + size), method, crc })
    off = start + size
  }
  return out
}

function text(entries: ZipEntry[], name: string): string {
  const e = entries.find((x) => x.name === name)
  if (!e) throw new Error(`missing entry ${name}`)
  return new TextDecoder().decode(e.data)
}

const ids = (prefix: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}-${i}`)

/** One [x, y] margin-relative offset (EMU) per floating card, in document order. */
function anchorOffsets(doc: string): [number, number][] {
  const re =
    /<wp:positionH relativeFrom="margin"><wp:posOffset>(\d+)<\/wp:posOffset><\/wp:positionH><wp:positionV relativeFrom="margin"><wp:posOffset>(\d+)<\/wp:posOffset><\/wp:positionV>/g
  return [...doc.matchAll(re)].map((m) => [Number(m[1]), Number(m[2])])
}

/** Card count per sheet, i.e. per paragraph that carries floating drawings. */
function cardsPerSheet(doc: string): number[] {
  return doc
    .split('<w:p>')
    .filter((para) => para.includes('<wp:anchor'))
    .map((para) => para.split('<w:drawing>').length - 1)
}

/** The [col * cellW, row * cellH] positions a grid of `count` cells should use. */
function gridOffsets(grid: { cols: number; emuW: number; emuH: number }, count: number): [number, number][] {
  return Array.from({ length: count }, (_, i) => [
    (i % grid.cols) * grid.emuW,
    Math.floor(i / grid.cols) * grid.emuH,
  ])
}

const deps: DeckDocxDeps = {
  fetchPng: async () => PNG,
  rotatePng: async (b) => b,
}

describe('zipStore', () => {
  it('writes local headers, central directory and a valid CRC per entry', () => {
    const files = [
      { name: 'a.txt', data: new TextEncoder().encode('hello world') },
      { name: 'dir/b.bin', data: new Uint8Array([1, 2, 3, 4, 5]) },
    ]
    const zip = zipStore(files)
    const entries = unzip(zip)

    expect(entries.map((e) => e.name)).toEqual(['a.txt', 'dir/b.bin'])
    entries.forEach((e, i) => {
      expect(e.method).toBe(0)
      expect(e.crc).toBe(crc32(files[i]!.data))
      expect(Array.from(e.data)).toEqual(Array.from(files[i]!.data))
    })

    // End-of-central-directory record.
    const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
    expect(dv.getUint32(zip.length - 22, true)).toBe(0x06054b50)
    expect(dv.getUint16(zip.length - 12, true)).toBe(files.length)
  })
})

describe('buildDeckDocx', () => {
  it('lays the arsenal out 3x3 on Oficio pages and rotates the backlash cards', async () => {
    const bytes = await buildDeckDocx(
      {
        name: 'Mazo de prueba',
        arsenal: ids('card', 20), // 9 + 9 + 2
        backlashPre: ids('pre', 10),
        backlashMid: ids('mid', 10),
      },
      deps,
    )

    const entries = unzip(bytes)
    const names = entries.map((e) => e.name)
    expect(names).toContain('[Content_Types].xml')
    expect(names).toContain('word/document.xml')
    expect(names).toContain('word/styles.xml')
    expect(names).toContain('word/media/image1.png')

    const doc = text(entries, 'word/document.xml')

    // Oficio: 21.59 x 33.02 cm.
    expect(doc).toContain('<w:pgSz w:w="12240" w:h="18720"/>')

    // 20 arsenal cards -> 3 sheets, plus 1 sheet per backlash half.
    expect(doc).not.toContain('<w:tbl>')
    expect(cardsPerSheet(doc)).toEqual([9, 9, 2, 10, 10])

    // Arsenal cells are portrait (6.4 x 9 cm), backlash cells are rotated (9 x 6.4 cm).
    const portrait = '<wp:extent cx="2304000" cy="3240000"/>'
    const landscape = '<wp:extent cx="3240000" cy="2304000"/>'
    expect(doc.split(portrait).length - 1).toBe(20)
    expect(doc.split(landscape).length - 1).toBe(20)
    expect(doc.split('<w:drawing>').length - 1).toBe(40)
    // Anchors live in body paragraphs, never inside a cell.
    expect(doc.split('layoutInCell="0"').length - 1).toBe(40)

    // Every card sits on its grid slot: col/cellW, row/cellH from the margin.
    const offsets = anchorOffsets(doc)
    expect(offsets).toHaveLength(40)
    expect(offsets.slice(0, 9)).toEqual(gridOffsets(ARSENAL_GRID, 9))
    expect(offsets.slice(9, 18)).toEqual(gridOffsets(ARSENAL_GRID, 9))
    expect(offsets.slice(18, 20)).toEqual(gridOffsets(ARSENAL_GRID, 2))
    expect(offsets.slice(20, 30)).toEqual(gridOffsets(BACKLASH_GRID, 10))
    expect(offsets.slice(30, 40)).toEqual(gridOffsets(BACKLASH_GRID, 10))

    // Sections: arsenal ends with a section break, then the backlash section.
    expect(doc).toContain('<w:sectPr>')
    expect(doc.match(/<w:sectPr>/g)?.length).toBe(2)

    // Image parts live in word/media and are referenced relatively.
    const rels = text(entries, 'word/_rels/document.xml.rels')
    expect(rels).toContain('Target="media/image1.png"')
    expect(rels).not.toContain('Target="image1.png"')
  })

  it('keeps the grid when a card has no artwork', async () => {
    const bytes = await buildDeckDocx(
      { name: 'Sin arte', arsenal: ids('card', 9), backlashPre: [], backlashMid: [] },
      { ...deps, fetchPng: async (id) => (id === 'card-4' ? null : PNG) },
    )
    const doc = text(unzip(bytes), 'word/document.xml')
    expect(cardsPerSheet(doc)).toEqual([8])
    expect(doc.split('<w:drawing>').length - 1).toBe(8)
    // The gap keeps slot (1,1): positions are index based, never packed.
    const all = gridOffsets(ARSENAL_GRID, 9)
    expect(anchorOffsets(doc)).toEqual([...all.slice(0, 4), ...all.slice(5)])
    // No backlash content: the single section keeps the arsenal margins.
    expect(doc.match(/<w:sectPr>/g)?.length).toBe(1)
    expect(doc).toContain('<w:pgMar w:top="1600"')
  })

  it('starts the backlash section with the landscape grid even without an arsenal', async () => {
    const bytes = await buildDeckDocx(
      { name: 'Solo backlash', arsenal: [], backlashPre: ids('pre', 3), backlashMid: [] },
      deps,
    )
    const doc = text(unzip(bytes), 'word/document.xml')
    expect(doc).toContain('<w:pgMar w:top="200"')
    expect(cardsPerSheet(doc)).toEqual([3])
    expect(doc.split('<w:drawing>').length - 1).toBe(3)
    expect(anchorOffsets(doc)).toEqual(gridOffsets(BACKLASH_GRID, 3))
    expect(doc).toContain('<wp:extent cx="3240000" cy="2304000"/>')
  })
})

describe('grid dimensions', () => {
  it('fits 3x3 portrait cards inside an Oficio page', () => {
    expect(ARSENAL_GRID.cellW).toBe(3628)
    expect(ARSENAL_GRID.cellH).toBe(5102)
    expect(ARSENAL_GRID.cellW * ARSENAL_GRID.cols).toBeLessThanOrEqual(12240)
    expect(ARSENAL_GRID.cellH * ARSENAL_GRID.rows).toBeLessThanOrEqual(18720)
  })

  it('fits 10 rotated backlash cards inside an Oficio page', () => {
    expect(BACKLASH_GRID.cellW).toBe(5102)
    expect(BACKLASH_GRID.cellH).toBe(3628)
    expect(BACKLASH_GRID.cellW * BACKLASH_GRID.cols).toBeLessThanOrEqual(12240)
    expect(BACKLASH_GRID.cellH * BACKLASH_GRID.rows).toBeLessThanOrEqual(18720)
  })
})
