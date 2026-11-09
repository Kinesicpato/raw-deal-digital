import type { GameState } from '../engine/types'

export type GameMode = 'rumble' | 'winner-takes-all'

export interface DeckPick {
  name: string | null
  arsenal: string[]
  backlashPre: string[]
  backlashMid: string[]
}

export interface RosterEntry {
  idx: number
  name: string
  superstarId: string | null
  handSize: number | null
  deck: DeckPick | null
  connected: boolean
  spectator?: boolean
  gameMode?: GameMode
  beltId?: string | null
}

/** A client asking to enter a full room (or a match already in progress). */
export interface JoinRequest {
  senderId: string
  name: string
}

/** Serialized shape of a saved deck, shared by the host so clients can pick it. */
export interface SharedDeck {
  name: string
  superstarId: string
  arsenal: string[]
  backlashPre: string[]
  backlashMid: string[]
}

export type IntentName =
  | 'playCardAction'
  | 'playPrematchAction'
  | 'passPrematchAction'
  | 'endTurnAction'
  | 'activateRingAction'
  | 'discardOpeningAction'
  | 'redrawOpeningAction'
  | 'keepHandAction'
  | 'resolvePending'
  | 'resolveReversal'
  | 'undoReversalAction'
  | 'flipOverturn'
  | 'stopOverturn'
  | 'manualMove'
  | 'manualRingToArsenal'
  | 'manualZoneToArsenal'
  | 'manualRemove'
  | 'manualDrawFromArsenal'
  | 'manualOverturn'
  | 'manualShuffleArsenal'
  | 'manualReorderArsenal'
  | 'manualRevealHand'
  | 'showCardToOpponent'
  | 'clearShownCard'

export type ClientMsg =
  | { type: 'hello'; name: string }
  | { type: 'setRole'; role: 'player' | 'spectator' }
  | { type: 'pick'; superstarId: string; handSize: number | null; deck: DeckPick | null }
  | { type: 'beltDefense'; defending: boolean }
  | { type: 'intent'; action: IntentName; args: unknown[] }

export type HostMsg =
  | { type: 'welcome'; idx: number; roster: RosterEntry[] }
  | { type: 'lobby'; roster: RosterEntry[] }
  | { type: 'decks'; decks: SharedDeck[] }
  | { type: 'belt'; beltId: string | null; defending: boolean | null }
  | { type: 'state'; game: GameState }
  | { type: 'error'; message: string }
  | { type: 'joinPending' }
  | { type: 'joinDenied'; reason?: string }

/** The player index that must answer the current pending decision, or null. */
export function decisionOwner(game: GameState): number | null {
  const d = game.pendingDecision
  if (!d) return null
  if (d.type === 'reversalChoice') {
    // In multiplayer, all non-attacking players can reverse — return null to show to all.
    if (d.reversedPlayers) return null
    return d.defenderIdx
  }
  if (d.type === 'reversalPlayed') return d.attackerIdx
  if (d.type === 'chooseOpponentHandCard') return game.pendingEffects?.sourcePlayer ?? d.playerIdx
  return d.playerIdx
}

const HIDDEN = '__hidden__'

/**
 * Builds the snapshot of a game that a given viewer is allowed to see.
 * Hidden information (other players' hands, Arsenal and Backlash decks) is
 * replaced by equal-length placeholders so counts stay accurate, unless the
 * game rules explicitly reveal it (handRevealedTo target, reorder-opponent
 * arsenal, look-at-opponent-hand) or a player granted THIS viewer a look at
 * specific cards of a zone (shown cards stay face-up, in place).
 */
export function buildClientView(game: GameState, viewerIdx: number): GameState {
  if (viewerIdx < -1) return game
  const clone: GameState = JSON.parse(JSON.stringify(game))
  // Spectators (viewerIdx === -1) see everything.
  if (viewerIdx === -1) return clone
  const owner = decisionOwner(clone)
  const n = clone.players.length

  // A reveal is private to the player who granted it and the one it was
  // granted to: anyone else must not even learn it happened (nor which
  // cards are in it).
  const shown = clone._shownCard
  if (shown && shown.from !== viewerIdx && shown.to !== viewerIdx) clone._shownCard = null

  clone.players.forEach((p, i) => {
    if (i === viewerIdx) return

    const revealHand =
      p.handRevealedTo === viewerIdx ||
      (owner === viewerIdx &&
        clone.pendingDecision?.type === 'chooseOpponentHandCard' &&
        clone.pendingDecision.playerIdx === i)
    if (!revealHand) p.hand = Array(p.hand.length).fill(HIDDEN)

    const revealArsenal =
      owner === viewerIdx &&
      clone.pendingDecision?.type === 'reorderOpponentArsenal' &&
      i === (clone.resolution?.target ?? (clone.pendingDecision.playerIdx + 1) % n)
    if (!revealArsenal) {
      // Cards player `i` granted THIS viewer to see stay face-up right where
      // they sit in the Arsenal (the rest of the pile shows as card backs).
      const granted =
        shown && shown.from === i && shown.to === viewerIdx && shown.zone === 'arsenal'
          ? shown.cardIds
          : null
      if (granted && granted.length > 0) {
        // Reveal each granted id only as many times as it was granted, so a
        // single copy shown never exposes a second copy sitting in the pile.
        const pending = new Map<string, number>()
        for (const id of granted) pending.set(id, (pending.get(id) ?? 0) + 1)
        p.arsenal = p.arsenal.map((id) => {
          const left = pending.get(id) ?? 0
          if (left <= 0) return HIDDEN
          pending.set(id, left - 1)
          return id
        })
      } else {
        p.arsenal = Array(p.arsenal.length).fill(HIDDEN)
      }
    }

    p.backlashPre = Array(p.backlashPre.length).fill(HIDDEN)
    p.backlashMid = Array(p.backlashMid.length).fill(HIDDEN)
  })

  if (owner !== viewerIdx) delete clone._searchPool
  return clone
}