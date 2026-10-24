-- REVIEW ONLY. First atomic adaptation primitive: a bounded program version transition.
-- Not a full plan regeneration implementation. Never deploy alone or without
-- revoking client writes to versions, programs, and explainability.
BEGIN;
CREATE OR REPLACE FUNCTION public.advance_program_adaptation_atomic(
 p_program_id uuid, p_program_type text, p_expected_version integer,
 p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $potok_adapt_atomic$
DECLARE
 caller uuid := auth.uid();
 program_row record;
 existing record;
 next_version integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR caller IS NULL THEN
   RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';
 END IF;
 IF p_program_id IS NULL OR p_program_type IS NULL OR p_program_type NOT IN ('nutrition','training')
    OR p_expected_version IS NULL OR p_expected_version < 1 OR p_idempotency_key IS NULL THEN
   RAISE EXCEPTION 'invalid adaptation request' USING ERRCODE='22023';
 END IF;
 IF p_program_type='nutrition' THEN
   SELECT id,user_id,status,program_version,knowledge_version_ref INTO program_row
     FROM public.nutrition_programs WHERE id=p_program_id FOR UPDATE;
 ELSE
   SELECT id,user_id,status,program_version,knowledge_version_ref INTO program_row
     FROM public.training_programs WHERE id=p_program_id FOR UPDATE;
 END IF;
 IF program_row.id IS NULL OR program_row.user_id IS DISTINCT FROM caller THEN
   RAISE EXCEPTION 'program not accessible' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.entitlements e WHERE e.user_id=caller
     AND coalesce((e.flags->>'can_adapt')::boolean,false)
 ) THEN
   RAISE EXCEPTION 'adaptation capability required' USING ERRCODE='42501';
 END IF;
 -- Lock first, then check replay. Same key on a different version is rejected.
 SELECT version,snapshot INTO existing FROM public.program_versions
 WHERE program_id=p_program_id AND program_type=p_program_type
   AND snapshot->>'adaptation_request_id'=p_idempotency_key::text
 ORDER BY version DESC LIMIT 1;
 IF existing.version IS NOT NULL THEN
   IF (existing.snapshot->>'expected_version')::integer IS DISTINCT FROM p_expected_version THEN
     RAISE EXCEPTION 'idempotency conflict' USING ERRCODE='23505';
   END IF;
   RETURN jsonb_build_object('status','already_applied','from_version',p_expected_version,
     'to_version',existing.version);
 END IF;
 IF program_row.status IS DISTINCT FROM 'active' THEN
   RAISE EXCEPTION 'program not active' USING ERRCODE='22023';
 END IF;
 IF program_row.program_version IS DISTINCT FROM p_expected_version THEN
   RAISE EXCEPTION 'program version conflict' USING ERRCODE='40001';
 END IF;
 next_version := p_expected_version+1;
 INSERT INTO public.program_versions(program_id,program_type,version,snapshot,reason)
 VALUES(p_program_id,p_program_type,next_version,
   jsonb_build_object('adaptation_request_id',p_idempotency_key::text,
    'expected_version',p_expected_version,'status','pending_server_generation'),
   'adaptation_pending');
 IF p_program_type='nutrition' THEN
   UPDATE public.nutrition_programs SET program_version=next_version WHERE id=p_program_id;
 ELSE
   UPDATE public.training_programs SET program_version=next_version WHERE id=p_program_id;
 END IF;
 INSERT INTO public.program_explainability(
  program_id,program_type,version,decision_ref,knowledge_refs,guard_notes)
 VALUES(p_program_id,p_program_type,next_version,'adaptation_pending',
  coalesce(program_row.knowledge_version_ref,'{}'::jsonb),
  jsonb_build_object('reason_code','adaptation_pending_server_generation'));
 RETURN jsonb_build_object('status','pending_server_generation',
   'from_version',p_expected_version,'to_version',next_version);
END $potok_adapt_atomic$;
REVOKE ALL ON FUNCTION public.advance_program_adaptation_atomic(uuid,text,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_program_adaptation_atomic(uuid,text,integer,uuid) TO authenticated;
ROLLBACK;
