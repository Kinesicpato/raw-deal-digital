import { ALL_CARDS } from './cards'
import { getCopiesLimit } from '../engine/rules'

/**
 * Builds a legal default 60-card Arsenal + Backlash deck for a Superstar.
 * Used when a player hasn't prepared a custom deck. Built programmatically
 * from the available card pool so it stays legal as cards are added/removed.
 */
export function buildDefaultDeck(superstarId: string): { arsenal: string[]; pre: string[]; mid: string[] } {
  const pool = ALL_CARDS.filter((c) => {
    if (c.type === 'Superstar') return false
    if (c.backlash) return false
    if (c.superstar && c.superstar.length > 0 && !c.superstar.includes(superstarId)) return false
    return true
  })

  const arsenal: string[] = []
  for (const c of pool) {
    if (arsenal.length >= 60) break
    const limit = getCopiesLimit(c)
    const copies = limit === Infinity ? 3 : Math.min(limit, 3)
    for (let i = 0; i < copies && arsenal.length < 60; i++) arsenal.push(c.id)
  }

  const pre = ALL_CARDS.filter((c) => c.backlash === 'Pre-match').map((c) => c.id)
  const mid = ALL_CARDS.filter((c) => c.backlash === 'Mid-match').map((c) => c.id)

  return { arsenal, pre, mid }
}
