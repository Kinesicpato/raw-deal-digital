import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore, applyRemoteIntent } from '../src/store/useAppStore'
import { hostSetGameStarted, isMatchLive, stopOnline } from '../src/online/network'
import { newGame, type NewGameConfig } from '../src/engine/game'

/**
 * A fresh online room must never see a game from a previous session, and the
 * host's local (offline) games must never replace or leak into an open room:
 * the room's match lives in the same `game` slot and is broadcast from it.
 */

function localCfg(): NewGameConfig {
  return {
    players: [
      {
        name: 'A',
        superstarId: 'kurt-angle',
        handSize: 7,
        arsenal: Array(12).fill('gen-kick'),
        backlashPre: [],
        backlashMid: [],
      },
    ],
  }
}

function offlineOnline() {
  return {
    role: null,
    code: null,
    myIdx: null,
    roster: [],
    sharedDecks: [],
    connected: false,
    gameMode: 'rumble' as const,
    beltId: null,
    beltDefending: null,
    joinRequests: [],
    pendingApproval: false,
  }
}

function roomOnline(role: 'host' | 'client') {
  return { ...offlineOnline(), role, code: 'ROOM1', myIdx: 0, connected: true }
}

describe('fresh room isolation', () => {
  beforeEach(() => {
    stopOnline() // resets the live-match flag and every room structure
    useAppStore.setState({
      online: offlineOnline(),
      game: null,
      lastError: null,
      view: 'menu',
    })
  })

  it('isMatchLive() is false until the room starts a match, false again after leaving', () => {
    expect(isMatchLive()).toBe(false)
    hostSetGameStarted(true)
    expect(isMatchLive()).toBe(true)
    stopOnline()
    expect(isMatchLive()).toBe(false)
  })

  it('a host with an open room cannot start a local game (the slot belongs to the room)', () => {
    const stale = newGame(localCfg())
    useAppStore.setState({ online: roomOnline('host'), game: stale })

    const started = useAppStore.getState().startGame(localCfg())
    const st = useAppStore.getState()

    expect(started).toBe(false)
    expect(st.game).toBe(stale) // the room's game is not replaced
    expect(st.view).toBe('lobby') // redirected where the error toast shows
    expect(st.lastError).toContain('sala')
  })

  it('a client in a room cannot start a local game either', () => {
    const stale = newGame(localCfg())
    useAppStore.setState({ online: roomOnline('client'), game: stale })

    expect(useAppStore.getState().startGame(localCfg())).toBe(false)
    expect(useAppStore.getState().game).toBe(stale)
  })

  it('a local game still starts fine with no room open', () => {
    const started = useAppStore.getState().startGame(localCfg())
    const st = useAppStore.getState()

    expect(started).toBe(true)
    expect(st.game).not.toBeNull()
    expect(st.game!.players).toHaveLength(1)
    expect(st.lastError).toBeNull()
  })

  it('room intents are refused while no match is live (stale game untouched)', () => {
    const stale = newGame(localCfg())
    stale.players[0]!.hand = ['gen-kick']
    useAppStore.setState({ online: roomOnline('host'), game: stale })
    const before = JSON.stringify(useAppStore.getState().game)

    applyRemoteIntent(useAppStore.getState, 0, 'manualMove', [0, 'hand', 'arsenal', ['gen-kick'], 'end'])

    expect(JSON.stringify(useAppStore.getState().game)).toBe(before)
  })

  it('room intents apply once the match is live', () => {
    hostSetGameStarted(true)
    const g = newGame(localCfg())
    g.players[0]!.hand = ['gen-kick']
    const before = g.players[0]!.arsenal.length
    useAppStore.setState({ online: roomOnline('host'), game: g })

    applyRemoteIntent(useAppStore.getState, 0, 'manualMove', [0, 'hand', 'arsenal', ['gen-kick'], 'end'])

    const st = useAppStore.getState()
    expect(st.game!.players[0]!.arsenal).toHaveLength(before + 1)
    expect(st.game!.players[0]!.hand).not.toContain('gen-kick')
  })
})
