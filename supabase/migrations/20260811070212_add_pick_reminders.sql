create table public.pick_reminder_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  thursday_enabled boolean not null default false,
  sunday_enabled boolean not null default false,
  timezone text not null default 'America/Los_Angeles' check (char_length(timezone) between 3 and 64),
  local_hour integer not null default 9 check (local_hour between 8 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pick_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season integer not null,
  week integer not null,
  reminder_kind text not null check (reminder_kind in ('thursday', 'sunday')),
  scheduled_for timestamptz not null,
  resend_email_id text,
  status text not null default 'scheduling' check (status in ('scheduling', 'scheduled', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  unique (user_id, season, week, reminder_kind)
);

alter table public.pick_reminder_preferences enable row level security;
alter table public.pick_reminder_deliveries enable row level security;
revoke all on public.pick_reminder_preferences, public.pick_reminder_deliveries from anon, authenticated;
grant select, insert, update, delete on public.pick_reminder_preferences to authenticated;
grant select on public.pick_reminder_deliveries to authenticated;

create policy "Users manage their own reminder preferences" on public.pick_reminder_preferences
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users read their own reminder deliveries" on public.pick_reminder_deliveries
  for select to authenticated using ((select auth.uid()) = user_id);
