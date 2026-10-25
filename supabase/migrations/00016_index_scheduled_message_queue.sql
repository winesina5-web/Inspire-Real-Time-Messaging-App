-- Keep the once-per-minute scheduled-message release job efficient as history grows.
CREATE INDEX IF NOT EXISTS messages_scheduled_due_idx
  ON public.messages (scheduled_for)
  WHERE scheduled_for IS NOT NULL;
