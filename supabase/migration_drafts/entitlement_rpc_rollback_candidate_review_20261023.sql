-- REVIEW ONLY. Restores observed production behavior; NOT safe as steady state.
-- Rollback reopens cross-account reads; use only under explicit incident decision.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_entitlements(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
 resolved_user uuid;
 row_ent public.entitlements;
BEGIN
 resolved_user := coalesce(p_user_id,auth.uid());
 IF resolved_user IS NULL THEN
  RETURN jsonb_build_object('tier','free','flags',jsonb_build_object());
 END IF;
 SELECT * INTO row_ent FROM public.entitlements WHERE user_id=resolved_user;
 IF row_ent.id IS NULL THEN
  RETURN jsonb_build_object('tier','free','flags',jsonb_build_object(
   'can_view_plan',true,'can_adapt',false,'can_explain',false,
   'can_voice',false,'can_spatial',false));
 END IF;
 RETURN jsonb_build_object('tier',row_ent.tier,'flags',row_ent.flags);
END $$;
GRANT EXECUTE ON FUNCTION public.get_entitlements(uuid) TO PUBLIC,anon,authenticated,service_role;
ROLLBACK;
