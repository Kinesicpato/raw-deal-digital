import type { CardDef, CardTrait, ManeuverSubtype } from '../data/types'
import type { PlayerState } from './types'

/**
 * Fortitude Rating = sum of the printed Fortitude (F) of the cards in a
 * player's Ring area plus their Mid-match/Pre-match cards played during the
 * match (values verified against readytofight.cl when the card name matches).
 */
export function computeFortitude(ids: string[], getCard: (id: string) => CardDef): number {
  let total = 0
  for (const id of ids) {
    total += getCard(id).fortitude
  }
  return total
}

export function countTrait(ids: string[], trait: CardTrait, getCard: (id: string) => CardDef): number {
  return ids.filter((id) => getCard(id).traits?.includes(trait)).length
}

export function countSubtype(ids: string[], subtype: ManeuverSubtype, getCard: (id: string) => CardDef): number {
  return ids.filter((id) => getCard(id).subtypes?.includes(subtype) === true).length
}

export function isChainCard(c: CardDef): boolean {
  return c.traits?.includes('Chain') === true
}

/**
 * Deck construction rules (Etapa 1.3 / 3.1):
 *   - 60 cards + 1 Superstar (configurable; Kurt has standard 60)
 *   - max 3 copies of a given card
 *   - Set-up cards: unlimited copies
 *   - Face and Heel cannot be mixed unless the Superstar says otherwise
 *   - Raw and SmackDown! logos cannot be mixed
 *   - Female Superstars cannot pack cards that forbid Female
 */
export interface ValidationIssue {
  code: string
  message: string
}

export function getCopiesLimit(card: CardDef): number {
  if (card.traits?.includes('Set-up')) return Infinity
  return card.copiesLimit ?? 3
}

export function validateDeck(
  ids: string[],
  superstarId: string,
  getCard: (id: string) => CardDef,
  getSuperstar: (id: string) => { name: string; alignment: 'Face' | 'Heel' | 'Both'; gender: string; brand: string | null },
): { valid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = []
  const superstar = getSuperstar(superstarId)

  if (ids.length !== 60) {
    issues.push({
      code: 'deck-size',
      message: `Your Arsenal must have exactly 60 cards (currently ${ids.length}).`,
    })
  }

  const counts = new Map<string, number>()
  const faces = new Set<string>()
  const heels = new Set<string>()
  const brands = new Set<string>()

  for (const id of ids) {
    const c = getCard(id)
    counts.set(id, (counts.get(id) ?? 0) + 1)
    if (c.traits?.includes('Face')) faces.add(id)
    if (c.traits?.includes('Heel')) heels.add(id)
    if (c.brand) brands.add(c.brand)
  }

  for (const [id, n] of counts) {
    const c = getCard(id)
    const limit = getCopiesLimit(c)
    if (n > limit) {
      issues.push({
        code: 'max-copies',
        message: `You have ${n} copies of "${c.name}" but the limit is ${limit === Infinity ? 'unlimited' : limit}.`,
      })
    }
    if (c.packRestrictions?.female === 'forbidden' && superstar.gender === 'female') {
      issues.push({ code: 'female-forbidden', message: `"${c.name}" cannot be packed by Female Superstars.` })
    }
    if (c.superstar && c.superstar.length > 0 && !c.superstar.includes(superstarId)) {
      issues.push({ code: 'logo', message: `"${c.name}" has the logo of a Superstar you are not playing.` })
    }
  }

  if (superstar.alignment !== 'Both' && faces.size > 0 && heels.size > 0) {
    // Only merge Face+Heel when the Superstar explicitly allows it.
    issues.push({
      code: 'face-heel',
      message: `${superstar.name} cannot pack both Face and Heel cards.`,
    })
  }

  if (brands.size > 1) {
    issues.push({ code: 'brand', message: 'You cannot pack both Raw and SmackDown! cards.' })
  }

  return { valid: issues.length === 0 && ids.length === 60, issues }
}

/**
 * Backlash deck rules: max 20 cards, max 10 Pre-match, max 10 Mid-match,
 * only Pre-match/Mid-match card types, plus the same construction rules.
 */
export function validateBacklashDeck(
  pre: string[],
  mid: string[],
  getCard: (id: string) => CardDef,
): { valid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = []

  if (pre.length + mid.length > 20) {
    issues.push({ code: 'backlash-size', message: 'Your Backlash deck may have a maximum of 20 cards.' })
  }
  if (pre.length > 10) {
    issues.push({ code: 'backlash-pre', message: 'You may have up to 10 Pre-match cards.' })
  }
  if (mid.length > 10) {
    issues.push({ code: 'backlash-mid', message: 'You may have up to 10 Mid-match cards.' })
  }

  for (const id of [...pre, ...mid]) {
    const c = getCard(id)
    if (c.backlash !== 'Pre-match' && c.backlash !== 'Mid-match') {
      issues.push({ code: 'backlash-type', message: `"${c.name}" is not a Pre-match or Mid-match card.` })
    }
  }

  return { valid: issues.length === 0, issues }
}

export function removeCard(list: string[], idx: number): string[] {
  const next = [...list]
  next.splice(idx, 1)
  return next
}

export function shuffled<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = a[i] as T
    a[i] = a[j] as T
    a[j] = t
  }
  return a
}

export function drawCards(p: PlayerState, count: number, getCard: (id: string) => CardDef): number {
  let drawn = 0
  while (count > 0 && p.arsenal.length > 0) {
    const c = p.arsenal.shift()
    if (c) {
      p.hand.push(c)
      drawn++
    }
    count--
  }
  void getCard
  return drawn
}

export function dealDamage(p: PlayerState, amount: number): string[] {
  const overturned: string[] = []
  let remaining = amount
  while (remaining > 0 && p.arsenal.length > 0) {
    const c = p.arsenal.shift()
    if (c) {
      p.ringside.push(c)
      overturned.push(c)
    }
    remaining--
  }
  return overturned
}