-- Additive: never rewrites the original prediction archive.
alter table public.games add column neutral_site boolean;

create table public.model_quarterback_inputs (
  season integer not null,
  week integer not null check (week between 1 and 18),
  team_abbreviation text not null,
  observed_at timestamptz not null,
  starter text not null,
  status text not null,
  adjustment integer not null check (adjustment between -60 and 60),
  source text not null,
  primary key (season, week, team_abbreviation)
);
alter table public.model_quarterback_inputs enable row level security;
revoke all on public.model_quarterback_inputs from anon, authenticated;
grant select on public.model_quarterback_inputs to anon, authenticated;
grant select, insert, update on public.model_quarterback_inputs to service_role;
create policy "Quarterback model inputs are public" on public.model_quarterback_inputs for select to anon, authenticated using (true);

create table public.model_forecasts (
  like public.model_prediction_snapshots including defaults including constraints,
  forecast_kind text not null check (forecast_kind in ('early', 'final')),
  automatic_home_probability numeric(5,4) not null check (automatic_home_probability between 0 and 1),
  inputs jsonb not null,
  primary key (game_id, model_version, forecast_kind),
  foreign key (game_id) references public.games(id) on delete restrict,
  check (capture_is_pregame and captured_at < kickoff_at)
);
create index model_forecasts_season_week_idx on public.model_forecasts(season, week);
alter table public.model_forecasts enable row level security;
revoke all on public.model_forecasts from anon, authenticated;
grant select on public.model_forecasts to anon, authenticated;
grant select, insert on public.model_forecasts to service_role;
create policy "Model forecast history is public" on public.model_forecasts for select to anon, authenticated using (true);
create trigger prevent_model_forecast_mutation before update or delete on public.model_forecasts
for each row execute function private.prevent_prediction_snapshot_mutation();
