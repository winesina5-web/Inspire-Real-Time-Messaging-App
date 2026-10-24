-- ==============================================================================
-- Migration 00006: Supabase Realtime Publication Settings
-- Inspire — Real-Time Messaging App
-- ==============================================================================

-- Enable Postgres Changes publication for real-time messaging tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps;
