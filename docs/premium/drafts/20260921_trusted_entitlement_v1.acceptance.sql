-- POTOK trusted entitlement v1 — TARGETED STAGING ACCEPTANCE DRAFT, NOT EXECUTED.
-- Run only after the reviewed patch is applied to STAGING ozidryfvhkcbtpnulakq
-- and after separate owner approval for rollback-only fixture writes.
-- Replace the three sentinel UUIDs with distinct existing STAGING test accounts
-- that already have exactly one public.user_profiles row. Never use real users.
-- Every persistent change below is enclosed in one transaction and rolled back.

BEGIN;

CREATE TEMP TABLE potok_entitlement_acceptance_config (
  free_account_id uuid PRIMARY KEY,
  premium_account_id uuid UNIQUE NOT NULL,
  admin_account_id uuid UNIQUE NOT NULL
) ON COMMIT DROP;

INSERT INTO potok_entitlement_acceptance_config VALUES (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000103'
);

DO $preflight$
DECLARE
  v_config potok_entitlement_acceptance_config%ROWTYPE;
  v_profile_count integer;
  v_attestation_count integer;
  v_active_catalog_count integer;
BEGIN
  SELECT * INTO STRICT v_config FROM potok_entitlement_acceptance_config;
  IF v_config.free_account_id::text LIKE '00000000-0000-0000-0000-0000000001%'
     OR v_config.premium_account_id::text LIKE '00000000-0000-0000-0000-0000000001%'
     OR v_config.admin_account_id::text LIKE '00000000-0000-0000-0000-0000000001%' THEN
    RAISE EXCEPTION 'replace all sentinel account UUIDs before running acceptance';
  END IF;
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'acceptance must start in the owner SQL session, never service_role';
  END IF;

  SELECT pg_catalog.count(*) INTO v_profile_count
    FROM public.user_profiles p
   WHERE p.user_id IN (v_config.free_account_id, v_config.premium_account_id, v_config.admin_account_id);
  IF v_profile_count <> 3 THEN
    RAISE EXCEPTION 'three existing test profiles are required, found %', v_profile_count;
  END IF;

  SELECT pg_catalog.count(*) INTO v_attestation_count
    FROM potok_control.access_attestations a
   WHERE a.account_id IN (v_config.free_account_id, v_config.premium_account_id, v_config.admin_account_id);
  IF v_attestation_count <> 0 THEN
    RAISE EXCEPTION 'fixture accounts must have no entitlement attestations';
  END IF;

  SELECT pg_catalog.count(*) INTO v_active_catalog_count
    FROM public.premium_plans p WHERE p.is_active = true;
  IF v_active_catalog_count = 0 THEN
    RAISE EXCEPTION 'at least one active Premium plan is required to prove the catalog gate';
  END IF;

  PERFORM pg_catalog.set_config('potok.acceptance.free_account_id', v_config.free_account_id::text, true);
  PERFORM pg_catalog.set_config('potok.acceptance.premium_account_id', v_config.premium_account_id::text, true);
  PERFORM pg_catalog.set_config('potok.acceptance.admin_account_id', v_config.admin_account_id::text, true);
  PERFORM pg_catalog.set_config('potok.acceptance.active_catalog_count', v_active_catalog_count::text, true);
END
$preflight$;

-- Acceptance-only membership is transactional and disappears at ROLLBACK.
GRANT potok_entitlement_owner, potok_access_provisioner TO postgres;

-- FREE / OLD FLAG: an old true projection without an attestation is still denied.
SET LOCAL ROLE potok_entitlement_owner;
UPDATE public.user_profiles
   SET has_premium = true,
       premium_provenance_id = NULL,
       premium_valid_until = NULL
 WHERE user_id = pg_catalog.current_setting('potok.acceptance.free_account_id')::uuid;
RESET ROLE;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', pg_catalog.current_setting('potok.acceptance.free_account_id'), true
);
SET LOCAL ROLE authenticated;
DO $free_case$
BEGIN
  IF public.has_verified_entitlement_v1('premium') THEN
    RAISE EXCEPTION 'FREE/old-flag account unexpectedly has verified Premium';
  END IF;
  IF EXISTS (SELECT 1 FROM public.premium_plans) THEN
    RAISE EXCEPTION 'FREE account can read Premium catalog';
  END IF;
END
$free_case$;
RESET ROLE;

-- Ordinary authenticated profile writes work, protected flag echo/write does not.
SET LOCAL ROLE authenticated;
DO $profile_guard_case$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.user_profiles
     SET first_name = first_name
   WHERE user_id = auth.uid();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'ordinary own-profile update did not affect exactly one row';
  END IF;
  BEGIN
    UPDATE public.user_profiles SET has_premium = has_premium WHERE user_id = auth.uid();
    RAISE EXCEPTION 'authenticated protected-column echo unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$profile_guard_case$;
RESET ROLE;

-- service_role has no provisioning EXECUTE/USAGE path despite bypassing RLS.
SET LOCAL ROLE service_role;
DO $service_role_case$
BEGIN
  BEGIN
    PERFORM potok_control.grant_entitlement_v1(
      pg_catalog.current_setting('potok.acceptance.premium_account_id')::uuid,
      'premium', pg_catalog.statement_timestamp() + interval '1 day',
      'acceptance/service-role-must-fail', 'must not execute'
    );
    RAISE EXCEPTION 'service_role unexpectedly invoked provisioning';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$service_role_case$;
RESET ROLE;

-- VERIFIED PREMIUM: protected provisioner appends audit and projection atomically.
SET LOCAL ROLE potok_access_provisioner;
SELECT pg_catalog.set_config(
  'potok.acceptance.premium_expiry',
  (pg_catalog.statement_timestamp() + interval '1 day')::text,
  true
);
SELECT pg_catalog.set_config(
  'potok.acceptance.premium_grant_id',
  potok_control.grant_entitlement_v1(
    pg_catalog.current_setting('potok.acceptance.premium_account_id')::uuid,
    'premium', pg_catalog.current_setting('potok.acceptance.premium_expiry')::timestamptz,
    'acceptance/premium-grant', 'rollback-only verified Premium case'
  )::text,
  true
);
RESET ROLE;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', pg_catalog.current_setting('potok.acceptance.premium_account_id'), true
);
SET LOCAL ROLE authenticated;
DO $premium_case$
DECLARE
  v_visible integer;
BEGIN
  IF NOT public.has_verified_entitlement_v1('premium') THEN
    RAISE EXCEPTION 'verified Premium grant was not effective';
  END IF;
  IF public.has_verified_entitlement_v1('admin') THEN
    RAISE EXCEPTION 'Premium grant incorrectly implied admin';
  END IF;
  SELECT pg_catalog.count(*) INTO v_visible FROM public.premium_plans;
  IF v_visible <> pg_catalog.current_setting('potok.acceptance.active_catalog_count')::integer THEN
    RAISE EXCEPTION 'verified Premium catalog count %, expected %',
      v_visible, pg_catalog.current_setting('potok.acceptance.active_catalog_count');
  END IF;
END
$premium_case$;
RESET ROLE;

-- FOREIGN ACCOUNT: another authenticated account cannot inherit Premium or name A.
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', pg_catalog.current_setting('potok.acceptance.free_account_id'), true
);
SET LOCAL ROLE authenticated;
DO $foreign_case$
BEGIN
  IF public.has_verified_entitlement_v1('premium') THEN
    RAISE EXCEPTION 'foreign account inherited another account Premium grant';
  END IF;
  BEGIN
    PERFORM 1 FROM potok_control.access_attestations LIMIT 1;
    RAISE EXCEPTION 'authenticated account unexpectedly read audit storage';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$foreign_case$;
RESET ROLE;

-- EXPIRED: private predicate fails exactly at valid_until; no waiting required.
SET LOCAL ROLE potok_entitlement_owner;
DO $expired_case$
BEGIN
  IF potok_control.is_effective_entitlement_v1(
    pg_catalog.current_setting('potok.acceptance.premium_account_id')::uuid,
    'premium', pg_catalog.current_setting('potok.acceptance.premium_expiry')::timestamptz
  ) THEN
    RAISE EXCEPTION 'Premium remained effective at expiry';
  END IF;
END
$expired_case$;
RESET ROLE;

-- REVOKED: a successor audit event immediately removes effective Premium.
SET LOCAL ROLE potok_access_provisioner;
SELECT pg_catalog.set_config(
  'potok.acceptance.premium_revoke_id',
  potok_control.revoke_entitlement_v1(
    pg_catalog.current_setting('potok.acceptance.premium_account_id')::uuid,
    'premium', 'acceptance/premium-revoke', 'rollback-only revoke case'
  )::text,
  true
);
RESET ROLE;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', pg_catalog.current_setting('potok.acceptance.premium_account_id'), true
);
SET LOCAL ROLE authenticated;
DO $revoked_case$
BEGIN
  IF public.has_verified_entitlement_v1('premium') THEN
    RAISE EXCEPTION 'revoked Premium remained effective';
  END IF;
  IF EXISTS (SELECT 1 FROM public.premium_plans) THEN
    RAISE EXCEPTION 'revoked Premium can still read catalog';
  END IF;
END
$revoked_case$;
RESET ROLE;

-- ADMIN: admin grant is effective only for admin and never grants Premium catalog.
SET LOCAL ROLE potok_access_provisioner;
SELECT potok_control.grant_entitlement_v1(
  pg_catalog.current_setting('potok.acceptance.admin_account_id')::uuid,
  'admin', NULL, 'acceptance/admin-grant', 'rollback-only admin separation case'
);
RESET ROLE;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', pg_catalog.current_setting('potok.acceptance.admin_account_id'), true
);
SET LOCAL ROLE authenticated;
DO $admin_case$
BEGIN
  IF NOT public.has_verified_entitlement_v1('admin') THEN
    RAISE EXCEPTION 'verified admin grant was not effective';
  END IF;
  IF public.has_verified_entitlement_v1('premium') THEN
    RAISE EXCEPTION 'admin grant incorrectly implied Premium';
  END IF;
  IF EXISTS (SELECT 1 FROM public.premium_plans) THEN
    RAISE EXCEPTION 'admin-only account can read Premium catalog';
  END IF;
END
$admin_case$;
RESET ROLE;

-- Lineage/audit assertions are owner-only and remain inside the rollback.
SET LOCAL ROLE potok_entitlement_owner;
DO $audit_case$
DECLARE
  v_count integer;
BEGIN
  SELECT pg_catalog.count(*) INTO v_count
    FROM potok_control.access_attestations a
   WHERE a.account_id = pg_catalog.current_setting('potok.acceptance.premium_account_id')::uuid
     AND a.capability = 'premium'
     AND (
       (a.lineage_sequence = 1 AND a.previous_attestation_id IS NULL AND a.effect = 'GRANT')
       OR (a.lineage_sequence = 2
           AND a.previous_attestation_id = pg_catalog.current_setting('potok.acceptance.premium_grant_id')::uuid
           AND a.effect = 'REVOKE')
     );
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Premium grant/revoke audit lineage mismatch';
  END IF;
END
$audit_case$;
RESET ROLE;

ROLLBACK;

-- PASS means every block completed and the final ROLLBACK succeeded.
-- Capture query output, deployed patch hash, fixture manifest and actor labels;
-- never return JWTs, passwords, service keys or real-user data.
