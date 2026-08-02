create table public.model_prediction_snapshots (
  game_id uuid primary key references public.games(id) on delete restrict,
  season integer not null,
  week integer not null check (week between 1 and 18),
  kickoff_at timestamptz not null,
  captured_at timestamptz not null default now(),
  capture_is_pregame boolean not null,
  capture_source text not null check (capture_source in ('cron', 'manual')),
  model_version text not null,
  away_win_probability numeric(5, 4) not null
    check (away_win_probability between 0 and 1),
  home_win_probability numeric(5, 4) not null
    check (home_win_probability between 0 and 1),
  away_team_rating integer not null,
  home_team_rating integer not null,
  home_field_elo integer not null,
  is_division_matchup boolean not null,
  division_cap numeric(5, 4) not null
    check (division_cap between 0.5 and 1),
  week_one_regression boolean not null,
  rest_advantage_team_id uuid references public.teams(id) on delete restrict,
  rest_advantage_days integer,
  rest_adjustment numeric(5, 4) not null default 0,
  manual_override boolean not null default false,
  manual_override_reason text,
  constraint model_prediction_snapshots_probabilities_sum check (
    away_win_probability + home_win_probability = 1
  ),
  constraint model_prediction_snapshots_override_reason check (
    (manual_override and manual_override_reason is not null)
    or (not manual_override and manual_override_reason is null)
  )
);

create index model_prediction_snapshots_season_week_idx
  on public.model_prediction_snapshots (season, week);

create index model_prediction_snapshots_rest_team_idx
  on public.model_prediction_snapshots (rest_advantage_team_id)
  where rest_advantage_team_id is not null;

alter table public.model_prediction_snapshots enable row level security;

revoke all on public.model_prediction_snapshots from anon, authenticated;
grant select on public.model_prediction_snapshots to anon, authenticated;
grant select, insert on public.model_prediction_snapshots to service_role;

create policy "Prediction snapshots are publicly readable"
on public.model_prediction_snapshots for select
to anon, authenticated
using (true);

create or replace function private.prevent_prediction_snapshot_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Model prediction snapshots are immutable' using errcode = '55000';
end;
$$;

revoke all on function private.prevent_prediction_snapshot_mutation()
from public, anon, authenticated;

create trigger prevent_prediction_snapshot_mutation
before update or delete on public.model_prediction_snapshots
for each row execute function private.prevent_prediction_snapshot_mutation();
