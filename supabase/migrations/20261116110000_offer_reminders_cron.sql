-- Daily at 04:00 UTC (12:00 Taipei): push a reminder for discount codes that
-- expire within 3 days. Same pattern as the other cron-called edge functions
-- (shared secret in the Vault). Dry-run it any time with ?dry_run=1.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-offer-code-reminders') then
    perform cron.unschedule('daily-offer-code-reminders');
  end if;
end $$;

select cron.schedule(
  'daily-offer-code-reminders',
  '0 4 * * *',
  $job$
    select net.http_post(
      url := 'https://svmlwnzmheiishkdwafk.functions.supabase.co/send-offer-code-reminders',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
      body := '{}'::jsonb)
  $job$
);
