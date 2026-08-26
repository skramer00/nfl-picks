create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Vault entries are provisioned separately so credentials never enter source control:
--   pretzel_quest_cron_url
--   pretzel_quest_cron_secret
--
-- The job wakes every 15 minutes but only sends an HTTP request when a regular-
-- season game is within its active window. Vercel's daily cron remains a
-- catch-up path if a provider or network outage delays an update.
select cron.schedule(
  'pretzel-quest-results-sync',
  '*/15 * * 1,9-12 *',
  $job$
    select net.http_get(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'pretzel_quest_cron_url'
        limit 1
      ) || '/api/cron/sync-results',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'pretzel_quest_cron_secret'
          limit 1
        )
      ),
      timeout_milliseconds := 30000
    ) as request_id
    where exists (
      select 1
      from public.games
      where season = 2026
        and season_type = 'REG'
        and kickoff_at between now() - interval '6 hours' and now() + interval '1 hour'
    );
  $job$
);
