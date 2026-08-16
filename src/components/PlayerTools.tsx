import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { CardFace } from './CardView'
import type { GameState } from '../engine/types'
import type { ManualZone } from '../engine/game'

const ZONES: ManualZone[] = ['hand', 'arsenal', 'ring', 'ringside', 'out']
const ZONE_LABEL: Record<ManualZone, string> = {
  hand: 'Mano',
  arsenal: 'Arsenal',
  ring: 'Ring Area',
  ringside: 'Ringside',
  out: 'Fuera del juego',
}

/**
 * Manual house-rule tool for a given player: view any zone and move cards
 * between any zones (hand / arsenal / ring / ringside / out of game).
 */
export function PlayerToolsModal({
  game,
  playerIdx,
  onClose,
}: {
  game: GameState
  playerIdx: number
  onClose: () => void
}) {
  const store = useAppStore.getState()
  const p = game.players[playerIdx]
  const [from, setFrom] = useState<ManualZone>('hand')
  const [to, setTo] = useState<ManualZone>('arsenal')
  const [selected, setSelected] = useState<string[]>([])

  const list = useMemo(() => {
    if (!p) return []
    switch (from) {
      case 'hand':
        return p.hand
      case 'arsenal':
        return p.arsenal
      case 'ring':
        return p.ring
      case 'ringside':
        return p.ringside
      case 'out':
        return p.outOfGame
    }
  }, [p, from])

  if (!p) return null

  const count = (z: ManualZone) => {
    switch (z) {
      case 'hand':
        return p.hand.length
      case 'arsenal':
        return p.arsenal.length
      case 'ring':
        return p.ring.length
      case 'ringside':
        return p.ringside.length
      case 'out':
        return p.outOfGame.length
    }
  }

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const doMove = () => {
    const err = store.manualMove(playerIdx, from, to, selected)
    if (err) store.setLastError(err)
    setSelected([])
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Cartas de {p.name}</h3>
          <div className="spacer" />
          <button className="ghost" onClick={onClose}>Cerrar</button>
        </div>

        <div className="tabs" style={{ marginBottom: 8 }}>
          {ZONES.map((z) => (
            <button
              key={z}
              className={`tab ${from === z ? 'active' : ''}`}
              onClick={() => {
                setFrom(z)
                setSelected([])
              }}
            >
              {ZONE_LABEL[z]} ({count(z)})
            </button>
          ))}
        </div>

        <div className="muted" style={{ marginBottom: 6, fontSize: 12 }}>
          Cartas de <b>{ZONE_LABEL[from]}</b> — tocá para seleccionar y luego elegí a dónde moverlas.
        </div>

        <div className="hand" style={{ width: '100%', maxHeight: 340, overflowY: 'auto', flexWrap: 'wrap' }}>
          {list.length === 0 ? (
            <span className="muted">Zona vacía.</span>
          ) : (
            list.map((id) => (
              <CardFace key={id} id={id} size="sm" selected={selected.includes(id)} onClick={() => toggle(id)} />
            ))
          )}
        </div>

        <div className="row" style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
          {ZONES.filter((z) => z !== from).map((z) => (
            <button
              key={z}
              className={`tab ${to === z ? 'active' : ''}`}
              onClick={() => setTo(z)}
            >
              {ZONE_LABEL[z]} ({count(z)})
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end', gap: 8 }}>
          <button className="ghost" onClick={() => { store.manualShuffleArsenal(playerIdx); setFrom('arsenal'); setSelected([]) }}>
            Barajar Arsenal
          </button>
          <button className="ghost" onClick={() => store.manualRevealHand(playerIdx, true)}>
            Mostrar mano a todos
          </button>
          <button className="ghost" onClick={() => store.manualRevealHand(playerIdx, false)}>
            Ocultar mano
          </button>
          <button className="primary" disabled={selected.length === 0} onClick={doMove}>
            Mover {selected.length || ''} → {ZONE_LABEL[to]}
          </button>
        </div>
      </div>
    </div>
  )
}
