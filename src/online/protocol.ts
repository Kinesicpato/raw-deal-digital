/**
 * Pure decision logic for the room protocol. Kept free of any Supabase or
 * DOM dependency so it can be unit-tested: these rules are what stop a
 * reconnecting player from being treated as a brand-new guest mid-game.
 */

export type HelloAction =
  /** A client we already know came back: restore its seat, quietly. */
  | { kind: 'restore'; idx: number }
  /** A brand-new player taking a free seat in the lobby. */
  | { kind: 'admit'; idx: number }
  /** Room full or match in progress: queue a join request for the host. */
  | { kind: 'pending' }
  /** Room at MAX_SEATS: turn the newcomer away. */
  | { kind: 'deny'; reason: string }

export interface HelloInput {
  /** Seat currently mapped to this sender id (still connected). */
  seatedIdx: number | null
  /** Seat promised to this sender id (may be disconnected right now). */
  reservedIdx: number | null
  /** Whether the reserved seat is free for this sender (nobody else holds it). */
  reservedFree: boolean
  /** Lowest unoccupied seat, or null when every seat is taken. */
  freeSeat: number | null
  /** Whether the roster may still grow (registry.size < MAX_SEATS). */
  canGrow: boolean
  /** True once the host started the duel. */
  gameStarted: boolean
}

/**
 * Decides what a `hello` means.
 *
 * Clients re-send `hello` every time their channel (re)joins — after a
 * network hiccup, a backgrounded tab, or a page reload with a stable client
 * id. A hello from a sender we already admitted is a RECONNECT and must
 * resume the same seat: routing it through the "new guest" flow is what used
 * to raise a bogus join request mid-game, and approving that request used to
 * turn an active player into a spectator.
 */
export function decideHello(input: HelloInput): HelloAction {
  // 1. Still listed as connected: the channel just rejoined under the same id.
  if (input.seatedIdx !== null) return { kind: 'restore', idx: input.seatedIdx }
  // 2. Seat reserved (they dropped earlier): give it back to them.
  if (input.reservedIdx !== null && input.reservedFree) {
    return { kind: 'restore', idx: input.reservedIdx }
  }
  // 3. Genuinely unknown sender from here on.
  if (input.freeSeat === null && !input.canGrow) {
    return { kind: 'deny', reason: 'Sala llena (máximo 8 jugadores).' }
  }
  if (input.gameStarted || input.freeSeat === null) return { kind: 'pending' }
  return { kind: 'admit', idx: input.freeSeat }
}
