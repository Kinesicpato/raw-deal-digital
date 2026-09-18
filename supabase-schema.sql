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
