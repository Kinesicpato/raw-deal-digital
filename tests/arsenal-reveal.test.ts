import { describe, it, expect, beforeEach } from 'vitest'
import { buildClientView } from '../src/online/types'
import { newGame, type NewGameConfig } from '../src/engine/game'
import type { GameState } from '../src/engine/types'
import { useAppStore, applyRemoteIntent } from '../src/store/useAppStore'
import { hostSetGameStarted, stopOnline } from '../src/online/network'

/**
 * "Mostrar arsenal al oponente": the reveal happens IN PLACE inside the
 * arsenal list — the pile shows as card backs and the granted cards flip
 * face-up right where they sit (the same pattern as a revealed hand), so
 * there is no separate panel of small cards to scroll down to.
 */

function makeGame(): GameState {
  const g = newGame({
    players: [
      { name: 'Owner', superstarId: 'kurt-angle', arsenal: Array(12).fill('gen-kick'), backlashPre: [], backlashMid: [] },
      { name: 'Target', superstarId: 'chyna', arsenal: Array(12).fill('punch'), backlashPre: [], backlashMid: [] },
      { name: 'Third', superstarId: 'kane', arsenal: Array(12).fill('gen-elbow-to-the-face'), backlashPre: [], backlashMid: [] },
    ],
  } as NewGameConfig)
  // Deterministic piles for position-sensitive assertions (newGame shuffles).
  g.players[0]!.arsenal = ['gen-kick', 'punch', 'kurt-olympic-slam', 'punch']
  g.players[1]!.arsenal = ['punch', 'gen-kick']
  g.players[2]!.arsenal = ['gen-kick']
  return g
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

function roomOnline() {
  return { ...offlineOnline(), role: 'host' as const, code: 'ROOM1', myIdx: 0, connected: true }
}

describe('buildClientView arsenal reveal (in place, like a revealed hand)', () => {
  it('shows the granted cards face-up where they sit, card backs everywhere else', () => {
    const g = makeGame()
    g._shownCard = { cardIds: ['punch'], from: 0, to: 1, zone: 'arsenal' }
    const view = buildClientView(g, 1)
    expect(view.players[0]!.arsenal).toEqual(['__hidden__', 'punch', '__hidden__', '__hidden__'])
  })

  it('reveals each granted copy only as many times as it was granted', () => {
    const g = makeGame()
    g._shownCard = { cardIds: ['punch', 'punch'], from: 0, to: 1, zone: 'arsenal' }
    const view = buildClientView(g, 1)
    expect(view.players[0]!.arsenal).toEqual(['__hidden__', 'punch', '__hidden__', 'punch'])
  })

  it('hides the pile from a third player and never tells them the reveal exists', () => {
    const g = makeGame()
    g._shownCard = { cardIds: ['punch'], from: 0, to: 1, zone: 'arsenal' }
    const view = buildClientView(g, 2)
    expect(view.players[0]!.arsenal).toEqual(['__hidden__', '__hidden__', '__hidden__', '__hidden__'])
    expect(view._shownCard ?? null).toBeNull()
  })

  it('keeps the owner their own full view of the pile (and the reveal state)', () => {
    const g = makeGame()
    g._shownCard = { cardIds: ['punch'], from: 0, to: 1, zone: 'arsenal' }
    const view = buildClientView(g, 0)
    expect(view.players[0]!.arsenal).toEqual(['gen-kick', 'punch', 'kurt-olympic-slam', 'punch'])
    expect(view._shownCard).toEqual(g._shownCard)
  })

  it('a reveal made from ANOTHER zone never un-hides the arsenal', () => {
    const g = makeGame()
    g._shownCard = { cardIds: ['punch'], from: 0, to: 1, zone: 'hand' }
    const view = buildClientView(g, 1)
    expect(view.players[0]!.arsenal.every((id) => id === '__hidden__')).toBe(true)
  })

  it('a granted card that left the arsenal stops being visible there', () => {
    const g = makeGame()
    g._shownCard = { cardIds: ['punch'], from: 0, to: 1, zone: 'arsenal' }
    g.players[0]!.arsenal = ['gen-kick'] // the punch was drawn away
    const view = buildClientView(g, 1)
    expect(view.players[0]!.arsenal).toEqual(['__hidden__'])
  })

  it('keeps the whole pile visible to spectators', () => {
    const g = makeGame()
    g._shownCard = { cardIds: ['punch'], from: 0, to: 1, zone: 'arsenal' }
    const view = buildClientView(g, -1)
    expect(view.players[0]!.arsenal).toEqual(['gen-kick', 'punch', 'kurt-olympic-slam', 'punch'])
  })

  it('leaves every arsenal untouched when no reveal is active', () => {
    const g = makeGame()
    const view = buildClientView(g, 1)
    expect(view.players[0]!.arsenal).toEqual(['__hidden__', '__hidden__', '__hidden__', '__hidden__'])
    expect(view._shownCard ?? null).toBeNull()
  })
})

describe('show arsenal to an opponent (store)', () => {
  beforeEach(() => {
    stopOnline()
    hostSetGameStarted(false)
    useAppStore.setState({ online: offlineOnline(), game: null, lastError: null })
  })

  const shownNow = () => useAppStore.getState().game!._shownCard

  it('records the reveal with its zone, dedupes cards and swaps targets', () => {
    useAppStore.setState({ game: makeGame() })
    const st = useAppStore.getState()

    st.showCardToOpponent(0, 'punch', 1, 'arsenal')
    st.showCardToOpponent(0, 'gen-kick', 1, 'arsenal')
    st.showCardToOpponent(0, 'punch', 1, 'arsenal') // duplicate: ignored
    expect(shownNow()).toEqual({ cardIds: ['punch', 'gen-kick'], from: 0, to: 1, zone: 'arsenal' })

    st.showCardToOpponent(0, 'kurt-olympic-slam', 2, 'arsenal') // new target replaces
    expect(shownNow()).toEqual({ cardIds: ['kurt-olympic-slam'], from: 0, to: 2, zone: 'arsenal' })

    st.clearShownCard()
    expect(shownNow() ?? null).toBeNull()
  })

  it('never records a hidden placeholder as a shown card', () => {
    useAppStore.setState({ game: makeGame() })
    useAppStore.getState().showCardToOpponent(0, '__hidden__', 1, 'arsenal')
    expect(shownNow() ?? null).toBeNull()
  })
})

describe('clearShownCard intent (host validation)', () => {
  beforeEach(() => {
    stopOnline()
    hostSetGameStarted(false)
    useAppStore.setState({ online: offlineOnline(), game: null, lastError: null })
  })

  function setLiveRoom() {
    hostSetGameStarted(true)
    const g = makeGame()
    g._shownCard = { cardIds: ['punch'], from: 0, to: 1, zone: 'arsenal' }
    useAppStore.setState({ online: roomOnline(), game: g })
    return g
  }

  it('the target of the reveal may take it back', () => {
    setLiveRoom()
    applyRemoteIntent(useAppStore.getState, 1, 'clearShownCard', [])
    expect(useAppStore.getState().game!._shownCard ?? null).toBeNull()
  })

  it('the owner who granted it may take it back', () => {
    setLiveRoom()
    applyRemoteIntent(useAppStore.getState, 0, 'clearShownCard', [])
    expect(useAppStore.getState().game!._shownCard ?? null).toBeNull()
  })

  it('a third player cannot clear someone else\u2019s reveal', () => {
    const g = setLiveRoom()
    const before = JSON.stringify(g._shownCard)
    applyRemoteIntent(useAppStore.getState, 2, 'clearShownCard', [])
    expect(JSON.stringify(useAppStore.getState().game!._shownCard)).toBe(before)
  })

  it('a client owner can show cards (with their zone) through an intent', () => {
    hostSetGameStarted(true)
    const g = makeGame()
    useAppStore.setState({ online: roomOnline(), game: g })
    applyRemoteIntent(useAppStore.getState, 0, 'showCardToOpponent', [0, 'punch', 1, 'arsenal'])
    expect(useAppStore.getState().game!._shownCard).toEqual({
      cardIds: ['punch'],
      from: 0,
      to: 1,
      zone: 'arsenal',
    })
  })

  it('a client cannot show cards on behalf of another player', () => {
    hostSetGameStarted(true)
    const g = makeGame()
    useAppStore.setState({ online: roomOnline(), game: g })
    applyRemoteIntent(useAppStore.getState, 1, 'showCardToOpponent', [0, 'punch', 1, 'arsenal'])
    expect(useAppStore.getState().game!._shownCard ?? null).toBeNull()
  })
})
