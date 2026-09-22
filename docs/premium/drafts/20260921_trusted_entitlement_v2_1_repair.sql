-- POTOK trusted entitlement v2.1 — MINIMAL STAGING REPAIR, NOT APPLIED.
-- Target only after separate approval: Supabase STAGING ozidryfvhkcbtpnulakq.
-- Repairs only deployed potok_control.grant_entitlement_v2(...).
-- No schema/table recreation, data change, role management, RLS or policy change.

BEGIN;

DO $preflight$
DECLARE
  v_function_oid regprocedure := pg_catalog.to_regprocedure(
    'potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'
  );
  v_owner name;
  v_security_definer boolean;
  v_settings text[];
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner SQL session required; current/session roles are %/%',
      CURRENT_USER, SESSION_USER USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.to_regnamespace('potok_control') IS NULL
     OR pg_catalog.to_regclass('potok_control.access_attestations') IS NULL
     OR v_function_oid IS NULL THEN
    RAISE EXCEPTION 'deployed v2 objects/function are required; this is not an installer';
  END IF;

  SELECT pg_catalog.pg_get_userbyid(p.proowner), p.prosecdef, p.proconfig
    INTO v_owner, v_security_definer, v_settings
    FROM pg_catalog.pg_proc p
   WHERE p.oid = v_function_oid;
  IF v_owner <> 'postgres'
     OR NOT v_security_definer
     OR v_settings IS NULL
     OR NOT ('search_path=pg_catalog' = ANY(v_settings)) THEN
    RAISE EXCEPTION 'deployed grant function security metadata differs from reviewed v2';
  END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION potok_control.grant_entitlement_v2(
  p_account_id uuid,
  p_capability text,
  p_valid_until timestamptz,
  p_evidence_ref text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_head potok_control.access_attestations%ROWTYPE;
  v_attestation_id uuid := pg_catalog.gen_random_uuid();
  v_sequence bigint;
  v_updated integer;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled entitlement channel required' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NULL OR p_capability NOT IN ('premium', 'admin') THEN
    RAISE EXCEPTION 'invalid entitlement scope' USING ERRCODE = '22023';
  END IF;
  IF p_valid_until IS NOT NULL AND p_valid_until <= v_now THEN
    RAISE EXCEPTION 'grant expiry must be in the future' USING ERRCODE = '22023';
  END IF;
  IF p_evidence_ref IS NULL OR p_evidence_ref = '' OR p_evidence_ref <> pg_catalog.btrim(p_evidence_ref)
     OR p_reason IS NULL OR p_reason = '' OR p_reason <> pg_catalog.btrim(p_reason) THEN
    RAISE EXCEPTION 'evidence and reason are required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-entitlement-v2:' || p_account_id::text || ':' || p_capability, 0)
  );
  SELECT a.* INTO v_head
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id AND a.capability = p_capability
   ORDER BY a.lineage_sequence DESC LIMIT 1 FOR UPDATE;
  v_sequence := COALESCE(v_head.lineage_sequence, 0::bigint) + 1::bigint;

  INSERT INTO potok_control.access_attestations (
    attestation_id, account_id, capability, effect, previous_attestation_id,
    lineage_sequence, issued_at, valid_until, operator_db_role, evidence_ref, reason
  ) VALUES (
    v_attestation_id, p_account_id, p_capability, 'GRANT', v_head.attestation_id,
    v_sequence, v_now, p_valid_until, SESSION_USER::name, p_evidence_ref, p_reason
  );

  IF p_capability = 'premium' THEN
    UPDATE public.user_profiles
       SET has_premium = true,
           premium_provenance_id = v_attestation_id,
           premium_valid_until = p_valid_until
     WHERE user_id = p_account_id;
  ELSE
    UPDATE public.user_profiles
       SET is_admin = true,
           admin_provenance_id = v_attestation_id,
           admin_valid_until = p_valid_until
     WHERE user_id = p_account_id;
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'exactly one user profile is required for entitlement grant';
  END IF;
  RETURN v_attestation_id;
END
$function$;

-- CREATE OR REPLACE retains owner/ACL; reassert client/service-role denial.
REVOKE ALL ON FUNCTION potok_control.grant_entitlement_v2(uuid, text, timestamptz, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
