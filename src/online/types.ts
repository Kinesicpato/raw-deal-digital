import type { GameState } from '../engine/types'

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
  | 'flipOverturn'
  | 'stopOverturn'
  | 'manualMove'
  | 'manualRingToArsenal'
  | 'manualZoneToArsenal'
  | 'manualRemove'
  | 'manualDrawFromArsenal'
  | 'manualShuffleArsenal'
  | 'manualReorderArsenal'
  | 'manualRevealHand'
  | 'showCardToOpponent'

export type ClientMsg =
  | { type: 'hello'; name: string }
  | { type: 'setRole'; role: 'player' | 'spectator' }
  | { type: 'pick'; superstarId: string; handSize: number | null; deck: DeckPick | null }
  | { type: 'intent'; action: IntentName; args: unknown[] }

export type HostMsg =
  | { type: 'welcome'; idx: number; roster: RosterEntry[] }
  | { type: 'lobby'; roster: RosterEntry[] }
  | { type: 'decks'; decks: SharedDeck[] }
  | { type: 'state'; game: GameState }
  | { type: 'error'; message: string }

/** The player index that must answer the current pending decision, or null. */
export function decisionOwner(game: GameState): number | null {
  const d = game.pendingDecision
  if (!d) return null
  if (d.type === 'reversalChoice') return d.defenderIdx
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
 * arsenal, look-at-opponent-hand).
 */
export function buildClientView(game: GameState, viewerIdx: number): GameState {
  if (viewerIdx < -1) return game
  const clone: GameState = JSON.parse(JSON.stringify(game))
  // Spectators (viewerIdx === -1) see everything.
  if (viewerIdx === -1) return clone
  const owner = decisionOwner(clone)
  const n = clone.players.length

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
    if (!revealArsenal) p.arsenal = Array(p.arsenal.length).fill(HIDDEN)

    p.backlashPre = Array(p.backlashPre.length).fill(HIDDEN)
    p.backlashMid = Array(p.backlashMid.length).fill(HIDDEN)
  })

  if (owner !== viewerIdx) delete clone._searchPool
  return clone
}