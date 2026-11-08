import { describe, it, expect } from 'vitest'
import { newGame, startMatch, type NewGameConfig } from '../src/engine/game'
import type { GameState } from '../src/engine/types'

/**
 * Who takes the first turn:
 *   1. the superstar `edge`, always (whatever its Value or entry order);
 *   2. the highest Superstar Value;
 *   3. equal Values → the lowest seat (entry order), so the room creator
 *      (seat 0) starts among tied players.
 *
 * Catalog values used here: your-freaking-hero=5, mankind/cactus-jack/
 * booker-t=4, kurt-angle=3, chyna=3, edge=3, kane=2.
 */

function makeGame(players: Array<{ superstarId: string; seat?: number }>): GameState {
  const cfg = {
    players: players.map((p, i) => ({
      name: `P${i}`,
      superstarId: p.superstarId,
      seat: p.seat,
      arsenal: Array(12).fill('gen-kick'),
      backlashPre: [],
      backlashMid: [],
    })),
  } as NewGameConfig
  return newGame(cfg)
}

describe('who starts the match', () => {
  it('the highest Superstar Value starts, even with the later seat', () => {
    // booker-t (8) joined second; kurt-angle (3) created the room.
    const state = makeGame([
      { superstarId: 'kurt-angle', seat: 0 },
      { superstarId: 'booker-t', seat: 1 },
    ])
    expect(state.activeIndex).toBe(1)
  })

  it('equal Value: the room creator (seat 0) starts, even listed second', () => {
    const state = makeGame([
      { superstarId: 'kurt-angle', seat: 1 }, // joiner, listed first
      { superstarId: 'chyna', seat: 0 }, // creator, listed second
    ])
    expect(state.activeIndex).toBe(1)
  })

  it('equal Value without the creator: consecutive entry order decides', () => {
    const state = makeGame([
      { superstarId: 'chyna', seat: 2 }, // joined third
      { superstarId: 'kurt-angle', seat: 1 }, // joined second
    ])
    expect(state.activeIndex).toBe(1)
  })

  it('edge always starts first, no matter its Value or entry order', () => {
    // edge (3) joined LAST; booker-t (8) created the room.
    const state = makeGame([
      { superstarId: 'booker-t', seat: 0 },
      { superstarId: 'kane', seat: 1 },
      { superstarId: 'edge', seat: 2 },
    ])
    expect(state.activeIndex).toBe(2)
  })

  it('edge also beats an equal-Value creator', () => {
    const state = makeGame([
      { superstarId: 'chyna', seat: 0 }, // creator, Value 3
      { superstarId: 'edge', seat: 1 }, // joiner, Value 3
    ])
    expect(state.activeIndex).toBe(1)
  })

  it('offline games (no seat) keep the slot order on Value ties', () => {
    const state = makeGame([{ superstarId: 'kurt-angle' }, { superstarId: 'chyna' }])
    expect(state.activeIndex).toBe(0)
  })

  it('startMatch re-applies the full rule when it recalculates', () => {
    const state = makeGame([
      { superstarId: 'kurt-angle', seat: 0 },
      { superstarId: 'chyna', seat: 1 },
    ])
    expect(state.activeIndex).toBe(0) // tie → creator

    state.players[1]!.superstarId = 'booker-t' // now the higher Value
    startMatch(state)
    expect(state.activeIndex).toBe(1)
  })
})
