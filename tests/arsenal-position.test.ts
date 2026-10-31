import { describe, it, expect } from 'vitest'
import { newGame, manualMoveCards, type NewGameConfig } from '../src/engine/game'
import { SUPERSTARS } from '../src/data/cards'

const ss = SUPERSTARS[0]!

function freshGame(): ReturnType<typeof newGame> {
  const cfg = {
    players: [
      {
        name: 'A',
        superstarId: ss.id,
        handSize: 7,
        arsenal: ['a1', 'a2', 'a3', 'a4', 'a5'],
        backlashPre: [],
        backlashMid: [],
      },
      { name: 'B', superstarId: ss.id, handSize: 7, arsenal: ['b1'], backlashPre: [], backlashMid: [] },
    ],
  } as NewGameConfig
  const g = newGame(cfg)
  // Pin exact, known zones so the assertions are deterministic.
  g.players[0]!.arsenal = ['a1', 'a2', 'a3', 'a4', 'a5']
  g.players[0]!.hand = ['h1', 'h2', 'h3']
  g.players[0]!.ringside = []
  g.players[1]!.arsenal = ['b1']
  return g
}

/** The moved cards removed, in order: what's left of the original Arsenal. */
function withoutMoved(arsenal: string[], moved: string[]): string[] {
  const rest = [...arsenal]
  for (const id of moved) {
    const i = rest.indexOf(id)
    if (i >= 0) rest.splice(i, 1)
  }
  return rest
}

describe('manualMoveCards → Arsenal: "Posición aleatoria" (former "Revolver")', () => {
  it('drops the card at ONE random spot and never reshuffles the Arsenal', () => {
    for (let run = 0; run < 200; run++) {
      const g = freshGame()
      expect(manualMoveCards(g, 0, 'hand', 'arsenal', ['h1'], 'shuffle')).toBeNull()
      const p = g.players[0]!
      expect(p.arsenal).toHaveLength(6)
      expect(p.arsenal).toContain('h1')
      expect(p.hand).toEqual(['h2', 'h3'])
      // Core invariant: the pre-existing Arsenal keeps its exact order.
      expect(withoutMoved(p.arsenal, ['h1'])).toEqual(['a1', 'a2', 'a3', 'a4', 'a5'])
    }
  })

  it('keeps multiple moved cards together, in order, at one random gap', () => {
    for (let run = 0; run < 200; run++) {
      const g = freshGame()
      expect(manualMoveCards(g, 0, 'hand', 'arsenal', ['h1', 'h2'], 'shuffle')).toBeNull()
      const p = g.players[0]!
      // The two moved cards stay consecutive and in the given order.
      expect(p.arsenal.indexOf('h2')).toBe(p.arsenal.indexOf('h1') + 1)
      expect(withoutMoved(p.arsenal, ['h1', 'h2'])).toEqual(['a1', 'a2', 'a3', 'a4', 'a5'])
    }
  })

  it('really is random: every gap of the Arsenal can receive the card', () => {
    const gaps = new Map<number, number>()
    const runs = 1200
    for (let i = 0; i < runs; i++) {
      const g = freshGame()
      manualMoveCards(g, 0, 'hand', 'arsenal', ['h1'], 'shuffle')
      const pos = g.players[0]!.arsenal.indexOf('h1')
      gaps.set(pos, (gaps.get(pos) ?? 0) + 1)
    }
    // A 5-card Arsenal has 6 gaps (0..5); each should get roughly 1/6 of runs.
    expect(gaps.size).toBe(6)
    for (const [pos, n] of gaps) {
      const pct = n / runs
      expect(pct, `gap ${pos} received the card in ${(pct * 100).toFixed(1)}% of runs`).toBeGreaterThan(0.08)
      expect(pct, `gap ${pos} received the card in ${(pct * 100).toFixed(1)}% of runs`).toBeLessThan(0.30)
    }
  })

  it('keeps "Inicio" and "Final" behaving as before', () => {
    const g1 = freshGame()
    manualMoveCards(g1, 0, 'hand', 'arsenal', ['h1'], 'start')
    expect(g1.players[0]!.arsenal).toEqual(['h1', 'a1', 'a2', 'a3', 'a4', 'a5'])

    const g2 = freshGame()
    manualMoveCards(g2, 0, 'hand', 'arsenal', ['h1'], 'end')
    expect(g2.players[0]!.arsenal).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'h1'])

    // Default position (no argument) is still 'end'.
    const g3 = freshGame()
    manualMoveCards(g3, 0, 'hand', 'arsenal', ['h1'])
    expect(g3.players[0]!.arsenal).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'h1'])
  })

  it('only touches the chosen player', () => {
    const g = freshGame()
    manualMoveCards(g, 0, 'hand', 'arsenal', ['h1'], 'shuffle')
    expect(g.players[1]!.arsenal).toEqual(['b1'])
  })
})
