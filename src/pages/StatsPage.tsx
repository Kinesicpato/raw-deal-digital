import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { AppBanner } from '../components/Branding'
import { SUPERSTARS } from '../data/cards'
import { getRecentResults, getPlayerStats, type GameResult, type PlayerStats } from '../online/stats'

function superstarsName(id: string | null): string {
  if (!id) return '—'
  return SUPERSTARS.find((s) => s.id === id)?.name ?? id
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function StatsPage() {
  const setView = useAppStore((s) => s.setView)
  const [tab, setTab] = useState<'history' | 'players'>('history')
  const [results, setResults] = useState<GameResult[]>([])
  const [players, setPlayers] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getRecentResults(), getPlayerStats()]).then(([r, p]) => {
      setResults(r)
      setPlayers(p)
      setLoading(false)
    })
  }, [])

  return (
    <div className="page">
      <AppBanner
        subtitle="Estadísticas online"
        right={<button className="ghost" onClick={() => setView('menu')}>Volver</button>}
      />

      <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 12 }}>
        <button className={tab === 'history' ? 'primary' : 'ghost'} onClick={() => setTab('history')}>
          Historial
        </button>
        <button className={tab === 'players' ? 'primary' : 'ghost'} onClick={() => setTab('players')}>
          Jugadores
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: '16px auto', width: '100%' }}>
        {loading ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p className="muted">Cargando...</p>
          </div>
        ) : (
          <>
            {tab === 'history' && (
              <>
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
                            {r.player_count > 2 && ` · ${r.game_mode === 'rumble' ? 'Rumble' : 'WTA'}`}
                            {r.belt_won && ` · 🏆 ${r.belt_name}`}
                          </div>
                        </div>
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{formatDate(r.created_at)}</div>
                    </div>
                  ))
                )}
              </>
            )}

            {tab === 'players' && (
              <>
                {players.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center' }}>
                    <p className="muted">Todavía no hay datos de jugadores.</p>
                  </div>
                ) : (
                  <div className="card">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border, #333)' }}>
                          <th style={{ textAlign: 'left', padding: '6px 4px' }}>Jugador</th>
                          <th style={{ textAlign: 'center', padding: '6px 4px' }}>PJ</th>
                          <th style={{ textAlign: 'center', padding: '6px 4px' }}>G</th>
                          <th style={{ textAlign: 'center', padding: '6px 4px' }}>P</th>
                          <th style={{ textAlign: 'center', padding: '6px 4px' }}>E</th>
                          <th style={{ textAlign: 'center', padding: '6px 4px' }}>🏆</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.map((ps) => (
                          <tr key={ps.name} style={{ borderBottom: '1px solid var(--border, #222)' }}>
                            <td style={{ padding: '6px 4px' }}>
                              <div style={{ fontWeight: 600 }}>{ps.name}</div>
                              <div className="muted" style={{ fontSize: 11 }}>{superstarsName(ps.favorite_superstar)}</div>
                            </td>
                            <td style={{ textAlign: 'center', padding: '6px 4px' }}>{ps.games_played}</td>
                            <td style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--green-bright, #4caf50)' }}>{ps.wins}</td>
                            <td style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--red-bright, #f44336)' }}>{ps.losses}</td>
                            <td style={{ textAlign: 'center', padding: '6px 4px' }}>{ps.draws}</td>
                            <td style={{ textAlign: 'center', padding: '6px 4px' }}>{ps.belts_won}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
