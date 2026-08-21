import { useMemo, useRef, useState } from 'react'
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
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const dragIdxRef = useRef<number | null>(null)

  const list = useMemo(() => {
    const pl = game.players[playerIdx]
    if (!pl) return []
    switch (from) {
      case 'hand':
        return pl.hand
      case 'arsenal':
        return pl.arsenal
      case 'ring':
        return pl.ring
      case 'ringside':
        return pl.ringside
      case 'midmatch':
        return pl.midmatchPlayed
      case 'out':
        return pl.outOfGame
    }
  }, [game, from, playerIdx])

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
    const fromIdx = dragIdxRef.current
    if (fromIdx === null) return
    dragIdxRef.current = null
    if (fromIdx === targetIdx) return
    const arr = [...list]
    const [moved] = arr.splice(fromIdx, 1)
    if (!moved) return
    const insertAt = targetIdx > fromIdx ? targetIdx - 1 : targetIdx
    arr.splice(insertAt, 0, moved)
    const err = store.manualReorderArsenal(playerIdx, arr)
    if (err) store.setLastError(err)
    setSelected(new Set())
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
          onDragOver={isArsenal ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } : undefined}
          onDrop={isArsenal ? (e) => { e.preventDefault(); if (e.target === e.currentTarget) handleDrop(list.length) } : undefined}
        >
          {list.length === 0 ? (
            <span className="muted">Zona vacía.</span>
          ) : (
            list.map((id, idx) =>
              isArsenal ? (
                <div
                  key={`${id}-${idx}`}
                  className={`pt-drag-item ${dragIdx === idx ? 'pt-dragging' : ''} ${overIdx === idx && dragIdx !== idx ? 'pt-drop-target' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    dragIdxRef.current = idx
                    setDragIdx(idx)
                    if (overIdx === idx) setOverIdx(null)
                    e.dataTransfer.setData('text/plain', String(idx))
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
                    e.stopPropagation()
                    handleDrop(idx)
                  }}
                  onDragEnd={() => {
                    dragIdxRef.current = null
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

        <ShowCardToOpponent game={game} playerIdx={playerIdx} list={list} from={from} selected={selected} />

        <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
          <button className="primary" disabled={selected.size === 0} onClick={doMove}>
            Mover {selected.size || ''} → {ZONE_LABEL[to]}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShowCardToOpponent({
  game,
  playerIdx,
  list,
  from,
  selected,
}: {
  game: GameState
  playerIdx: number
  list: string[]
  from: ManualZone
  selected: Set<number>
}) {
  const store = useAppStore.getState()
  const [showPick, setShowPick] = useState(false)
  const [pickCards, setPickCards] = useState<Set<number>>(new Set())
  const [pickOpponent, setPickOpponent] = useState<number | null>(null)
  const shown = game._shownCard

  if (shown && shown.from === playerIdx) {
    return (
      <div className="show-opponent-pick" style={{ marginTop: 10 }}>
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="big-label" style={{ margin: 0, fontSize: 12, flex: 1 }}>
            Mostrando a {game.players[shown.to]?.name}:
          </span>
          <button className="ghost" onClick={() => store.clearShownCard()}>Ocultar</button>
        </div>
        <div className="hand" style={{ flexWrap: 'wrap' }}>
          <CardFace id={shown.cardId} size="sm" />
        </div>
      </div>
    )
  }

  // Cards selected in the zone viewer
  const selectedIds = [...selected].map((i) => list[i]).filter((id): id is string => typeof id === 'string')
  // Cards picked within this component
  const pickedIds = [...pickCards].map((i) => list[i]).filter((id): id is string => typeof id === 'string')
  const cardIds = selectedIds.length > 0 ? selectedIds : pickedIds

  return (
    <div className="show-opponent-pick" style={{ marginTop: 10 }}>
      <div className="row" style={{ marginBottom: 6 }}>
        <button
          className="ghost"
          onClick={() => {
            setShowPick((v) => !v)
            setPickCards(new Set())
          }}
        >
          👁 {showPick ? 'Cerrar selector' : 'Mostrar carta(s) a oponente'}
        </button>
      </div>
      {showPick && (
        <>
          <p className="muted" style={{ fontSize: 12, margin: '0 0 6px' }}>
            Seleccioná cartas de <b>{ZONE_LABEL[from]}</b> para mostrar:
          </p>
          <div className="show-opponent-pick" style={{ maxHeight: 160, overflowY: 'auto', flexWrap: 'wrap', gap: 4, display: 'flex' }}>
            {list.length === 0 && <span className="muted">Zona vacía.</span>}
            {list.map((id, idx) => (
              <div
                key={`${id}-${idx}`}
                onClick={() => {
                  setPickCards((prev) => {
                    const next = new Set(prev)
                    if (next.has(idx)) next.delete(idx)
                    else next.add(idx)
                    return next
                  })
                }}
                style={{ cursor: 'pointer', border: pickCards.has(idx) ? '2px solid var(--gold)' : '2px solid transparent', borderRadius: 4 }}
              >
                <CardFace id={id} size="xs" />
              </div>
            ))}
          </div>
        </>
      )}
      {cardIds.length > 0 && (
        <>
          <div className="row" style={{ marginTop: 6, marginBottom: 4 }}>
            <span className="big-label" style={{ margin: 0, fontSize: 12, flex: 1 }}>
              Mostrar {cardIds.length === 1 ? 'esta carta' : 'estas cartas'} a:
            </span>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {game.players.map((op, i) => {
              if (i === playerIdx) return null
              return (
                <button
                  key={i}
                  className={`ghost ${pickOpponent === i ? 'reveal-target' : ''}`}
                  onClick={() => {
                    for (const cid of cardIds) {
                      store.showCardToOpponent(playerIdx, cid, i)
                    }
                    setPickCards(new Set())
                    setShowPick(false)
                    setPickOpponent(null)
                  }}
                >
                  {op.name}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
