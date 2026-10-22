-- REVIEW ONLY / NO CLOUD DEPLOY. Nutrition-only atomic server-owned recalculation.
-- This is not the adaptive strategy engine; 'maintain' and 'deload' are bounded.
-- Caller cannot provide calorie/macronutrient values or arbitrary multipliers.
-- Do not enable until client writers are removed and entitlement provenance verified.
BEGIN;
CREATE OR REPLACE FUNCTION public.adapt_nutrition_program_atomic_v1(
 p_program_id uuid,p_expected_version integer,p_request_id uuid,p_mode text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $potok_nutrition_atomic$
DECLARE
 caller uuid := auth.uid();
 pr record;
 goal_row record;
 previous record;
 v_targets jsonb;
 updated_count integer;
 next_version integer;
 factor numeric;
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR caller IS NULL THEN
  RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';
 END IF;
 IF p_program_id IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL
    OR p_expected_version < 1 OR p_mode IS NULL OR p_mode NOT IN ('maintain','deload') THEN
  RAISE EXCEPTION 'invalid adaptation request' USING ERRCODE='22023';
 END IF;
 SELECT id,user_id,status,program_version,knowledge_version_ref INTO pr
 FROM public.nutrition_programs WHERE id=p_program_id FOR UPDATE;
 IF pr.id IS NULL OR pr.user_id IS DISTINCT FROM caller THEN
  RAISE EXCEPTION 'program not accessible' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.entitlements e
  WHERE e.user_id=caller AND e.tier <> 'free'
  AND coalesce((e.flags->>'can_adapt')::boolean,false)) THEN
  RAISE EXCEPTION 'adaptation capability required' USING ERRCODE='42501';
 END IF;
 SELECT version,snapshot INTO previous FROM public.program_versions
 WHERE program_id=p_program_id AND program_type='nutrition'
 AND snapshot->>'adaptation_request_id'=p_request_id::text
 ORDER BY version DESC LIMIT 1;
 IF previous.version IS NOT NULL THEN
  IF (previous.snapshot->>'expected_version')::integer IS DISTINCT FROM p_expected_version
   OR previous.snapshot->>'mode' IS DISTINCT FROM p_mode THEN
   RAISE EXCEPTION 'idempotency conflict' USING ERRCODE='23505';
  END IF;
  RETURN jsonb_build_object('status','already_applied','to_version',previous.version);
 END IF;
 IF pr.status IS DISTINCT FROM 'active' THEN
  RAISE EXCEPTION 'program not active' USING ERRCODE='22023';
 END IF;
 IF pr.program_version IS DISTINCT FROM p_expected_version THEN
  RAISE EXCEPTION 'program version conflict' USING ERRCODE='40001';
 END IF;
 SELECT calories,protein,fat,carbs INTO STRICT goal_row
 FROM public.user_goals WHERE user_id=caller;
 factor:=CASE WHEN p_mode='deload' THEN 0.8 ELSE 1 END;
 v_targets:=public.potok_nutrition_adaptation_targets_v1(
  goal_row.calories,goal_row.protein,goal_row.fat,goal_row.carbs,
  1,factor,false);
 -- Only future plan days. Past plan history and completed/skipped sessions remain unchanged.
 -- Existing plan structures are not deleted/recreated.
 UPDATE public.program_days d SET targets=v_targets
 FROM public.program_blocks b JOIN public.program_phases ph ON ph.id=b.phase_id
 WHERE d.block_id=b.id AND ph.program_id=p_program_id AND ph.program_type='nutrition'
 AND d.date > current_date
 AND NOT EXISTS(SELECT 1 FROM public.program_sessions s
  WHERE s.program_id=p_program_id AND s.date=d.date AND s.status <> 'planned');
 GET DIAGNOSTICS updated_count=ROW_COUNT;
 IF updated_count=0 THEN
  RAISE EXCEPTION 'no eligible future plan days' USING ERRCODE='22023';
 END IF;
 next_version:=p_expected_version+1;
 INSERT INTO public.program_versions(program_id,program_type,version,snapshot,reason)
 VALUES(p_program_id,'nutrition',next_version,
 jsonb_build_object('adaptation_request_id',p_request_id::text,
  'expected_version',p_expected_version,'mode',p_mode,'targets',v_targets,
  'updated_future_days',updated_count),'adaptation_replan');
 INSERT INTO public.program_explainability(program_id,program_type,version,decision_ref,knowledge_refs,guard_notes)
 VALUES(p_program_id,'nutrition',next_version,'why_changed',
 coalesce(pr.knowledge_version_ref,'{}'::jsonb),
 jsonb_build_object('reason_code','bounded_nutrition_replan','mode',p_mode,
 'updated_future_days',updated_count));
 UPDATE public.nutrition_programs SET program_version=next_version WHERE id=p_program_id;
 RETURN jsonb_build_object('status','applied','from_version',p_expected_version,
  'to_version',next_version,'updated_future_days',updated_count,'targets',v_targets);
END $potok_nutrition_atomic$;
REVOKE ALL ON FUNCTION public.adapt_nutrition_program_atomic_v1(uuid,integer,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.adapt_nutrition_program_atomic_v1(uuid,integer,uuid,text) TO authenticated;
ROLLBACK;
