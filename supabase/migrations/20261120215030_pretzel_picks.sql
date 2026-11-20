create table public.pretzel_picks (
  user_id uuid not null references auth.users(id) on delete cascade,
  season integer not null,
  week integer not null check (week between 1 and 18),
  game_id uuid not null references public.games(id) on delete cascade,
  primary key (user_id, season, week),
  foreign key (user_id, game_id) references public.picks(user_id, game_id)
    deferrable initially deferred
);

create index pretzel_picks_game_id_idx on public.pretzel_picks(game_id);

alter table public.pretzel_picks enable row level security;
revoke all on public.pretzel_picks from public, anon, authenticated;
grant select, insert, update, delete on public.pretzel_picks to authenticated;
create policy own_pretzel_picks on public.pretzel_picks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function private.validate_pretzel_pick()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  target public.games%rowtype;
begin
  if tg_op <> 'INSERT' and current_user = 'authenticated' then
    if exists (select 1 from public.games where id = old.game_id and kickoff_at <= clock_timestamp()) then
      raise exception 'Your Pretzel Pick is locked because its game has kicked off.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;

  if tg_op = 'UPDATE' and (old.user_id, old.season, old.week) is distinct from (new.user_id, new.season, new.week) then
    raise exception 'A Pretzel Pick cannot move to another week.';
  end if;

  select * into target from public.games where id = new.game_id;
  if not found or target.season <> new.season or target.week <> new.week or target.season_type is distinct from 'REG' then
    raise exception 'Choose a regular-season game from this week.';
  end if;
  if target.kickoff_at <= clock_timestamp() then
    raise exception 'This game has already kicked off.';
  end if;
  if not exists (select 1 from public.picks where user_id = new.user_id and game_id = new.game_id) then
    raise exception 'Save a team pick for this game first.';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_pretzel_pick() from public, anon, authenticated;

create trigger validate_pretzel_pick_before_write
before insert or update or delete on public.pretzel_picks
for each row execute function private.validate_pretzel_pick();

create or replace view public.leaderboard_points
with (security_invoker = true)
as
select
  p.user_id,
  coalesce(pr.display_name, 'Player') as display_name,
  count(*)::integer as picks_made,
  count(*) filter (where g.status = 'final')::integer as final_picks,
  count(*) filter (where g.status = 'final' and p.picked_team_id = g.winner_team_id)::integer as correct,
  0::integer as upsets,
  (count(*) + count(*) filter (where g.status = 'final' and p.picked_team_id = g.winner_team_id) +
    count(*) filter (where pp.game_id is not null and g.status = 'final' and p.picked_team_id = g.winner_team_id))::integer as points,
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
left join public.pretzel_picks pp on pp.user_id = p.user_id and pp.season = g.season and pp.week = g.week and pp.game_id = g.id
group by p.user_id, pr.display_name;

create or replace function public.get_pool_standings(p_pool_id uuid, p_week integer default null)
returns table (user_id uuid, display_name text, points integer, picks_made integer, correct integer, upsets integer, final_picks integer, accuracy numeric)
language plpgsql security definer set search_path = '' stable as $$
begin
  if not exists (select 1 from public.pool_members pm where pm.pool_id = p_pool_id and pm.user_id = (select auth.uid())) then raise exception 'Not a pool member' using errcode = '42501'; end if;
  return query
    select pm.user_id, coalesce(pr.display_name, 'Player'),
      (count(pk.id) filter (where g.kickoff_at <= now() and (p_week is null or g.week = p_week)) + count(pk.id) filter (where g.status = 'final' and pk.picked_team_id = g.winner_team_id and (p_week is null or g.week = p_week))
        + count(pk.id) filter (where pp.game_id is not null and g.status = 'final' and pk.picked_team_id = g.winner_team_id and (p_week is null or g.week = p_week)))::integer,
      count(pk.id) filter (where g.kickoff_at <= now() and (p_week is null or g.week = p_week))::integer,
      count(pk.id) filter (where g.status = 'final' and pk.picked_team_id = g.winner_team_id and (p_week is null or g.week = p_week))::integer,
      0::integer,
      count(pk.id) filter (where g.status = 'final' and (p_week is null or g.week = p_week))::integer,
      case when count(pk.id) filter (where g.status = 'final' and (p_week is null or g.week = p_week)) = 0 then 0::numeric else round(100.0 * count(pk.id) filter (where g.status = 'final' and pk.picked_team_id = g.winner_team_id and (p_week is null or g.week = p_week)) / count(pk.id) filter (where g.status = 'final' and (p_week is null or g.week = p_week)), 1) end
    from public.pool_members pm
    left join public.profiles pr on pr.user_id = pm.user_id
    left join public.picks pk on pk.user_id = pm.user_id
    left join public.games g on g.id = pk.game_id
    left join public.pretzel_picks pp on pp.user_id = pk.user_id and pp.season = g.season and pp.week = g.week and pp.game_id = g.id
    where pm.pool_id = p_pool_id
    group by pm.user_id, pr.display_name
    order by 3 desc, 8 desc, 4 desc;
end $$;
