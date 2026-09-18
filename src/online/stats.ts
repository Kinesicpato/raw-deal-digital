import { supabase } from './supabase'
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

export async function saveGameResult(game: GameState): Promise<void> {
  const winners = game.winner ?? []
  const winnerIdx = winners.length === 1 ? winners[0] : null
  const winnerName = winnerIdx != null ? game.players[winnerIdx]?.name ?? null : null
  const winnerSuperstar = winnerIdx != null ? game.players[winnerIdx]?.superstarId ?? null : null
  const loserNames = winnerIdx != null
    ? game.players.filter((_, i) => i !== winnerIdx).map(p => p.name)
    : []
  const belt = game.beltId ? BELTS.find((b) => b.id === game.beltId) ?? null : null

  await supabase.from('game_results').insert({
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
  })
}

export async function getRecentResults(limit = 50): Promise<GameResult[]> {
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
