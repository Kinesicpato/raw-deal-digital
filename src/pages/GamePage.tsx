import { useState } from 'react'
import { useAppStore, getCardSafe } from '../store/useAppStore'
import type { GameState, PlayerState } from '../engine/types'
import { PREMATCH_STAGES } from '../engine/game'
import { CardFace, CardDetailModal } from '../components/CardView'
import { CardZoomPreview } from '../components/CardZoom'
import { DecisionModal } from '../components/DecisionModal'
import { PlayerToolsModal } from '../components/PlayerTools'
import { CardTypeTabs, classifyCard, type CardClassFilter } from '../components/CardTypeTabs'
import { AppBanner } from '../components/Branding'

export function GamePage() {
  const game = useAppStore((s) => s.game)
  const lastError = useAppStore((s) => s.lastError)
  const clearError = useAppStore((s) => s.clearError)
  const online = useAppStore((s) => s.online)
  const [detail, setDetail] = useState<string | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)
  const [tools, setTools] = useState<number | null>(null)

  if (!game) {
    return (
      <div className="page">
        <p>No hay partida activa.</p>
        <button onClick={() => useAppStore.getState().setView('menu')}>Volver al menú</button>
      </div>
    )
  }

  const active = game.players[game.activeIndex]
  const isOnline = online.role !== null && online.role !== undefined
  const myIdx = online.myIdx
  const isMyTurn = !isOnline || game.activeIndex === myIdx
  const showHandControls = isMyTurn && !!active && !active.isAI

  return (
    <div className="page">
      <AppBanner
        subtitle={isOnline && online.role === 'host' ? 'Partida en línea · anfitrión' : isOnline ? 'Partida en línea' : 'Partida en curso'}
        right={
          <>
            <span className="stat-chip">Turno {game.turnNumber}</span>
            <span className="stat-chip">{phaseLabel[game.phase] ?? game.phase}</span>
            {game.phase !== 'gameover' && active && (
              <span className="stat-chip">Juega {active.name}</span>
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
            {game.players.map((p, i) => (
              <PlayerPanel
                key={p.id}
                p={p}
                idx={i}
                game={game}
                onCardClick={setDetail}
                onCardHover={setZoom}
                onTools={() => setTools(i)}
                toolsOpen={tools === i}
                toolsEnabled={!isOnline || online.role === 'host' || i === myIdx}
                canControl={!isOnline || i === myIdx}
              />
            ))}
          </div>

          <RingZone game={game} onCardClick={setDetail} onCardHover={setZoom} />

          {game.phase === 'opening' && <OpeningZone game={game} canInteract={showHandControls} />}

          {game.phase === 'prematch' && <PrematchZone game={game} canInteract={showHandControls} />}

          {game.phase === 'gameover' && <GameOver game={game} />}

          {active && !active.isAI && game.phase === 'main' && showHandControls && (
            <HandZone
              player={active}
              onCardClick={(id) => useAppStore.getState().playCardAction(id)}
              onCardHover={setZoom}
            />
          )}
          {game.phase === 'main' && !showHandControls && (
            <div className="card" style={{ textAlign: 'center' }}>
              <span className="muted">
                {isOnline ? `Esperando que juegue ${active?.name ?? 'otro jugador'}…` : 'Turno de la IA…'}
              </span>
            </div>
          )}
        </div>

        <div className="game-side">
          {showHandControls && game.phase === 'main' && (
            <button className="primary btn-turn" onClick={() => useAppStore.getState().endTurnAction()}>
              Terminar turno
            </button>
          )}
          <GameLog game={game} />
        </div>
      </div>

      {tools !== null && <PlayerToolsModal game={game} playerIdx={tools} onClose={() => setTools(null)} />}
      <DecisionModal />
      <CardDetailModal id={detail} onClose={() => setDetail(null)} />
      <CardZoomPreview id={detail ? null : zoom} />
      {lastError && (
        <div className="toast" onClick={clearError}>
          {lastError}
        </div>
      )}
    </div>
  )
}

const phaseLabel: Record<string, string> = {
  opening: 'Elegí tu mano inicial',
  prematch: 'Fase Pre-match',
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
}: {
  p: PlayerState
  idx: number
  game: GameState
  onCardClick: (id: string) => void
  onCardHover: (id: string | null) => void
  onTools: () => void
  toolsOpen: boolean
  toolsEnabled: boolean
  canControl: boolean
}) {
  const isActive = game.activeIndex === idx && game.phase !== 'gameover'
  const isTarget = game.resolution?.target === idx
  const isOverturning = game.resolution?.overturning === true
  const isHandRevealed = p.handRevealed
  const hit = isTarget && isOverturning
  return (
    <div className={`panel ${isActive ? 'active' : ''} ${hit ? 'panel-hit' : ''} ${p.eliminated ? 'eliminated' : ''}`}>
      {toolsEnabled && (
        <button className={`ghost tools-btn ${toolsOpen ? 'open' : ''}`} title="Herramientas manuales" onClick={onTools}>
          ⚙
        </button>
      )}
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
      <div className="row" style={{ gap: 6, margin: '8px 0' }}>
        {hit && <span className="stat-chip damage-chip mono" style={{ background: 'var(--red-bright)', color: '#fff' }}>−{game.resolution?.damageDealt}</span>}
        <span className="stat-chip mono">Arsenal {p.arsenal.length}</span>
        <span className="stat-chip mono" title={isHandRevealed ? 'Mano revelada' : 'Mano oculta'}>
          {isHandRevealed ? '👁' : ''} Mano {p.hand.length}
        </span>
        <span className="stat-chip mono">Ringside {p.ringside.length}</span>
      </div>
      {p.eliminated ? (
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

          <div className={`zone clickable ${isActive ? 'zone-active' : ''}`} onClick={toolsEnabled ? onTools : undefined} title="Clic para ver/mover cartas del Ring Area">
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

          <div className={`zone clickable ${isTarget ? 'zone-target' : ''}`} onClick={toolsEnabled ? onTools : undefined} title="Clic para ver/mover cartas del Ringside">
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
  if (!res) {
    return (
      <div className="ring-zone">
        <div className="muted" style={{ textAlign: 'center' }}>
          El Ring — {game.phase === 'main' ? 'juega una carta de tu mano' : 'esperando…'}
        </div>
      </div>
    )
  }
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

function PrematchZone({ game, canInteract }: { game: GameState; canInteract: boolean }) {
  const active = game.players[game.activeIndex]
  const stage = PREMATCH_STAGES[game.prematchStage] ?? 'Event'
  const store = useAppStore.getState()

  return (
    <div className="card">
      <h3>Fase Pre-match — Etapa: {stage}</h3>
      <p className="muted">
        {canInteract ? <>Actúa: <b>{active?.name}</b></> : <>{active?.name} está decidiendo…</>}
      </p>
      {canInteract && active && (
        <>
          <div className="card" style={{ marginTop: 8 }}>
            <div className="big-label" style={{ marginTop: 0 }}>
              Mano inicial de {active.name} ({active.hand.length} cartas)
            </div>
            <div className="hand" style={{ flexWrap: 'wrap', maxHeight: 260, overflowY: 'auto' }}>
              {active.hand.map((id) => (
                <CardFace key={id} id={id} size="sm" />
              ))}
              {active.hand.length === 0 && <span className="muted">Sin cartas en mano.</span>}
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="hand" style={{ flexWrap: 'wrap', maxHeight: 260, overflowY: 'auto', flex: 1 }}>
              {active.backlashPre.map((id) => (
                <CardFace key={id} id={id} size="sm" onClick={() => store.playPrematchAction(id)} />
              ))}
              {active.backlashPre.length === 0 && <span className="muted">No tienes Pre-match cards restantes.</span>}
            </div>
            <button className="ghost" onClick={() => store.passPrematchAction()}>
              Pasar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function HandZone({ player, onCardClick, onCardHover }: { player: PlayerState; onCardClick: (id: string) => void; onCardHover: (id: string | null) => void }) {
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
            onClick={() => onCardClick(id)}
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
                onClick={() => useAppStore.getState().playCardAction(id, 'midmatch')}
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
                onClick={() => useAppStore.getState().playCardAction(id, 'prematch')}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function GameLog({ game }: { game: GameState }) {
  return (
    <div className="card">
      <div className="big-label" style={{ marginTop: 0 }}>Historial</div>
      <div className="log">
        {game.log.slice(-80).map((e, i) => (
          <div key={i}>
            <span className="log-turn">T{e.turn}</span>{' '}
            <b>{game.players[e.player]?.name}:</b> {e.text}
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