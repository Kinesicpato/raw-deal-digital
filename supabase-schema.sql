create table if not exists game_results (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now() not null,
  winner_name text,
  winner_superstar text,
  loser_names text[] default '{}',
  win_type text not null,
  turns integer not null,
  player_count integer not null,
  game_mode text not null,
  belt_won boolean default false,
  belt_name text,
  player_names text[] default '{}',
  player_superstars text[] default '{}'
);

alter table game_results enable row level security;

create policy "Anyone can read game results"
  on game_results for select
  using (true);

create policy "Anyone can insert game results"
  on game_results for insert
  with check (true);

create policy "Anyone can update game results"
  on game_results for update
  using (true);

create policy "Anyone can delete game results"
  on game_results for delete
  using (true);

-- Per-superstar match statistics: one row per player per game.
create table if not exists superstar_match_stats (
  id uuid default gen_random_uuid() primary key,
  game_result_id uuid references game_results(id) on delete cascade,
  created_at timestamp with time zone default now() not null,
  player_name text not null,
  superstar_id text not null,
  game_mode text not null,
  won boolean not null,
  opponent_superstar text,
  reversals_played integer default 0,
  strikes_played integer default 0,
  grapples_played integer default 0,
  submissions_played integer default 0,
  high_risk_played integer default 0,
  actions_played integer default 0,
  midmatch_played integer default 0
);

alter table superstar_match_stats enable row level security;

create policy "Anyone can read superstar match stats"
  on superstar_match_stats for select
  using (true);

create policy "Anyone can insert superstar match stats"
  on superstar_match_stats for insert
  with check (true);

create policy "Anyone can delete superstar match stats"
  on superstar_match_stats for delete
  using (true);
