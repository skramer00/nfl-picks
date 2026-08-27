create table public.game_day_alert_deliveries (
  incident_key text primary key,
  incident_type text not null check (incident_type in ('sync_error', 'stale_sync', 'result_attention')),
  season integer not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  resend_email_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index game_day_alert_deliveries_created_at_idx
  on public.game_day_alert_deliveries (created_at desc);

alter table public.game_day_alert_deliveries enable row level security;
revoke all on public.game_day_alert_deliveries from anon, authenticated;
grant select, insert, update on public.game_day_alert_deliveries to service_role;

create policy "Operational alerts are server-only"
on public.game_day_alert_deliveries for all
to anon, authenticated
using (false)
with check (false);
