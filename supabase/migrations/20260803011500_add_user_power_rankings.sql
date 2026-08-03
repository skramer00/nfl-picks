create table public.user_power_rankings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  team_order text[] not null,
  updated_at timestamptz not null default now(),
  constraint user_power_rankings_team_count check (cardinality(team_order) = 32)
);
alter table public.user_power_rankings enable row level security;
revoke all on public.user_power_rankings from anon, authenticated;
grant select, insert, update, delete on public.user_power_rankings to authenticated;
create policy "Users read their own power rankings" on public.user_power_rankings for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert their own power rankings" on public.user_power_rankings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own power rankings" on public.user_power_rankings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own power rankings" on public.user_power_rankings for delete to authenticated using ((select auth.uid()) = user_id);
