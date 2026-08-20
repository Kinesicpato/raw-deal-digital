import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { CardFace } from './CardView'
import type { GameState } from '../engine/types'
import type { ManualZone } from '../engine/game'

const ZONES: ManualZone[] = ['hand', 'arsenal', 'ring', 'ringside', 'midmatch', 'out']
const ZONE_LABEL: Record<ManualZone, string> = {
  hand: 'Mano',
  arsenal: 'Arsenal',
  ring: 'Ring Area',
  ringside: 'Ringside',
  midmatch: 'Mid Match',
  out: 'Fuera del juego',
}

/**
 * Manual house-rule tool for a given player: view any zone and move cards
 * between any zones (hand / arsenal / ring / ringside / out of game).
 */
export function PlayerToolsModal({
  game,
  playerIdx,
  initialZone,
  onClose,
}: {
  game: GameState
  playerIdx: number
  initialZone?: ManualZone
  onClose: () => void
}) {
  const store = useAppStore.getState()
  const p = game.players[playerIdx]
  const [from, setFrom] = useState<ManualZone>(initialZone ?? 'hand')
  const [to, setTo] = useState<ManualZone>('arsenal')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [revealPick, setRevealPick] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

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
      case 'midmatch':
        return p.midmatchPlayed
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
      case 'midmatch':
        return p.midmatchPlayed.length
      case 'out':
        return p.outOfGame.length
    }
  }

  const toggle = (idx: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })

  const switchFrom = (z: ManualZone) => {
    setFrom(z)
    setTo((prev) => (prev === z ? ZONES.find((x) => x !== z) ?? 'arsenal' : prev))
    setSelected(new Set())
  }

  const doMove = () => {
    const ids = [...selected].map((i) => list[i]).filter((id): id is string => typeof id === 'string')
    const err = store.manualMove(playerIdx, from, to, ids)
    if (err) store.setLastError(err)
    setSelected(new Set())
  }

  const isArsenal = from === 'arsenal'

  const handleDrop = (targetIdx: number) => {
    setOverIdx(null)
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null)
      return
    }
    const arr = [...list]
    const [moved] = arr.splice(dragIdx, 1)
    if (!moved) {
      setDragIdx(null)
      return
    }
    const insertAt = targetIdx > dragIdx ? targetIdx - 1 : targetIdx
    arr.splice(insertAt, 0, moved)
    const err = store.manualReorderArsenal(playerIdx, arr)
    if (err) store.setLastError(err)
    setSelected(new Set())
    setDragIdx(null)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Cartas de {p.name}</h3>
          <div className="spacer" />
          <button className="ghost" onClick={onClose}>Cerrar</button>
        </div>

        <div className="tabs tool-tabs" style={{ marginBottom: 8 }}>
          {ZONES.map((z) => (
            <button
              key={z}
              data-zone={z}
              className={`tab tab-lg ${from === z ? 'active' : ''}`}
              onClick={() => switchFrom(z)}
            >
              {ZONE_LABEL[z]} ({count(z)})
            </button>
          ))}
        </div>

        <div className="muted" style={{ marginBottom: 6, fontSize: 12 }}>
          Cartas de <b>{ZONE_LABEL[from]}</b> — tocá para seleccionar y luego elegí a dónde moverlas.
          {isArsenal && <span> Arrastrá las cartas para reordenar el Arsenal.</span>}
        </div>

        <div
          className="hand"
          style={{ width: '100%', maxHeight: 340, overflowY: 'auto', flexWrap: 'wrap' }}
          onDragOver={isArsenal ? (e) => e.preventDefault() : undefined}
          onDrop={isArsenal ? (e) => { e.preventDefault(); handleDrop(list.length) } : undefined}
        >
          {list.length === 0 ? (
            <span className="muted">Zona vacía.</span>
          ) : (
            list.map((id, idx) =>
              isArsenal ? (
                <div
                  key={`${id}-${idx}`}
                  className={`pt-drag-item ${dragIdx === idx ? 'pt-dragging' : ''} ${overIdx === idx ? 'pt-drop-target' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    setDragIdx(idx)
                    if (overIdx === idx) setOverIdx(null)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (overIdx !== idx) setOverIdx(idx)
                  }}
                  onDragLeave={() => {
                    if (overIdx === idx) setOverIdx(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDrop(idx)
                  }}
                  onDragEnd={() => {
                    setDragIdx(null)
                    setOverIdx(null)
                  }}
                >
                  <CardFace
                    id={id}
                    size="sm"
                    selected={selected.has(idx)}
                    onClick={() => toggle(idx)}
                  />
                </div>
              ) : (
                <CardFace
                  key={`${id}-${idx}`}
                  id={id}
                  size="sm"
                  selected={selected.has(idx)}
                  onClick={() => toggle(idx)}
                />
              ),
            )
          )}
        </div>

        <div className="row" style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
          {ZONES.filter((z) => z !== from).map((z) => (
            <button
              key={z}
              data-zone={z}
              className={`tab tab-lg ${to === z ? 'active' : ''}`}
              onClick={() => setTo(z)}
            >
              {ZONE_LABEL[z]} ({count(z)})
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
          <button className="ghost" onClick={() => { store.manualShuffleArsenal(playerIdx); switchFrom('arsenal') }}>
            Barajar Arsenal
          </button>
          <span className="muted" style={{ fontSize: 12 }}>Mostrar tu mano a:</span>
          {game.players.map((op, i) => {
            if (i === playerIdx) return null
            const shown = p.handRevealedTo === i
            return (
              <button
                key={i}
                className={`ghost ${shown ? 'reveal-target' : ''}`}
                onClick={() => store.manualRevealHand(playerIdx, shown ? null : i)}
              >
                {shown ? '✓ ' : ''}{op.name}
              </button>
            )
          })}
          <button className="ghost" onClick={() => store.manualRevealHand(playerIdx, null)}>
            Ocultar mano
          </button>
        </div>

        <div className="row" style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
          <button className="ghost" onClick={() => setRevealPick((v) => !v)}>
            👁 {revealPick ? 'Elegí un jugador…' : 'Revelar mano del oponente'}
          </button>
          {revealPick && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {game.players.map((op, i) => {
                if (i === playerIdx) return null
                const revealed = op.handRevealedTo === playerIdx
                return (
                  <button
                    key={i}
                    className={`ghost ${revealed ? 'reveal-target' : ''}`}
                    onClick={() => {
                      store.manualRevealHand(i, revealed ? null : playerIdx)
                      setRevealPick(false)
                    }}
                  >
                    {revealed ? '✓ ' : ''}{op.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {game.players.map((op, i) => {
          if (i === playerIdx || op.handRevealedTo !== playerIdx) return null
          return (
            <div key={`revealed-${i}`} className="card" style={{ marginTop: 10 }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <div className="big-label" style={{ margin: 0, fontSize: 12, flex: 1 }}>
                  Mano revelada de {op.name}
                </div>
                <button className="ghost" onClick={() => store.manualRevealHand(i, null)}>Ocultar</button>
              </div>
              {op.hand.length === 0 ? (
                <span className="muted">Mano vacía.</span>
              ) : (
                <div className="hand" style={{ width: '100%', maxHeight: 160, overflowY: 'auto', flexWrap: 'wrap' }}>
                  {op.hand.map((id, j) => (
                    <CardFace key={`${id}-${j}`} id={id} size="sm" />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
          <button className="primary" disabled={selected.size === 0} onClick={doMove}>
            Mover {selected.size || ''} → {ZONE_LABEL[to]}
          </button>
        </div>
      </div>
    </div>
  )
}
