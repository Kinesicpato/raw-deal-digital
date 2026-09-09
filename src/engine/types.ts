export type Phase =
  | 'opening'
  | 'prematch'
  | 'start'
  | 'draw'
  | 'main'
  | 'reversalWindow'
  | 'overturning'
  | 'end'
  | 'gameover'

export interface PlayerState {
  id: string
  name: string
  superstarId: string
  isAI: boolean
  aiLevel?: 1 | 2 | 3
  hand: string[]
  /** Opening hand size this player was dealt (defaults to their superstar's). */
  handSize?: number
  arsenal: string[]
  ringside: string[]
  ring: string[]
  outOfGame: string[]
  /** Remaining Pre-match cards available from the Backlash deck. */
  backlashPre: string[]
  /** Remaining Mid-match cards available from the Backlash deck. */
  backlashMid: string[]
  /** Mid-match (and Pre-match) cards played during the match, sitting in the Mid-match zone. */
  midmatchPlayed: string[]
  fortitude: number
  eliminated: boolean
  eliminatedReason: string | null
  /** True if this player reversed a maneuver to end the opponent's last turn. */
  reversedLastTurn: boolean
  lastSuccessfullyPlayed: { cardId: string; damage: number } | null
  playedThisTurn: string[]
  /** If set, only this opponent (player index) may see your hand. null = hidden. */
  handRevealedTo: number | null
  hasUsedHeat: boolean
  /** Index of the player who last attacked this player (for multiplayer win attribution). */
  lastAttackerIdx: number | null
}

export interface Resolution {
  attacker: number
  target: number
  cardId: string
  /** 'maneuver' | 'action' — how it was played. */
  mode: 'maneuver' | 'action'
  /** Where the card came from ('hand' vs a Backlash pile). */
  source: 'hand' | 'midmatch' | 'prematch'
  /** Number of reversals required to stop it (2 for Multi). */
  reversalHitsNeeded: number
  reversalHits: number
  /** Computed damage after bonuses (may be reduced by partial overturn). */
  damageToDeal: number
  damageDealt: number
  /** True while the defender is choosing whether to reverse from hand. */
  waitingHandReversal: boolean
  /** True once damage is being overturned and reversals may be revealed. */
  overturning: boolean
  /** Reverse from hand already accepted but Multi needs a second hit. */
  partialReversal: boolean
  ended: boolean
}

export type PendingDecision =
  | { type: 'chooseTarget'; playerIdx: number; cardId: string }
  | { type: 'reversalChoice'; defenderIdx: number; cardId: string; reversedPlayers?: number[]; playerChoices?: Record<number, string[] | null> }
  | { type: 'reversalPlayed'; attackerIdx: number; reversalCardIds: string[] }
  | { type: 'overturnCards'; playerIdx: number; cardId: string; damageToDeal: number; overturned: number; purpose: 'damage' | 'reversal'; voluntary: boolean }
  | { type: 'chooseCardsFromHand'; playerIdx: number; count: number; purpose: 'discard' | 'switch' }
  | { type: 'chooseArsenalCards'; playerIdx: number; count: number }
  | { type: 'chooseRingsideCards'; playerIdx: number; count: number; to: 'hand' }
  | { type: 'reorderOpponentArsenal'; playerIdx: number; amount: number }
  | { type: 'chooseOpponentHandCard'; playerIdx: number }
  | { type: 'searchArsenal'; playerIdx: number; count: number }
  | { type: 'concedeChoice'; playerIdx: number; reason: 'pin' | 'countout' }

export interface TurnBonus {
  damageDelta: number
  fortitudeDelta: number
  cannotBeReversed: boolean
  cannotBeTitled?: string
  countAsSetUp: boolean
}

export interface PendingEffects {
  sourcePlayer: number
  sourceCard: string
  effects: import('../data/types').CardEffect[]
  index: number
}

export interface GameState {
  players: PlayerState[]
  activeIndex: number
  turnNumber: number
  phase: Phase
  prematchStage: number
  resolution: Resolution | null
  pendingDecision: PendingDecision | null
  pendingEffects: PendingEffects | null
  turnBonus: TurnBonus | null
  /** Player whose "chain cards cannot be reversed from arsenal" this turn. */
  chainSafeIndex: number | null
  winner: number[] | null
  winType: 'pin' | 'countout' | 'draw' | null
  /** Cards offered to the current player by a pending search. */
  _searchPool?: string[]
  /** Players who already acted in the current Pre-match stage. */
  _prematchActed: number[]
  /** Players who already chose (kept) their opening hand. */
  _openingKept: number[]
  /** Manual house-rule: card(s) being shown to a specific opponent. */
  _shownCard?: { cardIds: string[]; from: number; to: number } | null
}
