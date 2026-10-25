-- Query-path indexes for realtime chat, group reads, calls, reactions, channels, and RSVPs.
-- All are additive; no data or existing constraints are changed.
CREATE INDEX IF NOT EXISTS group_messages_group_created_idx ON public.group_messages (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_messages_reply_to_idx ON public.group_messages (reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS call_signals_call_created_idx ON public.call_signals (call_id, created_at);
CREATE INDEX IF NOT EXISTS call_signals_receiver_created_idx ON public.call_signals (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS call_signals_sender_created_idx ON public.call_signals (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reactions_message_id_idx ON public.reactions (message_id);
CREATE INDEX IF NOT EXISTS reactions_user_id_idx ON public.reactions (user_id);
CREATE INDEX IF NOT EXISTS group_message_reads_message_id_idx ON public.group_message_reads (group_message_id);
CREATE INDEX IF NOT EXISTS group_message_reads_user_id_idx ON public.group_message_reads (user_id);
CREATE INDEX IF NOT EXISTS channel_posts_channel_created_idx ON public.channel_posts (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_rsvps_event_id_idx ON public.event_rsvps (event_id);
CREATE INDEX IF NOT EXISTS event_rsvps_user_id_idx ON public.event_rsvps (user_id);
CREATE INDEX IF NOT EXISTS messages_group_id_idx ON public.messages (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_reply_to_id_idx ON public.messages (reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_forwarded_from_id_idx ON public.messages (forwarded_from_id) WHERE forwarded_from_id IS NOT NULL;
