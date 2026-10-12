import type { RealtimeChannel } from '@supabase/supabase-js'
import type { GameState } from '../engine/types'
import { ensureSupabaseReachable, getSupabase } from './supabase'
import {
  buildClientView,
  type ClientMsg,
  type DeckPick,
  type HostMsg,
  type IntentName,
  type JoinRequest,
  type RosterEntry,
  type SharedDeck,
} from './types'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const MAX_SEATS = 8

export function randomCode(length = 5): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

function roomName(code: string): string {
  return `room:${code}`
}

export interface HostHooks {
  onOpen: () => void
  onRoster: (roster: RosterEntry[]) => void
  onIntent: (idx: number, action: IntentName, args: unknown[]) => void
  onPeerClosed: (idx: number) => void
  onError: (message: string) => void
  /** A client answered whether it defends the belt (only the champion's seat may). */
  onBeltDefense?: (idx: number, defending: boolean) => void
  /** A client asks to enter a full room (or a match already in progress). */
  onJoinRequest?: (req: JoinRequest) => void
  /** A client that asked to join went away before the host answered. */
  onJoinLeave?: (senderId: string) => void
}

export interface ClientHooks {
  onOpen: () => void
  onWelcome: (idx: number, roster: RosterEntry[]) => void
  onRoster: (roster: RosterEntry[]) => void
  onDecks: (decks: SharedDeck[]) => void
  onState: (game: GameState) => void
  onError: (message: string) => void
  onClosed: () => void
  /** Host announced (or re-announced) the belt in play for the room. */
  onBelt?: (beltId: string | null, defending: boolean | null) => void
  /** The host queued our join request: wait for approval before entering. */
  onJoinPending?: () => void
  /** The host rejected our join request. */
  onJoinDenied?: (reason?: string) => void
}

let role: 'host' | 'client' | null = null
let channel: RealtimeChannel | null = null
let clientId: string | null = null
const connectedClients = new Map<number, string>()

const registry = new Map<number, RosterEntry>()
let hostHooksRef: HostHooks | null = null
let hostSharedDecks: SharedDeck[] = []
/** Belt chosen for the room, kept on the host so late joiners receive it. */
let hostBelt: { beltId: string | null; defending: boolean | null } = { beltId: null, defending: null }
/** Join requests waiting for the host's answer (senderId -> requested name). */
const pendingJoins = new Map<string, string>()
/** True once the host started the duel: from then on, approvals enter as spectators. */
let hostGameStarted = false

function emitRoster(hooks: HostHooks | null) {
  if (!hooks) return
  hooks.onRoster([...registry.values()].sort((a, b) => a.idx - b.idx))
}

export function isOnline(): boolean {
  return role !== null
}

export function onlineRole(): 'host' | 'client' | null {
  return role
}

export function stopOnline(): void {
  if (channel) {
    channel.unsubscribe()
    channel = null
  }
  clientId = null
  connectedClients.clear()
  role = null
  registry.clear()
  hostHooksRef = null
  hostSharedDecks = []
  hostBelt = { beltId: null, defending: null }
  pendingJoins.clear()
  hostGameStarted = false
}

function sendToAll(payload: Record<string, unknown>): void {
  if (!channel) return
  channel.send({ type: 'broadcast', event: 'msg', payload })
}

function sendToClient(targetIdx: number, payload: HostMsg): void {
  sendToAll({ target: targetIdx, senderHint: connectedClients.get(targetIdx), msg: payload })
}

// ---------------------------------------------------------------------------
// HOST
// ---------------------------------------------------------------------------

export async function startHost(code: string, seatCount: number, hostName: string, hooks: HostHooks): Promise<void> {
  stopOnline()
  await ensureSupabaseReachable()
  role = 'host'
  hostHooksRef = hooks
  registry.clear()
  const n = Math.max(2, Math.min(seatCount, MAX_SEATS))
  for (let i = 0; i < n; i++) {
    registry.set(i, {
      idx: i,
      name: i === 0 ? hostName : '',
      superstarId: null,
      handSize: null,
      deck: null,
      connected: i === 0,
    })
  }

  const supabase = await getSupabase()
  const ch = supabase.channel(roomName(code), { config: { broadcast: { self: false } } })
  channel = ch

  ch.on('broadcast', { event: 'msg' }, ({ payload }: { payload: Record<string, unknown> }) => {
    const senderId = payload.sender as string
    const msg = payload.msg as ClientMsg

    if (msg.type === 'hello') {
      const free = nextFreeSeat()
      const canGrow = registry.size < MAX_SEATS
      if (free === null && !canGrow) {
        sendToAll({ target: -1, senderHint: senderId, msg: { type: 'joinDenied', reason: 'Sala llena (máximo 8 jugadores).' } satisfies HostMsg })
        return
      }
      if (hostGameStarted || free === null) {
        pendingJoins.set(senderId, msg.name)
        sendToAll({ target: -1, senderHint: senderId, msg: { type: 'joinPending' } satisfies HostMsg })
        hooks.onJoinRequest?.({ senderId, name: msg.name })
        return
      }
      admitClient(senderId, free, msg.name, hooks)
    } else if (msg.type === 'setRole') {
      const idx = clientIdx(senderId)
      if (idx === null) return
      const entry = registry.get(idx)
      if (entry && entry.connected) {
        // Once the duel has started nobody can switch in as a player.
        entry.spectator = hostGameStarted ? true : msg.role === 'spectator'
        emitRoster(hooks)
      }
    } else if (msg.type === 'pick') {
      const idx = clientIdx(senderId)
      if (idx === null) return
      const entry = registry.get(idx)
      if (entry && entry.connected && msg.superstarId) {
        entry.superstarId = msg.superstarId
        entry.handSize = msg.handSize
        entry.deck = msg.deck ?? null
        emitRoster(hooks)
      } else if (entry && entry.connected && msg.handSize !== null && entry.superstarId) {
        entry.handSize = msg.handSize
        emitRoster(hooks)
      }
    } else if (msg.type === 'beltDefense') {
      const idx = clientIdx(senderId)
      if (idx !== null && registry.get(idx)?.connected) hooks.onBeltDefense?.(idx, msg.defending === true)
    } else if (msg.type === 'intent') {
      const idx = clientIdx(senderId)
      const entry = idx !== null ? registry.get(idx) : null
      // Spectators (including mid-game approvals) never act: their seat index
      // is unrelated to the players array and could impersonate a player.
      if (entry?.spectator) {
        if (idx !== null) sendToClient(idx, { type: 'error', message: 'Estás observando la partida, no podés jugar.' })
        return
      }
      if (idx !== null && entry?.connected) hooks.onIntent(idx, msg.action, msg.args)
    }
  })

  ch.on('broadcast', { event: 'leave' }, ({ payload }: { payload: Record<string, unknown> }) => {
    const senderId = payload.sender as string
    if (dropPendingJoin(senderId, hooks)) return
    const idx = clientIdx(senderId)
    if (idx === null) return
    connectedClients.delete(idx)
    const entry = registry.get(idx)
    if (entry) {
      entry.connected = false
      entry.name = ''
      entry.superstarId = null
    }
    emitRoster(hooks)
    hooks.onPeerClosed(idx)
  })

  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState()
    const onlineIds = new Set<string>()
    for (const [, presences] of Object.entries(state)) {
      for (const p of presences as { client_id?: string }[]) {
        if (p.client_id) onlineIds.add(p.client_id)
      }
    }
    for (const [idx, cid] of connectedClients) {
      if (!onlineIds.has(cid)) {
        connectedClients.delete(idx)
        const entry = registry.get(idx)
        if (entry) {
          entry.connected = false
          entry.name = ''
          entry.superstarId = null
        }
        emitRoster(hooks)
        hooks.onPeerClosed(idx)
      }
    }
    for (const senderId of [...pendingJoins.keys()]) {
      if (!onlineIds.has(senderId)) dropPendingJoin(senderId, hooks)
    }
  })

  ch.subscribe(async (status: string) => {
    if (status === 'SUBSCRIBED') {
      clientId = 'host'
      await ch.track({ client_id: 'host', role: 'host' })
      console.log('[Supabase] Host joined room:', code)
      hooks.onOpen()
    } else if (status === 'CHANNEL_ERROR') {
      hooks.onError('Error al crear la sala. Intentá de nuevo.')
    }
  })
}

function admitClient(senderId: string, idx: number, name: string, hooks: HostHooks): void {
  connectedClients.set(idx, senderId)
  pendingJoins.delete(senderId)
  const entry = registry.get(idx)
  if (!entry) return
  entry.name = name
  entry.connected = true
  sendToClient(idx, { type: 'welcome', idx, roster: currentRoster() })
  sendToClient(idx, { type: 'belt', beltId: hostBelt.beltId, defending: hostBelt.defending })
  if (hostSharedDecks.length > 0) {
    sendToClient(idx, { type: 'decks', decks: hostSharedDecks })
  }
  emitRoster(hooks)
}

/** Drops a join request that never got an answer (the requester went away). */
function dropPendingJoin(senderId: string, hooks: HostHooks): boolean {
  if (!pendingJoins.delete(senderId)) return false
  hooks.onJoinLeave?.(senderId)
  return true
}

function clientIdx(senderId: string): number | null {
  for (const [idx, cid] of connectedClients) {
    if (cid === senderId) return idx
  }
  return null
}

function nextFreeSeat(): number | null {
  const free = [...registry.entries()].filter(([, r]) => !r.connected).map(([idx]) => idx)
  return free.length > 0 ? Math.min(...free) : null
}

function currentRoster(): RosterEntry[] {
  return [...registry.values()].sort((a, b) => a.idx - b.idx)
}

/** Host picks a superstar for the given seat (usually its own, 0). */
export function hostSetSuperstar(idx: number, superstarId: string, deck: DeckPick | null = null): void {
  const entry = registry.get(idx)
  if (entry) {
    entry.superstarId = superstarId
    entry.deck = deck
    emitRoster(hostHooksRef)
  }
}

/** Host changes its chosen opening-hand size for the given seat. */
export function hostSetHandSize(idx: number, handSize: number): void {
  const entry = registry.get(idx)
  if (entry) {
    entry.handSize = handSize
    emitRoster(hostHooksRef)
  }
}

/** Publishes the host's saved decks so every connected client can pick them. */
export function hostShareDecks(decks: SharedDeck[]): void {
  hostSharedDecks = decks
  for (const [idx] of connectedClients) {
    sendToClient(idx, { type: 'decks', decks })
  }
}

/** Announces the belt (and the champion's defense answer) to every client. */
export function hostSetBelt(beltId: string | null, defending: boolean | null): void {
  hostBelt = { beltId, defending }
  sendToAll({ msg: { type: 'belt', beltId, defending } satisfies HostMsg })
}

/** Broadcasts a redacted state snapshot to every connected client. */
export function broadcastState(game: GameState): void {
  for (const [idx] of connectedClients) {
    const entry = registry.get(idx)
    const viewerIdx = entry?.spectator ? -1 : idx
    sendToClient(idx, { type: 'state', game: buildClientView(game, viewerIdx) })
  }
}

export function hostSendError(idx: number, message: string): void {
  sendToClient(idx, { type: 'error', message })
}

/** Tells the host whether the duel has started: from then on approvals enter as spectators. */
export function hostSetGameStarted(started: boolean): void {
  hostGameStarted = started
}

/**
 * Admits a requested client. If the match already started (or the room was
 * full) the new seat is created on the spot, growing the roster up to
 * MAX_SEATS; mid-game joiners are always flagged as spectators so the engine
 * never sees them as players.
 */
export function hostApproveJoin(senderId: string): boolean {
  const hooks = hostHooksRef
  const name = pendingJoins.get(senderId)
  if (!hooks || name === undefined) return false
  let idx = nextFreeSeat()
  if (idx === null) {
    if (registry.size >= MAX_SEATS) {
      pendingJoins.delete(senderId)
      hooks.onJoinLeave?.(senderId)
      sendToAll({ target: -1, senderHint: senderId, msg: { type: 'joinDenied', reason: 'Sala llena (máximo 8 jugadores).' } satisfies HostMsg })
      return false
    }
    idx = registry.size
    registry.set(idx, { idx, name: '', superstarId: null, handSize: null, deck: null, connected: false })
  }
  const entry = registry.get(idx)
  // Mid-game joiners are spectators: set the flag before the welcome so the
  // roster the newcomer receives already shows them as such.
  if (hostGameStarted && entry) entry.spectator = true
  admitClient(senderId, idx, name, hooks)
  return true
}

/** Rejects a join request: the client goes back to the join form. */
export function hostRejectJoin(senderId: string, reason?: string): boolean {
  const hooks = hostHooksRef
  if (!pendingJoins.delete(senderId)) return false
  hooks?.onJoinLeave?.(senderId)
  sendToAll({
    target: -1,
    senderHint: senderId,
    msg: { type: 'joinDenied', reason: reason ?? 'El anfitrión no autorizó tu ingreso.' } satisfies HostMsg,
  })
  return true
}

// ---------------------------------------------------------------------------
// CLIENT
// ---------------------------------------------------------------------------

export async function startClient(code: string, name: string, hooks: ClientHooks): Promise<void> {
  stopOnline()
  await ensureSupabaseReachable()
  role = 'client'
  hostHooksRef = null

  const supabase = await getSupabase()
  const ch = supabase.channel(roomName(code), { config: { broadcast: { self: false } } })
  channel = ch

  clientId = crypto.randomUUID()

  ch.on('broadcast', { event: 'msg' }, ({ payload }: { payload: Record<string, unknown> }) => {
    const msg = payload.msg as HostMsg
    const target = payload.target as number | undefined
    const hint = payload.senderHint as string | undefined
    if (hint !== undefined) {
      // Addressed to a specific client: ignore it unless it's us. This is what
      // lets an unseated client (waiting for approval) receive joinPending /
      // joinDenied without catching other seats' messages.
      if (hint !== clientId) return
    } else if (target !== undefined && target !== -1) {
      if (mySeatIdx === null || target !== mySeatIdx) return
    }

    if (msg.type === 'welcome') {
      mySeatIdx = msg.idx
      hooks.onWelcome(msg.idx, msg.roster)
    } else if (msg.type === 'lobby') {
      hooks.onRoster(msg.roster)
    } else if (msg.type === 'decks') {
      hooks.onDecks(msg.decks)
    } else if (msg.type === 'belt') {
      hooks.onBelt?.(msg.beltId, msg.defending)
    } else if (msg.type === 'state') {
      hooks.onState(msg.game)
    } else if (msg.type === 'error') {
      hooks.onError(msg.message)
    } else if (msg.type === 'joinPending') {
      hooks.onJoinPending?.()
    } else if (msg.type === 'joinDenied') {
      hooks.onJoinDenied?.(msg.reason)
    }
  })

  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState()
    const hostPresent = Object.values(state).some(
      (presences) => (presences as { client_id?: string }[]).some((p) => p.client_id === 'host'),
    )
    if (!hostPresent && connected) {
      connected = false
      hooks.onClosed()
    }
  })

  let connected = false
  let mySeatIdx: number | null = null

  ch.subscribe(async (status: string) => {
    if (status === 'SUBSCRIBED') {
      await ch.track({ client_id: clientId, role: 'client' })
      console.log('[Supabase] Client joined room:', code, 'with ID:', clientId)
      ch.send({ type: 'broadcast', event: 'msg', payload: { sender: clientId, msg: { type: 'hello', name } satisfies ClientMsg } })
      connected = true
      hooks.onOpen()
    } else if (status === 'CHANNEL_ERROR') {
      hooks.onError('Error al conectar con la sala. Intentá de nuevo.')
    }
  })
}

export function clientSend(msg: ClientMsg): void {
  if (!channel || !clientId) return
  channel.send({ type: 'broadcast', event: 'msg', payload: { sender: clientId, msg } })
}

export function clientSendIntent(action: IntentName, args: unknown[]): void {
  clientSend({ type: 'intent', action, args })
}
