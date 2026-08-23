import type { CardEffect } from '../data/types'
import { getCard } from '../data/cards'
import type { GameState, PendingEffects } from './types'
import { countTrait, isChainCard } from './rules'

function computeAmount(state: GameState, player: number, amount: number | string): number {
  if (typeof amount === 'number') return amount
  if (amount === 'chainManeuversInRing') {
    const p = state.players[player]
    if (!p) return 0
    const n = countTrait(p.ring, 'Chain', getCard)
    return Math.min(n, 3)
  }
  if (amount === 'uniqueCardsInRing') {
    const p = state.players[player]
    if (!p) return 0
    return p.ring.filter((id) => getCard(id).traits?.includes('Unique')).length
  }
  return 0
}

/**
 * Resolves the next pending effect in the queue. When an effect needs player
 * input it sets `state.pendingDecision` and returns; the store resumes by
 * calling this again after the decision is resolved.
 */
export function resolveNextEffect(state: GameState): void {
  const q: PendingEffects | null = state.pendingEffects
  if (!q) return
  const source = state.players[q.sourcePlayer]
  if (!source) {
    state.pendingEffects = null
    return
  }
  const effect: CardEffect | undefined = q.effects[q.index]
  if (!effect) {
    state.pendingEffects = null
    return
  }
  q.index += 1

  switch (effect.kind) {
    case 'youDraw': {
      let drawn = 0
      while (drawn < effect.amount && source.arsenal.length > 0) {
        const c = source.arsenal.shift()
        if (c) source.hand.push(c)
        drawn++
      }
      break
    }

    case 'opponentOverturns': {
      const target = pickTarget(state, q.sourcePlayer)
      if (target === null) break
      const amt = computeAmount(state, q.sourcePlayer, effect.amount)
      const p = state.players[target]
      if (!p) break
      let n = 0
      while (n < amt && p.arsenal.length > 0) {
        const c = p.arsenal.shift()
        if (c) p.ringside.push(c)
        n++
      }
      if (n < amt) {
        eliminate(state, target, 'pin', q.sourcePlayer)
      }
      break
    }

    case 'youDiscard': {
      // Discards come from the end of the hand; the UI exposes manual discards elsewhere.
      let n = 0
      while (n < effect.amount && source.hand.length > 0) {
        const c = source.hand.pop()
        if (c) source.ringside.push(c)
        n++
      }
      break
    }

    case 'opponentDiscards': {
      const target = pickTarget(state, q.sourcePlayer)
      if (target === null) break
      const amt = computeAmount(state, q.sourcePlayer, effect.amount)
      if (amt <= 0) break
      if (state.players[target]?.isAI) {
        const p = state.players[target]
        let n = 0
        while (n < amt && p.hand.length > 0) {
          const c = p.hand.pop()
          if (c) p.ringside.push(c)
          n++
        }
      } else {
        state.pendingDecision = { type: 'chooseCardsFromHand', playerIdx: target, count: amt, purpose: 'discard' }
        return
      }
      break
    }

    case 'shuffleRingsideToArsenal': {
      const amt = computeAmount(state, q.sourcePlayer, effect.amount)
      let n = 0
      while (n < amt && source.ringside.length > 0) {
        const c = source.ringside.pop()
        if (c) source.arsenal.push(c)
        n++
      }
      break
    }

    case 'ringsideToHand': {
      if (source.isAI) {
        let n = 0
        while (n < effect.amount && source.ringside.length > 0) {
          const c = source.ringside.pop()
          if (c) source.hand.push(c)
          n++
        }
      } else {
        state.pendingDecision = {
          type: 'chooseRingsideCards',
          playerIdx: q.sourcePlayer,
          count: Math.min(effect.amount, source.ringside.length),
          to: 'hand',
        }
        return
      }
      break
    }

    case 'searchArsenalToHand': {
      if (source.isAI) {
        const candidates = source.arsenal.filter((id) => matchesSearch(getCard(id), effect.filter))
        let n = 0
        while (n < effect.amount && candidates.length > 0) {
          const c = candidates.pop()
          if (!c) break
          const idx = source.arsenal.indexOf(c)
          if (idx >= 0) {
            source.arsenal.splice(idx, 1)
            source.hand.push(c)
          }
          n++
        }
      } else {
        const candidates = source.arsenal.filter((id) => matchesSearch(getCard(id), effect.filter))
        const count = Math.min(effect.amount, candidates.length)
        state.pendingEffects = null
        state.pendingDecision = {
          type: 'searchArsenal',
          playerIdx: q.sourcePlayer,
          count,
        }
        state._searchPool = candidates
        return
      }
      break
    }

    case 'lookAtOpponentHand': {
      break
    }

    case 'opponentDiscardsChosenFromHand': {
      const target = pickTarget(state, q.sourcePlayer)
      if (target === null) break
      if (state.players[target]?.isAI) {
        const p = state.players[target]
        if (p.hand.length > 0) {
          const c = p.hand.pop()
          if (c) p.ringside.push(c)
        }
      } else {
        state.pendingDecision = { type: 'chooseOpponentHandCard', playerIdx: target }
        return
      }
      break
    }

    case 'lookAtOpponentArsenal': {
      if (state.players[q.sourcePlayer]?.isAI) {
        // AI keeps order.
      } else {
        state.pendingDecision = {
          type: 'reorderOpponentArsenal',
          playerIdx: q.sourcePlayer,
          amount: effect.amount,
        }
        return
      }
      break
    }

    case 'nextCardBonus': {
      const prev = state.turnBonus
      state.turnBonus = {
        damageDelta: effect.damageDelta ?? (prev?.damageDelta ?? 0),
        fortitudeDelta: effect.fortitudeDelta ?? (prev?.fortitudeDelta ?? 0),
        cannotBeReversed: effect.cannotBeReversed === true || (prev?.cannotBeReversed ?? false),
        cannotBeTitled: effect.cannotBeTitled ?? prev?.cannotBeTitled,
        countAsSetUp: effect.countAsSetUp === true || (prev?.countAsSetUp ?? false),
      }
      break
    }

    case 'opponentCannotPlayCardTitled': {
      break
    }

    case 'gainFortitude': {
      source.fortitude += effect.amount
      break
    }

    case 'stun': {
      let n = 0
      while (n < effect.amount && source.arsenal.length > 0) {
        const c = source.arsenal.shift()
        if (c) source.hand.push(c)
        n++
      }
      break
    }

    case 'discardThenRingsideToHand': {
      // The Switch — interactive even for AI when possible.
      if (source.isAI) {
        const count = Math.min(3, source.hand.length)
        let n = 0
        while (n < count && source.hand.length > 0) {
          const c = source.hand.pop()
          if (c) source.ringside.push(c)
          n++
        }
        n = 0
        while (n < count && source.ringside.length > 0) {
          const c = source.ringside.pop()
          if (c) source.hand.push(c)
          n++
        }
      } else {
        state.pendingDecision = { type: 'chooseCardsFromHand', playerIdx: q.sourcePlayer, count: 0, purpose: 'switch' }
        return
      }
      break
    }
  }
}

export function matchesSearch(c: import('../data/types').CardDef, filter: string): boolean {
  switch (filter) {
    case 'any':
      return true
    case 'unique':
      return c.traits?.includes('Unique') === true
    case 'nonUnique':
      return c.traits?.includes('Unique') !== true
    case 'chainManeuver':
      return c.type === 'Maneuver' && isChainCard(c)
    case 'submission':
      return c.subtypes?.includes('Submission') === true
    case 'chain':
      return isChainCard(c)
    default:
      return true
  }
}

function pickTarget(state: GameState, attacker: number): number | null {
  const res = state.resolution
  if (res) return res.target
  // Outside a resolution, pick the next non-eliminated player after the attacker.
  const n = state.players.length
  for (let i = 1; i < n; i++) {
    const idx = (attacker + i) % n
    const p = state.players[idx]
    if (p && !p.eliminated) return idx
  }
  return null
}

export function eliminate(state: GameState, idx: number, reason: 'pin' | 'countout', _by?: number): void {
  const p = state.players[idx]
  if (!p || p.eliminated) return
  p.eliminated = true
  p.eliminatedReason = reason
  checkGameOver(state)
}

export function checkGameOver(state: GameState): void {
  const alive = state.players.filter((p) => !p.eliminated)
  if (alive.length <= 1) {
    state.phase = 'gameover'
    const w = alive[0]
    if (w) {
      state.winner = [state.players.indexOf(w)]
      const loser = state.players.find((p) => p.eliminated)
      state.winType = (loser?.eliminatedReason ?? 'countout') as 'pin' | 'countout'
    } else {
      state.winner = []
      state.winType = 'draw'
    }
  }
}