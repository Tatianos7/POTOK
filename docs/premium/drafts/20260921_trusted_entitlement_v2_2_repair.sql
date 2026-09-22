-- POTOK trusted entitlement v2.2 — MINIMAL STAGING TIME-SEMANTICS REPAIR, NOT APPLIED.
-- Target only after separate approval: Supabase STAGING ozidryfvhkcbtpnulakq.
-- Replaces only grant/revoke writers so issued_at uses the same statement clock
-- as public entitlement evaluation. No table, data, RLS, policy or role changes.

BEGIN;

DO $preflight$
DECLARE
  v_grant_oid regprocedure := pg_catalog.to_regprocedure(
    'potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'
  );
  v_revoke_oid regprocedure := pg_catalog.to_regprocedure(
    'potok_control.revoke_entitlement_v2(uuid,text,text,text)'
  );
  v_valid_count integer;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner SQL session required; current/session roles are %/%',
      CURRENT_USER, SESSION_USER USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.to_regnamespace('potok_control') IS NULL
     OR pg_catalog.to_regclass('potok_control.access_attestations') IS NULL
     OR v_grant_oid IS NULL
     OR v_revoke_oid IS NULL THEN
    RAISE EXCEPTION 'deployed v2.1 entitlement objects/functions are required; this is not an installer';
  END IF;

  SELECT pg_catalog.count(*) INTO v_valid_count
    FROM pg_catalog.pg_proc p
   WHERE p.oid IN (v_grant_oid, v_revoke_oid)
     AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
     AND p.prosecdef
     AND COALESCE('search_path=pg_catalog' = ANY(p.proconfig), false);
  IF v_valid_count <> 2 THEN
    RAISE EXCEPTION 'deployed writer function security metadata differs from reviewed v2.1';
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
  v_now timestamptz := pg_catalog.statement_timestamp();
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

CREATE OR REPLACE FUNCTION potok_control.revoke_entitlement_v2(
  p_account_id uuid,
  p_capability text,
  p_evidence_ref text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cannot revoke entitlement without prior lineage' USING ERRCODE = '23514';
  END IF;
  v_sequence := v_head.lineage_sequence + 1;

  INSERT INTO potok_control.access_attestations (
    attestation_id, account_id, capability, effect, previous_attestation_id,
    lineage_sequence, issued_at, valid_until, operator_db_role, evidence_ref, reason
  ) VALUES (
    v_attestation_id, p_account_id, p_capability, 'REVOKE', v_head.attestation_id,
    v_sequence, v_now, NULL, SESSION_USER::name, p_evidence_ref, p_reason
  );

  IF p_capability = 'premium' THEN
    UPDATE public.user_profiles
       SET has_premium = false,
           premium_provenance_id = v_attestation_id,
           premium_valid_until = NULL
     WHERE user_id = p_account_id;
  ELSE
    UPDATE public.user_profiles
       SET is_admin = false,
           admin_provenance_id = v_attestation_id,
           admin_valid_until = NULL
     WHERE user_id = p_account_id;
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'exactly one user profile is required for entitlement revoke';
  END IF;
  RETURN v_attestation_id;
END
$function$;

-- CREATE OR REPLACE retains owner/ACL; reassert client/service-role denial.
REVOKE ALL ON FUNCTION potok_control.grant_entitlement_v2(uuid, text, timestamptz, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION potok_control.revoke_entitlement_v2(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
