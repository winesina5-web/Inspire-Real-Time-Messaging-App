-- Support expiry-filtered message reads without scanning all historical messages.
CREATE INDEX IF NOT EXISTS messages_expiry_due_idx
  ON public.messages (expires_at)
  WHERE expires_at IS NOT NULL;
