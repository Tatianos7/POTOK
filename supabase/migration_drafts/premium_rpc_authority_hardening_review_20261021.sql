-- REVIEW ONLY. This is a proposed contract, NOT a deployment migration.
-- Never apply to cloud or copy to supabase/migrations without owner approval,
-- verified client call-sites, disposable acceptance and rollback.
-- Proposed authority boundary:
--   user-facing entitlement reads: authenticated, own account only.
--   purchase event writers: trusted service_role only, pending payment architecture review.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_entitlements(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  caller uuid := auth.uid();
  resolved_user uuid;
  row_ent public.entitlements;
BEGIN
  IF auth.role() <> 'authenticated' OR caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';
  END IF;
  resolved_user := coalesce(p_user_id,caller);
  IF resolved_user <> caller THEN
    RAISE EXCEPTION 'cross-account entitlement access denied' USING ERRCODE='42501';
  END IF;
  SELECT * INTO row_ent FROM public.entitlements WHERE user_id=resolved_user;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('tier','free','flags',jsonb_build_object(
      'can_view_plan',true,'can_adapt',false,'can_explain',false,
      'can_voice',false,'can_spatial',false));
  END IF;
  RETURN jsonb_build_object('tier',row_ent.tier,'flags',row_ent.flags);
END $$;
-- get_paywall_state delegates to the guarded get_entitlements; keep its
-- existing business decision branches unchanged in the final reviewed patch.
REVOKE ALL ON FUNCTION public.get_entitlements(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_entitlements(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_paywall_state(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_paywall_state(text,uuid) TO authenticated,service_role;
-- Purchase RPCs must not be callable with arbitrary p_user_id by clients.
-- Service role is trusted server-side ONLY; receipt verification and event
-- idempotency remain separate prerequisites.
REVOKE ALL ON FUNCTION public.start_purchase(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restore_purchase(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_purchase(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_purchase(uuid,text,text,text) TO service_role;
ROLLBACK;
