import type { RealtimeChannel } from '@supabase/supabase-js'
import type { GameState } from '../engine/types'
import { getSupabase } from './supabase'
import {
  buildClientView,
  type ClientMsg,
  type DeckPick,
  type HostMsg,
  type IntentName,
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
}

export interface ClientHooks {
  onOpen: () => void
  onWelcome: (idx: number, roster: RosterEntry[]) => void
  onRoster: (roster: RosterEntry[]) => void
  onDecks: (decks: SharedDeck[]) => void
  onState: (game: GameState) => void
  onError: (message: string) => void
  onClosed: () => void
}

let role: 'host' | 'client' | null = null
let channel: RealtimeChannel | null = null
let clientId: string | null = null
const connectedClients = new Map<number, string>()

const registry = new Map<number, RosterEntry>()
let hostHooksRef: HostHooks | null = null
let hostSharedDecks: SharedDeck[] = []

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
}

function sendToAll(payload: Record<string, unknown>): void {
  if (!channel) return
  channel.send({ type: 'broadcast', event: 'msg', payload })
}

function sendToClient(targetIdx: number, payload: HostMsg): void {
  sendToAll({ target: targetIdx, msg: payload })
}

// ---------------------------------------------------------------------------
// HOST
// ---------------------------------------------------------------------------

export async function startHost(code: string, seatCount: number, hostName: string, hooks: HostHooks): Promise<void> {
  stopOnline()
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
      const idx = nextFreeSeat()
      if (idx === null) {
        sendToAll({ target: -1, senderHint: senderId, msg: { type: 'error', message: 'Sala llena (máximo 8 jugadores).' } satisfies HostMsg })
        return
      }
      connectedClients.set(idx, senderId)
      const entry = registry.get(idx)
      if (entry) {
        entry.name = msg.name
        entry.connected = true
        sendToClient(idx, { type: 'welcome', idx, roster: currentRoster() })
        if (hostSharedDecks.length > 0) {
          sendToClient(idx, { type: 'decks', decks: hostSharedDecks })
        }
        emitRoster(hooks)
      }
    } else if (msg.type === 'setRole') {
      const idx = clientIdx(senderId)
      if (idx === null) return
      const entry = registry.get(idx)
      if (entry && entry.connected) {
        entry.spectator = msg.role === 'spectator'
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
    } else if (msg.type === 'intent') {
      const idx = clientIdx(senderId)
      if (idx !== null && registry.get(idx)?.connected) hooks.onIntent(idx, msg.action, msg.args)
    }
  })

  ch.on('broadcast', { event: 'leave' }, ({ payload }: { payload: Record<string, unknown> }) => {
    const senderId = payload.sender as string
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

// ---------------------------------------------------------------------------
// CLIENT
// ---------------------------------------------------------------------------

export async function startClient(code: string, name: string, hooks: ClientHooks): Promise<void> {
  stopOnline()
  role = 'client'
  hostHooksRef = null

  const supabase = await getSupabase()
  const ch = supabase.channel(roomName(code), { config: { broadcast: { self: false } } })
  channel = ch

  clientId = crypto.randomUUID()

  ch.on('broadcast', { event: 'msg' }, ({ payload }: { payload: Record<string, unknown> }) => {
    const msg = payload.msg as HostMsg
    const target = payload.target as number | undefined
    if (target !== undefined && target !== -1) {
      const myIdx = mySeatIdx
      if (myIdx !== null && target !== myIdx) return
    }

    if (msg.type === 'welcome') {
      mySeatIdx = msg.idx
      hooks.onWelcome(msg.idx, msg.roster)
    } else if (msg.type === 'lobby') {
      hooks.onRoster(msg.roster)
    } else if (msg.type === 'decks') {
      hooks.onDecks(msg.decks)
    } else if (msg.type === 'state') {
      hooks.onState(msg.game)
    } else if (msg.type === 'error') {
      hooks.onError(msg.message)
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
