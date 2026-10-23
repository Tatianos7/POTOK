-- REVIEW ONLY: isolated entitlement read authority change; do not deploy.
-- Rollback-only transaction; no changes to purchase, paywall or explainability.
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
REVOKE ALL ON FUNCTION public.get_entitlements(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_entitlements(uuid) TO authenticated;
ROLLBACK;
