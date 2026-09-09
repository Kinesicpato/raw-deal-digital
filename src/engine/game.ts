import { getCard, getSuperstar } from '../data/cards'
import type { CardDef } from '../data/types'
import type { GameState, PlayerState, PendingDecision, Resolution } from './types'
import { computeFortitude, drawCards, shuffled } from './rules'
import { eliminate, resolveNextEffect } from './effects'

export const PREMATCH_STAGES = ['Venue', 'Feud', 'Stipulation', 'Manager', 'Event'] as const

/** Superstars whose Draw Segment always draws 2 cards (Mankind / Cactus Jack). */
export const DRAW_TWO_SUPERSTARS: readonly string[] = ['mankind', 'cactus-jack']

export interface NewGameConfig {
  players: Array<{
    name: string
    superstarId: string
    isAI?: boolean
    aiLevel?: 1 | 2 | 3
    handSize?: number
    arsenal: string[]
    backlashPre: string[]
    backlashMid: string[]
  }>
}

export function newGame(cfg: NewGameConfig): GameState {
  const players: PlayerState[] = cfg.players.map((p, i) => ({
    id: `p${i}`,
    name: p.name,
    superstarId: p.superstarId,
    isAI: p.isAI ?? false,
    aiLevel: p.aiLevel,
    hand: [],
    handSize: p.handSize,
    arsenal: [...p.arsenal],
    ringside: [],
    ring: [],
    outOfGame: [],
    backlashPre: [...p.backlashPre],
    backlashMid: [...p.backlashMid],
    midmatchPlayed: [],
    fortitude: 0,
    eliminated: false,
    eliminatedReason: null,
    reversedLastTurn: false,
    lastSuccessfullyPlayed: null,
    playedThisTurn: [],
    handRevealedTo: null,
    hasUsedHeat: false,
    lastAttackerIdx: null,
  }))

  const state: GameState = {
    players,
    activeIndex: 0,
    turnNumber: 1,
    phase: 'opening',
    prematchStage: 0,
    resolution: null,
    pendingDecision: null,
    pendingEffects: null,
    turnBonus: null,
    chainSafeIndex: null,
    winner: null,
    winType: null,
    _prematchActed: [],
    _openingKept: [],
  }

  // Order by Superstar Value descending.
  const ordered = players
    .map((_, i) => i)
    .sort((a, b) => {
      const va = getSuperstar(players[a]?.superstarId ?? '').value
      const vb = getSuperstar(players[b]?.superstarId ?? '').value
      return vb - va
    })
  const first = ordered[0]
  if (first !== undefined) state.activeIndex = first

  // Shuffle each Arsenal and deal the opening hand before the Pre-match.
  players.forEach((p) => {
    p.arsenal = shuffled(p.arsenal)
    const ss = getSuperstar(p.superstarId)
    drawCards(p, p.handSize ?? ss.handSize, getCard)
    ensurePlayableOpeningHand(state, p)
  })

  return state
}

/**
 * Guarantees the opening hand contains enough playable (F:0, non-reversal)
 * cards so the first Main Segment isn't a dead stop. Swaps unusable hand
 * cards for F:0 Maneuver/Action cards from the Arsenal when available.
 */
function ensurePlayableOpeningHand(_state: GameState, p: PlayerState): void {
  const needPlayable = Math.min(3, p.hand.length)
  let playable = p.hand.filter((id) => {
    const c = getCard(id)
    return c.type !== 'Reversal' && c.fortitude === 0
  }).length
  let pi = 0
  while (playable < needPlayable && pi < p.hand.length) {
    const curId = p.hand[pi]
    if (!curId) break
    const cur = getCard(curId)
    if (cur.type !== 'Reversal' && cur.fortitude === 0) {
      pi++
      continue
    }
    const swapIdx = p.arsenal.findIndex((id) => {
      const c = getCard(id)
      return c.type !== 'Reversal' && c.fortitude === 0
    })
    if (swapIdx === -1) break
    const swap = p.arsenal[swapIdx]!
    p.arsenal.splice(swapIdx, 1)
    p.hand[pi] = swap
    p.arsenal.push(curId)
    playable++
    pi++
  }
}

// ---------------------------------------------------------------------------
// OPENING HAND SELECTION (mulligan-ish)
// ---------------------------------------------------------------------------

/**
 * Voluntary discard: move the chosen cards from the opening hand back into a
 * shuffled Arsenal, WITHOUT drawing replacements. Each player decides on their
 * own, so hands won't all end up the same size.
 */
export function discardOpeningCards(state: GameState, playerIdx: number, cardIds: string[]): string | null {
  const p = state.players[playerIdx]
  if (!p) return 'No player'
  if (state.phase !== 'opening') return 'Not in the opening phase.'
  if (state.activeIndex !== playerIdx) return 'It is not your turn to choose.'
  const kept = cardIds.filter((id) => p.hand.includes(id))
  if (kept.length === 0) return null
  p.hand = p.hand.filter((id) => !cardIds.includes(id))
  p.arsenal = shuffled([...p.arsenal, ...cardIds])
  return null
}

/**
 * Voluntary refill: draw one card from the Arsenal back into the opening hand.
 * Not forced to any hand size.
 */
export function redrawOpeningCards(state: GameState, playerIdx: number, count: number): string | null {
  const p = state.players[playerIdx]
  if (!p) return 'No player'
  if (state.phase !== 'opening') return 'Not in the opening phase.'
  if (state.activeIndex !== playerIdx) return 'It is not your turn to choose.'
  const n = Math.max(1, count)
  const drawn = drawCards(p, n, getCard)
  if (drawn === 0) return 'No hay cartas en el Arsenal para robar.'
  return null
}

/** Lock in the current hand and advance to the next player / Pre-match. */
export function keepOpeningHand(state: GameState, playerIdx: number): void {
  if (state.phase !== 'opening') return
  const acted = state._openingKept
  if (!acted.includes(playerIdx)) acted.push(playerIdx)
  const alive = state.players.filter((ph) => !ph.eliminated).length
  if (acted.length >= alive) {
    startMatch(state)
    return
  }
  state.activeIndex = nextAlive(state, playerIdx)
}

// ---------------------------------------------------------------------------
// PRE-MATCH PHASE
// ---------------------------------------------------------------------------

function stageTrait(stage: number): 'Venue' | 'Feud' | 'Stipulation' | 'Manager' | 'Event' {
  return PREMATCH_STAGES[stage] ?? 'Event'
}

function prematchCardLegalForStage(c: CardDef, stage: number): boolean {
  const trait = stageTrait(stage)
  if (trait === 'Event') {
    const restricted = ['Venue', 'Feud', 'Stipulation', 'Manager']
    return c.backlash === 'Pre-match' && !c.traits?.some((t) => restricted.includes(t))
  }
  return c.backlash === 'Pre-match' && c.traits?.includes(trait) === true
}

export function canPlayPrematchCard(state: GameState, playerIdx: number, cardId: string): string | null {
  const p = state.players[playerIdx]
  if (!p) return 'No player'
  if (state.phase !== 'prematch') return 'Not the Pre-match phase.'
  if (state.activeIndex !== playerIdx) return 'It is not your turn to act.'
  const c = getCard(cardId)
  if (!p.backlashPre.includes(cardId)) return 'That card is not in your Pre-match deck.'
  if (!prematchCardLegalForStage(c, state.prematchStage)) {
    return `You may only play a ${stageTrait(state.prematchStage)} card now.`
  }
  const prematchInRing = p.ring.filter((id) => getCard(id).backlash === 'Pre-match').length
  if (prematchInRing >= 5) return 'You already have 5 Pre-match cards in your Ring area.'
  // One per type limit for the first four stages.
  if (state.prematchStage < 4) {
    const already = p.ring.some((id) => {
      const cc = getCard(id)
      return cc.traits?.includes(stageTrait(state.prematchStage)) === true
    })
    if (already) return `You already have a ${stageTrait(state.prematchStage)} card in play.`
  }
  return null
}

export function playPrematchCard(state: GameState, playerIdx: number, cardId: string): string | null {
  const err = canPlayPrematchCard(state, playerIdx, cardId)
  if (err) return err
  const p = state.players[playerIdx]
  if (!p) return 'No player'
  p.backlashPre = p.backlashPre.filter((id) => id !== cardId)
  p.ring.push(cardId)
  p.fortitude = computeFortitude([...p.midmatchPlayed, ...p.ring], getCard)
  advancePrematch(state, playerIdx)
  return null
}

export function passPrematch(state: GameState): void {
  advancePrematch(state, state.activeIndex)
}

function advancePrematch(state: GameState, actorIdx: number): void {
  if (state.phase !== 'prematch') return
  const acted = state._prematchActed
  if (!acted.includes(actorIdx)) acted.push(actorIdx)

  const alive = state.players.filter((p) => !p.eliminated).length
  if (acted.length >= alive) {
    state.prematchStage += 1
    state._prematchActed = []
    if (state.prematchStage >= PREMATCH_STAGES.length) {
      startMatch(state)
      return
    }
    state.activeIndex = nextAlive(state, actorIdx)
    return
  }
  state.activeIndex = nextAlive(state, actorIdx)
}

/** Begin the first turn (opening hand is already dealt in newGame). */
export function startMatch(state: GameState): void {
  // Recalculate order by Superstar Value.
  const ordered = state.players
    .map((_, i) => i)
    .sort((a, b) => {
      const va = getSuperstar(state.players[a]?.superstarId ?? '').value
      const vb = getSuperstar(state.players[b]?.superstarId ?? '').value
      return vb - va
    })
  const first = ordered[0]
  if (first !== undefined) state.activeIndex = first
  state.phase = 'start'
  startTurn(state)
}

// ---------------------------------------------------------------------------
// TURN STRUCTURE
// ---------------------------------------------------------------------------

function nextAlive(state: GameState, from: number): number {
  const n = state.players.length
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n
    const p = state.players[idx]
    if (p && !p.eliminated) return idx
  }
  return from
}

export function startTurn(state: GameState): void {
  if (state.winner !== null) return
  state.phase = 'draw'
  const p = state.players[state.activeIndex]
  if (p) {
    p.playedThisTurn = []
    p.hasUsedHeat = false
    state.turnBonus = null
    state.chainSafeIndex = null
    state.resolution = null
    state.pendingDecision = null
  }
  // Draw Segment: if the player has no Arsenal, they lose to whoever last attacked them.
  if (p && p.arsenal.length === 0) {
    const attackerIdx = p.lastAttackerIdx
    if (attackerIdx !== null && attackerIdx !== state.activeIndex) {
      eliminate(state, state.activeIndex, 'countout')
      // Game continues if other players remain; advance to next alive player.
      advanceTurn(state)
    } else {
      // No known attacker (e.g. first turn) — offer concede choice.
      openConcedeChoice(state, state.activeIndex, 'countout')
    }
    return
  }
  // Draw Segment: Mankind and Cactus Jack always draw 2, everyone else draws 1.
  if (p) {
    const drawCount = DRAW_TWO_SUPERSTARS.includes(p.superstarId) ? 2 : 1
    drawCards(p, drawCount, getCard)
  }
  state.phase = 'main'
}

export function endTurn(state: GameState): void {
  if (state.winner !== null) {
    // Game is already over, just clean up
    state.pendingDecision = null
    state.pendingEffects = null
    return
  }
  const active = state.players[state.activeIndex]
  if (active) active.reversedLastTurn = false
  // Count Out check at end of turn: if arsenal is empty, the last attacker wins.
  if (active && active.arsenal.length === 0) {
    const attackerIdx = active.lastAttackerIdx
    if (attackerIdx !== null && attackerIdx !== state.activeIndex) {
      eliminate(state, state.activeIndex, 'countout')
      // Game continues if other players remain; checkGameOver handles it.
      advanceTurn(state)
    } else {
      openConcedeChoice(state, state.activeIndex, 'countout')
    }
    return
  }
  advanceTurn(state)
}

/** Advances active player / turn number after a turn ends. */
export function advanceTurn(state: GameState): void {
  if (state.winner !== null) return
  state.turnBonus = null
  state.resolution = null
  state.pendingDecision = null
  state.pendingEffects = null
  state.phase = 'start'
  state.activeIndex = nextAlive(state, state.activeIndex)
  state.turnNumber += 1
  startTurn(state)
}

/**
 * If the given player has no cards at all, ask them (via a pending decision)
 * whether they want to lose the match. Everything else in the game is manual,
 * so the player decides: accept loss (eliminated) or keep playing.
 */
export function openConcedeChoice(
  state: GameState,
  playerIdx: number,
  reason: 'pin' | 'countout',
): void {
  const p = state.players[playerIdx]
  if (!p || p.eliminated) return
  if (state.winner !== null) return
  // Player only truly "has no cards" when Arsenal is empty.
  if (p.arsenal.length !== 0) return
  state.pendingDecision = { type: 'concedeChoice', playerIdx, reason }
}

// ---------------------------------------------------------------------------
// PLAYING CARDS
// ---------------------------------------------------------------------------

export function effectiveFortitude(card: CardDef, state: GameState): number {
  const p = state.players[state.activeIndex]
  const delta = state.turnBonus?.fortitudeDelta ?? 0
  void p
  return card.fortitude + delta
}

function checkPlayability(state: GameState, playerIdx: number, _card: CardDef): string | null {
  const p = state.players[playerIdx]
  if (!p) return 'No player'
  if (p.eliminated) return 'You are eliminated.'
  return null
}

function pickDefaultTarget(state: GameState, attacker: number): number | null {
  const n = state.players.length
  for (let i = 1; i < n; i++) {
    const idx = (attacker + i) % n
    const p = state.players[idx]
    if (p && !p.eliminated) return idx
  }
  return null
}

export function cardNeedsTarget(card: CardDef): boolean {
  return card.damage > 0 || (card.effect !== undefined && card.effect.length > 0)
}

/** Cards the given player may legally play right now (their Main Segment). */
export function getValidPlays(state: GameState, playerIdx: number): string[] {
  const p = state.players[playerIdx]
  if (!p || state.phase !== 'main' || state.activeIndex !== playerIdx) return []
  const plays = p.hand.filter((id) => {
    const c = getCard(id)
    return checkPlayability(state, playerIdx, c) === null
  })
  // Mid-match Backlash cards are played during Main Segments too.
  for (const id of p.backlashMid) {
    const c = getCard(id)
    if (checkPlayability(state, playerIdx, c) === null) plays.push(id)
  }
  // Pre-match cards can also be played manually on your turn (house rule).
  for (const id of p.backlashPre) {
    const c = getCard(id)
    if (checkPlayability(state, playerIdx, c) === null) plays.push(id)
  }
  return plays
}

/**
 * Play a card from hand (or from the Mid-match deck). Mode is implied by phase:
 * your turn -> Maneuver/Action; opponent's turn -> Reversal (Hybrid only).
 */
export function playCard(
  state: GameState,
  playerIdx: number,
  cardId: string,
  source: 'hand' | 'midmatch' | 'prematch' = 'hand',
): string | null {
  const p = state.players[playerIdx]
  if (!p) return 'No player'
  if (state.phase !== 'main') return 'You can only play cards during your Main Segment.'
  if (state.activeIndex !== playerIdx) return 'It is not your turn.'

  const card = getCard(cardId)

  const playErr = checkPlayability(state, playerIdx, card)
  if (playErr) return playErr

  // Remove from source (auto-detect when the card lives in a Backlash pile).
  let src = source
  if (src === 'hand' && !p.hand.includes(cardId)) {
    if (p.backlashMid.includes(cardId)) src = 'midmatch'
    else if (p.backlashPre.includes(cardId)) src = 'prematch'
  }
  if (src === 'hand') {
    const idx = p.hand.indexOf(cardId)
    if (idx < 0) return 'Card is not in your hand.'
    p.hand.splice(idx, 1)
  } else if (src === 'prematch') {
    const idx = p.backlashPre.indexOf(cardId)
    if (idx < 0) return 'Card is not in your Pre-match deck.'
    p.backlashPre.splice(idx, 1)
  } else {
    const idx = p.backlashMid.indexOf(cardId)
    if (idx < 0) return 'Card is not in your Mid-match deck.'
    p.backlashMid.splice(idx, 1)
  }

  const mode: Resolution['mode'] = card.type === 'Action' ? 'action' : 'maneuver'

  if (cardNeedsTarget(card) && state.players.length > 2) {
    const target = pickDefaultTarget(state, playerIdx)
    if (target === null) {
      if (src === 'hand') p.hand.push(cardId)
      else if (src === 'prematch') p.backlashPre.push(cardId)
      else p.backlashMid.push(cardId)
      return 'No valid target.'
    }
    if (!p.isAI) {
      state.resolution = {
        attacker: playerIdx,
        target,
        cardId,
        mode,
        reversalHitsNeeded: card.traits?.includes('Multi') ? 2 : 1,
        reversalHits: 0,
        damageToDeal: 0,
        damageDealt: 0,
        waitingHandReversal: false,
        overturning: false,
        partialReversal: false,
        ended: false,
        source: src,
      }
      state.pendingDecision = { type: 'chooseTarget', playerIdx, cardId }
      return null
    }
    state.resolution = makeResolution(playerIdx, target, cardId, mode, src)
    state.players[target]!.lastAttackerIdx = playerIdx
    openReversalWindow(state, target)
    return null
  }

  const target = pickDefaultTarget(state, playerIdx) ?? playerIdx
  state.resolution = makeResolution(playerIdx, target, cardId, mode, src)
  state.players[target]!.lastAttackerIdx = playerIdx
  openReversalWindow(state, target)
  return null
}

function makeResolution(
  attacker: number,
  target: number,
  cardId: string,
  mode: Resolution['mode'],
  source: 'hand' | 'midmatch' | 'prematch',
): Resolution {
  return {
    attacker,
    target,
    cardId,
    mode,
    reversalHitsNeeded: getCard(cardId).traits?.includes('Multi') ? 2 : 1,
    reversalHits: 0,
    damageToDeal: 0,
    damageDealt: 0,
    waitingHandReversal: false,
    overturning: false,
    partialReversal: false,
    ended: false,
    source,
  }
}

export function resolveTarget(state: GameState, target: number): string | null {
  const d = state.pendingDecision
  if (!d || d.type !== 'chooseTarget') return 'No target pending.'
  const res = state.resolution
  if (!res) return 'No active card.'
  const attacker = state.players[res.attacker]
  if (!attacker) return 'No attacker.'
  state.pendingDecision = null
  res.target = target
  state.players[target]!.lastAttackerIdx = res.attacker
  openReversalWindow(state, target)
  return null
}

// ---------------------------------------------------------------------------
// REVERSAL WINDOW
// ---------------------------------------------------------------------------

function openReversalWindow(state: GameState, defenderIdx: number): void {
  const res = state.resolution
  if (!res) return
  res.waitingHandReversal = true
  state.phase = 'reversalWindow'
  const isMulti = state.players.length > 2
  if (isMulti) {
    state.pendingDecision = { type: 'reversalChoice', defenderIdx, cardId: res.cardId, reversedPlayers: [], playerChoices: {} }
  } else {
    state.pendingDecision = { type: 'reversalChoice', defenderIdx, cardId: res.cardId }
  }
}

export function getPlayableReversals(state: GameState, defenderIdx: number): string[] {
  const res = state.resolution
  if (!res) return []
  const defender = state.players[defenderIdx]
  if (!defender) return []
  // Manual mode: any card in hand OR any Mid-match Backlash card may reverse.
  return [...defender.hand, ...defender.backlashMid]
}

/** For the AI only: keep the reversal-criteria matching to pick smart reversals. */
export function reversalMatches(reversal: CardDef, attacked: CardDef): boolean {
  const r = reversal.reverses
  if (!r) return false
  if (r.handOnly && !reversal.reversalFromHandOnly) {
    // handled by caller context
  }
  if (r.maneuverTypes) {
    const okType =
      r.maneuverTypes.includes('*') ||
      (attacked.type === 'Maneuver' &&
        attacked.subtypes?.some((s) => r.maneuverTypes?.includes(s)) === true)
    if (!okType) return false
  }
  if (r.cardKinds) {
    const attackedTraits = attacked.traits ?? []
    const isKind = r.cardKinds.some((k) => {
      if (k === 'Action') return attacked.type === 'Action'
      if (k === 'Chain') return attackedTraits.includes('Chain')
      if (k === 'Unique') return attackedTraits.includes('Unique')
      if (k === 'Heat') return attackedTraits.includes('Heat')
      if (k === 'Multi') return attackedTraits.includes('Multi')
      return false
    })
    if (!isKind) return false
  }
  if (r.maxDamage !== undefined && attacked.damage > r.maxDamage) return false
  if (r.minDamage !== undefined && attacked.damage < r.minDamage) return false
  if (r.cardTitles && !r.cardTitles.includes(attacked.name)) return false
  return true
}

/**
 * Manual reversal: the defender picks ANY card from hand to reverse. The
 * reversal always goes to the defender's Ringside pile (no placement prompt).
 * The attacker's card goes to Ringside and the attacker's turn does NOT end:
 * it stays in "main" so effects can be resolved and the attacker ends the
 * turn voluntarily with the "Terminar turno" button.
 */
export function playReversal(
  state: GameState,
  defenderIdx: number,
  reversalIds: string[],
): string | null {
  const res = state.resolution
  if (!res) return 'No active card to reverse.'
  const defender = state.players[defenderIdx]
  if (!defender) return 'No defender.'
  if (!res.waitingHandReversal && !res.partialReversal) return 'No reversal window open.'
  if (state.activeIndex === defenderIdx) return 'You cannot reverse your own card.'

  const firstId = reversalIds[0]!
  const firstHandIdx = defender.hand.indexOf(firstId)
  const firstBacklashIdx = defender.backlashMid.indexOf(firstId)
  if (firstHandIdx < 0 && firstBacklashIdx < 0) return 'Card is not in your hand or Backlash deck.'
  if (firstHandIdx >= 0) {
    defender.hand.splice(firstHandIdx, 1)
  } else {
    defender.backlashMid.splice(firstBacklashIdx, 1)
  }

  const rev = getCard(firstId)
  const attacker = state.players[res.attacker]
  if (!attacker) return 'No attacker.'

  const cameFromBacklash = firstBacklashIdx >= 0
  if (cameFromBacklash) {
    defender.midmatchPlayed.push(firstId)
  } else {
    defender.ring.push(firstId)
    defender.fortitude = computeFortitude([...defender.midmatchPlayed, ...defender.ring], getCard)
  }

  if (rev.effect && rev.effect.length > 0) {
  }

  for (let i = 1; i < reversalIds.length; i++) {
    const extraId = reversalIds[i]!
    const hi = defender.hand.indexOf(extraId)
    const bi = defender.backlashMid.indexOf(extraId)
    if (hi >= 0) {
      defender.hand.splice(hi, 1)
      defender.ring.push(extraId)
    } else if (bi >= 0) {
      defender.backlashMid.splice(bi, 1)
      defender.midmatchPlayed.push(extraId)
    }
  }
  defender.fortitude = computeFortitude([...defender.midmatchPlayed, ...defender.ring], getCard)

  attacker.ringside.push(res.cardId)

  attacker.reversedLastTurn = true
  defender.reversedLastTurn = false

  state.pendingDecision = { type: 'reversalPlayed', attackerIdx: res.attacker, reversalCardIds: reversalIds }
  state.pendingEffects = null
  state.phase = 'main'
  return null
}

/**
 * Wraps up a fully successful hand reversal (no damage to pay, or the manual
 * overturn already finished): clears the resolution and ends the attacker's
 * turn.
 */
function finishReversalCleanup(state: GameState, defenderIdx: number, _rev: CardDef): void {
  const res = state.resolution
  if (!res) return
  const defender = state.players[defenderIdx]
  const attacker = state.players[res.attacker]
  if (!defender || !attacker) return

  attacker.reversedLastTurn = true
  defender.reversedLastTurn = false

  // Stun value of the reversed card.
  const attacked = getCard(res.cardId)
  if (attacked.stun && !res.overturning) {
    const p = state.players[res.attacker]
    if (p) drawCards(p, attacked.stun, getCard)
  }

  state.resolution = null
  state.pendingDecision = null
  state.pendingEffects = null
  // Same as playReversal: the attacker ends their turn voluntarily.
  state.phase = 'main'
}

// ---------------------------------------------------------------------------
// DAMAGE / OVERTURNING
// ---------------------------------------------------------------------------

export function passReversal(state: GameState): void {
  const res = state.resolution
  if (!res) return
  if (!res.waitingHandReversal) return
  const d = state.pendingDecision
  const isMulti = state.players.length > 2
  if (isMulti && d && d.type === 'reversalChoice' && d.reversedPlayers && d.playerChoices) {
    const actingIdx = d.defenderIdx
    d.playerChoices[actingIdx] = null
    d.reversedPlayers.push(actingIdx)
    const eligible = state.players
      .map((_, i) => i)
      .filter((i) => i !== res!.attacker && !state.players[i]!.eliminated)
    const allDone = eligible.every((i) => d.reversedPlayers!.includes(i))
    if (allDone) {
      res.waitingHandReversal = false
      beginManualOverturn(state, res.target, 'damage')
    }
    return
  }
  res.waitingHandReversal = false
  beginManualOverturn(state, res.target, 'damage')
}

/**
 * Begins a fully manual damage phase. The defender (or attacker, for reversal
 * damage) must overturn cards from their Arsenal one at a time; every flip is
 * shown so the players read each card. No card effect is resolved
 * automatically — the card text is exposed and the players execute it by hand.
 */
function beginManualOverturn(state: GameState, defenderIdx: number, purpose: 'damage' | 'reversal'): void {
  const res = state.resolution
  if (!res) return
  const attacker = state.players[res.attacker]
  const defender = state.players[defenderIdx]
  if (!attacker || !defender) return
  const card = getCard(res.cardId)

  // Effects are NEVER applied automatically: print the text so the players
  // execute it manually on the table.
  if (card.effect && card.effect.length > 0) {
  }
  state.pendingEffects = null

  const bonus = state.turnBonus
  let damageDelta = 0
  if (bonus) {
    damageDelta = bonus.damageDelta
    state.turnBonus = null
  }
  const damageToDeal = Math.max(0, card.damage + (purpose === 'damage' ? damageDelta : 0))

  res.damageToDeal = damageToDeal
  res.overturning = true
  state.phase = 'overturning'

  // Manual mode: ALWAYS offer the overturn (even for 0 printed damage), so the
  // defender can choose to send cards to their Ringside voluntarily.
  if (damageToDeal === 0) {
    if (purpose === 'reversal') {
      finishReversalCleanup(state, defenderIdx, card)
      return
    }
  } else {
  }
  res.damageDealt = 0
  state.pendingDecision = {
    type: 'overturnCards',
    playerIdx: defenderIdx,
    cardId: res.cardId,
    damageToDeal,
    overturned: 0,
    purpose,
    voluntary: true,
  }
}

/**
 * Flip one card of the volunteer's Arsenal face-up to their Ringside (manual,
 * self-chosen damage). Called from applyDecision with payload 'flip'. The
 * overturn is NEVER forced: after each flip (or before any), the player may
 * stop via stopOverturnCard. Every flip is logged so the UI shows the card.
 */
export function flipOverturnCard(state: GameState, playerIdx: number): string | null {
  const res = state.resolution
  const p = state.players[playerIdx]
  if (!res || !p) return 'No active overturn.'
  if (!res.overturning) return 'No overturn in progress.'
  const d = state.pendingDecision
  if (!d || d.type !== 'overturnCards') return 'No overturn pending.'
  if (d.playerIdx !== playerIdx) return 'Not your overturn.'

  if (p.arsenal.length === 0) {
    return 'Arsenal vacío — no podés voltear más cartas.'
  }

  const top = p.arsenal.shift()
  if (!top) return 'No card to overturn.'
  p.ringside.push(top)
  d.overturned += 1
  res.damageDealt = d.overturned

  // Stay in the overturn decision: the player chooses to flip more or stop.
  state.pendingDecision = { ...d }
  return null
}

/**
 * Voluntarily stop taking damage (or finish the reversal-damage phase). The
 * player keeps whatever cards they already flipped (or none). Called from
 * applyDecision with payload 'stop'.
 */
export function stopOverturnCard(state: GameState, playerIdx: number): string | null {
  const res = state.resolution
  const p = state.players[playerIdx]
  if (!res || !p) return 'No active overturn.'
  if (!res.overturning) return 'No overturn in progress.'
  const d = state.pendingDecision
  if (!d || d.type !== 'overturnCards') return 'No overturn pending.'
  if (d.playerIdx !== playerIdx) return 'Not your overturn.'

  res.overturning = false
  state.pendingDecision = null
  if (d.purpose === 'reversal') {
    finishReversalCleanup(state, d.playerIdx, getCard(d.cardId))
    return null
  }
  succeedCard(state, res.attacker, playerIdx)
  // If the defender has no Arsenal left after the overturn, the attacker wins this matchup.
  const defender = state.players[playerIdx]
  if (defender && defender.arsenal.length === 0) {
    eliminate(state, playerIdx, 'pin')
    // Game continues if other players remain; checkGameOver handles it.
  }
  return null
}

function succeedCard(
  state: GameState,
  attackerIdx: number,
  defenderIdx: number,
  opts?: { keepTurn?: boolean },
): void {
  const res = state.resolution
  const attacker = state.players[attackerIdx]
  const defender = state.players[defenderIdx]
  if (!res || !attacker || !defender) return
  const card = getCard(res.cardId)

  const fromBacklash = res.source === 'midmatch' || res.source === 'prematch'

  if (fromBacklash) {
    // Mid-match / Pre-match cards stay in the player's Mid-match zone.
    attacker.midmatchPlayed.push(res.cardId)
    attacker.fortitude = computeFortitude([...attacker.midmatchPlayed, ...attacker.ring], getCard)
  } else {
    // The successful card stays in the attacker's Ring and raises Fortitude.
    attacker.ring.push(res.cardId)
    attacker.fortitude = computeFortitude([...attacker.midmatchPlayed, ...attacker.ring], getCard)
  }
  attacker.lastSuccessfullyPlayed = { cardId: res.cardId, damage: res.damageDealt }
  attacker.playedThisTurn.push(res.cardId)

  // Stun value: attacker draws if reversed while overturning.
  if (res.ended && res.overturning) {
    if (card.stun && attacker.arsenal.length > 0) {
      drawCards(attacker, card.stun, getCard)
    }
    attacker.reversedLastTurn = false
    state.resolution = null
    state.pendingDecision = null
    state.pendingEffects = null
    endTurn(state)
    return
  }

  const keepTurn = opts?.keepTurn ?? true
  state.resolution = null
  state.pendingDecision = null
  state.pendingEffects = null
  if (keepTurn) {
    state.phase = 'main'
  } else {
    endTurn(state)
  }
}

// ---------------------------------------------------------------------------
// DECISION RESOLUTION
// ---------------------------------------------------------------------------

export function applyDecision(state: GameState, decision: PendingDecision, payload: unknown): string | null {
  switch (decision.type) {
    case 'reversalChoice': {
      const isMulti = state.players.length > 2
      const d = state.pendingDecision
      const res = state.resolution
      if (isMulti && d && d.type === 'reversalChoice' && d.reversedPlayers && d.playerChoices && res) {
        const actingIdx = decision.defenderIdx
        if (payload === null) {
          d.playerChoices[actingIdx] = null
          d.reversedPlayers.push(actingIdx)
          const eligible = state.players
            .map((_, i) => i)
            .filter((i) => i !== res!.attacker && !state.players[i]!.eliminated)
          const allDone = eligible.every((i) => d.reversedPlayers!.includes(i))
          if (allDone) {
            res.waitingHandReversal = false
            beginManualOverturn(state, res.target, 'damage')
          }
          return null
        }
        const p = payload as { cardIds: string[] }
        const ids = p.cardIds
        if (!Array.isArray(ids) || ids.length === 0) return 'No reversal cards selected.'
        const err = playReversal(state, actingIdx, ids)
        if (err) return err
        return null
      }
      if (payload === null) {
        passReversal(state)
      } else {
        const p = payload as { cardIds: string[] }
        const ids = p.cardIds
        if (!Array.isArray(ids) || ids.length === 0) return 'No reversal cards selected.'
        const err = playReversal(state, decision.defenderIdx, ids)
        if (err) return err
      }
      return null
    }

    case 'reversalPlayed': {
      state.resolution = null
      state.pendingDecision = null
      state.phase = 'main'
      return null
    }

    case 'chooseCardsFromHand': {
      const selected = payload as string[]
      const p = state.players[decision.playerIdx]
      if (!p) return 'No player.'
      const count = decision.count === 0 ? selected.length : decision.count
      if (decision.count !== 0 && selected.length !== Math.min(count, p.hand.length)) {
        return 'Incorrect number of cards selected.'
      }
      for (const id of selected) {
        const idx = p.hand.indexOf(id)
        if (idx >= 0) {
          p.hand.splice(idx, 1)
          p.ringside.push(id)
        }
      }
      if (decision.purpose === 'switch') {
        let n = 0
        while (n < selected.length && p.ringside.length > 0) {
          const c = p.ringside.pop()
          if (c) p.hand.push(c)
          n++
        }
      }
      state.pendingDecision = null
      resolveNextEffect(state)
      return null
    }

    case 'chooseOpponentHandCard': {
      const cardId = payload as string
      const p = state.players[decision.playerIdx]
      if (!p) return 'No player.'
      const idx = p.hand.indexOf(cardId)
      if (idx < 0) return 'Card not found in hand.'
      p.hand.splice(idx, 1)
      p.ringside.push(cardId)
      state.pendingDecision = null
      resolveNextEffect(state)
      return null
    }

    case 'chooseRingsideCards': {
      const selected = payload as string[]
      const p = state.players[decision.playerIdx]
      if (!p) return 'No player.'
      if (selected.length !== Math.min(decision.count, p.ringside.length)) {
        return 'Incorrect number of cards selected.'
      }
      for (const id of selected) {
        const idx = p.ringside.indexOf(id)
        if (idx >= 0) {
          p.ringside.splice(idx, 1)
          p.hand.push(id)
        }
      }
      state.pendingDecision = null
      resolveNextEffect(state)
      return null
    }

    case 'searchArsenal': {
      const picks = (Array.isArray(payload) ? payload : [payload]) as string[]
      const p = state.players[decision.playerIdx]
      if (!p) return 'No player.'
      const pool = state._searchPool ?? []
      const moved: string[] = []
      for (const cardId of picks) {
        if (pool.length > 0 && !pool.includes(cardId)) continue
        const idx = p.arsenal.indexOf(cardId)
        if (idx >= 0) {
          p.arsenal.splice(idx, 1)
          p.hand.push(cardId)
          moved.push(cardId)
        }
      }
      if (moved.length > 0) {
      }
      state._searchPool = undefined
      state.pendingDecision = null
      resolveNextEffect(state)
      return null
    }

    case 'reorderOpponentArsenal': {
      const ordered = payload as string[]
      const p = state.players[decision.playerIdx]
      if (!p) return 'No player.'
      const target = pickDefaultTarget(state, decision.playerIdx)
      if (target === null) return 'No target.'
      const tp = state.players[target]
      if (!tp) return 'No target.'
      const top = tp.arsenal.slice(0, decision.amount)
      if (ordered.length !== top.length || new Set(ordered).size !== top.length) {
        return 'Invalid reordering.'
      }
      if (!ordered.every((id) => top.includes(id))) return 'Invalid reordering.'
      tp.arsenal = [...ordered, ...tp.arsenal.slice(decision.amount)]
      state.pendingDecision = null
      resolveNextEffect(state)
      return null
    }

    case 'overturnCards': {
      if (payload === 'flip') {
        return flipOverturnCard(state, decision.playerIdx)
      }
      if (payload === 'stop') {
        return stopOverturnCard(state, decision.playerIdx)
      }
      return 'Unknown overturn action.'
    }

    case 'chooseTarget': {
      return resolveTarget(state, payload as number)
    }

    case 'concedeChoice': {
      const acceptLoss = payload === true
      if (acceptLoss) {
        state.pendingDecision = null
        eliminate(state, decision.playerIdx, decision.reason)
      } else {
        state.pendingDecision = null
        // Count Out was declined: continue the turn flow (the affected player
        // keeps playing manually).
        if (decision.reason === 'countout') {
          advanceTurn(state)
        }
      }
      return null
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// MANUAL TABLE ACTIONS (house rules / player convenience)
// ---------------------------------------------------------------------------

export type ManualZone = 'hand' | 'arsenal' | 'ring' | 'ringside' | 'midmatch' | 'backlashMid' | 'out'

function zoneList(p: PlayerState, zone: ManualZone): string[] {
  switch (zone) {
    case 'hand':
      return p.hand
    case 'arsenal':
      return p.arsenal
    case 'ring':
      return p.ring
    case 'ringside':
      return p.ringside
    case 'midmatch':
      return p.midmatchPlayed
    case 'backlashMid':
      return p.backlashMid
    case 'out':
      return p.outOfGame
  }
}

/** Move any cards between any of a player's zones (house rule). Recomputes Fortitude. */
export function manualMoveCards(
  state: GameState,
  playerIdx: number,
  from: ManualZone,
  to: ManualZone,
  cardIds: string[],
): string | null {
  const p = state.players[playerIdx]
  if (!p) return 'No player.'
  if (from === to) return 'La zona de origen y destino son iguales.'
  const src = zoneList(p, from)
  const dst = zoneList(p, to)
  const ids = cardIds.filter((id) => src.includes(id))
  if (ids.length === 0) return 'No hay cartas seleccionadas en esa zona.'
  for (const id of ids) {
    const i = src.indexOf(id)
    if (i >= 0) src.splice(i, 1)
  }
  dst.push(...ids)
  if (from === 'ring' || to === 'ring' || from === 'midmatch' || to === 'midmatch') {
    p.fortitude = computeFortitude([...p.midmatchPlayed, ...p.ring], getCard)
  }
  return null
}

/** Return cards from a player's Ringside pile back into their Arsenal. */
export function manualRingToArsenal(
  state: GameState,
  playerIdx: number,
  cardIds: string[],
): string | null {
  const p = state.players[playerIdx]
  if (!p) return 'No player.'
  const ids = cardIds.filter((id) => p.ringside.includes(id))
  if (ids.length === 0) return 'No Ringside cards selected.'
  for (const id of ids) {
    const i = p.ringside.indexOf(id)
    if (i >= 0) p.ringside.splice(i, 1)
  }
  p.arsenal.push(...ids)
  return null
}

/** Move cards from Ring / Ringside / Hand back into the Arsenal (house rule). */
export function manualZoneToArsenal(
  state: GameState,
  playerIdx: number,
  zone: 'ring' | 'ringside' | 'hand',
  cardIds: string[],
): string | null {
  const p = state.players[playerIdx]
  if (!p) return 'No player.'
  const list = zone === 'ring' ? p.ring : zone === 'ringside' ? p.ringside : p.hand
  const ids = cardIds.filter((id) => list.includes(id))
  if (ids.length === 0) return 'No cards selected from that zone.'
  for (const id of ids) {
    const i = list.indexOf(id)
    if (i >= 0) list.splice(i, 1)
  }
  p.arsenal.push(...ids)
  if (zone === 'ring') p.fortitude = computeFortitude([...p.midmatchPlayed, ...p.ring], getCard)
  return null
}

/** Draw a number of cards from the Arsenal into the hand (house rule). */
export function manualDrawFromArsenal(state: GameState, playerIdx: number, count: number): string | null {
  const p = state.players[playerIdx]
  if (!p) return 'No player.'
  if (!Number.isInteger(count) || count < 1) return 'Invalid number of cards to draw.'
  const n = Math.min(count, p.arsenal.length)
  if (n <= 0) return 'Arsenal is empty.'
  for (let i = 0; i < n; i++) {
    const c = p.arsenal.shift()
    if (c) p.hand.push(c)
  }
  return null
}

/** Shuffle a player's Arsenal pile (house-rule convenience). */
export function manualShuffleArsenal(state: GameState, playerIdx: number): void {
  const p = state.players[playerIdx]
  if (!p) return
  for (let i = p.arsenal.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = p.arsenal[i]!
    p.arsenal[i] = p.arsenal[j]!
    p.arsenal[j] = tmp
  }
}

/** Reorder the player's Arsenal (house-rule): `orderedIds` must be a
 * permutation of the current Arsenal contents. */
export function manualReorderArsenal(
  state: GameState,
  playerIdx: number,
  orderedIds: string[],
): string | null {
  const p = state.players[playerIdx]
  if (!p) return 'No player.'
  if (orderedIds.length !== p.arsenal.length) return 'La carta ordenada no coincide con el Arsenal.'
  const idSet = new Set(p.arsenal)
  for (const id of orderedIds) {
    if (!idSet.has(id)) return 'La carta ordenada no coincide con el Arsenal.'
  }
  p.arsenal = [...orderedIds]
  return null
}

/** Show one player's hand to a specific opponent (or hide it with null). */
export function manualRevealHand(state: GameState, playerIdx: number, targetIdx: number | null): void {
  const p = state.players[playerIdx]
  if (!p) return
  if (targetIdx !== null && (targetIdx === playerIdx || targetIdx < 0 || targetIdx >= state.players.length)) {
    return
  }
  p.handRevealedTo = targetIdx
}

/**
 * Activate the effect of a card sitting in the active player's Ring area or
 * Mid-match zone (ACE / persistent effects). The card stays where it is and
 * its structured effect (if any) is resolved. Returns an error string, or null
 * on success.
 */
export function activateRingCard(state: GameState, playerIdx: number, cardId: string): string | null {
  const p = state.players[playerIdx]
  if (!p) return 'No player.'
  if (state.phase !== 'main') return 'You can only activate effects during your Main Segment.'
  if (state.activeIndex !== playerIdx) return 'It is not your turn.'
  let idx = p.ring.indexOf(cardId)
  if (idx < 0) {
    idx = p.midmatchPlayed.indexOf(cardId)
  }
  if (idx < 0) return 'That card is not in your Ring or Mid-match area.'
  const card = getCard(cardId)
  if (!card.effect || card.effect.length === 0) return `"${card.name}" has no activatable effect.`

  // Effects are never applied automatically — the players read and execute
  // the card text by hand.
  if (card.effect && card.effect.length > 0) {
  }
  state.pendingEffects = null
  void idx
  return null
}

/** Remove cards from a zone to the Out-Of-Game pile (house rule). */
export function manualRemoveFromZone(
  state: GameState,
  playerIdx: number,
  cardIds: string[],
  zone: 'hand' | 'ring' | 'ringside',
): string | null {
  const p = state.players[playerIdx]
  if (!p) return 'No player.'
  const list = zone === 'hand' ? p.hand : zone === 'ring' ? p.ring : p.ringside
  const ids = cardIds.filter((id) => list.includes(id))
  if (ids.length === 0) return 'No cards selected.'
  for (const id of ids) {
    const i = list.indexOf(id)
    if (i >= 0) list.splice(i, 1)
  }
  p.outOfGame.push(...ids)
  if (zone === 'ring') p.fortitude = computeFortitude([...p.midmatchPlayed, ...p.ring], getCard)
  return null
}