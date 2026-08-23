import { describe, it, expect, beforeEach } from 'vitest'
import type { GameState } from '../src/engine/types'
import { useAppStore, applyRemoteIntent, actorFor } from '../src/store/useAppStore'
import {
  newGame,
  startMatch,
  playCard,
  passReversal,
  applyDecision,
  endTurn,
  type NewGameConfig,
} from '../src/engine/game'

const KICK = 'gen-kick'
const CLOTHESLINE = 'punch'

function make2p(arsenalA: string[], arsenalB: string[]): NewGameConfig {
  return {
    players: [
      { name: 'A', superstarId: 'kurt-angle', arsenal: arsenalA, backlashPre: [], backlashMid: [] },
      { name: 'B', superstarId: 'mankind', arsenal: arsenalB, backlashPre: [], backlashMid: [] },
    ],
  }
}

function startGame2(arsenalA: string[], arsenalB: string[]): GameState {
  const g = newGame(make2p(arsenalA, arsenalB))
  startMatch(g)
  return g
}

function setStoreHost(game: GameState) {
  useAppStore.setState({
    online: { role: 'host', code: 'TEST', myIdx: 0, roster: [], sharedDecks: [], connected: true },
    game,
  })
}

// Build an overturn decision for `defenderIdx` on a fresh host game.
function hostOverturn(defenderIdx: number) {
  const g = startGame2(Array(10).fill(KICK), Array(10).fill(CLOTHESLINE))
  const attacker = defenderIdx === 0 ? 1 : 0
  g.players[attacker]!.hand = [KICK]
  g.players[defenderIdx]!.hand = []
  g.players[defenderIdx]!.arsenal = [CLOTHESLINE, CLOTHESLINE, CLOTHESLINE]
  g.activeIndex = attacker
  const err = playCard(g, attacker, KICK)
  if (err) throw new Error('playCard: ' + err)
  passReversal(g)
  expect(g.pendingDecision?.type).toBe('overturnCards')
  setStoreHost(g)
  return g
}

describe('online overturn intent handling', () => {
  beforeEach(() => {
    useAppStore.setState({
      online: { role: null, code: null, myIdx: null, roster: [], sharedDecks: [], connected: false },
      game: null,
      lastError: null,
    })
  })

  it('host accepts client flip then stop for defender seat 1', () => {
    hostOverturn(1)
    expect(actorFor(useAppStore.getState().game, 'flipOverturn')).toBe(1)

    applyRemoteIntent(useAppStore.getState, 1, 'flipOverturn', [])
    let g = useAppStore.getState().game!
    expect(g.pendingDecision?.type).toBe('overturnCards')
    if (g.pendingDecision?.type === 'overturnCards') expect(g.pendingDecision.overturned).toBe(1)

    applyRemoteIntent(useAppStore.getState, 1, 'flipOverturn', [])
    g = useAppStore.getState().game!
    if (g.pendingDecision?.type === 'overturnCards') expect(g.pendingDecision.overturned).toBe(2)

    applyRemoteIntent(useAppStore.getState, 1, 'stopOverturn', [])
    g = useAppStore.getState().game!
    expect(g.pendingDecision?.type).not.toBe('overturnCards')
  })

  it('host accepts host flip then stop for defender seat 0 (local)', () => {
    hostOverturn(0)
    expect(actorFor(useAppStore.getState().game, 'flipOverturn')).toBe(0)

    applyRemoteIntent(useAppStore.getState, 0, 'flipOverturn', [])
    let g = useAppStore.getState().game!
    if (g.pendingDecision?.type === 'overturnCards') expect(g.pendingDecision.overturned).toBe(1)

    applyRemoteIntent(useAppStore.getState, 0, 'stopOverturn', [])
    g = useAppStore.getState().game!
    expect(g.pendingDecision?.type).not.toBe('overturnCards')
  })

  it('late-game: overturn works after several turns with reduced arsenals', () => {
    const g = startGame2(Array(10).fill(KICK), Array(10).fill(CLOTHESLINE))
    // Advance a few turns so activeIndex/log/state differ from a fresh game.
    for (let t = 0; t < 3; t++) {
      const attacker = g.activeIndex
      g.activeIndex = attacker
      const defender = attacker === 0 ? 1 : 0
      g.players[attacker]!.hand = [KICK]
      g.players[defender]!.hand = []
      const e = playCard(g, attacker, KICK)
      if (e) throw new Error('playCard: ' + e)
      // resolve via reversal pass -> overturn -> stop
      passReversal(g)
      if (g.pendingDecision?.type === 'overturnCards') {
        applyDecision(g, g.pendingDecision, 'flip')
        applyDecision(g, g.pendingDecision!, 'stop')
      }
      endTurn(g)
    }
    // Now trigger a fresh overturn for seat 1 and run it through the host intent path.
    g.activeIndex = 0
    g.players[0]!.hand = [KICK]
    g.players[1]!.hand = []
    g.players[1]!.arsenal = [CLOTHESLINE, CLOTHESLINE]
    const e = playCard(g, 0, KICK)
    expect(e).toBeNull()
    passReversal(g)
    expect(g.pendingDecision?.type).toBe('overturnCards')
    setStoreHost(g)

    applyRemoteIntent(useAppStore.getState, 1, 'flipOverturn', [])
    let s = useAppStore.getState().game!
    expect(s.pendingDecision?.type).toBe('overturnCards')
    if (s.pendingDecision?.type === 'overturnCards') expect(s.pendingDecision.overturned).toBe(1)

    applyRemoteIntent(useAppStore.getState, 1, 'stopOverturn', [])
    s = useAppStore.getState().game!
    expect(s.pendingDecision?.type).not.toBe('overturnCards')
  })
})
