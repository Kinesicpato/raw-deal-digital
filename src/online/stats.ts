import { getSupabase } from './supabase'
import type { GameState } from '../engine/types'
import { BELTS } from '../data/cards'

export interface GameResult {
  id: string
  created_at: string
  winner_name: string | null
  winner_superstar: string | null
  loser_names: string[]
  win_type: string
  turns: number
  player_count: number
  game_mode: string
  belt_won: boolean
  belt_name: string | null
  player_names: string[]
  player_superstars: string[]
}

export interface SuperstarMatchStat {
  id: string
  game_result_id: string
  created_at: string
  player_name: string
  superstar_id: string
  game_mode: string
  won: boolean
  opponent_superstar: string | null
  reversals_played: number
  strikes_played: number
  grapples_played: number
  submissions_played: number
  high_risk_played: number
  actions_played: number
  midmatch_played: number
}

export async function saveGameResult(game: GameState): Promise<void> {
  const supabase = await getSupabase()
  const winners = game.winner ?? []
  const winnerIdx = winners.length === 1 ? winners[0] : null
  const winnerName = winnerIdx != null ? game.players[winnerIdx]?.name ?? null : null
  const winnerSuperstar = winnerIdx != null ? game.players[winnerIdx]?.superstarId ?? null : null
  const loserNames = winnerIdx != null
    ? game.players.filter((_, i) => i !== winnerIdx).map(p => p.name)
    : []
  const belt = game.beltId ? BELTS.find((b) => b.id === game.beltId) ?? null : null

  const { data: inserted } = await supabase.from('game_results').insert({
    winner_name: winnerName,
    winner_superstar: winnerSuperstar,
    loser_names: loserNames,
    win_type: game.winType ?? 'draw',
    turns: game.turnNumber,
    player_count: game.players.length,
    game_mode: game.gameMode,
    belt_won: !!(winnerIdx != null && game.beltId),
    belt_name: belt?.name ?? null,
    player_names: game.players.map(p => p.name),
    player_superstars: game.players.map(p => p.superstarId),
  }).select('id').single()

  if (!inserted?.id) return

  const statsRows = game.players.map((p, i) => {
    const won = winnerIdx !== null && i === winnerIdx
    const opponents = game.players.filter((_, j) => j !== i)
    const opponentSuperstar = opponents.length === 1 ? opponents[0]?.superstarId ?? null : null
    return {
      game_result_id: inserted.id,
      player_name: p.name,
      superstar_id: p.superstarId,
      game_mode: game.gameMode,
      won,
      opponent_superstar: opponentSuperstar,
      reversals_played: p.cardPlays.reversals,
      strikes_played: p.cardPlays.strikes,
      grapples_played: p.cardPlays.grapples,
      submissions_played: p.cardPlays.submissions,
      high_risk_played: p.cardPlays.highRisk,
      actions_played: p.cardPlays.actions,
      midmatch_played: p.cardPlays.midmatch,
    }
  })

  await supabase.from('superstar_match_stats').insert(statsRows)
}

export async function getRecentResults(limit = 50): Promise<GameResult[]> {
  const supabase = await getSupabase()
  const { data } = await supabase
    .from('game_results')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as GameResult[]) ?? []
}

export interface PlayerStats {
  name: string
  games_played: number
  wins: number
  losses: number
  draws: number
  belts_won: number
  favorite_superstar: string | null
}

export async function getPlayerStats(): Promise<PlayerStats[]> {
  const supabase = await getSupabase()
  const { data } = await supabase
    .from('game_results')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (!data) return []

  const map = new Map<string, PlayerStats>()

  for (const r of data as GameResult[]) {
    for (let i = 0; i < r.player_names.length; i++) {
      const name = r.player_names[i]
      if (!name) continue
      let ps = map.get(name)
      if (!ps) {
        ps = { name, games_played: 0, wins: 0, losses: 0, draws: 0, belts_won: 0, favorite_superstar: null }
        map.set(name, ps)
      }
      ps.games_played++
      if (r.player_superstars[i]) ps.favorite_superstar = r.player_superstars[i] ?? null
    }

    if (r.winner_name) {
      const ps = map.get(r.winner_name)
      if (ps) {
        ps.wins++
        if (r.belt_won) ps.belts_won++
      }
    }

    for (const loser of r.loser_names) {
      const ps = map.get(loser)
      if (ps) ps.losses++
    }

    if (!r.winner_name) {
      for (const name of r.player_names) {
        const ps = map.get(name)
        if (ps) ps.draws++
      }
    }
  }

  return [...map.values()].sort((a, b) => b.wins - a.wins)
}

// ---------------------------------------------------------------------------
// SUPERSTAR-LEVEL AGGREGATED STATS
// ---------------------------------------------------------------------------

export interface SuperstarAggregate {
  superstar_id: string
  matches_played: number
  wins: number
  losses: number
  /** Record: { [opponent_superstar_id]: { wins, losses } } */
  record_vs: Record<string, { wins: number; losses: number }>
  /** Per-mode breakdown */
  by_mode: Record<string, { played: number; wins: number; losses: number }>
  /** Averaged card-play stats per match */
  avg_reversals: number
  avg_strikes: number
  avg_grapples: number
  avg_submissions: number
  avg_high_risk: number
  avg_actions: number
  avg_midmatch: number
}

export async function getSuperstarStats(): Promise<SuperstarAggregate[]> {
  const supabase = await getSupabase()
  const { data } = await supabase
    .from('superstar_match_stats')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (!data) return []

  const rows = data as SuperstarMatchStat[]
  const map = new Map<string, SuperstarAggregate>()

  for (const r of rows) {
    let agg = map.get(r.superstar_id)
    if (!agg) {
      agg = {
        superstar_id: r.superstar_id,
        matches_played: 0,
        wins: 0,
        losses: 0,
        record_vs: {},
        by_mode: {},
        avg_reversals: 0,
        avg_strikes: 0,
        avg_grapples: 0,
        avg_submissions: 0,
        avg_high_risk: 0,
        avg_actions: 0,
        avg_midmatch: 0,
      }
      map.set(r.superstar_id, agg)
    }

    agg.matches_played++
    if (r.won) agg.wins++
    else agg.losses++

    // Record vs opponent
    if (r.opponent_superstar) {
      const rv = agg.record_vs[r.opponent_superstar] ?? { wins: 0, losses: 0 }
      if (r.won) rv.wins++
      else rv.losses++
      agg.record_vs[r.opponent_superstar] = rv
    }

    // By mode
    const modeKey = r.game_mode
    const bm = agg.by_mode[modeKey] ?? { played: 0, wins: 0, losses: 0 }
    bm.played++
    if (r.won) bm.wins++
    else bm.losses++
    agg.by_mode[modeKey] = bm

    // Accumulate card-play totals for averaging
    agg.avg_reversals += r.reversals_played
    agg.avg_strikes += r.strikes_played
    agg.avg_grapples += r.grapples_played
    agg.avg_submissions += r.submissions_played
    agg.avg_high_risk += r.high_risk_played
    agg.avg_actions += r.actions_played
    agg.avg_midmatch += r.midmatch_played
  }

  // Compute averages
  for (const agg of map.values()) {
    const n = agg.matches_played || 1
    agg.avg_reversals = Math.round((agg.avg_reversals / n) * 10) / 10
    agg.avg_strikes = Math.round((agg.avg_strikes / n) * 10) / 10
    agg.avg_grapples = Math.round((agg.avg_grapples / n) * 10) / 10
    agg.avg_submissions = Math.round((agg.avg_submissions / n) * 10) / 10
    agg.avg_high_risk = Math.round((agg.avg_high_risk / n) * 10) / 10
    agg.avg_actions = Math.round((agg.avg_actions / n) * 10) / 10
    agg.avg_midmatch = Math.round((agg.avg_midmatch / n) * 10) / 10
  }

  return [...map.values()].sort((a, b) => b.wins - a.wins)
}
