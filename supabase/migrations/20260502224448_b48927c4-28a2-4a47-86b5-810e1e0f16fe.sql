
-- Schedule telegram-poll every minute
do $$
begin
  if exists (select 1 from cron.job where jobname = 'telegram-poll-every-minute') then
    perform cron.unschedule('telegram-poll-every-minute');
  end if;
  perform cron.schedule(
    'telegram-poll-every-minute',
    '* * * * *',
    $job$
    select net.http_post(
      url := 'https://zzufaisawyhveocviycg.supabase.co/functions/v1/telegram-poll',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6dWZhaXNhd3lodmVvY3ZpeWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDQ3MTQsImV4cCI6MjA4OTQyMDcxNH0.DCf78riMN4BgOB4myrzR7a733PQh-AxKLh2KdUiPBlk'
      ),
      body := '{}'::jsonb
    );
    $job$
  );
end $$;
