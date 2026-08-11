create table public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 50),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
  invite_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pool_members (
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);

create index pool_members_user_id_idx on public.pool_members(user_id);
alter table public.pools enable row level security;
alter table public.pool_members enable row level security;
revoke all on public.pools, public.pool_members from public, anon, authenticated;

create or replace function public.create_pool(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid()); new_pool_id uuid; new_code text;
begin
  if current_user_id is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if char_length(trim(p_name)) not between 2 and 50 then raise exception 'Pool name must be 2–50 characters'; end if;
  loop
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.pools where invite_code = new_code);
  end loop;
  insert into public.pools (name, owner_id, invite_code) values (trim(p_name), current_user_id, new_code) returning id into new_pool_id;
  insert into public.pool_members (pool_id, user_id, role) values (new_pool_id, current_user_id, 'owner');
  return new_pool_id;
end $$;

create or replace function public.join_pool(p_invite_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid()); target public.pools%rowtype;
begin
  if current_user_id is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select * into target from public.pools where invite_code = upper(trim(p_invite_code));
  if not found or not target.invite_enabled then raise exception 'Invite code is invalid or disabled'; end if;
  insert into public.pool_members (pool_id, user_id, role) values (target.id, current_user_id, 'member') on conflict do nothing;
  return target.id;
end $$;

create or replace function public.get_my_pools()
returns table (pool_id uuid, name text, owner_id uuid, invite_code text, invite_enabled boolean, role text, member_count bigint)
language sql security definer set search_path = '' stable as $$
  select p.id, p.name, p.owner_id, p.invite_code, p.invite_enabled, mine.role,
    (select count(*) from public.pool_members all_members where all_members.pool_id = p.id)
  from public.pool_members mine join public.pools p on p.id = mine.pool_id
  where mine.user_id = (select auth.uid()) order by p.created_at;
$$;

create or replace function public.get_pool_members(p_pool_id uuid)
returns table (user_id uuid, display_name text, role text, joined_at timestamptz)
language plpgsql security definer set search_path = '' stable as $$
begin
  if not exists (select 1 from public.pool_members pm where pm.pool_id = p_pool_id and pm.user_id = (select auth.uid())) then raise exception 'Not a pool member' using errcode = '42501'; end if;
  return query select pm.user_id, coalesce(pr.display_name, 'Player'), pm.role, pm.joined_at
    from public.pool_members pm left join public.profiles pr on pr.user_id = pm.user_id
    where pm.pool_id = p_pool_id order by case when pm.role = 'owner' then 0 else 1 end, pm.joined_at;
end $$;

create or replace function public.get_pool_standings(p_pool_id uuid, p_week integer default null)
returns table (user_id uuid, display_name text, points integer, picks_made integer, correct integer, upsets integer, final_picks integer, accuracy numeric)
language plpgsql security definer set search_path = '' stable as $$
begin
  if not exists (select 1 from public.pool_members pm where pm.pool_id = p_pool_id and pm.user_id = (select auth.uid())) then raise exception 'Not a pool member' using errcode = '42501'; end if;
  return query
    select pm.user_id, coalesce(pr.display_name, 'Player'),
      (count(pk.id) filter (where g.kickoff_at <= now() and (p_week is null or g.week = p_week)) + count(pk.id) filter (where g.status = 'final' and pk.picked_team_id = g.winner_team_id and (p_week is null or g.week = p_week)))::integer,
      count(pk.id) filter (where g.kickoff_at <= now() and (p_week is null or g.week = p_week))::integer,
      count(pk.id) filter (where g.status = 'final' and pk.picked_team_id = g.winner_team_id and (p_week is null or g.week = p_week))::integer,
      0::integer,
      count(pk.id) filter (where g.status = 'final' and (p_week is null or g.week = p_week))::integer,
      case when count(pk.id) filter (where g.status = 'final' and (p_week is null or g.week = p_week)) = 0 then 0::numeric else round(100.0 * count(pk.id) filter (where g.status = 'final' and pk.picked_team_id = g.winner_team_id and (p_week is null or g.week = p_week)) / count(pk.id) filter (where g.status = 'final' and (p_week is null or g.week = p_week)), 1) end
    from public.pool_members pm
    left join public.profiles pr on pr.user_id = pm.user_id
    left join public.picks pk on pk.user_id = pm.user_id
    left join public.games g on g.id = pk.game_id
    where pm.pool_id = p_pool_id
    group by pm.user_id, pr.display_name
    order by 3 desc, 8 desc, 4 desc;
end $$;

create or replace function public.set_pool_invites(p_pool_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.pools p where p.id = p_pool_id and p.owner_id = (select auth.uid())) then raise exception 'Only the pool owner can change invitations' using errcode = '42501'; end if;
  update public.pools set invite_enabled = p_enabled, updated_at = now() where id = p_pool_id;
end $$;

create or replace function public.regenerate_pool_invite(p_pool_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare new_code text;
begin
  if not exists (select 1 from public.pools p where p.id = p_pool_id and p.owner_id = (select auth.uid())) then raise exception 'Only the pool owner can regenerate invitations' using errcode = '42501'; end if;
  loop new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)); exit when not exists (select 1 from public.pools where invite_code = new_code); end loop;
  update public.pools set invite_code = new_code, invite_enabled = true, updated_at = now() where id = p_pool_id;
  return new_code;
end $$;

create or replace function public.remove_pool_member(p_pool_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.pools p where p.id = p_pool_id and p.owner_id = (select auth.uid())) then raise exception 'Only the pool owner can remove members' using errcode = '42501'; end if;
  if p_user_id = (select auth.uid()) then raise exception 'The owner cannot remove themselves'; end if;
  delete from public.pool_members where pool_id = p_pool_id and user_id = p_user_id and role = 'member';
end $$;

revoke all on function public.create_pool(text), public.join_pool(text), public.get_my_pools(), public.get_pool_members(uuid), public.get_pool_standings(uuid, integer), public.set_pool_invites(uuid, boolean), public.regenerate_pool_invite(uuid), public.remove_pool_member(uuid, uuid) from public, anon;
grant execute on function public.create_pool(text), public.join_pool(text), public.get_my_pools(), public.get_pool_members(uuid), public.get_pool_standings(uuid, integer), public.set_pool_invites(uuid, boolean), public.regenerate_pool_invite(uuid), public.remove_pool_member(uuid, uuid) to authenticated;
