create table public.model_efficiency_observations (
  game_id uuid not null references public.games(id), season integer not null, week integer not null,
  team text not null, opponent text not null, kickoff_at timestamptz not null,
  observed_at timestamptz not null, content_hash text not null, source text not null,
  plays integer not null check (plays > 0), epa double precision not null,
  successes integer not null check (successes >= 0 and successes <= plays),
  pass_plays integer not null, pass_epa double precision not null,
  rush_plays integer not null, rush_epa double precision not null,
  primary key (game_id, team, content_hash),
  check (observed_at > kickoff_at), check (team <> opponent),
  check (pass_plays >= 0 and rush_plays >= 0 and pass_plays + rush_plays = plays)
);
create index model_efficiency_season_observed on public.model_efficiency_observations(season, observed_at);
alter table public.model_efficiency_observations enable row level security;
revoke all on public.model_efficiency_observations from anon, authenticated;
grant select on public.model_efficiency_observations to anon, authenticated;
grant select, insert on public.model_efficiency_observations to service_role;
create policy "Public efficiency observations" on public.model_efficiency_observations for select to anon, authenticated using (true);
create trigger prevent_efficiency_observation_mutation before update or delete on public.model_efficiency_observations
for each row execute function private.prevent_prediction_snapshot_mutation();

create table public.model_market_snapshots (
  game_id uuid not null references public.games(id), season integer not null, week integer not null,
  forecast_kind text not null check (forecast_kind in ('early', 'final')),
  captured_at timestamptz not null, kickoff_at timestamptz not null,
  provider text not null, observed_at timestamptz not null, provider_event_id text not null, source text not null,
  home_moneyline double precision not null, away_moneyline double precision not null,
  home_probability double precision not null check (home_probability > 0 and home_probability < 1),
  primary key (game_id, forecast_kind, captured_at, provider),
  check (observed_at <= captured_at and captured_at < kickoff_at),
  check (captured_at - observed_at <= interval '5 minutes'),
  check (abs(home_moneyline) >= 100 and abs(away_moneyline) >= 100)
);
create index model_market_season on public.model_market_snapshots(season);
alter table public.model_market_snapshots enable row level security;
revoke all on public.model_market_snapshots from anon, authenticated;
grant select on public.model_market_snapshots to anon, authenticated;
grant select, insert on public.model_market_snapshots to service_role;
create policy "Public market snapshots" on public.model_market_snapshots for select to anon, authenticated using (true);
create trigger prevent_market_snapshot_mutation before update or delete on public.model_market_snapshots
for each row execute function private.prevent_prediction_snapshot_mutation();

create table public.model_data_refreshes (
  season integer not null, source text not null, attempted_at timestamptz not null,
  status text not null check (status in ('running','success','error')), row_count integer not null default 0,
  error text, primary key(season, source)
);
alter table public.model_data_refreshes enable row level security;
revoke all on public.model_data_refreshes from anon, authenticated;
grant select on public.model_data_refreshes to anon, authenticated;
grant select, insert, update on public.model_data_refreshes to service_role;
create policy "Public model source health" on public.model_data_refreshes for select to anon, authenticated using (true);
