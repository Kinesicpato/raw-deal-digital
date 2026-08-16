import Peer, { type DataConnection } from 'peerjs'
import type { GameState } from '../engine/types'
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
export const MAX_SEATS = 5

export function randomCode(length = 5): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

export function peerIdFor(code: string): string {
  return `rawdeal-${code}`
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
let peer: Peer | null = null
let hostConn: DataConnection | null = null
const hostConns = new Map<number, DataConnection>()

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
  hostConn?.close()
  hostConn = null
  for (const c of hostConns.values()) c.close()
  hostConns.clear()
  peer?.destroy()
  peer = null
  role = null
  registry.clear()
  hostHooksRef = null
}

/**
 * Creates the room (free public PeerJS broker). The host is always seat 0.
 */
export function startHost(code: string, seatCount: number, hostName: string, hooks: HostHooks): void {
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

  const p = new Peer(peerIdFor(code), { debug: 1 })
  peer = p

  p.on('open', () => hooks.onOpen())
  p.on('error', (err: unknown) => {
    const type = (err as { type?: string }).type
    if (type === 'unavailable-id') hooks.onError('Ese código ya está en uso. Probá con otra sala.')
    else hooks.onError('Error de red: ' + ((err as { message?: string }).message ?? String(err)))
  })

  const onConn = (conn: DataConnection) => {
    const idx = nextFreeSeat()
    if (idx === null) {
      conn.on('open', () => {
        conn.send({ type: 'error', message: 'Sala llena (máximo 5 jugadores).' } as HostMsg)
        setTimeout(() => conn.close(), 500)
      })
      return
    }
    hostConns.set(idx, conn)

    conn.on('data', (raw: unknown) => {
      const msg = raw as ClientMsg
      if (msg.type === 'hello') {
        const entry = registry.get(idx)
        if (entry) {
          entry.name = msg.name
          entry.connected = true
          conn.send({ type: 'welcome', idx, roster: currentRoster() } satisfies HostMsg)
          if (hostSharedDecks.length > 0) {
            conn.send({ type: 'decks', decks: hostSharedDecks } satisfies HostMsg)
          }
          emitRoster(hooks)
        }
      } else if (msg.type === 'pick') {
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
        if (registry.get(idx)?.connected) hooks.onIntent(idx, msg.action, msg.args)
      }
    })

    conn.on('close', () => {
      hostConns.delete(idx)
      const entry = registry.get(idx)
      if (entry) {
        entry.connected = false
        entry.name = ''
        entry.superstarId = null
      }
      emitRoster(hooks)
      hooks.onPeerClosed(idx)
    })
  }

  p.on('connection', (conn) => {
    conn.on('open', () => onConn(conn))
  })
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
  for (const [, conn] of hostConns) {
    if (conn.open) conn.send({ type: 'decks', decks } satisfies HostMsg)
  }
}

/** Broadcasts a redacted state snapshot to every connected client. */
export function broadcastState(game: GameState): void {
  for (const [idx, conn] of hostConns) {
    if (conn.open) conn.send({ type: 'state', game: buildClientView(game, idx) } satisfies HostMsg)
  }
}

export function hostSendError(idx: number, message: string): void {
  const conn = hostConns.get(idx)
  if (conn?.open) conn.send({ type: 'error', message } satisfies HostMsg)
}

// ---------------------------------------------------------------------------
// CLIENT
// ---------------------------------------------------------------------------

export function startClient(code: string, name: string, hooks: ClientHooks): void {
  stopOnline()
  role = 'client'
  hostHooksRef = null

  const p = new Peer({ debug: 1 })
  peer = p
  let started = false

  p.on('open', () => {
    const conn = p.connect(peerIdFor(code), { serialization: 'json', reliable: true })
    hostConn = conn
    conn.on('open', () => {
      conn.send({ type: 'hello', name } satisfies ClientMsg)
      started = true
      hooks.onOpen()
    })
    conn.on('data', (raw: unknown) => {
      const msg = raw as HostMsg
      if (msg.type === 'welcome') hooks.onWelcome(msg.idx, msg.roster)
      else if (msg.type === 'lobby') hooks.onRoster(msg.roster)
      else if (msg.type === 'decks') hooks.onDecks(msg.decks)
      else if (msg.type === 'state') hooks.onState(msg.game)
      else if (msg.type === 'error') hooks.onError(msg.message)
    })
    conn.on('close', () => {
      if (started) hooks.onClosed()
    })
  })

  p.on('error', (err: unknown) => {
    const type = (err as { type?: string }).type
    if (type === 'peer-unavailable' || type === 'unavailable-id') {
      hooks.onError('No se encontró la sala con ese código.')
    } else {
      hooks.onError('Error de red: ' + ((err as { message?: string }).message ?? String(err)))
    }
  })
}

export function clientSend(msg: ClientMsg): void {
  hostConn?.send(msg)
}

export function clientSendIntent(action: IntentName, args: unknown[]): void {
  hostConn?.send({ type: 'intent', action, args } satisfies ClientMsg)
}