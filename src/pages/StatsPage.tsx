import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { AppBanner } from '../components/Branding'
import { CardFace } from '../components/CardView'
import { SUPERSTARS } from '../data/cards'
import {
  getRecentResults,
  getPlayerStats,
  getSuperstarStats,
  deleteGameResult,
  insertGameResultManual,
  deleteAllStats,
  type GameResult,
  type PlayerStats,
  type SuperstarAggregate,
} from '../online/stats'

function superstarsName(id: string | null): string {
  if (!id) return '—'
  return SUPERSTARS.find((s) => s.id === id)?.name ?? id
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border, #222)' }}>
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}</span>
    </div>
  )
}

interface ManualResult {
  winnerName: string
  winnerSuperstar: string
  loserName: string
  loserSuperstar: string
  winType: string
  turns: number
  gameMode: string
}

const EMPTY_RESULT: ManualResult = {
  winnerName: '',
  winnerSuperstar: '',
  loserName: '',
  loserSuperstar: '',
  winType: 'pin',
  turns: 1,
  gameMode: 'rumble',
}

export function StatsPage() {
  const setView = useAppStore((s) => s.setView)
  const [tab, setTab] = useState<'history' | 'players' | 'superstars'>('history')
  const [results, setResults] = useState<GameResult[]>([])
  const [players, setPlayers] = useState<PlayerStats[]>([])
  const [starStats, setStarStats] = useState<SuperstarAggregate[]>([])
  const [selectedStar, setSelectedStar] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [admin, setAdmin] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [manual, setManual] = useState<ManualResult>(EMPTY_RESULT)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    Promise.all([getRecentResults(), getPlayerStats(), getSuperstarStats()]).then(([r, p, s]) => {
      setResults(r)
      setPlayers(p)
      setStarStats(s)
      setLoading(false)
    })
  }, [])

  useEffect(() => { reload() }, [reload])

  const selectedAgg = selectedStar ? starStats.find((s) => s.superstar_id === selectedStar) ?? null : null

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este resultado? Se recalcularán las estadísticas.')) return
    await deleteGameResult(id)
    reload()
  }

  async function handleDeleteAll() {
    if (!confirm('¿ELIMINAR TODAS las estadísticas? Esta acción no se puede deshacer.')) return
    if (!confirm('¿Estás seguro? Se borrarán todos los historiales y estadísticas.')) return
    await deleteAllStats()
    reload()
  }

  async function handleAdd() {
    if (!manual.winnerName.trim() || !manual.winnerSuperstar) return
    setSaving(true)
    const loserNames = manual.loserName.trim() ? [manual.loserName.trim()] : []
    const loserSuperstars = manual.loserSuperstar ? [manual.loserSuperstar] : []
    await insertGameResultManual({
      winner_name: manual.winnerName.trim(),
      winner_superstar: manual.winnerSuperstar || null,
      loser_names: loserNames,
      win_type: manual.winType,
      turns: manual.turns,
      player_count: 1 + loserNames.length,
      game_mode: manual.gameMode,
      belt_won: false,
      belt_name: null,
      player_names: [manual.winnerName.trim(), ...loserNames],
      player_superstars: [manual.winnerSuperstar, ...loserSuperstars],
      superstar_stats: [
        {
          player_name: manual.winnerName.trim(),
          superstar_id: manual.winnerSuperstar || 'gen-kurt',
          won: true,
          opponent_superstar: manual.loserSuperstar || null,
          reversals_played: 0,
          strikes_played: 0,
          grapples_played: 0,
          submissions_played: 0,
          high_risk_played: 0,
          actions_played: 0,
          midmatch_played: 0,
        },
        ...(loserNames.length > 0
          ? [{
              player_name: loserNames[0]!,
              superstar_id: manual.loserSuperstar || 'gen-kurt',
              won: false,
              opponent_superstar: manual.winnerSuperstar || null,
              reversals_played: 0,
              strikes_played: 0,
              grapples_played: 0,
              submissions_played: 0,
              high_risk_played: 0,
              actions_played: 0,
              midmatch_played: 0,
            }]
          : []),
      ],
    })
    setManual(EMPTY_RESULT)
    setShowAddForm(false)
    setSaving(false)
    reload()
  }

  return (
    <div className="page">
      <AppBanner
        subtitle="Estadísticas online"
        right={
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <button
              className={admin ? 'primary' : 'ghost'}
              onClick={() => setAdmin(!admin)}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              {admin ? 'Admin ON' : 'Admin'}
            </button>
            <button className="ghost" onClick={() => setView('menu')}>Volver</button>
          </div>
        }
      />

      <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button className={tab === 'history' ? 'primary' : 'ghost'} onClick={() => setTab('history')}>
          Historial
        </button>
        <button className={tab === 'players' ? 'primary' : 'ghost'} onClick={() => setTab('players')}>
          Jugadores
        </button>
        <button className={tab === 'superstars' ? 'primary' : 'ghost'} onClick={() => setTab('superstars')}>
          Superestrellas
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: '16px auto', width: '100%' }}>
        {loading ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p className="muted">Cargando...</p>
          </div>
        ) : (
          <>
            {/* ─── TAB: HISTORIAL ─── */}
            {tab === 'history' && (
              <>
                {admin && (
                  <div className="card" style={{ marginBottom: 10, padding: '10px 14px' }}>
                    <div className="row" style={{ gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                      <button className="primary" onClick={() => setShowAddForm(!showAddForm)}>
                        {showAddForm ? 'Cancelar' : '+ Agregar resultado'}
                      </button>
                      {results.length > 0 && (
                        <button
                          className="ghost"
                          onClick={handleDeleteAll}
                          style={{ color: 'var(--red-bright, #f44336)', fontSize: 12 }}
                        >
                          Borrar todo
                        </button>
                      )}
                    </div>

                    {showAddForm && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--border, #333)', paddingTop: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Agregar resultado manual</div>

                        <label style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Ganador — Nombre</label>
                        <input
                          value={manual.winnerName}
                          onChange={(e) => setManual({ ...manual, winnerName: e.target.value })}
                          placeholder="Nombre del ganador"
                          style={{ width: '100%', marginBottom: 8 }}
                        />

                        <label style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Ganador — Superestrella</label>
                        <select
                          value={manual.winnerSuperstar}
                          onChange={(e) => setManual({ ...manual, winnerSuperstar: e.target.value })}
                          style={{ width: '100%', marginBottom: 8 }}
                        >
                          <option value="">Elegir superestrella...</option>
                          {SUPERSTARS.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>

                        <label style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Perdedor — Nombre</label>
                        <input
                          value={manual.loserName}
                          onChange={(e) => setManual({ ...manual, loserName: e.target.value })}
                          placeholder="Nombre del perdedor"
                          style={{ width: '100%', marginBottom: 8 }}
                        />

                        <label style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Perdedor — Superestrella</label>
                        <select
                          value={manual.loserSuperstar}
                          onChange={(e) => setManual({ ...manual, loserSuperstar: e.target.value })}
                          style={{ width: '100%', marginBottom: 8 }}
                        >
                          <option value="">Elegir superestrella...</option>
                          {SUPERSTARS.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>

                        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Tipo de victoria</label>
                            <select
                              value={manual.winType}
                              onChange={(e) => setManual({ ...manual, winType: e.target.value })}
                              style={{ width: '100%' }}
                            >
                              <option value="pin">Pinfall</option>
                              <option value="countout">Count Out</option>
                              <option value="draw">Empate</option>
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Modalidad</label>
                            <select
                              value={manual.gameMode}
                              onChange={(e) => setManual({ ...manual, gameMode: e.target.value })}
                              style={{ width: '100%' }}
                            >
                              <option value="rumble">Rumble</option>
                              <option value="winner-takes-all">Winner Takes All</option>
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>Turnos</label>
                            <input
                              type="number"
                              min={1}
                              value={manual.turns}
                              onChange={(e) => setManual({ ...manual, turns: Math.max(1, Number(e.target.value)) })}
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>

                        <button
                          className="primary"
                          onClick={handleAdd}
                          disabled={saving || !manual.winnerName.trim() || !manual.winnerSuperstar}
                          style={{ marginTop: 4 }}
                        >
                          {saving ? 'Guardando...' : 'Guardar resultado'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {results.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center' }}>
                    <p className="muted">Todavía no hay partidas online registradas.</p>
                    <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                      Las estadísticas se guardan automáticamente cuando termina una partida online.
                    </p>
                  </div>
                ) : (
                  results.map((r) => (
                    <div key={r.id} className="card" style={{ marginBottom: 8, padding: '10px 14px' }}>
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {r.winner_name
                              ? `${r.winner_name} (${superstarsName(r.winner_superstar)})`
                              : 'Empate'}
                          </div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                            vs {r.loser_names.length > 0 ? r.loser_names.join(', ') : '—'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>
                            {r.win_type === 'pin' && 'Pinfall'}
                            {r.win_type === 'countout' && 'Count Out'}
                            {r.win_type === 'draw' && 'Empate'}
                          </div>
                          <div className="muted" style={{ fontSize: 11 }}>
                            {r.turns} turnos · {r.player_count}J
                            {r.player_count > 2 && ` · ${r.game_mode === 'rumble' ? 'Rumble' : 'Winner Takes All'}`}
                            {r.belt_won && ` · 🏆 ${r.belt_name}`}
                          </div>
                        </div>
                      </div>
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{formatDate(r.created_at)}</div>
                        {admin && (
                          <button
                            className="ghost"
                            onClick={() => handleDelete(r.id)}
                            style={{ fontSize: 11, color: 'var(--red-bright, #f44336)', padding: '2px 8px', marginTop: 4 }}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* ─── TAB: JUGADORES ─── */}
            {tab === 'players' && (
              <>
                {players.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center' }}>
                    <p className="muted">Todavía no hay datos de jugadores.</p>
                  </div>
                ) : (
                  <div className="card" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border, #333)' }}>
                          <th style={{ textAlign: 'left', padding: '8px 6px' }}>Jugador</th>
                          <th style={{ textAlign: 'center', padding: '8px 6px' }}>Partidas Jugadas</th>
                          <th style={{ textAlign: 'center', padding: '8px 6px' }}>Ganadas</th>
                          <th style={{ textAlign: 'center', padding: '8px 6px' }}>Perdidas</th>
                          <th style={{ textAlign: 'center', padding: '8px 6px' }}>Empates</th>
                          <th style={{ textAlign: 'center', padding: '8px 6px' }}>Cinturones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.map((ps) => (
                          <tr key={ps.name} style={{ borderBottom: '1px solid var(--border, #222)' }}>
                            <td style={{ padding: '8px 6px' }}>
                              <div style={{ fontWeight: 600 }}>{ps.name}</div>
                              <div className="muted" style={{ fontSize: 11 }}>{superstarsName(ps.favorite_superstar)}</div>
                            </td>
                            <td style={{ textAlign: 'center', padding: '8px 6px' }}>{ps.games_played}</td>
                            <td style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--green-bright, #4caf50)' }}>{ps.wins}</td>
                            <td style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--red-bright, #f44336)' }}>{ps.losses}</td>
                            <td style={{ textAlign: 'center', padding: '8px 6px' }}>{ps.draws}</td>
                            <td style={{ textAlign: 'center', padding: '8px 6px' }}>{ps.belts_won}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ─── TAB: SUPERESTRELLAS ─── */}
            {tab === 'superstars' && (
              <>
                {starStats.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center' }}>
                    <p className="muted">Todavía no hay estadísticas por superestrella.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
                      {starStats.map((agg) => {
                        const star = SUPERSTARS.find((s) => s.id === agg.superstar_id)
                        const isSelected = selectedStar === agg.superstar_id
                        return (
                          <div
                            key={agg.superstar_id}
                            onClick={() => setSelectedStar(isSelected ? null : agg.superstar_id)}
                            style={{
                              cursor: 'pointer',
                              borderRadius: 8,
                              border: isSelected ? '2px solid var(--gold, #ffd700)' : '2px solid transparent',
                              background: isSelected ? 'var(--accent-bg, rgba(255,215,0,0.08))' : 'var(--card-bg, rgba(255,255,255,0.04))',
                              padding: 8,
                              textAlign: 'center',
                              width: 90,
                              transition: 'border-color 0.15s',
                            }}
                          >
                            <CardFace id={`superstar-${agg.superstar_id}`} size="xs" />
                            <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600, lineHeight: 1.2 }}>
                              {star?.name ?? agg.superstar_id}
                            </div>
                            <div className="muted" style={{ fontSize: 10 }}>
                              {agg.wins}G / {agg.losses}P
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {selectedAgg && (
                      <div className="card" style={{ padding: '14px 16px' }}>
                        <div className="row" style={{ alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <CardFace id={`superstar-${selectedAgg.superstar_id}`} size="sm" />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{superstarsName(selectedAgg.superstar_id)}</div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {selectedAgg.matches_played} partidas · {selectedAgg.wins} victorias / {selectedAgg.losses} derrotas
                            </div>
                          </div>
                        </div>

                        {Object.keys(selectedAgg.by_mode).length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Por modalidad</div>
                            {Object.entries(selectedAgg.by_mode).map(([mode, m]) => (
                              <StatRow
                                key={mode}
                                label={mode === 'rumble' ? 'Rumble' : 'Winner Takes All'}
                                value={`${m.played} partidas (${m.wins}G / ${m.losses}P)`}
                              />
                            ))}
                          </div>
                        )}

                        {Object.keys(selectedAgg.record_vs).length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Récord contra</div>
                            {Object.entries(selectedAgg.record_vs)
                              .sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses))
                              .map(([oppId, rv]) => (
                                <StatRow
                                  key={oppId}
                                  label={superstarsName(oppId)}
                                  value={`${rv.wins}G / ${rv.losses}P`}
                                  color={rv.wins > rv.losses ? 'var(--green-bright, #4caf50)' : rv.wins < rv.losses ? 'var(--red-bright, #f44336)' : undefined}
                                />
                              ))}
                          </div>
                        )}

                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Promedio por duelo</div>
                          <StatRow label="Reversals" value={selectedAgg.avg_reversals} />
                          <StatRow label="Strikes" value={selectedAgg.avg_strikes} />
                          <StatRow label="Grapples" value={selectedAgg.avg_grapples} />
                          <StatRow label="Submissions" value={selectedAgg.avg_submissions} />
                          <StatRow label="High Risk" value={selectedAgg.avg_high_risk} />
                          <StatRow label="Actions" value={selectedAgg.avg_actions} />
                          <StatRow label="Mid-match" value={selectedAgg.avg_midmatch} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
