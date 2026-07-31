revoke select on public.sync_runs from anon;

create index sync_runs_requested_by_idx
  on public.sync_runs (requested_by)
  where requested_by is not null;

create index favorability_overrides_created_by_idx
  on public.favorability_overrides (created_by)
  where created_by is not null;
