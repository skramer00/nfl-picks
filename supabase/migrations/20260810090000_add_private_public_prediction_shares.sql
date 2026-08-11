create table public.shared_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('power_rankings', 'playoffs_model', 'playoffs_user')),
  public_token uuid not null default gen_random_uuid(),
  payload jsonb not null default '{}'::jsonb,
  display_name text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shared_predictions_user_kind_key unique (user_id, kind),
  constraint shared_predictions_public_token_key unique (public_token)
);

alter table public.shared_predictions enable row level security;
revoke all on public.shared_predictions from anon, authenticated;
grant select, insert, update, delete on public.shared_predictions to authenticated;

create policy "Users read their own shared predictions" on public.shared_predictions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert their own shared predictions" on public.shared_predictions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own shared predictions" on public.shared_predictions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users delete their own shared predictions" on public.shared_predictions
  for delete to authenticated using ((select auth.uid()) = user_id);

create index shared_predictions_public_lookup_idx on public.shared_predictions (public_token)
  where is_public = true;
