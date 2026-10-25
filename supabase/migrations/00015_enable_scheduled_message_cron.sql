-- Enable the managed PostgreSQL scheduler and run due-message release once per minute.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
  'release-due-scheduled-messages',
  '* * * * *',
  'SELECT public.release_due_scheduled_messages();'
);
