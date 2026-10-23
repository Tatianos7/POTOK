-- REVIEW ONLY. Security-preserving emergency recovery for entitlement RPC.
-- Never restore the old cross-account-readable function.
-- This candidate disables both entitlement and paywall client access while preserving guarded bodies.
BEGIN;
REVOKE ALL ON FUNCTION public.get_entitlements(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
-- Owner-approved: paywall endpoint matches entitlement authenticated-only grants.
REVOKE ALL ON FUNCTION public.get_paywall_state(text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;

ROLLBACK;
