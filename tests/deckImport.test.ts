import { describe, it, expect } from 'vitest'
import {
  buildDeckDocx,
  zipStore,
  readDeckFile,
  readZipEntry,
  DECK_PART,
  type DeckDocxDeps,
} from '../src/export/deckDocx'
import { importDeckBytes, uniqueDeckName } from '../src/export/deckImport'

/** 1x1 red PNG. */
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
)

const deps: DeckDocxDeps = {
  fetchPng: async () => PNG,
  rotatePng: async (b) => b,
}

const str = (s: string): Uint8Array => new TextEncoder().encode(s)

/** Real ids so the import can resolve them against the catalog. */
const DECK = {
  name: 'Mazo viajero',
  superstarId: 'kurt-angle',
  arsenal: ['gen-kick', 'gen-elbow-to-the-face', 'kurt-olympic-slam'],
  backlashPre: ['kurt-hold-on'],
  backlashMid: ['kurt-do-you-live-by-the-three-is'],
}

const build = (): Promise<Uint8Array> => buildDeckDocx(DECK, deps)

describe('deck payload round-trip', () => {
  it('embeds the deck data in the .docx and reads it back unchanged', async () => {
    const bytes = await build()

    // The part is really there and declared for the package.
    expect(readZipEntry(bytes, DECK_PART)).not.toBeNull()
    const ct = new TextDecoder().decode(readZipEntry(bytes, '[Content_Types].xml')!)
    expect(ct).toContain('<Default Extension="json" ContentType="application/json"/>')

    const payload = readDeckFile(bytes)
    expect(payload).toEqual({ format: 'raw-deal-deck', version: 1, ...DECK })
  })

  it('imports the .docx bytes into a deck for the editor', async () => {
    const { deck, error, dropped } = importDeckBytes(await build())
    expect(error).toBeNull()
    expect(dropped).toEqual([])
    expect(deck).toEqual(DECK)
  })

  it('accepts the bare JSON payload too', () => {
    const json = str(JSON.stringify({ format: 'raw-deal-deck', version: 1, ...DECK }))
    expect(importDeckBytes(json).deck).toEqual(DECK)
  })

  it('reads entries via the central directory regardless of entry order', async () => {
    const zip = zipStore([
      { name: 'zzz.txt', data: str('after') },
      { name: DECK_PART, data: str(JSON.stringify({ format: 'raw-deal-deck', version: 1, ...DECK })) },
      { name: 'aaa.txt', data: str('before') },
    ])
    expect(new TextDecoder().decode(readZipEntry(zip, 'aaa.txt')!)).toBe('before')
    expect(readDeckFile(zip).name).toBe(DECK.name)
  })
})

describe('import errors', () => {
  it('rejects a .docx exported before deck data existed', async () => {
    const docx = await buildDeckDocx(DECK, deps)
    // Rebuild the archive without the deck part.
    const entries: { name: string; data: Uint8Array }[] = []
    const dv = new DataView(docx.buffer, docx.byteOffset, docx.byteLength)
    let off = 0
    while (off + 4 <= docx.length && dv.getUint32(off, true) === 0x04034b50) {
      const size = dv.getUint32(off + 18, true)
      const nameLen = dv.getUint16(off + 26, true)
      const extraLen = dv.getUint16(off + 28, true)
      const name = new TextDecoder().decode(docx.subarray(off + 30, off + 30 + nameLen))
      const start = off + 30 + nameLen + extraLen
      if (name !== DECK_PART) entries.push({ name, data: docx.subarray(start, start + size) })
      off = start + size
    }
    const err = importDeckBytes(zipStore(entries)).error
    expect(err).toContain('no trae los datos del mazo')
  })

  it('explains that a PDF cannot carry the deck', () => {
    const pdf = str('%PDF-1.7\n%âãÏÓ\n1 0 obj')
    expect(importDeckBytes(pdf).error).toContain('PDF')
  })

  it('rejects bytes that are not a document at all', () => {
    expect(importDeckBytes(new Uint8Array([0xde, 0xad, 0xbe, 0xef])).error).toContain('.docx')
  })

  it('reports corrupt JSON inside the archive', () => {
    const zip = zipStore([
      { name: '[Content_Types].xml', data: str('<Types/>') },
      { name: DECK_PART, data: str('{ not json !!') },
    ])
    expect(importDeckBytes(zip).error).toContain('corruptos')
  })

  it('reports an unrecognised payload shape', () => {
    const zip = zipStore([{ name: DECK_PART, data: str(JSON.stringify({ hello: 'world' })) }])
    expect(importDeckBytes(zip).error).toContain('reconocido')
  })

  it('rejects a superstar that does not exist', () => {
    const json = str(JSON.stringify({ format: 'raw-deal-deck', version: 1, ...DECK, superstarId: 'nadie-existe' }))
    const { deck, error } = importDeckBytes(json)
    expect(deck).toBeNull()
    expect(error).toContain('Superstar')
  })

  it('rejects a deck with no superstar at all', () => {
    const json = str(JSON.stringify({ format: 'raw-deal-deck', version: 1, ...DECK, superstarId: '' }))
    expect(importDeckBytes(json).error).toContain('Superstar')
  })
})

describe('unknown cards', () => {
  it('drops ids this build does not know and lists them', () => {
    const json = str(
      JSON.stringify({
        format: 'raw-deal-deck',
        version: 1,
        ...DECK,
        arsenal: [...DECK.arsenal, 'carta-del-futuro'],
        backlashPre: [...DECK.backlashPre, 'otra-desconocida'],
      }),
    )
    const { deck, error, dropped } = importDeckBytes(json)
    expect(error).toBeNull()
    expect(deck!.arsenal).toEqual(DECK.arsenal)
    expect(deck!.backlashPre).toEqual(DECK.backlashPre)
    expect(dropped.sort()).toEqual(['carta-del-futuro', 'otra-desconocida'])
  })
})

describe('uniqueDeckName', () => {
  it('keeps the base name when it is free', () => {
    expect(uniqueDeckName(['Otro'], 'Mazo')).toBe('Mazo')
  })

  it('numbers a collision', () => {
    expect(uniqueDeckName(['Mazo'], 'Mazo')).toBe('Mazo (2)')
  })

  it('skips names already taken', () => {
    expect(uniqueDeckName(['Mazo', 'Mazo (2)', 'Mazo (3)'], 'Mazo')).toBe('Mazo (4)')
  })
})
