-- REVIEW ONLY / NO-GO. Never apply to cloud without coordinated rollout.
-- Production column names verified read-only on 2026-10-22.
-- Transactional PostgreSQL RPC: status + guard event + explainability.
-- Repeated pause is a no-op under the locked program row.
BEGIN;
CREATE OR REPLACE FUNCTION public.pause_program_atomic(
  p_program_id uuid, p_program_type text, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $potok_pause$
DECLARE
  caller uuid := auth.uid();
  row_program record;
  normalized_reason text := btrim(p_reason);
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';
  END IF;
  IF p_program_id IS NULL OR p_program_type NOT IN ('nutrition','training') OR p_program_type IS NULL THEN
    RAISE EXCEPTION 'invalid program identity' USING ERRCODE='22023';
  END IF;
  IF normalized_reason IS NULL OR length(normalized_reason) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'invalid pause reason' USING ERRCODE='22023';
  END IF;
  -- Row lock serializes concurrent pauses and prevents duplicate evidence.
  IF p_program_type='nutrition' THEN
    SELECT id,user_id,status,program_version,knowledge_version_ref
      INTO row_program FROM public.nutrition_programs
      WHERE id=p_program_id FOR UPDATE;
  ELSE
    SELECT id,user_id,status,program_version,knowledge_version_ref
      INTO row_program FROM public.training_programs
      WHERE id=p_program_id FOR UPDATE;
  END IF;
  IF row_program.id IS NULL OR row_program.user_id IS DISTINCT FROM caller THEN
    RAISE EXCEPTION 'program not accessible' USING ERRCODE='42501';
  END IF;
  IF row_program.status='paused' THEN
    RETURN jsonb_build_object('status','paused','changed',false);
  END IF;
  IF row_program.status <> 'active' THEN
    RAISE EXCEPTION 'program cannot be paused from current state' USING ERRCODE='22023';
  END IF;
  IF p_program_type='nutrition' THEN
    UPDATE public.nutrition_programs SET status='paused' WHERE id=p_program_id;
  ELSE
    UPDATE public.training_programs SET status='paused' WHERE id=p_program_id;
  END IF;
  INSERT INTO public.program_guard_events(program_id,program_type,risk_level,flags,blocked_actions)
  VALUES (p_program_id,p_program_type,'caution',ARRAY['manual_pause'],ARRAY['program_delivery']);
  INSERT INTO public.program_explainability(
    program_id,program_type,version,decision_ref,knowledge_refs,confidence,guard_notes
  ) VALUES (
    p_program_id,p_program_type,row_program.program_version,'why_paused',
    coalesce(row_program.knowledge_version_ref,'{}'::jsonb),
    CASE WHEN jsonb_typeof(row_program.knowledge_version_ref->'effective_confidence')='number'
      THEN (row_program.knowledge_version_ref->>'effective_confidence')::numeric ELSE NULL END,
    jsonb_build_object('reason_code','manual_pause',
      'diff_summary',jsonb_build_object('status','paused'),
      'safety_notes',jsonb_build_object('reason',normalized_reason))
  );
  RETURN jsonb_build_object('status','paused','changed',true);
END $potok_pause$;
REVOKE ALL ON FUNCTION public.pause_program_atomic(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pause_program_atomic(uuid,text,text) TO authenticated;
ROLLBACK;
