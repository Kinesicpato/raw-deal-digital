import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { CardFace } from './CardView'
import type { GameState } from '../engine/types'
import type { ManualZone, ArsenalPosition } from '../engine/game'
import { ArsenalPositionPicker } from './ArsenalPositionPicker'

const ZONES: ManualZone[] = ['hand', 'arsenal', 'ring', 'ringside', 'midmatch', 'backlashMid', 'out']
const ZONE_LABEL: Record<ManualZone, string> = {
  hand: 'Mano',
  arsenal: 'Arsenal',
  ring: 'Ring Area',
  ringside: 'Ringside',
  midmatch: 'Mid Match',
  backlashMid: 'Backlash Mid',
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
  const [pendingMove, setPendingMove] = useState<{ ids: string[]; from: ManualZone } | null>(null)
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
      case 'backlashMid':
        return pl.backlashMid
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
      case 'backlashMid':
        return p.backlashMid.length
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
    if (to === 'arsenal') {
      setPendingMove({ ids, from })
      return
    }
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
    <>
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

          <div className="row" style={{ marginBottom: 6, gap: 6 }}>
            <button
              className="ghost"
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => setSelected(new Set(list.map((_, i) => i)))}
            >
              Seleccionar todo ({list.length})
            </button>
            <button
              className="ghost"
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => setSelected(new Set())}
            >
              Deseleccionar
            </button>
          </div>

          <div
            className="hand"
            style={{ width: '100%', maxHeight: 500, overflowY: 'auto', flexWrap: 'wrap' }}
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
          </div>

          <ShowCardToOpponent game={game} playerIdx={playerIdx} list={list} selected={selected} zone={from} />

          <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
            <button className="primary" disabled={selected.size === 0} onClick={doMove}>
              Mover {selected.size || ''} → {ZONE_LABEL[to]}
            </button>
          </div>
        </div>
      </div>
      {pendingMove && (
        <ArsenalPositionPicker
          cardCount={pendingMove.ids.length}
          onPick={(position: ArsenalPosition) => {
            const err = store.manualMove(playerIdx, pendingMove.from, 'arsenal', pendingMove.ids, position)
            if (err) store.setLastError(err)
            setPendingMove(null)
            setSelected(new Set())
          }}
          onCancel={() => setPendingMove(null)}
        />
      )}
    </>
  )
}

function ShowCardToOpponent({
  game,
  playerIdx,
  list,
  selected,
  zone,
}: {
  game: GameState
  playerIdx: number
  list: string[]
  selected: Set<number>
  zone: ManualZone
}) {
  const store = useAppStore.getState()
  const shown = game._shownCard

  const selectedIds = [...selected].map((i) => list[i]).filter((id): id is string => typeof id === 'string')

  if (shown && shown.from === playerIdx && selectedIds.length === 0) {
    return (
      <div className="show-opponent-pick" style={{ marginTop: 10 }}>
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="big-label" style={{ margin: 0, fontSize: 12, flex: 1 }}>
            Mostrando {shown.cardIds.length} carta(s) a {game.players[shown.to]?.name}:
          </span>
          <button className="ghost" onClick={() => store.clearShownCard()}>Ocultar</button>
        </div>
        <div className="hand" style={{ flexWrap: 'wrap', maxHeight: 200, overflowY: 'auto' }}>
          {shown.cardIds.map((id) => (
            <CardFace key={id} id={id} size="sm" />
          ))}
        </div>
      </div>
    )
  }

  if (selectedIds.length === 0) return null

  return (
    <div className="show-opponent-pick" style={{ marginTop: 10 }}>
      <div className="row" style={{ marginBottom: 4 }}>
        <span className="big-label" style={{ margin: 0, fontSize: 12, flex: 1 }}>
          Mostrar {ZONE_LABEL[zone]} a:
        </span>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {game.players.map((op, i) => {
          if (i === playerIdx) return null
          return (
            <button
              key={i}
              className="ghost"
              onClick={() => {
                store.clearShownCard()
                for (const cid of selectedIds) {
                  store.showCardToOpponent(playerIdx, cid, i)
                }
              }}
            >
              {op.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
