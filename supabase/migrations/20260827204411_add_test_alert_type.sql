alter table public.game_day_alert_deliveries
  drop constraint if exists game_day_alert_deliveries_incident_type_check;

alter table public.game_day_alert_deliveries
  add constraint game_day_alert_deliveries_incident_type_check
  check (incident_type in ('sync_error', 'stale_sync', 'result_attention', 'test_alert'));
