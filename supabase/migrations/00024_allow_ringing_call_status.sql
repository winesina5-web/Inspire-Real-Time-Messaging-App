-- Allow the initial state used by the outgoing-call flow.
-- Calls progress through ringing -> answered, or ringing -> missed/declined.
ALTER TABLE public.calls
  DROP CONSTRAINT IF EXISTS calls_status_check;

ALTER TABLE public.calls
  ADD CONSTRAINT calls_status_check
  CHECK (status = ANY (ARRAY['ringing'::text, 'missed'::text, 'answered'::text, 'declined'::text]));

CREATE INDEX IF NOT EXISTS calls_callee_status_started_at_idx
  ON public.calls (callee_id, status, started_at DESC);
