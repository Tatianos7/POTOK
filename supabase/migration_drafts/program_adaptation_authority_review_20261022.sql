-- REVIEW ONLY: trusted adaptation authorization boundary, not an adaptation writer.
-- This does not authorize direct client writes; a future atomic adaptation RPC
-- must repeat these checks inside the same locked transaction as its mutations.
BEGIN;
CREATE OR REPLACE FUNCTION public.assert_program_adaptation_authority(
  p_program_id uuid, p_program_type text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $potok_adapt_auth$
DECLARE
  caller uuid := auth.uid();
  capability boolean := false;
  owned boolean := false;
BEGIN
  IF caller IS NULL OR current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';
  END IF;
  IF p_program_id IS NULL OR p_program_type NOT IN ('nutrition','training') OR p_program_type IS NULL THEN
    RAISE EXCEPTION 'invalid program identity' USING ERRCODE='22023';
  END IF;
  IF p_program_type='nutrition' THEN
    SELECT EXISTS (SELECT 1 FROM public.nutrition_programs WHERE id=p_program_id AND user_id=caller) INTO owned;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.training_programs WHERE id=p_program_id AND user_id=caller) INTO owned;
  END IF;
  IF NOT owned THEN
    RAISE EXCEPTION 'program not accessible' USING ERRCODE='42501';
  END IF;
  SELECT coalesce((e.flags->>'can_adapt')::boolean,false)
  INTO capability FROM public.entitlements e WHERE e.user_id=caller;
  IF NOT coalesce(capability,false) THEN
    RAISE EXCEPTION 'adaptation capability required' USING ERRCODE='42501';
  END IF;
  RETURN true;
END
$potok_adapt_auth$;
REVOKE ALL ON FUNCTION public.assert_program_adaptation_authority(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assert_program_adaptation_authority(uuid,text) TO authenticated;
ROLLBACK;
