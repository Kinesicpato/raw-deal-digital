import { describe, it, expect } from 'vitest'
import { newGame, manualOverturn, type NewGameConfig } from '../src/engine/game'
import { SUPERSTARS } from '../src/data/cards'

const ss = SUPERSTARS[0]!

function freshGame(): ReturnType<typeof newGame> {
  const cfg = {
    players: [
      {
        name: 'A',
        superstarId: ss.id,
        handSize: 7,
        arsenal: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
        backlashPre: [],
        backlashMid: [],
      },
      { name: 'B', superstarId: ss.id, handSize: 7, arsenal: ['b1'], backlashPre: [], backlashMid: [] },
    ],
  } as NewGameConfig
  const g = newGame(cfg)
  // Pin exact, known zones so the assertions are deterministic.
  g.players[0]!.arsenal = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']
  g.players[0]!.hand = ['h1']
  g.players[0]!.ringside = ['r0']
  g.players[1]!.arsenal = ['b1']
  g.players[1]!.hand = []
  g.players[1]!.ringside = []
  return g
}

describe('manualOverturn (Arsenal → Ringside, face up)', () => {
  it('flips the top N cards into the Ringside, leaving hand and order untouched', () => {
    const g = freshGame()
    const p = g.players[0]!

    expect(manualOverturn(g, 0, 2)).toBeNull()
    expect(p.ringside).toEqual(['r0', 'a1', 'a2']) // top of the Arsenal goes first
    expect(p.arsenal).toEqual(['a3', 'a4', 'a5', 'a6'])
    expect(p.hand).toEqual(['h1'])
    expect(p.midmatchPlayed).toEqual([])
    expect(p.ring).toEqual([])
  })

  it('only affects the chosen player', () => {
    const g = freshGame()
    manualOverturn(g, 0, 3)
    expect(g.players[1]!.arsenal).toEqual(['b1'])
    expect(g.players[1]!.ringside).toEqual([])
  })

  it('flips at most the whole Arsenal when asked for more', () => {
    const g = freshGame()
    expect(manualOverturn(g, 0, 99)).toBeNull()
    expect(g.players[0]!.arsenal).toEqual([])
    expect(g.players[0]!.ringside.slice(1)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'])
  })

  it('rejects invalid counts and an empty Arsenal', () => {
    const g = freshGame()
    expect(manualOverturn(g, 0, 0)).toBeTruthy()
    expect(manualOverturn(g, 0, -3)).toBeTruthy()
    expect(manualOverturn(g, 0, 1.5)).toBeTruthy()
    expect(manualOverturn(g, 99, 1)).toBeTruthy()

    g.players[0]!.arsenal = []
    expect(manualOverturn(g, 0, 1)).toBe('Arsenal is empty.')
  })
})
