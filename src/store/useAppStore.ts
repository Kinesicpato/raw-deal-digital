import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CardDef } from '../data/types'
import { getCard, getSuperstar } from '../data/cards'
import {
  newGame,
  playCard,
  endTurn,
  activateRingCard,
  passPrematch,
  playPrematchCard,
  applyDecision,
  manualRingToArsenal,
  manualShuffleArsenal,
  manualRevealHand,
  manualRemoveFromZone,
  manualZoneToArsenal,
  manualDrawFromArsenal,
  manualMoveCards,
  flipOverturnCard,
  stopOverturnCard,
  discardOpeningCards,
  redrawOpeningCards,
  keepOpeningHand,
  type NewGameConfig,
} from '../engine/game'
import type { GameState } from '../engine/types'
import type { ManualZone } from '../engine/game'
import { buildDefaultDeck } from '../data/defaultDeck'
import {
  broadcastState,
  clientSend,
  clientSendIntent,
  hostSendError,
  hostSetSuperstar,
  hostSetHandSize,
  hostShareDecks,
  randomCode,
  startClient,
  startHost,
  stopOnline,
  onlineRole,
  isOnline,
} from '../online/network'
import { decisionOwner, type IntentName, type RosterEntry, type SharedDeck } from '../online/types'

export interface DeckDraft {
  name: string
  superstarId: string
  arsenal: string[]
  backlashPre: string[]
  backlashMid: string[]
}

export type View = 'menu' | 'setup' | 'deck' | 'game' | 'lobby'

interface OnlineInfo {
  role: 'host' | 'client' | null
  code: string | null
  myIdx: number | null
  roster: RosterEntry[]
  sharedDecks: SharedDeck[]
  connected: boolean
}

interface AppState {
  view: View
  decks: DeckDraft[]
  activeDeckId: string | null
  game: GameState | null
  lastError: string | null
  online: OnlineInfo

  setView: (v: View) => void
  saveDeck: (deck: DeckDraft) => string | null
  deleteDeck: (id: string) => void
  setActiveDeck: (id: string | null) => void
  updateDeck: (patch: Partial<DeckDraft>) => void

  startGame: (cfg: NewGameConfig) => void
  discardOpeningAction: (cardIds: string[]) => void
  redrawOpeningAction: (count: number) => void
  keepHandAction: () => void
  playCardAction: (cardId: string, source?: 'hand' | 'midmatch' | 'prematch') => void
  playPrematchAction: (cardId: string) => void
  passPrematchAction: () => void
  endTurnAction: () => void
  activateRingAction: (cardId: string) => void
  resolvePending: (payload: unknown) => void
  resolveReversal: (payload: { cardId: string; zone: 'ring' | 'ringside' } | null) => void
  flipOverturn: () => void
  stopOverturn: () => void
  newGameAgain: () => void
  clearError: () => void
  manualRingToArsenal: (playerIdx: number, cardIds: string[]) => string | null
  manualShuffleArsenal: (playerIdx: number) => void
  manualRevealHand: (playerIdx: number, targetIdx: number | null) => void
  manualRemove: (playerIdx: number, zone: 'hand' | 'ring' | 'ringside', cardIds: string[]) => string | null
  manualZoneToArsenal: (playerIdx: number, zone: 'hand' | 'ring' | 'ringside', cardIds: string[]) => string | null
  manualDrawFromArsenal: (playerIdx: number, count: number) => string | null
  manualMove: (playerIdx: number, from: ManualZone, to: ManualZone, cardIds: string[]) => string | null
  setLastError: (msg: string | null) => void

  reshareDecks: () => void
  createRoom: (name: string, seats: number) => void
  joinRoom: (code: string, name: string) => void
  leaveOnline: () => void
  onlineSetRoster: (roster: RosterEntry[]) => void
  onlineSetMyIdx: (idx: number) => void
  onlinePickSuperstar: (superstarId: string, deck?: { name: string | null; arsenal: string[]; backlashPre: string[]; backlashMid: string[] } | null, handSize?: number | null) => void
  onlineSetHandSize: (handSize: number) => void
  startOnlineGame: () => void
  applyRemoteState: (game: GameState) => void
}

function cloneGame(g: GameState): GameState {
  return { ...g }
}

const defaultOnline: OnlineInfo = { role: null, code: null, myIdx: null, roster: [], sharedDecks: [], connected: false }

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      function isClient(): boolean {
        return get().online.role === 'client'
      }

      function route(action: IntentName, args: unknown[]): boolean {
        if (isClient()) {
          clientSendIntent(action, args)
          return true
        }
        return false
      }

      return {
        view: 'menu',
        decks: [],
        activeDeckId: null,
        game: null,
        lastError: null,
        online: defaultOnline,

        setView: (v) => set({ view: v }),

        saveDeck: (deck) => {
          const s = get()
          const existing = s.decks.find((d) => d.name === deck.name)
          if (!existing && s.decks.length >= 10) return 'Guardá max 10 mazos. Borrá uno antes de crear otro.'
          set((st) => {
            const decks = existing
              ? st.decks.map((d) => (d.name === deck.name ? { ...d, ...deck } : d))
              : [...st.decks, deck]
            return { decks }
          })
          return null
        },

        deleteDeck: (id) =>
          set((s) => ({
            decks: s.decks.filter((d) => d.name !== id),
            activeDeckId: s.activeDeckId === id ? null : s.activeDeckId,
          })),

        setActiveDeck: (id) => set({ activeDeckId: id }),

        updateDeck: (patch) =>
          set((s) => {
            const id = s.activeDeckId
            if (!id) return {}
            return {
              decks: s.decks.map((d) => (d.name === id ? { ...d, ...patch } : d)),
            }
          }),

        startGame: (cfg) => {
          const game = newGame(cfg)
          set({ game, lastError: null })
          if (get().online.role === 'host') broadcastState(game)
        },

        discardOpeningAction: (cardIds) => {
          if (route('discardOpeningAction', [cardIds])) return
          const s = get()
          if (!s.game) return
          const err = discardOpeningCards(s.game, s.game.activeIndex, cardIds)
          if (err) {
            set({ lastError: err })
            return
          }
          set((st) => ({ game: st.game ? { ...st.game } : null }))
          if (s.online.role === 'host' && s.game) broadcastState(s.game)
        },

        redrawOpeningAction: (count) => {
          if (route('redrawOpeningAction', [count])) return
          const s = get()
          if (!s.game) return
          const err = redrawOpeningCards(s.game, s.game.activeIndex, count)
          if (err) {
            set({ lastError: err })
            return
          }
          set((st) => ({ game: st.game ? { ...st.game } : null }))
          if (s.online.role === 'host' && s.game) broadcastState(s.game)
        },

        keepHandAction: () => {
          if (route('keepHandAction', [])) return
          const s = get()
          if (!s.game) return
          keepOpeningHand(s.game, s.game.activeIndex)
          refreshGame(set, get)
        },

        playCardAction: (cardId, source = 'hand') => {
          if (route('playCardAction', [cardId, source])) return
          const s = get()
          if (!s.game) return
          const err = playCard(s.game, s.game.activeIndex, cardId, source)
          if (err) {
            set({ lastError: err })
            return
          }
          refreshGame(set, get)
        },

        playPrematchAction: (cardId) => {
          if (route('playPrematchAction', [cardId])) return
          const s = get()
          if (!s.game) return
          const err = playPrematchCard(s.game, s.game.activeIndex, cardId)
          if (err) {
            set({ lastError: err })
            return
          }
          refreshGame(set, get)
        },

        passPrematchAction: () => {
          if (route('passPrematchAction', [])) return
          const s = get()
          if (!s.game) return
          passPrematch(s.game)
          refreshGame(set, get)
        },

        endTurnAction: () => {
          if (route('endTurnAction', [])) return
          const s = get()
          if (!s.game) return
          endTurn(s.game)
          refreshGame(set, get)
        },

        activateRingAction: (cardId) => {
          if (route('activateRingAction', [cardId])) return
          const s = get()
          if (!s.game) return
          const err = activateRingCard(s.game, s.game.activeIndex, cardId)
          if (err) {
            set({ lastError: err })
            return
          }
          refreshGame(set, get)
        },

        resolvePending: (payload) => {
          if (route('resolvePending', [payload])) return
          const s = get()
          if (!s.game) return
          const d = s.game.pendingDecision
          if (!d) return
          const err = applyDecision(s.game, d, payload)
          if (err) {
            set({ lastError: err })
            return
          }
          refreshGame(set, get)
        },

        resolveReversal: (payload) => {
          if (route('resolveReversal', [payload])) return
          const s = get()
          if (!s.game) return
          const d = s.game.pendingDecision
          if (!d || d.type !== 'reversalChoice') return
          s.game.pendingDecision = null
          const err = applyDecision(
            s.game,
            { type: 'reversalChoice', defenderIdx: d.defenderIdx, cardId: d.cardId },
            payload,
          )
          if (err) {
            set({ lastError: err })
            return
          }
          refreshGame(set, get)
        },

        flipOverturn: () => {
          if (route('flipOverturn', [])) return
          const s = get()
          if (!s.game) return
          const d = s.game.pendingDecision
          if (!d || d.type !== 'overturnCards') return
          const err = flipOverturnCard(s.game, d.playerIdx)
          if (err) {
            set({ lastError: err })
            return
          }
          refreshGame(set, get)
        },

        stopOverturn: () => {
          if (route('stopOverturn', [])) return
          const s = get()
          if (!s.game) return
          const d = s.game.pendingDecision
          if (!d || d.type !== 'overturnCards') return
          const err = stopOverturnCard(s.game, d.playerIdx)
          if (err) {
            set({ lastError: err })
            return
          }
          refreshGame(set, get)
        },

        newGameAgain: () => {
          const s = get()
          if (!s.game) return
          set({ view: 'menu', game: null, lastError: null })
        },

        clearError: () => set({ lastError: null }),

        setLastError: (msg) => set({ lastError: msg }),

        manualRingToArsenal: (playerIdx, cardIds) => {
          const s = get()
          if (!s.game) return null
          if (route('manualRingToArsenal', [playerIdx, cardIds])) return null
          const err = manualRingToArsenal(s.game, playerIdx, cardIds)
          set((st) => ({ game: st.game ? { ...st.game } : null }))
          if (s.online.role === 'host' && s.game) broadcastState(s.game)
          return err
        },

        manualShuffleArsenal: (playerIdx) => {
          const s = get()
          if (!s.game) return
          if (route('manualShuffleArsenal', [playerIdx])) return
          manualShuffleArsenal(s.game, playerIdx)
          set((st) => ({ game: st.game ? { ...st.game } : null }))
          if (s.online.role === 'host' && s.game) broadcastState(s.game)
        },

        manualRevealHand: (playerIdx, targetIdx) => {
          const s = get()
          if (!s.game) return
          if (route('manualRevealHand', [playerIdx, targetIdx])) return
          manualRevealHand(s.game, playerIdx, targetIdx)
          set((st) => ({ game: st.game ? { ...st.game } : null }))
          if (s.online.role === 'host' && s.game) broadcastState(s.game)
        },

        manualRemove: (playerIdx, zone, cardIds) => {
          const s = get()
          if (!s.game) return null
          if (route('manualRemove', [playerIdx, zone, cardIds])) return null
          const err = manualRemoveFromZone(s.game, playerIdx, cardIds, zone)
          set((st) => ({ game: st.game ? { ...st.game } : null }))
          if (s.online.role === 'host' && s.game) broadcastState(s.game)
          return err
        },

        manualZoneToArsenal: (playerIdx, zone, cardIds) => {
          const s = get()
          if (!s.game) return null
          if (route('manualZoneToArsenal', [playerIdx, zone, cardIds])) return null
          const err = manualZoneToArsenal(s.game, playerIdx, zone, cardIds)
          set((st) => ({ game: st.game ? { ...st.game } : null }))
          if (s.online.role === 'host' && s.game) broadcastState(s.game)
          return err
        },

        manualDrawFromArsenal: (playerIdx, count) => {
          const s = get()
          if (!s.game) return null
          if (route('manualDrawFromArsenal', [playerIdx, count])) return null
          const err = manualDrawFromArsenal(s.game, playerIdx, count)
          set((st) => ({ game: st.game ? { ...st.game } : null }))
          if (s.online.role === 'host' && s.game) broadcastState(s.game)
          return err
        },

        manualMove: (playerIdx, from, to, cardIds) => {
          const s = get()
          if (!s.game) return null
          if (route('manualMove', [playerIdx, from, to, cardIds])) return null
          const err = manualMoveCards(s.game, playerIdx, from, to, cardIds)
          set((st) => ({ game: st.game ? { ...st.game } : null }))
          if (s.online.role === 'host' && s.game) broadcastState(s.game)
          return err
        },

        // -------------------------------------------------------------------
        // ONLINE
        // -------------------------------------------------------------------

        reshareDecks: () => {
          const s = get()
          if (s.online.role !== 'host') return
          const decks = get().decks.map((d) => ({ ...d }))
          set({ online: { ...s.online, sharedDecks: decks } })
          hostShareDecks(decks)
        },

        createRoom: (name, seats) => {
          stopOnline()
          const code = randomCode()
          const roster: RosterEntry[] = Array.from({ length: Math.max(2, seats) }, (_, i) => ({
            idx: i,
            name: i === 0 ? name : '',
            superstarId: null,
            handSize: null,
            deck: null,
            connected: i === 0,
          }))
          set({
            online: { role: 'host', code, myIdx: 0, roster, sharedDecks: get().decks.map((d) => ({ ...d })), connected: false },
            view: 'lobby',
            lastError: null,
          })
          hostShareDecks(get().decks.map((d) => ({ ...d })))
          startHost(code, seats, name, {
            onOpen: () => {
              const st = get()
              set({ online: { ...st.online, connected: true } })
            },
            onRoster: (r) => {
              const st = get()
              set({ online: { ...st.online, roster: r } })
            },
            onIntent: (idx, action, args) => applyRemoteIntent(get, idx, action, args),
            onPeerClosed: () => {
              /* roster already updated via onRoster */
            },
            onError: (message) => set({ lastError: message }),
          })
        },

        joinRoom: (code, name) => {
          stopOnline()
          set({
            online: { role: 'client', code: code.toUpperCase(), myIdx: null, roster: [], sharedDecks: [], connected: false },
            view: 'lobby',
            lastError: null,
          })
          startClient(code, name, {
            onOpen: () => {
              const st = get()
              set({ online: { ...st.online, connected: true } })
            },
            onWelcome: (idx, roster) => {
              const st = get()
              set({ online: { ...st.online, myIdx: idx, roster } })
            },
            onRoster: (roster) => {
              const st = get()
              set({ online: { ...st.online, roster } })
            },
            onDecks: (decks) => {
              const st = get()
              set({ online: { ...st.online, sharedDecks: decks } })
            },
            onState: (game) => {
              const st = get()
              set({ online: st.online, game, view: 'game', lastError: null })
            },
            onError: (message) => set({ lastError: message }),
            onClosed: () => {
              set({ lastError: 'La sala se cerró (el anfitrión se desconectó).', view: 'menu', game: null })
              stopOnline()
            },
          })
        },

        leaveOnline: () => {
          stopOnline()
          set({ online: defaultOnline, view: 'menu', game: null, lastError: null })
        },

        onlineSetRoster: (roster) => {
          const st = get()
          set({ online: { ...st.online, roster } })
        },

        onlineSetMyIdx: (idx) => {
          const st = get()
          set({ online: { ...st.online, myIdx: idx } })
        },

        onlinePickSuperstar: (superstarId, deck = null, handSize = null) => {
          const st = get()
          const d = buildDefaultDeck(superstarId)
          const pick = deck ?? { name: null, arsenal: d.arsenal, backlashPre: d.pre, backlashMid: d.mid }
          const hs =
            handSize ??
            st.online.roster[st.online.myIdx ?? -1]?.handSize ??
            getSuperstar(superstarId).handSize
          if (st.online.role === 'host' && st.online.myIdx !== null) {
            hostSetSuperstar(st.online.myIdx, superstarId, pick)
            const roster = st.online.roster.map((r) =>
              r.idx === st.online.myIdx ? { ...r, superstarId, handSize: hs, deck: pick } : r,
            )
            set({ online: { ...st.online, roster } })
          } else if (st.online.role === 'client') {
            clientSend({ type: 'pick', superstarId, handSize: hs, deck: pick })
            const roster = st.online.roster.map((r) =>
              r.idx === st.online.myIdx ? { ...r, superstarId, handSize: hs, deck: pick } : r,
            )
            set({ online: { ...st.online, roster } })
          }
        },

        onlineSetHandSize: (handSize) => {
          const st = get()
          const clamped = Math.max(1, Math.min(12, Math.round(handSize)))
          if (st.online.myIdx === null) return
          const roster = st.online.roster.map((r) =>
            r.idx === st.online.myIdx ? { ...r, handSize: clamped } : r,
          )
          set({ online: { ...st.online, roster } })
          if (st.online.role === 'host') {
            hostSetHandSize(st.online.myIdx, clamped)
          } else if (st.online.role === 'client') {
            clientSend({
              type: 'pick',
              superstarId: roster[st.online.myIdx]?.superstarId ?? '',
              handSize: clamped,
              deck: roster[st.online.myIdx]?.deck ?? null,
            })
          }
        },

        startOnlineGame: () => {
          const st = get()
          if (st.online.role !== 'host' || !st.online.roster.length) return
          const players = st.online.roster
            .filter((r) => r.connected && r.superstarId)
            .sort((a, b) => a.idx - b.idx)
          if (players.length < 2) {
            set({ lastError: 'Se necesitan al menos 2 jugadores con Superestrella elegida.' })
            return
          }
          const cfg: NewGameConfig = {
            players: players.map((r) => {
              const dd = buildDefaultDeck(r.superstarId!)
              // A picked deck is used exactly as designed: if the player saved
              // it without Pre-match / Mid-match (Backlash) cards, those stay
              // empty instead of silently falling back to the default deck.
              return {
                name: r.name,
                superstarId: r.superstarId!,
                handSize: r.handSize ?? undefined,
                arsenal: r.deck ? r.deck.arsenal : dd.arsenal,
                backlashPre: r.deck ? r.deck.backlashPre : dd.pre,
                backlashMid: r.deck ? r.deck.backlashMid : dd.mid,
              }
            }),
          }
          const game = newGame(cfg)
          set({ game, lastError: null, view: 'game' })
          broadcastState(game)
        },

        applyRemoteState: (game) => {
          const st = get()
          set({ online: st.online, game, view: 'game', lastError: null })
        },
      }
    },
    {
      name: 'rawdeal-store',
      partialize: (s) => ({
        decks: s.decks,
        activeDeckId: s.activeDeckId,
        view: s.view === 'game' ? 'menu' : s.view === 'lobby' ? 'menu' : s.view,
        game: s.game,
      }),
      version: 1,
    },
  ),
)

/**
 * After any engine mutation, re-render the game state. There is no AI
 * anymore: every player is controlled by a human.
 */
function refreshGame(
  set: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
): void {
  set((s) => ({ game: s.game ? cloneGame(s.game) : null }))
  const st = get()
  if (st.online.role === 'host' && st.game) broadcastState(st.game)
}

/** Which player index a given intent action requires (host-side). */
function actorFor(game: GameState | null, action: IntentName): number | null {
  if (!game) return null
  switch (action) {
    case 'resolveReversal':
      if (game.pendingDecision?.type === 'reversalChoice') return game.pendingDecision.defenderIdx
      return null
    case 'resolvePending':
      return decisionOwner(game)
    case 'flipOverturn':
    case 'stopOverturn':
      if (game.pendingDecision?.type === 'overturnCards') return game.pendingDecision.playerIdx
      return null
    default:
      return game.activeIndex
  }
}

const MANUAL_INTENTS: IntentName[] = [
  'manualMove',
  'manualRingToArsenal',
  'manualZoneToArsenal',
  'manualRemove',
  'manualDrawFromArsenal',
  'manualShuffleArsenal',
  'manualRevealHand',
]

/** Host handles a remote client intent, validating it's that player's move. */
function applyRemoteIntent(
  get: () => AppState,
  idx: number,
  action: IntentName,
  args: unknown[],
): void {
  const s = get()
  if (MANUAL_INTENTS.includes(action)) {
    if (action === 'manualRevealHand') {
      // A player may show their own hand to anyone, or reveal a specific
      // opponent's hand to themselves (and hide either reveal they made).
      const [player, target] = args as [number, number | null]
      const valid =
        player === idx ||
        (target !== null && target === idx) ||
        (target === null && s.game?.players[player]?.handRevealedTo === idx)
      if (!valid) {
        hostSendError(idx, 'Solo podés revelar tu mano o la de un oponente para vos mismo.')
        return
      }
    } else if (args.length === 0 || args[0] !== idx) {
      hostSendError(idx, 'Solo podés mover tus propias cartas.')
      return
    }
    const fn = (s as unknown as Record<string, (...args: unknown[]) => void>)[action]
    if (typeof fn === 'function') fn(...args)
    return
  }
  const allowed = actorFor(s.game, action)
  if (allowed === null || allowed !== idx) {
    hostSendError(idx, 'No es tu turno o la jugada no es válida.')
    return
  }
  const fn = (s as unknown as Record<string, (...args: unknown[]) => void>)[action]
  if (typeof fn === 'function') fn(...args)
}

export function getCardSafe(id: string): CardDef {
  try {
    return getCard(id)
  } catch {
    return {
      id,
      name: `Unknown (${id})`,
      type: 'Action',
      fortitude: 0,
      damage: 0,
      text: 'Card data missing.',
    }
  }
}

export { onlineRole, isOnline }