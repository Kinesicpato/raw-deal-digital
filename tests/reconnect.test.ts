import { describe, it, expect } from 'vitest'
import { decideHello, type HelloInput } from '../src/online/protocol'

/**
 * Regression suite for the "bogus join request mid-game" bug: a player whose
 * channel reconnects re-sends `hello` with the same client id. That must
 * resume their seat — never queue a join request (whose approval used to
 * turn the seated player into a spectator and freeze the match).
 */
const base: HelloInput = {
  seatedIdx: null,
  reservedIdx: null,
  reservedFree: false,
  freeSeat: 1,
  canGrow: true,
  gameStarted: true,
}

describe('decideHello (reconnect vs. new guest)', () => {
  it('restores the seat of a client that is still listed as connected (channel rejoined)', () => {
    const action = decideHello({ ...base, seatedIdx: 1 })
    expect(action).toEqual({ kind: 'restore', idx: 1 })
  })

  it('restores a reserved seat after the client dropped out of presence', () => {
    const action = decideHello({ ...base, seatedIdx: null, reservedIdx: 1, reservedFree: true, freeSeat: null })
    expect(action).toEqual({ kind: 'restore', idx: 1 })
  })

  it('never routes a known sender into the join-request flow while the game runs', () => {
    for (const seatedIdx of [0, 1]) {
      for (const gameStarted of [true, false]) {
        const action = decideHello({ ...base, seatedIdx, gameStarted, freeSeat: null, canGrow: false })
        expect(action.kind).toBe('restore')
      }
    }
  })

  it('queues a join request for an unknown sender mid-game (even with a free seat)', () => {
    // This is the scenario the bug produced BY MISTAKE; it stays correct for
    // genuinely new guests: they can only enter through host approval.
    expect(decideHello({ ...base, freeSeat: 1 })).toEqual({ kind: 'pending' })
  })

  it('queues a join request when the reserved seat was taken by somebody else', () => {
    const action = decideHello({ ...base, reservedIdx: 1, reservedFree: false, freeSeat: null })
    expect(action).toEqual({ kind: 'pending' })
  })

  it('admits a newcomer straight into a free seat in the lobby', () => {
    const action = decideHello({ ...base, gameStarted: false, freeSeat: 1 })
    expect(action).toEqual({ kind: 'admit', idx: 1 })
  })

  it('queues a join request in the lobby when every seat is taken but the roster can grow', () => {
    const action = decideHello({ ...base, gameStarted: false, freeSeat: null, canGrow: true })
    expect(action).toEqual({ kind: 'pending' })
  })

  it('denies when the room is at MAX_SEATS and no seat is free', () => {
    const action = decideHello({ ...base, gameStarted: false, freeSeat: null, canGrow: false })
    expect(action.kind).toBe('deny')
  })
})
