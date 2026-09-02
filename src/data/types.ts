export type CardType = 'Maneuver' | 'Reversal' | 'Action' | 'Hybrid' | 'Superstar'

export type ManeuverSubtype =
  | 'Strike'
  | 'Grapple'
  | 'Submission'
  | 'High Risk'
  | 'Trademark Finisher'

export type CardTrait =
  | 'Chain'
  | 'Set-up'
  | 'Foreign Object'
  | 'Run-in'
  | 'Special'
  | 'Multi'
  | 'Volley'
  | 'Heat'
  | 'Active'
  | 'Permanent'
  | 'Unique'
  | 'Universally Unique'
  | 'Restricted Modification'
  | 'Face'
  | 'Heel'
  | 'Raw'
  | 'SmackDown'
  | 'Throwback'
  | 'Cheater'
  | 'Fan Favorite!'
  | 'Ace'
  | 'Survivor Series'
  | 'Wrestling'
  | 'Event'
  | 'Venue'
  | 'Feud'
  | 'Stipulation'
  | 'Manager'
  | 'Object'

export type CardBrand = 'Raw' | 'SmackDown' | null

/**
 * Structured reversal criteria. Describes what a Reversal (or the reversal
 * half of a Hybrid) can reverse.
 */
export interface ReversalCriteria {
  /** Maneuver subtypes this reverses. '*' means "any maneuver". */
  maneuverTypes?: Array<ManeuverSubtype | '*'>
  /** Reverses any card of these card types (e.g. Action, Chain…). */
  cardKinds?: Array<'Action' | 'Chain' | 'Unique' | 'Heat' | 'Multi'>
  /** Restriction: reverses only cards whose printed damage is <= this value. */
  maxDamage?: number
  /** Restriction: reverses only cards whose printed damage is >= this value. */
  minDamage?: number
  /** Reverses only cards with one of these exact titles. */
  cardTitles?: string[]
  /** e.g. "non-hybrid or unique reversal cards" restriction on the target's reversals. */
  nonHybridOrUniqueOnly?: boolean
  /** True when this reversal can only be played from your hand (not overturned). */
  handOnly?: boolean
}

/**
 * Structured effects. The engine executes a subset of these automatically;
 * anything unrecognized falls back to the raw `text`.
 */
export type CardEffect =
  | { kind: 'opponentDiscards'; amount: number | 'chainManeuversInRing' }
  | { kind: 'youDraw'; amount: number }
  | { kind: 'opponentOverturns'; amount: number }
  | { kind: 'youDiscard'; amount: number }
  | { kind: 'shuffleRingsideToArsenal'; amount: number | 'uniqueCardsInRing' }
  | { kind: 'searchArsenalToHand'; filter: 'unique' | 'nonUnique' | 'chainManeuver' | 'submission' | 'chain' | 'any'; amount: number }
  | { kind: 'ringsideToHand'; filter: 'any' | 'unique' | 'submission'; amount: number }
  | { kind: 'lookAtOpponentHand' }
  | { kind: 'opponentDiscardsChosenFromHand' }
  | { kind: 'lookAtOpponentArsenal'; amount: number; order: 'any' | 'top' }
  | { kind: 'nextCardBonus'; fortitudeDelta?: number; damageDelta?: number; cannotBeReversed?: boolean; cannotBeTitled?: string; countAsSetUp?: boolean }
  | { kind: 'discardThenRingsideToHand' }
  | { kind: 'opponentCannotPlayCardTitled'; titles: string[]; during: 'nextTurn' | 'thisTurn' }
  | { kind: 'giveOpponentChainToken' }
  | { kind: 'gainFortitude'; amount: number }
  | { kind: 'stun'; amount: number }

export interface CardDef {
  id: string
  name: string
  /** Primary card type. Hybrids may add more types. */
  type: CardType
  /** Additional types for hybrid cards (e.g. Maneuver + Reversal). */
  extraTypes?: CardType[]
  /** Maneuver subtype(s). */
  subtypes?: ManeuverSubtype[]
  /** Traits, incl. Heel/Face, Chain, Set-up, Foreign Object… */
  traits?: CardTrait[]
  /** Brand affiliation of the card (Raw/SmackDown). */
  brand?: CardBrand
  /** Fortitude Value required to play it. */
  fortitude: number
  /** Damage Value (printed). Adds to Fortitude Rating when successfully played. */
  damage: number
  /** Stun Value (number of stars). */
  stun?: number
  /** Which Superstar logos are on this card (null/empty = generic). */
  superstar?: string[]
  /** If set, only these Superstars may pack/play it. */
  packRestrictions?: { female?: 'forbidden' | 'required'; gender?: string }
  /** How many copies allowed: 3 default, Infinity for Set-up. */
  copiesLimit?: number
  /** Reversal criteria (only meaningful when card can act as a Reversal). */
  reverses?: ReversalCriteria
  /** True if the reversal half can only be played from hand. */
  reversalFromHandOnly?: boolean
  /** This card can only be reversed from the opponent's hand (not by overturning). */
  canOnlyBeReversedFromHand?: boolean
  /** Structured effects executed by the engine. */
  effect?: CardEffect[]
  /** Original (OCR/rulebook) card text, shown to the player. */
  text: string
  /** Card belongs to a Backlash deck: 'Pre-match' | 'Mid-match' | null. */
  backlash?: 'Pre-match' | 'Mid-match' | null
  /** Set/expansion this card came from. */
  set?: string
  /** Errata/notes for the digital implementation. */
  notes?: string
}

export interface SuperstarDef {
  id: string
  name: string
  /** Superstar Value — determines who goes first. */
  value: number
  /** Starting hand size. */
  handSize: number
  /** Brand affiliation. */
  brand: CardBrand
  /** Face/Heel alignment. */
  alignment: 'Face' | 'Heel' | 'Both'
  /** Female / Diva handling. */
  gender: 'male' | 'female'
  isDiva?: boolean
  /** Cards whose superstar logos this superstar counts as. */
  logos?: string[]
  /** Ability text (informational in v1). */
  abilityText: string
  /** Backlash deck limits. */
  backlashLimit?: { preMatch: number; midMatch: number }
}
