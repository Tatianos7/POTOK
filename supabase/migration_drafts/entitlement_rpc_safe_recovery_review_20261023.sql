-- REVIEW ONLY. Security-preserving emergency recovery for entitlement RPC.
-- Never restore the old cross-account-readable function.
-- This candidate disables all client access while preserving the guarded body.
BEGIN;
REVOKE ALL ON FUNCTION public.get_entitlements(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
ROLLBACK;
