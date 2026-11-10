/**
 * Deck import: turns the bytes of an exported .docx (or the bare JSON payload)
 * back into a deck the deckbuilder can load.
 *
 * Deliberately mirrors `saveDeck`: no rule validation here. Unknown card ids
 * are dropped with a warning so a deck exported on a newer build still loads;
 * an unknown superstar is fatal because without it the deck has no identity.
 */

import { readDeckFile, type DeckFilePayload } from './deckDocx'
import { ALL_CARDS, getSuperstar } from '../data/cards'
import type { DeckDraft } from '../store/useAppStore'

export interface DeckImportResult {
  deck: DeckDraft | null
  /** User-facing Spanish message; deck is null when this is set. */
  error: string | null
  /** Card ids present in the file but unknown to this build (dropped). */
  dropped: string[]
}

const KNOWN_IDS = new Set(ALL_CARDS.map((c) => c.id))

function isSuperstarId(id: string): boolean {
  if (!id) return false
  try {
    getSuperstar(id)
    return true
  } catch {
    return false
  }
}

function filterIds(ids: string[], dropped: Set<string>): string[] {
  const out: string[] = []
  for (const id of ids) {
    if (KNOWN_IDS.has(id)) out.push(id)
    else dropped.add(id)
  }
  return out
}

/** Parses deck bytes (exported .docx or bare JSON) into a deck for the editor. */
export function importDeckBytes(bytes: Uint8Array): DeckImportResult {
  let payload: DeckFilePayload
  try {
    payload = readDeckFile(bytes)
  } catch (err) {
    return { deck: null, error: err instanceof Error ? err.message : 'No se pudo leer el archivo.', dropped: [] }
  }

  if (!payload.superstarId) {
    return { deck: null, error: 'El mazo no indica qué Superstar usa.', dropped: [] }
  }
  if (!isSuperstarId(payload.superstarId)) {
    return {
      deck: null,
      error: `El Superstar del mazo ("${payload.superstarId}") no existe en esta versión del juego.`,
      dropped: [],
    }
  }

  const dropped = new Set<string>()
  const deck: DeckDraft = {
    name: payload.name,
    superstarId: payload.superstarId,
    arsenal: filterIds(payload.arsenal, dropped),
    backlashPre: filterIds(payload.backlashPre, dropped),
    backlashMid: filterIds(payload.backlashMid, dropped),
  }
  return { deck, error: null, dropped: [...dropped] }
}

/** "Mazo" -> "Mazo (2)", skipping names already in use. */
export function uniqueDeckName(existing: string[], base: string): string {
  if (!existing.includes(base)) return base
  let n = 2
  while (existing.includes(`${base} (${n})`)) n++
  return `${base} (${n})`
}
