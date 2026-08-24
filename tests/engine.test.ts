import { describe, it, expect, beforeEach } from 'vitest'
import { getCard, getSuperstar, KURT_CARDS, GENERIC_CARDS, KURT_BACKLASH_CARDS } from '../src/data/cards'
import { validateDeck, validateBacklashDeck, computeFortitude, getCopiesLimit, dealDamage } from '../src/engine/rules'
import { buildClientView } from '../src/online/types'
import {
  newGame,
  startMatch,
  keepOpeningHand,
  playCard,
  passPrematch,
  applyDecision,
  endTurn,
  passReversal,
  getValidPlays,
  startTurn,
  manualRevealHand,
  type NewGameConfig,
} from '../src/engine/game'
import type { GameState } from '../src/engine/types'

const KICK = 'gen-kick'
const CLOTHESLINE = 'punch'
const ELBOW = 'gen-elbow-to-the-face'

function make2p(arsenalA: string[], arsenalB: string[]): GameState {
  const cfg: NewGameConfig = {
    players: [
      { name: 'A', superstarId: 'kurt-angle', arsenal: arsenalA, backlashPre: [], backlashMid: [] },
      { name: 'B', superstarId: 'mankind', arsenal: arsenalB, backlashPre: [], backlashMid: [] },
    ],
  }
  return newGame(cfg)
}

function startGame(arsenalA: string[], arsenalB: string[]): GameState {
  const g = make2p(arsenalA, arsenalB)
  startMatch(g)
  return g
}

const deckCheck = (id: string) => {
  const s = getSuperstar(id)
  return { name: s.name, alignment: s.alignment, gender: s.gender, brand: s.brand }
}

describe('deck construction', () => {
  it('rejects 60 copies of the same card (3-copy limit)', () => {
    const deck = Array(60).fill('gen-kick')
    const res = validateDeck(deck, 'kurt-angle', getCard, deckCheck)
    expect(res.valid).toBe(false)
  })

  it('rejects more than 3 copies of a non Set-up card', () => {
    const deck = [...Array(4).fill('gen-kick'), ...Array(56).fill('gen-elbow-to-the-face')]
    const res = validateDeck(deck, 'kurt-angle', getCard, deckCheck)
    expect(res.issues.some((i) => i.code === 'max-copies')).toBe(true)
  })

  it('allows unlimited Set-up cards', () => {
    expect(getCopiesLimit(getCard('between-the-ropes'))).toBe(Infinity)
  })

  it('allows mixing Face and Heel for a Both-alignment superstar', () => {
    const mix = [...Array(30).fill('kurt-armed-dangerous'), ...Array(30).fill('kurt-handcuffed')]
    const res = validateDeck(mix, 'kurt-angle', getCard, deckCheck)
    expect(res.issues.some((i) => i.code === 'face-heel')).toBe(false)
  })

  it('rejects a 59-card deck', () => {
    const deck = Array(59).fill('gen-kick')
    const res = validateDeck(deck, 'kurt-angle', getCard, deckCheck)
    expect(res.issues.some((i) => i.code === 'deck-size')).toBe(true)
  })

  it('validates backlash deck limits', () => {
    const pre = Array(11).fill('kurt-hold-on')
    const res = validateBacklashDeck(pre, [], getCard)
    expect(res.issues.some((i) => i.code === 'backlash-pre')).toBe(true)
  })
})

describe('fortitude & damage', () => {
  it('computes fortitude from printed Damage (the D box) in the Ring and Mid-match', () => {
    const ring = ['gen-kick', 'kurt-atomic-driver'] // Kick D=5 + Atomic Driver D=12 = 17
    expect(computeFortitude(ring, getCard)).toBe(17)
    expect(computeFortitude(['gen-kick', ...ring], getCard)).toBe(22) // extra Mid-match Kick (D=5) adds 5
  })

  it('dealDamage overturns cards from Arsenal to Ringside', () => {
    const g = startGame([KICK], [CLOTHESLINE, 'kurt-armed-dangerous'])
    const p = g.players[1]!
    p.arsenal = [CLOTHESLINE, 'kurt-armed-dangerous']
    const overturned = dealDamage(p, 1)
    expect(overturned.length).toBe(1)
    expect(p.arsenal.length).toBe(1)
    expect(p.ringside.length).toBe(1)
  })
})

describe('playing cards and reversal window', () => {
  it('plays a 0F card and deals voluntary damage when not reversed', () => {
    const g = startGame(Array(10).fill(KICK), Array(10).fill(CLOTHESLINE))
    g.players[0]!.hand = [KICK]
    g.players[1]!.hand = []
    g.players[1]!.arsenal = [CLOTHESLINE, CLOTHESLINE, CLOTHESLINE]
    const err = playCard(g, 0, KICK)
    expect(err).toBeNull()
    expect(g.phase).toBe('reversalWindow')
    passReversal(g)
    // Voluntary overturn: defender flips cards one at a time (KICK prints 5).
    expect(g.pendingDecision?.type).toBe('overturnCards')
    for (let i = 0; i < 3; i++) {
      const d = g.pendingDecision
      if (d && d.type === 'overturnCards') applyDecision(g, d, 'flip')
    }
    // After 3 flips (less than printed damage) the decision is STILL open.
    expect(g.pendingDecision?.type).toBe('overturnCards')
    const dStop = g.pendingDecision
    if (dStop && dStop.type === 'overturnCards') applyDecision(g, dStop, 'stop')
    expect(g.players[1]!.arsenal.length).toBe(0)
    expect(g.players[1]!.ringside.length).toBe(3)
    expect(g.players[0]!.ring).toContain(KICK)
    expect(g.players[0]!.fortitude).toBe(5) // Kick prints 5D, so Fortitude Rating = 5
    expect(g.phase).toBe('main')
  })

  it('allows the defender to voluntarily take LESS damage than printed', () => {
    const g = startGame(Array(10).fill(KICK), Array(10).fill(CLOTHESLINE))
    g.players[0]!.hand = [KICK]
    g.players[1]!.hand = []
    g.players[1]!.arsenal = [CLOTHESLINE, CLOTHESLINE, CLOTHESLINE]
    const err = playCard(g, 0, KICK)
    expect(err).toBeNull()
    expect(g.phase).toBe('reversalWindow')
    passReversal(g)
    expect(g.pendingDecision?.type).toBe('overturnCards')
    const d0 = g.pendingDecision
    if (d0 && d0.type === 'overturnCards') applyDecision(g, d0, 'flip') // 1 card only
    const d1 = g.pendingDecision
    if (d1 && d1.type === 'overturnCards') applyDecision(g, d1, 'stop')
    expect(g.players[1]!.ringside.length).toBe(1)
    expect(g.players[1]!.arsenal.length).toBe(2)
    expect(g.players[0]!.ring).toContain(KICK)
    expect(g.phase).toBe('main')
  })

  it('lets the defender reverse from hand with any card, choosing its zone, and the attacker continues their turn voluntarily', () => {
    const g = startGame(Array(10).fill(KICK), Array(10).fill(CLOTHESLINE))
    g.players[0]!.hand = [KICK]
    g.players[1]!.hand = [ELBOW]
    g.players[0]!.arsenal = [KICK, KICK, KICK]
    g.players[0]!.hand = [KICK]
    const perr = playCard(g, 0, KICK)
    expect(perr).toBeNull()
    const err = applyDecision(
      g,
      { type: 'reversalChoice', defenderIdx: 1, cardId: KICK },
      { cardId: ELBOW, zone: 'ring' },
    )
    expect(err).toBeNull()
    expect(g.players[1]!.ring).toContain(ELBOW)
    expect(g.players[0]!.ringside).toContain(KICK)
    // Manual mode: no auto reversal damage, and the attacker's turn does NOT
    // auto-end — they finish it with the "Terminar turno" button.
    expect(g.activeIndex).toBe(0)
    expect(g.phase).toBe('main')
    endTurn(g)
    expect(g.activeIndex).toBe(1)
  })

  it('places the reversal in Ring Area (not Ringside), keeping the attacker turn active', () => {
    const g = startGame(Array(10).fill(KICK), Array(10).fill(CLOTHESLINE))
    g.players[0]!.hand = [KICK]
    g.players[1]!.hand = [ELBOW]
    playCard(g, 0, KICK)
    const err = applyDecision(
      g,
      { type: 'reversalChoice', defenderIdx: 1, cardId: KICK },
      { cardId: ELBOW },
    )
    expect(err).toBeNull()
    expect(g.players[1]!.ring).toContain(ELBOW)
    expect(g.players[0]!.ringside).toContain(KICK)
    expect(g.activeIndex).toBe(0)
    expect(g.phase).toBe('main')
  })

  it('flips overturn cards one at a time, face-up to Ringside', () => {
    const g = startGame(Array(10).fill(KICK), Array(10).fill(CLOTHESLINE))
    g.players[0]!.hand = [KICK]
    g.players[1]!.hand = []
    g.players[1]!.arsenal = [ELBOW, CLOTHESLINE, CLOTHESLINE]
    playCard(g, 0, KICK)
    passReversal(g)
    const d0 = g.pendingDecision
    if (d0 && d0.type === 'overturnCards') applyDecision(g, d0, 'flip')
    expect(g.players[1]!.ringside).toContain(ELBOW) // first flipped card revealed
    for (let i = 0; i < 2; i++) {
      const d = g.pendingDecision
      if (d && d.type === 'overturnCards') applyDecision(g, d, 'flip')
    }
    const dStop = g.pendingDecision
    if (dStop && dStop.type === 'overturnCards') applyDecision(g, dStop, 'stop')
    expect(g.players[0]!.ring).toContain(KICK)
    expect(g.players[0]!.fortitude).toBe(5) // Kick prints 5D, so Fortitude Rating = 5
    expect(g.phase).toBe('main')
  })

  it('allows the defender to reverse with any card in manual mode', () => {
    const g = startGame(Array(10).fill(KICK), Array(10).fill(CLOTHESLINE))
    g.players[0]!.hand = [KICK]
    g.players[1]!.hand = ['kurt-its-true-its-true'] // 4F, defender has 0F
    playCard(g, 0, KICK)
    const err = applyDecision(
      g,
      { type: 'reversalChoice', defenderIdx: 1, cardId: KICK },
      { cardId: 'kurt-its-true-its-true', zone: 'ring' },
    )
    expect(err).toBeNull() // manual mode: any card, no Fortitude requirement
  })
})

describe('win conditions', () => {
  it('a defender with an empty Arsenal can only stop (no forced flip, no auto-pin)', () => {
    const g = startGame(Array(10).fill(KICK), Array(10).fill(CLOTHESLINE))
    g.players[0]!.hand = [KICK]
    g.players[1]!.hand = []
    g.players[1]!.arsenal = []
    playCard(g, 0, KICK)
    passReversal(g)
    expect(g.pendingDecision?.type).toBe('overturnCards')
    const d = g.pendingDecision
    if (d && d.type === 'overturnCards') {
      const err = applyDecision(g, d, 'flip')
      expect(err).toContain('vacío')
    }
    const dStop = g.pendingDecision
    if (dStop && dStop.type === 'overturnCards') applyDecision(g, dStop, 'stop')
    expect(g.players[0]!.ring).toContain(KICK)
    expect(g.phase).toBe('main')
  })

  it('offers countout loss when the active player ends their turn with an empty Arsenal, and applies it if accepted', () => {
    const g = startGame([], [])
    g.players[0]!.arsenal = []
    endTurn(g)
    expect(g.pendingDecision?.type).toBe('concedeChoice')
    const d = g.pendingDecision
    if (d && d.type === 'concedeChoice') applyDecision(g, d, true)
    expect(g.phase).toBe('gameover')
    expect(g.winner).toEqual([1])
    expect(g.winType).toBe('countout')
  })

  it('continues the turn if the player declines countout', () => {
    const g = startGame([], [])
    g.players[0]!.arsenal = []
    endTurn(g)
    const d = g.pendingDecision
    if (d && d.type === 'concedeChoice') applyDecision(g, d, false)
    expect(g.pendingDecision).toBeNull()
    expect(g.activeIndex).toBe(1)
  })
})

describe('pre-match phase', () => {
  it('passes through stages and starts the match', () => {
    const g = make2p([], [])
    expect(g.phase).toBe('opening')
    // Both players confirm their opening hand.
    keepOpeningHand(g, g.activeIndex)
    keepOpeningHand(g, g.activeIndex)
    expect(g.phase).toBe('prematch')
    for (let i = 0; i < 10; i++) passPrematch(g)
    expect(g.phase).not.toBe('prematch')
  })
})

describe('valid plays', () => {
  it('exposes every hand card in manual mode regardless of Fortitude', () => {
    const g = startGame(['gen-kick', 'kurt-olympic-slam'], ['gen-kick'])
    g.players[0]!.hand = ['gen-kick', 'kurt-olympic-slam']
    g.players[0]!.fortitude = 0
    const plays = getValidPlays(g, 0)
    expect(plays).toContain('gen-kick')
    expect(plays).toContain('kurt-olympic-slam') // manual mode: Fortitude no longer blocks
  })
})

describe('data sanity', () => {
  it('has unique card ids and resolves every id', () => {
    const all = [...KURT_CARDS, ...GENERIC_CARDS]
    const ids = all.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of all) {
      expect(getCard(c.id).name).toBe(c.name)
    }
  })

  it('all generic/kurt cards used by default decks exist', () => {
    const all = new Set([...GENERIC_CARDS, ...KURT_CARDS, ...KURT_BACKLASH_CARDS].map((c) => c.id))
    const referenced = [
      'gen-kick', 'gen-elbow-to-the-face', 'gen-step-aside', 'gen-spit-at-opponent',
      'kurt-angles-uppercut', 'kurt-ankle-lock', 'kurt-strangle-hold', 'kurt-scoop-slam',
      'kurt-bear-hug', 'kurt-garbage-can-lid', 'kurt-atomic-driver', 'kurt-atomic-body-lock',
      'kurt-brass-nuks-shot', 'kurt-olympic-slam', 'kurt-its-true-its-true',
      'kurt-where-are-your-medals', 'kurt-the-switch', 'kurt-chain-wrestling',
      'kurt-chained-aggression', 'kurt-submit', 'kurt-intensity', 'kurt-integrity',
      'kurt-intelligence', 'kurt-ill-make-you-tap', 'kurt-hold-on', 'kurt-tap-match',
      'kurt-wrestling-with-a-broken-freakin-neck',
    ]
    for (const id of referenced) {
      expect(all.has(id), `missing ${id}`).toBe(true)
    }
  })
})

describe('end of turn and next player', () => {
  it('rotates to the next alive player', () => {
    const g = startGame(Array(10).fill(KICK), Array(10).fill(CLOTHESLINE))
    g.players[0]!.hand = []
    endTurn(g)
    expect(g.activeIndex).toBe(1)
  })

  it('Mankind / Cactus Jack draw 2 cards during their Draw Segment', () => {
    // Player B is Mankind (see make2p). Force a turn for them with a fresh hand.
    const g = startGame(Array(12).fill(KICK), Array(12).fill(CLOTHESLINE))
    const mankind = g.players[1]!
    mankind.hand = []
    mankind.arsenal = Array(5).fill('gen-kick')
    g.activeIndex = 1
    g.phase = 'start'
    startTurn(g)
    expect(mankind.hand.length).toBe(2)
    expect(g.phase).toBe('main')
  })

  it('other superstars still draw 1 card during their Draw Segment', () => {
    const g = startGame(Array(12).fill(KICK), Array(12).fill(CLOTHESLINE))
    const kurt = g.players[0]!
    kurt.hand = []
    kurt.arsenal = Array(5).fill('gen-kick')
    g.activeIndex = 0
    g.phase = 'start'
    startTurn(g)
    expect(kurt.hand.length).toBe(1)
    expect(g.phase).toBe('main')
  })
})

describe('revealing a hand to a specific opponent (3+ players)', () => {
  it('shows the hand only to the chosen opponent, never the rest', () => {
    const g = newGame({
      players: [
        { name: 'A', superstarId: 'kurt-angle', arsenal: [], backlashPre: [], backlashMid: [] },
        { name: 'B', superstarId: 'mankind', arsenal: [], backlashPre: [], backlashMid: [] },
        { name: 'C', superstarId: 'cactus-jack', arsenal: [], backlashPre: [], backlashMid: [] },
      ],
    } satisfies Parameters<typeof newGame>[0])
    g.players[0]!.hand = ['gen-kick']
    manualRevealHand(g, 0, 2)
    expect(g.players[0]!.handRevealedTo).toBe(2)
    manualRevealHand(g, 0, null)
    expect(g.players[0]!.handRevealedTo).toBeNull()
  })
})

describe('buildClientView hand reveal (online view filtering)', () => {
  let g: GameState
  beforeEach(() => {
    g = newGame({
      players: [
        { name: 'A', superstarId: 'kurt-angle', arsenal: Array(15).fill('gen-kick'), backlashPre: [], backlashMid: [] },
        { name: 'B', superstarId: 'mankind', arsenal: Array(15).fill('punch'), backlashPre: [], backlashMid: [] },
        { name: 'C', superstarId: 'cactus-jack', arsenal: Array(15).fill('gen-elbow-to-the-face'), backlashPre: [], backlashMid: [] },
      ],
    } satisfies Parameters<typeof newGame>[0])
  })

  it("keeps an opponent's hand hidden until it's revealed to the viewer", () => {
    const view = buildClientView(g, 0)
    expect(view.players[1]!.hand.every((id) => id === '__hidden__')).toBe(true)
  })

  it("shows a hand once that player reveals it to THIS viewer (not to themselves)", () => {
    manualRevealHand(g, 1, 0) // player B reveals their hand to viewer A (idx 0)
    const view = buildClientView(g, 0)
    expect(view.players[1]!.hand.every((id) => id === '__hidden__')).toBe(false)
    expect(view.players[1]!.hand).toEqual(g.players[1]!.hand)
  })

  it("still hides that hand from a different viewer", () => {
    manualRevealHand(g, 1, 0)
    const view = buildClientView(g, 2) // player C looks: B's hand stays hidden
    expect(view.players[1]!.hand.every((id) => id === '__hidden__')).toBe(true)
  })

  it("never hides the viewer's own hand", () => {
    const view = buildClientView(g, 1)
    expect(view.players[1]!.hand).toEqual(g.players[1]!.hand)
  })
})
