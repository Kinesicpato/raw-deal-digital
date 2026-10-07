/**
 * Word (.docx) export for a built deck.
 *
 * The document is "Oficio" (21.59 x 33.02 cm) portrait and holds:
 *   - Arsenal cards: 3x3 grid, 9 cards per sheet, cell 6.4 x 9 cm.
 *   - Backlash cards: rotated 90 degrees, cell 9 x 6.4 cm, 2x5 = 10 per sheet.
 *
 * Written by hand (ZIP with stored entries + minimal WordprocessingML) so the
 * app needs no extra dependency.
 */

export interface DeckDocxInput {
  name: string
  arsenal: string[]
  backlashPre: string[]
  backlashMid: string[]
}

export interface DeckDocxDeps {
  /** Card art (300x420 PNG) as raw bytes, or null when the card has no art. */
  fetchPng: (cardId: string) => Promise<Uint8Array | null>
  /** Rotates a portrait card 90 degrees clockwise (portrait -> landscape). */
  rotatePng: (bytes: Uint8Array) => Promise<Uint8Array>
}

const EMU_PER_CM = 360000
const PAGE_W_TWIPS = 12240 // Oficio: 21.59 cm
const PAGE_H_TWIPS = 18720 // Oficio: 33.02 cm

const twips = (cm: number): number => Math.round((cm / 2.54) * 1440)
const emuCm = (cm: number): number => Math.round(cm * EMU_PER_CM)

interface PageGrid {
  cols: number
  rows: number
  cellW: number // twips
  cellH: number
  emuW: number
  emuH: number
}

/** Portrait cards: 9 per sheet, 6.4 cm wide x 9 cm tall. */
export const ARSENAL_GRID: PageGrid = {
  cols: 3,
  rows: 3,
  cellW: twips(6.4),
  cellH: twips(9),
  emuW: emuCm(6.4),
  emuH: emuCm(9),
}

/** Backlash cards, rotated: 9 cm wide x 6.4 cm tall, 10 per sheet. */
export const BACKLASH_GRID: PageGrid = {
  cols: 2,
  rows: 5,
  cellW: twips(9),
  cellH: twips(6.4),
  emuW: emuCm(9),
  emuH: emuCm(6.4),
}

interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

const ARSENAL_MARGINS: Margins = { top: 1600, right: 678, bottom: 1600, left: 678 }
const BACKLASH_MARGINS: Margins = { top: 200, right: 1018, bottom: 200, left: 1018 }

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

interface Cell {
  cardId: string
  rotated: boolean
}

interface MediaEntry {
  relId: string
  fileName: string
  bytes: Uint8Array
}

// ---------------------------------------------------------------------------
// ZIP (stored entries, no compression)
// ---------------------------------------------------------------------------

let crcTable: Uint32Array | null = null

function crcTableOnce(): Uint32Array {
  if (crcTable) return crcTable
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  crcTable = table
  return table
}

export function crc32(data: Uint8Array): number {
  const table = crcTableOnce()
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    const byte = data[i] ?? 0
    crc = (table[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** Builds a ZIP archive (method 0 = stored) from the given entries. */
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const now = new Date()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const crc = crc32(file.data)
    const size = file.data.length

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, dosTime, true)
    lv.setUint16(12, dosDate, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true)
    lv.setUint32(22, size, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    local.set(nameBytes, 30)
    locals.push(local, file.data)

    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, dosTime, true)
    cv.setUint16(14, dosDate, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true)
    cv.setUint16(32, 0, true)
    cv.setUint16(34, 0, true)
    cv.setUint16(36, 0, true)
    cv.setUint32(38, 0, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    centrals.push(central)

    offset += local.length + size
  }

  const centralBytes = concat(centrals)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralBytes.length, true)
  ev.setUint32(16, offset, true)
  ev.setUint16(20, 0, true)

  return concat([...locals, centralBytes, eocd])
}

// ---------------------------------------------------------------------------
// WordprocessingML
// ---------------------------------------------------------------------------

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture'
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
const REL_DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
const REL_STYLES = `${R}/styles`
const REL_IMAGE = `${R}/image`

function sectPrXml(margins: Margins, last = false): string {
  const type = last ? '' : '<w:type w:val="nextPage"/>'
  return (
    `<w:sectPr>${type}` +
    `<w:pgSz w:w="${PAGE_W_TWIPS}" w:h="${PAGE_H_TWIPS}"/>` +
    `<w:pgMar w:top="${margins.top}" w:right="${margins.right}" w:bottom="${margins.bottom}" w:left="${margins.left}" w:header="0" w:footer="0" w:gutter="0"/>` +
    `</w:sectPr>`
  )
}

/** A 1pt paragraph that either breaks the page or ends a section. */
function tinyParagraphXml(inner: string): string {
  const rPr = '<w:rPr><w:sz w:val="2"/></w:rPr>'
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>${rPr}${inner}</w:pPr>${inner.includes('<w:sectPr>') ? '' : `<w:r>${rPr}${inner}</w:r>`}</w:p>`
}

const pageBreakXml = (): string =>
  tinyParagraphXml('<w:br w:type="page"/>')

const sectionBreakXml = (margins: Margins): string => tinyParagraphXml(sectPrXml(margins))

function drawingXml(relId: string, docPrId: number, width: number, height: number): string {
  const name = `Card ${docPrId}`
  return (
    `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${width}" cy="${height}"/>` +
    `<wp:docPr id="${docPrId}" name="${name}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
  )
}

function tableXml(
  page: Cell[],
  grid: PageGrid,
  mediaFor: (cell: Cell) => MediaEntry | null,
  nextDocPrId: () => number,
): string {
  const cellW = grid.cellW
  const cellH = grid.cellH
  const cols: string[] = []
  for (let i = 0; i < grid.cols; i++) cols.push(`<w:gridCol w:w="${cellW}"/>`)

  const rows: string[] = []
  for (let r = 0; r < grid.rows; r++) {
    const cells: string[] = []
    for (let c = 0; c < grid.cols; c++) {
      const cell = page[r * grid.cols + c]
      let run = ''
      if (cell) {
        const media = mediaFor(cell)
        if (media) {
          run = `<w:r>${drawingXml(media.relId, nextDocPrId(), grid.emuW, grid.emuH)}</w:r>`
        }
      }
      cells.push(
        `<w:tc><w:tcPr><w:tcW w:w="${cellW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>` +
          `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${cellH}" w:lineRule="exact"/>` +
          `<w:jc w:val="center"/></w:pPr>${run}</w:p></w:tc>`,
      )
    }
    rows.push(
      `<w:tr><w:trPr><w:trHeight w:val="${cellH}" w:hRule="exact"/><w:cantSplit/></w:trPr>${cells.join('')}</w:tr>`,
    )
  }

  const total = cellW * grid.cols
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:jc w:val="center"/>` +
    `<w:tblLayout w:type="fixed"/>` +
    `<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>` +
    `<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>` +
    `</w:tblPr><w:tblGrid>${cols.join('')}</w:tblGrid>${rows.join('')}</w:tbl>`
  )
}

function documentXml(body: string, finalMargins: Margins): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}">` +
    `<w:body>${body}${sectPrXml(finalMargins, true)}</w:body></w:document>`
  )
}

function stylesXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:styles xmlns:w="${W}">` +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
    `</w:styles>`
  )
}

function relsXml(rels: { id: string; type: string; target: string }[]): string {
  const items = rels
    .map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PKG_REL}">${items}</Relationships>`
}

function contentTypesXml(mediaCount: number): string {
  const pngOverrides = Array.from(
    { length: mediaCount },
    (_, i) => `<Override PartName="/word/media/image${i + 1}.png" ContentType="image/png"/>`,
  ).join('')
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${CT}">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="png" ContentType="image/png"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `${pngOverrides}</Types>`
  )
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function paginate(ids: string[], grid: PageGrid, rotated: boolean): Cell[][] {
  const per = grid.cols * grid.rows
  const pages: Cell[][] = []
  for (let i = 0; i < ids.length; i += per) {
    pages.push(ids.slice(i, i + per).map((cardId) => ({ cardId, rotated })))
  }
  return pages
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
  return cleaned || 'mazo'
}

/** Builds the .docx bytes for a deck. Pure apart from the injected image IO. */
export async function buildDeckDocx(input: DeckDocxInput, deps: DeckDocxDeps): Promise<Uint8Array> {
  const arsenalPages = paginate(input.arsenal, ARSENAL_GRID, false)
  const prePages = paginate(input.backlashPre, BACKLASH_GRID, true)
  const midPages = paginate(input.backlashMid, BACKLASH_GRID, true)
  const backlashPages = [...prePages, ...midPages]

  const mediaByKey = new Map<string, MediaEntry>()
  const wanted: { key: string; cardId: string; rotated: boolean }[] = []
  const seen = new Set<string>()
  for (const page of [...arsenalPages, ...backlashPages]) {
    for (const cell of page) {
      const key = `${cell.rotated ? 'rot:' : ''}${cell.cardId}`
      if (seen.has(key)) continue
      seen.add(key)
      wanted.push({ key, cardId: cell.cardId, rotated: cell.rotated })
    }
  }

  const loaded = await Promise.all(
    wanted.map(async (w) => {
      const raw = await deps.fetchPng(w.cardId)
      if (!raw) return null
      return { key: w.key, bytes: w.rotated ? await deps.rotatePng(raw) : raw }
    }),
  )

  let mediaCount = 0
  for (const entry of loaded) {
    if (!entry) continue
    mediaCount++
    mediaByKey.set(entry.key, {
      relId: `rId${mediaCount + 1}`, // rId1 = styles.xml
      fileName: `image${mediaCount}.png`,
      bytes: entry.bytes,
    })
  }

  const mediaFor = (cell: Cell): MediaEntry | null =>
    mediaByKey.get(`${cell.rotated ? 'rot:' : ''}${cell.cardId}`) ?? null

  let docPrId = 1
  const nextDocPrId = (): number => docPrId++

  const hasArsenal = arsenalPages.length > 0
  const hasBacklash = backlashPages.length > 0
  const body: string[] = []

  if (hasArsenal) {
    arsenalPages.forEach((page, i) => {
      body.push(tableXml(page, ARSENAL_GRID, mediaFor, nextDocPrId))
      if (i < arsenalPages.length - 1) body.push(pageBreakXml())
      else if (hasBacklash) body.push(sectionBreakXml(ARSENAL_MARGINS))
    })
  }

  backlashPages.forEach((page, i) => {
    if (i > 0) body.push(pageBreakXml())
    body.push(tableXml(page, BACKLASH_GRID, mediaFor, nextDocPrId))
  })

  const finalMargins = hasBacklash ? BACKLASH_MARGINS : ARSENAL_MARGINS

  const imageRels = [...mediaByKey.values()].map((m) => ({
    id: m.relId,
    type: REL_IMAGE,
    target: `media/${m.fileName}`,
  }))

  const files: { name: string; data: Uint8Array }[] = [
    { name: '[Content_Types].xml', data: str(contentTypesXml(mediaByKey.size)) },
    { name: '_rels/.rels', data: str(relsXml([{ id: 'rId1', type: REL_DOC, target: 'word/document.xml' }])) },
    { name: 'word/document.xml', data: str(documentXml(body.join(''), finalMargins)) },
    {
      name: 'word/_rels/document.xml.rels',
      data: str(relsXml([{ id: 'rId1', type: REL_STYLES, target: 'styles.xml' }, ...imageRels])),
    },
    { name: 'word/styles.xml', data: str(stylesXml()) },
  ]
  for (const m of mediaByKey.values()) files.push({ name: `word/media/${m.fileName}`, data: m.bytes })

  return zipStore(files)
}

function str(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

// ---------------------------------------------------------------------------
// Browser side
// ---------------------------------------------------------------------------

async function defaultFetchPng(cardId: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`/cards/${encodeURIComponent(cardId)}.png`)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function defaultRotatePng(bytes: Uint8Array): Promise<Uint8Array> {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    throw new Error('No se pudo leer la imagen de la carta para rotarla.')
  }
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.height
    canvas.height = bitmap.width
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo procesar la imagen de la carta.')
    ctx.translate(bitmap.height, 0)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(bitmap, 0, 0)
    const out = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen rotada.'))), 'image/png')
    })
    return new Uint8Array(await out.arrayBuffer())
  } finally {
    bitmap.close()
  }
}

/** Generates the .docx for the given deck and triggers the browser download. */
export async function downloadDeckDocx(input: DeckDocxInput): Promise<void> {
  const bytes = await buildDeckDocx(input, { fetchPng: defaultFetchPng, rotatePng: defaultRotatePng })
  const blob = new Blob([new Uint8Array(bytes)], { type: DOCX_MIME })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${sanitizeFileName(input.name)}.docx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
