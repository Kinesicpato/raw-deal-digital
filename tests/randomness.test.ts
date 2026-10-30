import { describe, it, expect } from 'vitest'
import { newGame, type NewGameConfig } from '../src/engine/game'
import { buildDefaultDeck } from '../src/data/defaultDeck'
import { ALL_CARDS, SUPERSTARS, getCard } from '../src/data/cards'
import { getCopiesLimit, shuffled } from '../src/engine/rules'

const ss = SUPERSTARS[0]!

function dealGames(arsenal: string[], handSize: number, games: number, pre: string[] = [], mid: string[] = []): string[][] {
  const hands: string[][] = []
  for (let i = 0; i < games; i++) {
    const cfg = {
      players: [
        { name: 'A', superstarId: ss.id, handSize, arsenal, backlashPre: pre, backlashMid: mid },
      ],
    } as NewGameConfig
    const g = newGame(cfg)
    hands.push([...g.players[0]!.hand])
  }
  return hands
}

describe('deal randomness', () => {
  it('never rigs the opening hand toward "playable" cards', () => {
    // 3 copies of an F:0 non-Reversal card + 57 Reversals. A fair 9-card hand
    // from a 60-card deck holds all three of them in ~0.3% of games.
    const kick = getCard('gen-kick')
    const rev = getCard('gen-step-aside')
    expect(kick.type).not.toBe('Reversal')
    expect(kick.fortitude).toBe(0)
    expect(rev.type).toBe('Reversal')

    const arsenal = ['gen-kick', 'gen-kick', 'gen-kick', ...Array(57).fill('gen-step-aside')]
    const hands = dealGames(arsenal, 8, 300)

    const allThree = hands.filter((h) => h.filter((id) => id === 'gen-kick').length === 3).length
    expect(allThree / hands.length).toBeLessThan(0.1) // fair deal: ~0.003

    const avgKicks = hands.reduce((acc, h) => acc + h.filter((id) => id === 'gen-kick').length, 0) / hands.length
    expect(avgKicks).toBeGreaterThan(0.25) // fair: 9 × 3 / 60 = 0.45
    expect(avgKicks).toBeLessThan(0.65)
  })

  it('gives every card of the default deck the same odds (3 copies ≈ 45% of hands)', () => {
    const deck = buildDefaultDeck(ss.id)
    const hands = dealGames(deck.arsenal, 8, 600, deck.pre, deck.mid)
    const hits = new Map<string, number>()
    for (const hand of hands) for (const id of new Set(hand)) hits.set(id, (hits.get(id) ?? 0) + 1)

    for (const id of new Set(deck.arsenal)) {
      const pct = (hits.get(id) ?? 0) / hands.length
      expect(pct, `${id} appeared in ${(pct * 100).toFixed(1)}% of opening hands`).toBeGreaterThan(0.3)
      expect(pct, `${id} appeared in ${(pct * 100).toFixed(1)}% of opening hands`).toBeLessThan(0.6)
    }
  })

  it('keeps the opening hand inside the deck (no card duplicated by the deal)', () => {
    const deck = buildDefaultDeck(ss.id)
    const hands = dealGames(deck.arsenal, 8, 100, deck.pre, deck.mid)
    const deckCounts = new Map<string, number>()
    for (const id of deck.arsenal) deckCounts.set(id, (deckCounts.get(id) ?? 0) + 1)
    for (const hand of hands) {
      const inHand = new Map<string, number>()
      for (const id of hand) inHand.set(id, (inHand.get(id) ?? 0) + 1)
      for (const [id, n] of inHand) expect(n).toBeLessThanOrEqual(deckCounts.get(id) ?? 0)
    }
  })

  it('never exceeds the copy limit, even for cards defined twice in the catalog', () => {
    const duplicated = ALL_CARDS.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) !== i)
    expect(duplicated.length).toBeGreaterThan(0) // guard: catalog currently has duplicate ids

    const deck = buildDefaultDeck(ss.id)
    const counts = new Map<string, number>()
    for (const id of deck.arsenal) counts.set(id, (counts.get(id) ?? 0) + 1)
    for (const [id, n] of counts) {
      expect(n).toBeLessThanOrEqual(getCopiesLimit(getCard(id)))
    }
    for (const c of duplicated) {
      expect(counts.get(c.id) ?? 0).toBeLessThanOrEqual(getCopiesLimit(c))
    }
  })

  it('shuffled() is a uniform Fisher–Yates permutation that leaves the input untouched', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const first = shuffled(input)
    expect(first).not.toBe(input)
    expect([...first].sort((a, b) => a - b)).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    const runs = 2000
    const atFirst = new Map<number, number>()
    for (let i = 0; i < runs; i++) {
      const v = shuffled(input)[0]!
      atFirst.set(v, (atFirst.get(v) ?? 0) + 1)
    }
    for (const v of input) {
      const pct = (atFirst.get(v) ?? 0) / runs
      expect(pct, `card ${v} started on top in ${(pct * 100).toFixed(1)}% of shuffles`).toBeGreaterThan(0.05)
      expect(pct, `card ${v} started on top in ${(pct * 100).toFixed(1)}% of shuffles`).toBeLessThan(0.15)
    }
  })
})
