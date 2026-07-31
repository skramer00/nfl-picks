create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (
    display_name is null or char_length(trim(display_name)) between 1 and 40
  )
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (user_id, display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "Profiles are readable by signed-in users"
on public.profiles for select to authenticated using (true);

create policy "Users can create their own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    nullif(left(split_part(coalesce(new.email, ''), '@', 1), 40), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (user_id, display_name)
select id, nullif(left(split_part(coalesce(email, ''), '@', 1), 40), '')
from auth.users
on conflict (user_id) do nothing;

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  picked_team_id uuid not null references public.teams(id),
  picked_at timestamptz not null default now(),
  unique (user_id, game_id)
);

create index picks_user_id_idx on public.picks(user_id);
create index picks_game_id_idx on public.picks(game_id);
create index picks_picked_team_id_idx on public.picks(picked_team_id);
create index if not exists games_winner_team_idx on public.games(winner_team_id);

alter table public.picks enable row level security;
revoke all on public.picks from anon, authenticated;
grant select, insert, update, delete on public.picks to authenticated;

create policy "Users can view their own picks"
on public.picks for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert their own picks"
on public.picks for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own picks"
on public.picks for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete their own picks"
on public.picks for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function private.validate_pick()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_game public.games%rowtype;
begin
  if (select auth.uid()) is null or new.user_id <> (select auth.uid()) then
    raise exception 'Not authenticated for this pick' using errcode = '42501';
  end if;

  select * into target_game from public.games where id = new.game_id;
  if not found then
    raise exception 'Game not found' using errcode = '23503';
  end if;

  if new.picked_team_id not in (target_game.home_team_id, target_game.away_team_id) then
    raise exception 'Picked team is not in this game' using errcode = '23514';
  end if;

  if target_game.kickoff_at <= now() then
    raise exception 'Game is locked because kickoff has passed' using errcode = 'P0001';
  end if;

  new.picked_at := now();
  return new;
end;
$$;

revoke all on function private.validate_pick() from public, anon, authenticated;

create trigger validate_pick_before_write
before insert or update on public.picks
for each row execute function private.validate_pick();

create or replace function public.submit_pick(p_game_id uuid, p_team_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.picks (user_id, game_id, picked_team_id)
  values (current_user_id, p_game_id, p_team_id)
  on conflict (user_id, game_id)
  do update set picked_team_id = excluded.picked_team_id, picked_at = now();
end;
$$;

revoke all on function public.submit_pick(uuid, uuid) from public, anon;
grant execute on function public.submit_pick(uuid, uuid) to authenticated;

create view public.leaderboard_points
with (security_invoker = true)
as
select
  p.user_id,
  coalesce(pr.display_name, 'Player') as display_name,
  count(*)::integer as picks_made,
  count(*) filter (where g.status = 'final')::integer as final_picks,
  count(*) filter (where g.status = 'final' and p.picked_team_id = g.winner_team_id)::integer as correct,
  0::integer as upsets,
  (count(*) + count(*) filter (where g.status = 'final' and p.picked_team_id = g.winner_team_id))::integer as points,
  case
    when count(*) filter (where g.status = 'final') = 0 then 0::numeric
    else round(
      100.0 * count(*) filter (where g.status = 'final' and p.picked_team_id = g.winner_team_id)
      / count(*) filter (where g.status = 'final'),
      1
    )
  end as accuracy
from public.picks p
left join public.profiles pr on pr.user_id = p.user_id
join public.games g on g.id = p.game_id
group by p.user_id, pr.display_name;

revoke all on public.leaderboard_points from anon, authenticated;
grant select on public.leaderboard_points to authenticated;
