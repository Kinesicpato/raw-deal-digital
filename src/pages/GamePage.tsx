import { useEffect, useState } from 'react'
import { useAppStore, getCardSafe } from '../store/useAppStore'
import type { GameState, PlayerState } from '../engine/types'
import { CardFace, CardDetailModal, cardTypeLabel } from '../components/CardView'
import { CardZoomPreview } from '../components/CardZoom'
import { DecisionModal } from '../components/DecisionModal'
import { PlayerToolsModal } from '../components/PlayerTools'
import type { ManualZone } from '../engine/game'
import { computeFortitude } from '../engine/rules'
import { CardTypeTabs, classifyCard, type CardClassFilter } from '../components/CardTypeTabs'
import { AppBanner } from '../components/Branding'
import { Toast } from '../components/Toast'
import { buildClientView } from '../online/types'

export function GamePage() {
  const game = useAppStore((s) => s.game)
  const lastError = useAppStore((s) => s.lastError)
  const clearError = useAppStore((s) => s.clearError)
  const online = useAppStore((s) => s.online)
  const [detail, setDetail] = useState<string | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)
  const [tools, setTools] = useState<{ player: number; zone?: ManualZone } | null>(null)
  const [playConfirm, setPlayConfirm] = useState<{ id: string; zone?: 'hand' | 'midmatch' | 'prematch' } | null>(null)

  // Clear the corner zoom as soon as a playable card resolves (the hovered
  // card either left the hand or is no longer the active play), so it doesn't
  // stay stuck on mobile where mouseleave never fires.
  const resolutionId = game?.resolution?.cardId ?? null
  useEffect(() => {
    if (!resolutionId) setZoom(null)
  }, [resolutionId])

  // Each time the turn passes, bring the active player's panel into view so
  // the screen "expands" toward whoever is on turn (notably in local play on
  // mobile/with several seats).
  const activeIdx = game?.activeIndex ?? null
  useEffect(() => {
    if (activeIdx == null) return
    const raf = requestAnimationFrame(() => {
      document
        .querySelector(`[data-player="${activeIdx}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(raf)
  }, [activeIdx])

  if (!game) {
    return (
      <div className="page">
        <p>No hay partida activa.</p>
        <button onClick={() => useAppStore.getState().setView('menu')}>Volver al menú</button>
      </div>
    )
  }

  const isOnline = online.role !== null && online.role !== undefined
  const myIdx = online.myIdx
  // Online viewers only ever see the rules-allowed snapshot of the game
  // (opponents' hands/Arsenal/Backlash stay hidden unless a reveal decision
  // exposes them), applied to the host's own screen too.
  const displayGame = isOnline && myIdx != null ? buildClientView(game, myIdx) : game
  const displayActive = displayGame.players[displayGame.activeIndex]
  const isMyTurn = !isOnline || displayGame.activeIndex === myIdx
  const showHandControls = isMyTurn && !!displayActive && !displayActive.isAI

  return (
    <div className="page">
      <AppBanner
        subtitle={isOnline && online.role === 'host' ? 'Partida en línea · anfitrión' : isOnline ? 'Partida en línea' : 'Partida en curso'}
        right={
          <>
            <span className="stat-chip">Turno {displayGame.turnNumber}</span>
            <span className="stat-chip">{phaseLabel[displayGame.phase] ?? displayGame.phase}</span>
            {displayGame.phase !== 'gameover' && displayActive && (
              <span className="stat-chip">Juega {displayActive.name}</span>
            )}
            {isOnline && <span className="stat-chip mono">Código: {online.code}</span>}
            <button className="ghost" onClick={() => useAppStore.getState().setView('menu')}>
              Volver al menú
            </button>
          </>
        }
      />

      <div className="game-layout" style={{ marginTop: 12 }}>
        <div className="game-main">
          <div className="opponents">
            {displayGame.players.map((p, i) => (
              <PlayerPanel
                key={p.id}
                p={p}
                idx={i}
                game={displayGame}
                onCardClick={setDetail}
                onCardHover={setZoom}
                onTools={(zone) => setTools({ player: i, zone })}
                toolsOpen={tools?.player === i}
                toolsEnabled={!isOnline || i === myIdx}
                canControl={!isOnline || i === myIdx}
                compact={isOnline ? i !== myIdx : i !== displayGame.activeIndex}
              />
            ))}
          </div>

          <RingZone game={displayGame} onCardClick={setDetail} onCardHover={setZoom} />

          {displayGame.resolution?.overturning && displayGame.pendingDecision?.type === 'overturnCards' && (
            <OverturnBanner game={displayGame} />
          )}

          {displayGame.phase === 'opening' && <OpeningZone game={displayGame} canInteract={showHandControls} />}

          {displayGame.phase === 'gameover' && <GameOver game={displayGame} />}

          {displayActive && !displayActive.isAI && displayGame.phase === 'main' && showHandControls && (
            <HandZone
              player={displayActive}
              onCardClick={(id, zone) => {
                setZoom(null)
                setPlayConfirm({ id, zone })
              }}
              onCardHover={setZoom}
            />
          )}
          {displayGame.phase === 'main' && !showHandControls && (
            <div className="card" style={{ textAlign: 'center' }}>
              <span className="muted">
                {isOnline ? `Esperando que juegue ${displayActive?.name ?? 'otro jugador'}…` : 'Turno de la IA…'}
              </span>
            </div>
          )}

          {showHandControls && displayGame.phase === 'main' && (
            <button className="primary btn-turn" onClick={() => useAppStore.getState().endTurnAction()}>
              Terminar turno
            </button>
          )}
        </div>
      </div>

      {tools !== null && (
        <PlayerToolsModal
          game={displayGame}
          playerIdx={tools.player}
          initialZone={tools.zone}
          onClose={() => setTools(null)}
        />
      )}
      <DecisionModal />
      <PlayConfirmModal confirm={playConfirm} onClose={() => setPlayConfirm(null)} />
      <CardDetailModal id={detail} onClose={() => setDetail(null)} />
      <CardZoomPreview id={detail ? null : zoom} />
      {lastError && <Toast message={lastError} onClose={clearError} />}
    </div>
  )
}

const phaseLabel: Record<string, string> = {
  opening: 'Elegí tu mano inicial',
  start: 'Inicio de turno',
  draw: 'Draw Segment',
  main: 'Main Segment',
  reversalWindow: 'Ventana de Reversal',
  overturning: 'Volteando cartas…',
  gameover: 'Fin de la partida',
}

function PlayerPanel({
  p,
  idx,
  game,
  onCardClick,
  onCardHover,
  onTools,
  toolsOpen,
  toolsEnabled,
  canControl,
  compact,
}: {
  p: PlayerState
  idx: number
  game: GameState
  onCardClick: (id: string) => void
  onCardHover: (id: string | null) => void
  onTools: (zone?: ManualZone) => void
  toolsOpen: boolean
  toolsEnabled: boolean
  canControl: boolean
  compact?: boolean
}) {
  const isActive = game.activeIndex === idx && game.phase !== 'gameover'
  const isTarget = game.resolution?.target === idx
  const isOverturning = game.resolution?.overturning === true
  const isHandRevealed = p.handRevealedTo !== null
  const hit = isTarget && isOverturning
  // Fortitude Rating shown live: sum of the "D" (Damage) box of every card in
  // the player's Ring area plus Mid-match/Pre-match cards played.
  const rating = computeFortitude([...p.midmatchPlayed, ...p.ring], getCardSafe)
  return (
    <div className={`panel ${isActive ? 'active' : ''} ${hit ? 'panel-hit' : ''} ${p.eliminated ? 'eliminated' : ''} ${compact ? 'compact' : ''}`} data-player={idx}>
      <div className="panel-head">
        {p.superstarId && (
          <span
            style={{ cursor: 'pointer', lineHeight: 0 }}
            onMouseEnter={() => onCardHover(`superstar-${p.superstarId}`)}
            onMouseLeave={() => onCardHover(null)}
            onClick={() => onCardClick(`superstar-${p.superstarId}`)}
          >
            <CardFace id={`superstar-${p.superstarId}`} size="xs" />
          </span>
        )}
        <span>{p.name}</span>
        {p.isAI && <span className="stat-chip">IA</span>}
        {isTarget && <span className="stat-chip" style={{ background: 'var(--red-bright)' }}>Objetivo</span>}
      </div>
      <div className="row player-counts" style={{ gap: 8, margin: '8px 0' }}>
        {hit && <span className="stat-chip damage-chip mono" style={{ background: 'var(--red-bright)', color: '#fff' }}>−{game.resolution?.damageDealt}</span>}
        <span className="stat-chip badge-fort mono" title="Fortitude Rating = suma de la casilla D (Daño) de tus cartas en Ring Area y Mid-match/Pre-match jugadas">
          Fortitude <b>{rating}</b>
        </span>
        <button
          className="zone-chip zone-hand"
          title={isHandRevealed ? `Mano visible para ${game.players[p.handRevealedTo!]?.name ?? 'un oponente'}` : 'Mano oculta · clic para ver/mover cartas'}
          onClick={() => onTools('hand')}
        >
          {isHandRevealed ? '👁 ' : ''}Mano <b>{p.hand.length}</b>
        </button>
        <button className="zone-chip zone-arsenal" title="Clic para ver/mover cartas del Arsenal" onClick={() => onTools('arsenal')}>
          Arsenal <b>{p.arsenal.length}</b>
        </button>
        <button className="zone-chip zone-ringside" title="Clic para ver/mover cartas del Ringside" onClick={() => onTools('ringside')}>
          Ringside <b>{p.ringside.length}</b>
        </button>
        {toolsEnabled && (
          <button
            className={`tools-btn ${toolsOpen ? 'open' : ''}`}
            title="Herramientas manuales"
            onClick={() => onTools()}
          >
            ⚙ Herramientas
          </button>
        )}
      </div>
      {compact ? (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '6px 0 2px' }}>
          {!p.eliminated && (
            <>
              <span className="stat-chip mono" title="Mid-match / Pre-match jugadas">Mid {p.midmatchPlayed.length}</span>
              <span className="stat-chip mono" title="Ring Area">Ring {p.ring.length}</span>
              <span className="stat-chip mono" title="Backlash">Back {p.backlashPre.length + p.backlashMid.length}</span>
            </>
          )}
          {p.eliminated && <span className="muted" style={{ fontSize: 11 }}>Eliminado ({p.eliminatedReason})</span>}
        </div>
      ) : p.eliminated ? (
        <div className="muted" style={{ fontSize: 12 }}>Eliminado ({p.eliminatedReason})</div>
      ) : (
        <div className="player-zones">
          <div className={`zone ${isActive ? 'zone-active' : ''}`} title="Cartas de Mid-match / Pre-match jugadas durante el encuentro">
            <div className="zone-title">
              <span>Mid-match</span>
              <span className="mono">{p.midmatchPlayed.length}</span>
            </div>
            <div className="zone-body">
              <div className="zone-cardrow">
                {p.midmatchPlayed.slice(-12).map((id) => {
                  const card = getCardSafe(id)
                  const hasEffect = card.effect ? card.effect.length > 0 : false
                  return (
                    <div key={id} className="ring-card-cell" onClick={(e) => e.stopPropagation()}>
                      <CardFace
                        id={id}
                        size="sm"
                        onClick={() => onCardClick(id)}
                        onMouseEnter={() => onCardHover(id)}
                        onMouseLeave={() => onCardHover(null)}
                      />
                      {canControl && isActive && hasEffect && (
                        <button
                          className="ghost ring-activate-btn"
                          title="Activar efecto (se queda en Mid-match)"
                          onClick={(e) => {
                            e.stopPropagation()
                            useAppStore.getState().activateRingAction(id)
                          }}
                        >
                          ⚡ efecto
                        </button>
                      )}
                    </div>
                  )
                })}
                {p.midmatchPlayed.length === 0 && (
                  <span className="muted" style={{ fontSize: 12 }}>Vacío — las cartas Mid-match/Pre-match jugadas quedan acá.</span>
                )}
              </div>
              <span className="muted" style={{ fontSize: 11 }}>Arsenal {p.arsenal.length} — usá ⚙ para verlo.</span>
            </div>
          </div>

          <div className={`zone clickable ${isActive ? 'zone-active' : ''}`} onClick={toolsEnabled ? () => onTools('ring') : undefined} title="Clic para ver/mover cartas del Ring Area">
            <div className="zone-title">
              <span>Ring Area</span>
              <span className="mono">{p.ring.length}</span>
            </div>
            <div className="zone-body">
              <div className="zone-cardrow">
                {p.ring.slice(-12).map((id) => {
                  const card = getCardSafe(id)
                  const hasEffect = card.effect ? card.effect.length > 0 : false
                  return (
                    <div key={id} className="ring-card-cell" onClick={(e) => e.stopPropagation()}>
                      <CardFace
                        id={id}
                        size="sm"
                        onClick={() => onCardClick(id)}
                        onMouseEnter={() => onCardHover(id)}
                        onMouseLeave={() => onCardHover(null)}
                      />
                      {canControl && isActive && hasEffect && (
                        <button
                          className="ghost ring-activate-btn"
                          title="Activar efecto (ACE)"
                          onClick={(e) => {
                            e.stopPropagation()
                            useAppStore.getState().activateRingAction(id)
                          }}
                        >
                          ⚡ efecto
                        </button>
                      )}
                    </div>
                  )
                })}
                {p.ring.length === 0 && <span className="muted" style={{ fontSize: 12 }}>Ring vacío — jugá una carta exitosa en tu turno.</span>}
              </div>
            </div>
          </div>

          <div className={`zone clickable ${isTarget ? 'zone-target' : ''}`} onClick={toolsEnabled ? () => onTools('ringside') : undefined} title="Clic para ver/mover cartas del Ringside">
            <div className="zone-title">
              <span>Ringside · descarte/daño</span>
              <span className="mono">{p.ringside.length}</span>
            </div>
            <div className="zone-body">
              <div className="zone-cardrow">
                {p.ringside.slice(-8).map((id) => (
                  <div key={id} className="ring-card-cell" onClick={(e) => e.stopPropagation()}>
                    <CardFace
                      id={id}
                      size="sm"
                      onClick={() => onCardClick(id)}
                      onMouseEnter={() => onCardHover(id)}
                      onMouseLeave={() => onCardHover(null)}
                    />
                  </div>
                ))}
                {p.ringside.length === 0 && (
                  <span className="muted" style={{ fontSize: 12 }}>Vacío — acá van el daño y las cartas volteadas.</span>
                )}
              </div>
              <Pile label="Ringside" count={p.ringside.length} />
            </div>
          </div>

          <div className={`zone ${isActive ? 'zone-active' : ''}`}>
            <div className="zone-title">
              <span>Backlash</span>
              <span className="mono">
                {p.backlashPre.length + p.backlashMid.length}
              </span>
            </div>
            <div className="zone-body">
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {p.backlashPre.length > 0 && (
                  <Pile label="Pre-match" count={p.backlashPre.length} faceDown />
                )}
                {p.backlashMid.length > 0 && (
                  <Pile label="Mid-match" count={p.backlashMid.length} faceDown />
                )}
                {p.backlashPre.length + p.backlashMid.length === 0 && (
                  <span className="muted" style={{ fontSize: 12 }}>Sin cartas Backlash.</span>
                )}
              </div>
              <span className="muted" style={{ fontSize: 11 }}>Aparte de la mano; se juegan en sus fases.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Mini graphic representing a face-down/face-up pile. */
function Pile({
  label,
  count,
  faceDown,
  hit,
  onClick,
}: {
  label: string
  count: number
  faceDown?: boolean
  hit?: boolean
  onClick?: (id: string) => void
}) {
  return (
    <div
      className={`pile-stack ${hit ? 'hit' : ''}`}
      onClick={onClick ? () => onClick('') : undefined}
      title={onClick ? undefined : `${count} cartas`}
    >
      <div className="pile-squares">
        <div className={`sq ${faceDown ? 'b' : 'f'}`} />
        <div className={`sq ${faceDown ? 'b' : 'f'}`} />
        <div className={`sq ${faceDown ? 'b' : 'f'}`} />
      </div>
      <div>
        <div className="big-label" style={{ margin: 0 }}>{label}</div>
        <div className={`sq-count ${hit ? 'pop' : ''}`}>{count}</div>
      </div>
    </div>
  )
}

function RingZone({ game, onCardClick, onCardHover }: { game: GameState; onCardClick: (id: string) => void; onCardHover: (id: string | null) => void }) {
  const res = game.resolution
  if (!res) return null
  const attacker = game.players[res.attacker]
  const defender = game.players[res.target]

  return (
    <div className="ring-zone">
      <div className="ring-cards">
        <div style={{ textAlign: 'center' }}>
          <div className="big-label" style={{ color: '#d8a92f' }}>{attacker?.name} juega</div>
          <div
            key={`played-${res.cardId}`}
            className="ring-card-played md"
            style={{ display: 'flex', justifyContent: 'center' }}
            onClick={() => onCardClick(res.cardId)}
            onMouseEnter={() => onCardHover(res.cardId)}
            onMouseLeave={() => onCardHover(null)}
          >
            <CardFace id={res.cardId} size="md" />
          </div>
        </div>
        <div style={{ alignSelf: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="stat-chip" style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}>
            vs {defender?.name}
          </div>
          {res.overturning && (
            <div className="stat-chip" style={{ background: 'var(--red-bright)', marginTop: 0 }}>
              Daño tomado: {res.damageDealt} (imprime {res.damageToDeal})
            </div>
          )}
          {res.partialReversal && (
            <div className="stat-chip" style={{ background: 'var(--yellow)', color: '#221a05' }}>
              Multi: necesita {res.reversalHitsNeeded - res.reversalHits} más
            </div>
          )}
          {game.phase === 'reversalWindow' && (
            <div className="stat-chip" style={{ background: 'var(--gold)', color: '#221a05' }}>
              Ventana de reversión abierta
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function OpeningZone({ game, canInteract }: { game: GameState; canInteract: boolean }) {
  const active = game.players[game.activeIndex]
  const [swap, setSwap] = useState<Set<string>>(new Set())
  const store = useAppStore.getState()

  if (active && active.isAI) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <span className="muted">{active.name} elige su mano inicial…</span>
      </div>
    )
  }

  if (!canInteract) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <span className="muted">{active?.name} está eligiendo su mano inicial…</span>
      </div>
    )
  }

  const hand = active?.hand ?? []
  const arsenalCount = active?.arsenal.length ?? 0

  return (
    <div className="card">
      <h3>Elige tu mano inicial — {active?.name}</h3>
      <p className="muted">
        El descarte y la reposición son voluntarios e independientes: tocá las cartas que querés devolver al
        Arsenal y usá «Devolver seleccionadas» (no se roba de vuelta). Para reponer, robá del Arsenal con
        «Robar». Cuando quieras quedarte con tu mano, confirmá.
      </p>
      <div className="hand" style={{ flexWrap: 'wrap', maxHeight: 280, overflowY: 'auto' }}>
        {hand.map((id) => {
          const removing = swap.has(id)
          return (
            <div key={id} style={{ position: 'relative' }}>
              <CardFace
                id={id}
                size="sm"
                playable={removing}
                selected={!removing}
                onClick={() =>
                  setSwap((prev) => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }
              />
              <div
                className="stat-chip mono"
                style={{ position: 'absolute', top: 4, right: 4, background: removing ? 'var(--red-bright)' : 'var(--green)' }}
              >
                {removing ? 'Devuelvo' : 'Guardo'}
              </div>
            </div>
          )
        })}
      </div>
      <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end', gap: 8 }}>
        <button className="ghost" onClick={() => setSwap(new Set())}>Desmarcar todo</button>
        <button
          className="ghost"
          disabled={arsenalCount === 0}
          onClick={() => {
            store.redrawOpeningAction(1)
          }}
        >
          Robar 1
        </button>
        <button
          className="ghost"
          disabled={arsenalCount === 0}
          onClick={() => {
            store.redrawOpeningAction(3)
          }}
        >
          Robar 3
        </button>
        <button
          className="ghost"
          disabled={swap.size === 0}
          onClick={() => {
            store.discardOpeningAction([...swap])
            setSwap(new Set())
          }}
        >
          Devolver seleccionadas
        </button>
        <button className="primary" onClick={() => store.keepHandAction()}>
          Confirmar mano
        </button>
      </div>
    </div>
  )
}

function HandZone({
  player,
  onCardClick,
  onCardHover,
}: {
  player: PlayerState
  onCardClick: (id: string, zone?: 'hand' | 'midmatch' | 'prematch') => void
  onCardHover: (id: string | null) => void
}) {
  const game = useAppStore((s) => s.game)
  const [filter, setFilter] = useState<CardClassFilter>('all')
  if (!game) return null
  const shown = player.hand.filter((id) => {
    const c = getCardSafe(id)
    return filter === 'all' || classifyCard(c) === filter
  })
  return (
    <div className="hand-fan">
      <div className="fan-title">
        <h3 style={{ margin: 0 }}>Tu mano ({player.hand.length})</h3>
        <span className="muted">Toca una carta para jugarla · el resto va manual</span>
        <div className="spacer" />
        <CardTypeTabs value={filter} onChange={setFilter} />
      </div>
      <div className="hand">
        {shown.map((id) => (
          <CardFace
            key={id}
            id={id}
            size="sm"
            playable
            onClick={() => onCardClick(id, 'hand')}
            onMouseEnter={() => onCardHover(id)}
            onMouseLeave={() => onCardHover(null)}
          />
        ))}
        {shown.length === 0 && <span className="muted">No hay cartas en este filtro.</span>}
      </div>
      {player.backlashMid.length > 0 && (
        <>
          <div className="big-label">Mid-match (Backlash)</div>
          <div className="hand">
            {player.backlashMid.map((id) => (
              <CardFace
                key={id}
                id={id}
                size="sm"
                playable
                onMouseEnter={() => onCardHover(id)}
                onMouseLeave={() => onCardHover(null)}
                onClick={() => onCardClick(id, 'midmatch')}
              />
            ))}
          </div>
        </>
      )}
      {player.backlashPre.length > 0 && (
        <>
          <div className="big-label">Pre-match (Backlash)</div>
          <div className="hand">
            {player.backlashPre.map((id) => (
              <CardFace
                key={id}
                id={id}
                size="sm"
                playable
                onMouseEnter={() => onCardHover(id)}
                onMouseLeave={() => onCardHover(null)}
                onClick={() => onCardClick(id, 'prematch')}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PlayConfirmModal({
  confirm,
  onClose,
}: {
  confirm: { id: string; zone?: 'hand' | 'midmatch' | 'prematch' } | null
  onClose: () => void
}) {
  if (!confirm) return null
  const c = getCardSafe(confirm.id)
  const zoneLabel = confirm.zone === 'hand' ? 'de tu mano' : confirm.zone === 'prematch' ? 'Pre-match (Backlash)' : 'Mid-match (Backlash)'
  const zoneKind: 'hand' | 'midmatch' | 'prematch' = confirm.zone ?? 'hand'
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
          <CardFace id={confirm.id} size="lg" />
          <div className="grid" style={{ flex: 1, gap: 6 }}>
            <h3 style={{ margin: 0 }}>{c.name}</h3>
            <div className="muted">
              {cardTypeLabel(c)} · {zoneLabel}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <span className="stat-chip">
Fortitude <b>{c.fortitude}F</b>
                </span>
                <span className="stat-chip">
                  Daño <b>{c.damage}D</b>
                </span>
            </div>
            {c.traits && c.traits.length > 0 && (
              <div className="row" style={{ gap: 6 }}>
                {c.traits.map((t) => (
                  <span key={t} className="stat-chip">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <p style={{ lineHeight: 1.5, margin: 0 }}>{c.text}</p>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end', gap: 8 }}>
          <button className="ghost" onClick={onClose}>
            Volver
          </button>
          <button
            className="primary"
            onClick={() => {
              onClose()
              useAppStore.getState().playCardAction(confirm.id, zoneKind)
            }}
          >
            Jugar{' '}
            {c.fortitude > 0 && (
              <span className="mono" style={{ opacity: 0.85 }}>
                ({c.fortitude}F)
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function OverturnBanner({ game }: { game: GameState }) {
  const d = game.pendingDecision
  if (!d || d.type !== 'overturnCards') return null
  const p = game.players[d.playerIdx]
  const res = game.resolution
  if (!p || !res) return null
  const flipped = p.ringside.slice(-d.overturned)
  if (flipped.length === 0) return null
  return (
    <div className="card" style={{ border: '1px solid var(--gold)', marginBottom: 8 }}>
      <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className="overturn-label">Volteando cartas</span>
        <span className="stat-chip mono">Daño {d.overturned}/{d.damageToDeal}</span>
        <span className="stat-chip mono">Arsenal {p.arsenal.length}</span>
      </div>
      <div className="hand" style={{ flexWrap: 'wrap', gap: 6 }}>
        {flipped.map((id, i) => (
          <div key={`${id}-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <CardFace id={id} size="xs" />
            <span className="muted" style={{ fontSize: 10, marginTop: 2 }}>#{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GameOver({ game }: { game: GameState }) {
  const winners = game.winner ?? []
  const winner = winners[0]
  return (
    <div className="card" style={{ textAlign: 'center', borderColor: 'var(--gold)' }}>
      <h2>
        {winners.length === 1 && winner !== undefined
          ? `¡${game.players[winner]?.name} gana la partida!`
          : '¡Partida terminada!'}
      </h2>
      <p className="muted">
        {game.winType === 'pin' && 'Victoria por Pinfall'}
        {game.winType === 'countout' && 'Victoria por Count Out'}
        {game.winType === 'draw' && 'Empate'}
      </p>
      <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
        <button className="primary" onClick={() => useAppStore.getState().newGameAgain()}>
          Volver al menú
        </button>
      </div>
    </div>
  )
}