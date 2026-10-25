-- Keep the internal RLS-enforcement event-trigger function out of the public Data API.
-- The event trigger still runs as PostgreSQL creates public tables; browser clients
-- must not be able to invoke this SECURITY DEFINER function via RPC.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
