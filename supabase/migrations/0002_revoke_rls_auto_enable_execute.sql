-- rls_auto_enable is an event-trigger helper, not a public RPC.
-- Revoke EXECUTE from API roles so it cannot be called via /rest/v1/rpc.

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
