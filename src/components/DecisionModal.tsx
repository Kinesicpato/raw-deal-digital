import { useEffect, useRef, useState } from 'react'
import { getCardSafe, useAppStore } from '../store/useAppStore'
import type { PendingDecision } from '../engine/types'
import { parseCardRef } from '../engine/game'
import { decisionOwner } from '../online/types'
import { CardFace } from './CardView'

export function DecisionModal() {
  const game = useAppStore((s) => s.game)
  const online = useAppStore((s) => s.online)
  const resolvePending = useAppStore((s) => s.resolvePending)
  const resolveReversal = useAppStore((s) => s.resolveReversal)
  const flipOverturn = useAppStore((s) => s.flipOverturn)
  const stopOverturn = useAppStore((s) => s.stopOverturn)

  const processingRefs = useRef<Record<string, boolean>>({})

  const d: PendingDecision | null = game?.pendingDecision ?? null

  // Reset all processing flags whenever the game state changes (new broadcast,
  // turn advance, etc.) so the anti-double-click guard never stays stale across
  // different decisions or phases.
  useEffect(() => {
    processingRefs.current = {}
  }, [game])

  if (!d || !game) return null

  // In an online match, only the player responsible for this decision may see it.
  // Exception: reversalPlayed and multiplayer reversalChoice are shown to all players.
  const owner = decisionOwner(game)
  const isMultiReversal = d.type === 'reversalChoice' && 'reversedPlayers' in d && d.reversedPlayers
  if (online.role && online.myIdx !== owner && d.type !== 'reversalPlayed' && !isMultiReversal) return null

  // Per-action guard. Each decision sub-action gets its own flag so a stalled
  // intent (dropped host response, validation rejection, or a thrown network
  // error) can never block a *different* action in the same modal — e.g. a
  // stuck "flip" must not prevent the player from clicking "stop" to close the
  // damage window.
  //
  // The 2.5s timeout is scheduled in a `finally` block so it ALWAYS runs, even
  // if the wrapped call throws (for example clientSendIntent throwing on a
  // degraded peer connection). Without this, a throw would leave processingRef
  // stuck true forever and freeze the modal for the rest of the match.
  const guard = <T extends unknown[]>(key: string, fn: (...args: T) => void) => {
    return (...args: T) => {
      if (processingRefs.current[key]) return
      processingRefs.current[key] = true
      try {
        fn(...args)
      } finally {
        window.setTimeout(() => {
          processingRefs.current[key] = false
        }, 2500)
      }
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        {d.type === 'chooseTarget' && (
          <ChooseTarget
            decision={d}
            onPick={guard('target', (idx) => resolvePending(idx))}
          />
        )}
        {d.type === 'reversalChoice' && (
          <ReversalChoice decision={d} onResolve={guard('reversal', resolveReversal)} />
        )}
        {d.type === 'reversalPlayed' && (
          <ReversalPlayed decision={d} onContinue={guard('reversalContinue', () => resolvePending(null))} />
        )}
        {d.type === 'overturnCards' && (
          <OverturnCards decision={d} onFlip={guard('flip', flipOverturn)} onStop={guard('stop', stopOverturn)} />
        )}
        {(d.type === 'chooseCardsFromHand') && (
          <ChooseFromHand decision={d} onDone={guard('hand', (ids) => resolvePending(ids))} />
        )}
        {d.type === 'chooseOpponentHandCard' && (
          <ChooseOpponentCard
            decision={d}
            onPick={guard('oppHand', (id) => resolvePending(id))}
          />
        )}
        {d.type === 'chooseRingsideCards' && (
          <ChooseRingside decision={d} onDone={guard('ringside', (ids) => resolvePending(ids))} />
        )}
        {d.type === 'reorderOpponentArsenal' && (
          <ReorderArsenal decision={d} onDone={guard('reorder', (order) => resolvePending(order))} />
        )}
        {d.type === 'searchArsenal' && (
          <SearchArsenal decision={d} onPick={guard('search', (id) => resolvePending(id))} />
        )}
        {d.type === 'concedeChoice' && (
          <ConcedeChoice decision={d} onResolve={guard('concede', (v) => resolvePending(v))} />
        )}
      </div>
    </div>
  )
}

function ChooseTarget({ decision, onPick }: { decision: Extract<PendingDecision, { type: 'chooseTarget' }>; onPick: (idx: number) => void }) {
  const players = useAppStore((s) => s.game?.players ?? [])
  return (
    <>
      <h3>Elige objetivo</h3>
      <p className="muted">La carta <b>{getCardSafe(decision.cardId).name}</b> necesita un objetivo.</p>
      <div className="grid" style={{ marginTop: 10 }}>
        {players.map((p, i) => {
          if (i === decision.playerIdx || p.eliminated) return null
          return (
            <button key={p.id} className="row" style={{ justifyContent: 'space-between' }} onClick={() => onPick(i)}>
              <span>{p.name}</span>
              <span className="stat-chip mono">Arsenal {p.arsenal.length}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

function ReversalChoice({ decision, onResolve }: { decision: Extract<PendingDecision, { type: 'reversalChoice' }>; onResolve: (payload: { cardIds: string[]; defenderIdx?: number; pass?: boolean } | null) => void }) {
  const game = useAppStore((s) => s.game)
  const myIdx = useAppStore((s) => s.online.myIdx)
  const online = useAppStore((s) => s.online)
  const attacker = game?.players[game.resolution?.attacker ?? -1]
  const played = game?.resolution ? getCardSafe(game.resolution.cardId) : null
  const [sel, setSel] = useState<string[]>([])

  const isMulti = !!(decision.reversedPlayers && game && game.players.length > 2)
  const myPlayerIdx = isMulti ? myIdx : decision.defenderIdx
  const amEligible = isMulti
    ? online.myIdx !== null
      ? myPlayerIdx !== null && myPlayerIdx !== game?.resolution?.attacker && !decision.reversedPlayers!.includes(myPlayerIdx)
      : true
    : true
  const defender = game?.players[isMulti ? (myPlayerIdx ?? decision.defenderIdx) : decision.defenderIdx]

  const toggle = (key: string) =>
    setSel((prev) => {
      if (prev.includes(key)) return prev.filter((x) => x !== key)
      return [...prev, key]
    })

  const handleReverse = () => {
    if (isMulti && myPlayerIdx !== null) {
      onResolve({ cardIds: sel, defenderIdx: myPlayerIdx })
    } else {
      onResolve({ cardIds: sel })
    }
  }

  const handlePass = () => {
    if (isMulti && myPlayerIdx !== null) {
      onResolve({ cardIds: [], defenderIdx: myPlayerIdx, pass: true })
    } else {
      onResolve(null)
    }
  }

  return (
    <>
      <h3>Ventana de Reversal</h3>
      {isMulti && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {game?.players.map((pl, i) => {
            if (i === game.resolution?.attacker) return null
            const passed = decision.reversedPlayers?.includes(i)
            const isMe = i === myPlayerIdx
            return (
              <span
                key={i}
                className={`stat-chip ${isMe && amEligible ? 'badge-fort' : ''}`}
                style={{ opacity: passed ? 0.4 : 1 }}
              >
                {pl.name} {isMe ? '(vos)' : ''} {passed ? '✓' : ''}
              </span>
            )
          })}
        </div>
      )}
      <p className="muted">
        <b>{attacker?.name}</b> jugó <b>{played?.name ?? ''}</b>.
        {amEligible ? ' Elegí cartas para revertir:' : isMulti ? ' Esperandodecisiones...' : ''}
      </p>
      <p className="muted" style={{ margin: '4px 0 8px' }}>
        Carta de <b>mano</b> → va a tu <b>Ring Area</b>. Carta de <b>Backlash</b> → va a tu zona <b>Mid-match</b>.
      </p>
      {played && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, margin: '12px 0' }}>
          <CardFace id={played.id} size="lg" />
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span className="stat-chip">Fortitude <b>{played.fortitude}F</b></span>
            <span className="stat-chip">Daño <b>{played.damage}D</b></span>
            {played.traits && played.traits.length > 0 && (
              <span className="stat-chip">{played.traits.join(' · ')}</span>
            )}
          </div>
          <p className="muted" style={{ textAlign: 'center', margin: 0, maxWidth: 420 }}>{played.text}</p>
        </div>
      )}
      {amEligible && (
        <>
          <div className="big-label" style={{ marginTop: 8 }}>Tu mano</div>
          <div className="hand" style={{ maxHeight: 200, overflowY: 'auto', flexWrap: 'wrap' }}>
            {defender?.hand.map((id, idx) => {
              const key = `hand:${idx}:${id}`
              return (
                <CardFace key={key} id={id} size="sm" playable selected={sel.includes(key)} onClick={() => toggle(key)} />
              )
            })}
            {(!defender || defender.hand.length === 0) && <span className="muted">Sin cartas en mano.</span>}
          </div>
          {defender && defender.backlashMid.length > 0 && (
            <>
              <div className="big-label" style={{ marginTop: 8 }}>Backlash (Mid-match)</div>
              <div className="hand" style={{ maxHeight: 160, overflowY: 'auto', flexWrap: 'wrap' }}>
                {defender.backlashMid.map((id, idx) => {
                  const key = `backlashMid:${idx}:${id}`
                  return (
                    <CardFace key={key} id={id} size="sm" playable selected={sel.includes(key)} onClick={() => toggle(key)} />
                  )
                })}
              </div>
            </>
          )}
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <button className="primary" onClick={handlePass} style={{ flex: 1 }}>
              No revertir (tomar el daño)
            </button>
            <button className="primary" disabled={sel.length === 0} onClick={handleReverse} style={{ flex: 1 }}>
              Revertir {sel.length > 0 ? `(${sel.length})` : ''}
            </button>
          </div>
        </>
      )}
    </>
  )
}

function ReversalPlayed({ decision, onContinue }: { decision: Extract<PendingDecision, { type: 'reversalPlayed' }>; onContinue: () => void }) {
  const game = useAppStore((s) => s.game)
  const undoReversalAction = useAppStore((s) => s.undoReversalAction)
  const attacker = game?.players[decision.attackerIdx]
  const cardIds = decision.reversalCardIds

  const defenderIdx = game?.resolution ? game.resolution.target : -1

  const handleUndo = () => {
    if (defenderIdx >= 0) undoReversalAction(defenderIdx, cardIds)
  }

  // Extract actual card IDs from composite keys for display.
  const displayIds = cardIds.map((ref) => parseCardRef(ref)?.cardId ?? ref)

  return (
    <>
      <h3>Reversal aplicado</h3>
      <p className="muted">
        <b>{attacker?.name}</b>, tu oponente revirtió tu jugada con{' '}
        <b>{displayIds.length === 1 ? getCardSafe(displayIds[0]!).name : `${displayIds.length} cartas`}</b>.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, margin: '12px 0' }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {cardIds.map((ref, i) => {
            const cardId = parseCardRef(ref)?.cardId ?? ref
            const card = getCardSafe(cardId)
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <CardFace id={card.id} size="lg" />
                <div className="row" style={{ gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {card.fortitude > 0 && <span className="stat-chip">F{card.fortitude}</span>}
                  {card.damage > 0 && <span className="stat-chip">D{card.damage}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <button className="ghost" onClick={handleUndo} style={{ flex: 1 }}>
          Volver (elegir otras cartas)
        </button>
        <button className="primary" onClick={onContinue} style={{ flex: 1 }}>
          Continuar
        </button>
      </div>
    </>
  )
}

function OverturnCards({ decision, onFlip, onStop }: { decision: Extract<PendingDecision, { type: 'overturnCards' }>; onFlip: () => void; onStop: () => void }) {
  const game = useAppStore((s) => s.game)
  const p = game?.players[decision.playerIdx]
  const res = game?.resolution
  const attacked = res ? getCardSafe(res.cardId) : null
  const flipped = decision.overturned
  const printed = decision.damageToDeal

  if (!p || !game || !res) return null
  const isAttacker = res.attacker === decision.playerIdx
  const payerName = p.name
  const foe = game.players[isAttacker ? res.target : res.attacker]

  return (
    <>
      <h3>Daño — Voluntario (vos decidís cuánto tomás)</h3>
      <p className="muted">
        {attacked?.name} imprime <b>{printed} de daño</b>, pero el juego no lo impone: <b>{payerName}</b> elige
        cuántas cartas voltear (contra <b>{foe?.name}</b>). Podés seguir mientras quieras o parar en cualquier momento.
      </p>
      <p className="muted">
        Cada carta que voltees queda boca arriba en tu Ringside. Leé su texto: si aparece una reversión
        que puedas pagar, aplicá la regla de mesa a mano.
      </p>
      <div className="row" style={{ marginTop: 8, gap: 10, alignItems: 'center' }}>
        <span className="stat-chip badge-fort mono">Daño tomado {flipped}</span>
        <span className="stat-chip mono">Arsenal {p.arsenal.length}</span>
        {p.ringside.length > 0 && (
          <span className="stat-chip mono">Ringside {p.ringside.length}</span>
        )}
      </div>
      {flipped > 0 && (
        <>
          <div className="big-label" style={{ marginTop: 10 }}>
            Cartas volteadas (última arriba)
          </div>
          <div className="hand" style={{ maxHeight: 210, overflowY: 'auto', flexWrap: 'wrap' }}>
            {p.ringside
              .slice(-flipped)
              .map((id, i) => (
                <CardFace
                  key={id}
                  id={id}
                  size="sm"
                  playable
                  selected={i === flipped - 1}
                />
              ))}
          </div>
        </>
      )}
      <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end', gap: 8 }}>
        <button
          className="primary"
          onClick={onStop}
          style={{ fontSize: 15, padding: '10px 18px', position: 'relative' }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, background: '#d02020', color: '#fff', fontWeight: 900, fontSize: 13, lineHeight: 1 }}>⛔</span>
            Parar (dejar de recibir daño)
          </span>
        </button>
        <button
          className="primary"
          disabled={p.arsenal.length === 0}
          onClick={onFlip}
          style={{ fontSize: 15, padding: '10px 18px' }}
        >
          Voltear siguiente carta
        </button>
      </div>
      {p.arsenal.length === 0 && (
        <p className="muted" style={{ marginTop: 6 }}>
          Arsenal vacío: no podés seguir volteando. Tocá "Parar" para terminar.
        </p>
      )}
    </>
  )
}

function ConcedeChoice({ decision, onResolve }: { decision: Extract<PendingDecision, { type: 'concedeChoice' }>; onResolve: (v: boolean) => void }) {
  const game = useAppStore((s) => s.game)
  const p = game?.players[decision.playerIdx]
  const foe = game?.players.find((q) => q.id !== p?.id && !q.eliminated)
  return (
    <>
      <h3>Quedaste sin cartas en el Arsenal</h3>
      <p className="muted">
        <b>{p?.name}</b> no tiene más cartas en su Arsenal. En mesa eso suele significar derrota (pin/count-out),
        pero acá el juego es manual: vos decidís.
      </p>
      <div className="row" style={{ marginTop: 14, gap: 8, justifyContent: 'flex-end' }}>
        <button
          className="ghost"
          onClick={() => onResolve(false)}
          style={{ fontSize: 15, padding: '10px 18px' }}
        >
          Seguir jugando (usar herramientas)
        </button>
        <button
          className="danger"
          onClick={() => onResolve(true)}
          style={{ fontSize: 15, padding: '10px 18px' }}
        >
          Perder la partida
        </button>
      </div>
      {foe && (
        <p className="muted" style={{ marginTop: 10 }}>
          Si perdés, la victoria va para <b>{foe.name}</b>.
        </p>
      )}
    </>
  )
}

function ChooseFromHand({ decision, onDone }: { decision: Extract<PendingDecision, { type: 'chooseCardsFromHand' }>; onDone: (ids: string[]) => void }) {
  const players = useAppStore((s) => s.game?.players ?? [])
  const p = players[decision.playerIdx]
  const [sel, setSel] = useState<string[]>([])
  const required = decision.count

  useEffect(() => setSel([]), [decision])

  if (!p) return null
  const maxSelectable = required === 0 ? p.hand.length : required

  const toggle = (id: string) =>
    setSel((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= maxSelectable) return prev
      return [...prev, id]
    })

  const canConfirm = required === 0 ? sel.length > 0 : sel.length === required

  return (
    <>
      <h3>{decision.purpose === 'switch' ? 'The Switch' : 'Descarta cartas'}</h3>
      <p className="muted">
        {p.name}, {decision.purpose === 'switch' ? 'elige cuántas cartas descartar para recuperar la misma cantidad de Ringside' : `elige ${required} carta(s) de tu mano para descartar`}.
      </p>
      <div className="hand" style={{ maxHeight: 260, overflowY: 'auto', flexWrap: 'wrap' }}>
        {p.hand.map((id) => (
          <CardFace key={id} id={id} size="sm" selected={sel.includes(id)} onClick={() => toggle(id)} />
        ))}
      </div>
      <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
        <span className="muted">{sel.length}/{maxSelectable}</span>
        <button className="primary" disabled={!canConfirm} onClick={() => onDone(sel)}>
          Confirmar
        </button>
      </div>
    </>
  )
}

function ChooseOpponentCard({ decision, onPick }: { decision: Extract<PendingDecision, { type: 'chooseOpponentHandCard' }>; onPick: (id: string) => void }) {
  const players = useAppStore((s) => s.game?.players ?? [])
  const p = players[decision.playerIdx]
  if (!p) return null
  return (
    <>
      <h3>Elige una carta de la mano</h3>
      <p className="muted">Mira la mano de {p.name} y elige 1 carta que deba descartar.</p>
      <div className="hand" style={{ maxHeight: 260, overflowY: 'auto', flexWrap: 'wrap' }}>
        {p.hand.map((id) => (
          <CardFace key={id} id={id} size="sm" onClick={() => onPick(id)} />
        ))}
      </div>
    </>
  )
}

function ChooseRingside({ decision, onDone }: { decision: Extract<PendingDecision, { type: 'chooseRingsideCards' }>; onDone: (ids: string[]) => void }) {
  const players = useAppStore((s) => s.game?.players ?? [])
  const p = players[decision.playerIdx]
  const [sel, setSel] = useState<string[]>([])

  useEffect(() => setSel([]), [decision])

  if (!p) return null
  const toggle = (id: string) =>
    setSel((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= decision.count) return prev
      return [...prev, id]
    })

  return (
    <>
      <h3>Elige de Ringside</h3>
      <p className="muted">
        {p.name}, elige {decision.count} carta(s) de tu Ringside para llevarlas a tu mano.
      </p>
      <div className="hand" style={{ maxHeight: 260, overflowY: 'auto', flexWrap: 'wrap' }}>
        {p.ringside.map((id) => (
          <CardFace key={id} id={id} size="sm" selected={sel.includes(id)} onClick={() => toggle(id)} />
        ))}
      </div>
      <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
        <button className="primary" disabled={sel.length !== decision.count} onClick={() => onDone(sel)}>
          Confirmar
        </button>
      </div>
    </>
  )
}

function ReorderArsenal({ decision, onDone }: { decision: Extract<PendingDecision, { type: 'reorderOpponentArsenal' }>; onDone: (order: string[]) => void }) {
  const players = useAppStore((s) => s.game?.players ?? [])
  const game = useAppStore((s) => s.game)
  const [order, setOrder] = useState<string[]>([])
  useEffect(() => setOrder([]), [decision])
  const me = game?.players[decision.playerIdx]
  if (!me || !game) return null
  const targetIdx = game.resolution?.target ?? (decision.playerIdx + 1) % players.length
  const target = players[targetIdx]
  if (!target) return null
  const top = target.arsenal.slice(0, decision.amount)
  const remaining = top.filter((id) => !order.includes(id))
  const canConfirm = order.length === top.length

  return (
    <>
      <h3>Reordena el Arsenal</h3>
      <p className="muted">Mira las top {decision.amount} cartas del Arsenal de {target.name} y ordénalas de arriba a abajo.</p>
      <div className="big-label">Orden actual</div>
      <div className="row">
        {order.map((id, i) => (
          <div key={id} onClick={() => setOrder((o) => o.filter((x) => x !== id))} style={{ cursor: 'pointer' }}>
            <CardFace id={id} size="xs" />
            <div className="muted" style={{ fontSize: 10 }}>{i + 1}</div>
          </div>
        ))}
        {order.length === 0 && <span className="muted">Aún sin elegir</span>}
      </div>
      <div className="big-label">Elige la siguiente</div>
      <div className="row">
        {remaining.map((id) => (
          <div key={id} onClick={() => setOrder((o) => [...o, id])} style={{ cursor: 'pointer' }}>
            <CardFace id={id} size="xs" />
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
        <button className="primary" disabled={!canConfirm} onClick={() => onDone(order)}>
          Confirmar orden
        </button>
      </div>
    </>
  )
}

function SearchArsenal({ decision, onPick }: { decision: Extract<PendingDecision, { type: 'searchArsenal' }>; onPick: (ids: string[]) => void }) {
  const pool = useAppStore((s) => s.game?._searchPool ?? [])
  const players = useAppStore((s) => s.game?.players ?? [])
  const p = players[decision.playerIdx]
  const [sel, setSel] = useState<string[]>([])

  useEffect(() => setSel([]), [decision])

  const toggle = (id: string) =>
    setSel((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= decision.count) return prev
      return [...prev, id]
    })

  const canConfirm = decision.count > 1 ? sel.length > 0 : sel.length === decision.count

  return (
    <>
      <h3>Busca en tu Arsenal</h3>
      <p className="muted">
        {p?.name}, elige {decision.count > 1 ? `hasta ${decision.count}` : '1'} carta(s) de tu Arsenal para llevar a tu mano.
      </p>
      <div className="hand" style={{ maxHeight: 260, overflowY: 'auto', flexWrap: 'wrap' }}>
        {pool.map((id) => (
          <CardFace key={id} id={id} size="sm" selected={sel.includes(id)} onClick={() => toggle(id)} />
        ))}
        {pool.length === 0 && <span className="muted">No hay cartas que cumplan la búsqueda.</span>}
      </div>
      <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
        <button className="ghost" disabled={pool.length === 0} onClick={() => onPick([])}>
          Omitir
        </button>
        <button className="primary" disabled={!canConfirm} onClick={() => onPick(sel)}>
          Confirmar
        </button>
      </div>
    </>
  )
}
