-- REVIEW ONLY: do not apply to Staging/Production. Requires schema-parity acceptance.
-- SECURITY DEFINER is needed because direct SELECT on program_explainability is revoked.
-- Explicit ownership check is mandatory before reading any program rows.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_program_days(p_program_id uuid)
RETURNS TABLE(date date, block_id uuid, phase_id uuid, phase_type text, block_type text, targets jsonb, session_plan jsonb, session_status text, explainability_summary jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $potok_days$
DECLARE
  caller uuid := auth.uid();
  allowed_explain boolean := false;
BEGIN
  IF auth.role() <> 'authenticated' OR caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';
  END IF;
  IF NOT (EXISTS(SELECT 1 FROM public.nutrition_programs np WHERE np.id=p_program_id AND np.user_id=caller)
      OR EXISTS(SELECT 1 FROM public.training_programs tp WHERE tp.id=p_program_id AND tp.user_id=caller)) THEN
    RAISE EXCEPTION 'program not accessible' USING ERRCODE='42501';
  END IF;
  SELECT coalesce((e.flags->>'can_explain')::boolean,false)
    INTO allowed_explain FROM public.entitlements e WHERE e.user_id=caller;
  RETURN QUERY
  WITH latest_explain AS (
    SELECT pe.program_id,pe.decision_ref,pe.guard_notes
    FROM public.program_explainability pe
    JOIN public.nutrition_programs np ON np.id=pe.program_id
    WHERE allowed_explain AND pe.program_id=p_program_id AND pe.version=np.program_version AND np.user_id=caller
    UNION ALL
    SELECT pe.program_id,pe.decision_ref,pe.guard_notes
    FROM public.program_explainability pe
    JOIN public.training_programs tp ON tp.id=pe.program_id
    WHERE allowed_explain AND pe.program_id=p_program_id AND pe.version=tp.program_version AND tp.user_id=caller
  ), latest_days AS (
    SELECT DISTINCT ON (pd.date) pd.*
    FROM public.program_days pd JOIN public.program_blocks pb ON pb.id=pd.block_id
    JOIN public.program_phases pp ON pp.id=pb.phase_id
    WHERE pp.program_id=p_program_id ORDER BY pd.date ASC,pd.created_at DESC
  ), latest_sessions AS (
    SELECT DISTINCT ON (ps.date) ps.* FROM public.program_sessions ps
    WHERE ps.program_id=p_program_id ORDER BY ps.date ASC,ps.created_at DESC
  )
  SELECT ld.date,ld.block_id,pb.phase_id,pp.phase_type,pb.block_type,
         ld.targets,ld.session_plan,ls.status,
         CASE WHEN allowed_explain AND le.program_id IS NOT NULL
           THEN jsonb_build_object('decision_ref',le.decision_ref,'reason_code',le.guard_notes->>'reason_code')
           ELSE NULL::jsonb END
  FROM latest_days ld JOIN public.program_blocks pb ON pb.id=ld.block_id
  JOIN public.program_phases pp ON pp.id=pb.phase_id
  LEFT JOIN latest_sessions ls ON ls.program_id=p_program_id AND ls.date=ld.date
  LEFT JOIN LATERAL (
    SELECT le.decision_ref,le.guard_notes,le.program_id
    FROM latest_explain le WHERE le.program_id=p_program_id
    ORDER BY le.decision_ref ASC LIMIT 1
  ) le ON true
  ORDER BY ld.date ASC;
END $potok_days$;

CREATE OR REPLACE FUNCTION public.get_program_day_details(p_program_id uuid,p_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $potok_details$
DECLARE
  caller uuid := auth.uid();
  allowed_explain boolean := false;
  output jsonb;
BEGIN
  IF auth.role() <> 'authenticated' OR caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';
  END IF;
  IF NOT (EXISTS(SELECT 1 FROM public.nutrition_programs np WHERE np.id=p_program_id AND np.user_id=caller)
      OR EXISTS(SELECT 1 FROM public.training_programs tp WHERE tp.id=p_program_id AND tp.user_id=caller)) THEN
    RAISE EXCEPTION 'program not accessible' USING ERRCODE='42501';
  END IF;
  SELECT coalesce((e.flags->>'can_explain')::boolean,false)
    INTO allowed_explain FROM public.entitlements e WHERE e.user_id=caller;
  WITH day_row AS (
    SELECT pd.*,pb.block_type,pp.phase_type,pp.phase_goal
    FROM public.program_days pd JOIN public.program_blocks pb ON pb.id=pd.block_id
    JOIN public.program_phases pp ON pp.id=pb.phase_id
    WHERE pp.program_id=p_program_id AND pd.date=p_date
    ORDER BY pd.created_at DESC LIMIT 1
  ),session_row AS (
    SELECT ps.* FROM public.program_sessions ps
    WHERE ps.program_id=p_program_id AND ps.date=p_date
    ORDER BY ps.created_at DESC LIMIT 1
  ),explain_row AS (
    SELECT pe.* FROM public.program_explainability pe
    JOIN public.nutrition_programs np ON np.id=pe.program_id
    WHERE allowed_explain AND np.user_id=caller AND pe.program_id=p_program_id AND pe.version=np.program_version
    UNION ALL
    SELECT pe.* FROM public.program_explainability pe
    JOIN public.training_programs tp ON tp.id=pe.program_id
    WHERE allowed_explain AND tp.user_id=caller AND pe.program_id=p_program_id AND pe.version=tp.program_version
  )
  SELECT jsonb_build_object('day',(SELECT to_jsonb(day_row) FROM day_row),
    'session',(SELECT to_jsonb(session_row) FROM session_row),
    'explainability',CASE WHEN allowed_explain THEN (SELECT jsonb_agg(to_jsonb(explain_row)) FROM explain_row) ELSE NULL::jsonb END)
  INTO output;
  RETURN output;
END $potok_details$;
REVOKE ALL ON FUNCTION public.get_program_days(uuid),public.get_program_day_details(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_program_days(uuid),public.get_program_day_details(uuid,date) TO authenticated;
ROLLBACK;
