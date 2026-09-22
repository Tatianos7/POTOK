-- POTOK trusted entitlement v2 — TARGETED STAGING ACCEPTANCE, NOT EXECUTED.
-- Run only after separately approved v2 apply to STAGING ozidryfvhkcbtpnulakq.
-- Requires separate approval for rollback-only writes. Never run in production.
-- The two currently missing profile rows are created only inside this transaction,
-- with user_id as the sole supplied field, and are removed by the final ROLLBACK.

BEGIN;

CREATE TEMP TABLE potok_entitlement_acceptance_config (
  free_account_id uuid PRIMARY KEY,
  premium_account_id uuid UNIQUE NOT NULL,
  admin_account_id uuid UNIQUE NOT NULL
) ON COMMIT DROP;

INSERT INTO potok_entitlement_acceptance_config VALUES (
  'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde',
  '88c26f6b-ebc8-4bff-864d-9194fbd27f8d',
  '8f82ff67-39d1-4bb1-9d55-028af99d5cca'
);

CREATE TEMP TABLE potok_entitlement_fixture_profiles (
  account_id uuid PRIMARY KEY
) ON COMMIT DROP;

DO $preflight$
DECLARE
  v_config potok_entitlement_acceptance_config%ROWTYPE;
  v_auth_count integer;
  v_duplicate_profile_count integer;
  v_attestation_count integer;
  v_active_catalog_count integer;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'acceptance requires the postgres owner SQL session' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT v_config FROM potok_entitlement_acceptance_config;

  SELECT pg_catalog.count(*) INTO v_auth_count
    FROM auth.users u
   WHERE u.id IN (v_config.free_account_id, v_config.premium_account_id, v_config.admin_account_id);
  IF v_auth_count <> 3 THEN
    RAISE EXCEPTION 'all three exact staging auth accounts are required, found %', v_auth_count;
  END IF;

  SELECT pg_catalog.count(*) INTO v_duplicate_profile_count
    FROM (
      SELECT p.user_id
        FROM public.user_profiles p
       WHERE p.user_id IN (v_config.free_account_id, v_config.premium_account_id, v_config.admin_account_id)
       GROUP BY p.user_id
      HAVING pg_catalog.count(*) > 1
    ) duplicates;
  IF v_duplicate_profile_count <> 0 THEN
    RAISE EXCEPTION 'acceptance accounts contain duplicate profile rows';
  END IF;

  SELECT pg_catalog.count(*) INTO v_attestation_count
    FROM potok_control.access_attestations a
   WHERE a.account_id IN (v_config.free_account_id, v_config.premium_account_id, v_config.admin_account_id);
  IF v_attestation_count <> 0 THEN
    RAISE EXCEPTION 'acceptance accounts must have no prior attestations';
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

-- Rollback-only minimal fixture: supply no name/contact/goal/privilege data.
WITH acceptance_accounts(account_id) AS (
  SELECT free_account_id FROM potok_entitlement_acceptance_config
  UNION ALL SELECT premium_account_id FROM potok_entitlement_acceptance_config
  UNION ALL SELECT admin_account_id FROM potok_entitlement_acceptance_config
), inserted AS (
  INSERT INTO public.user_profiles (user_id)
  SELECT a.account_id
    FROM acceptance_accounts a
   WHERE NOT EXISTS (
     SELECT 1 FROM public.user_profiles p WHERE p.user_id = a.account_id
   )
  RETURNING user_id
)
INSERT INTO potok_entitlement_fixture_profiles (account_id)
SELECT user_id FROM inserted;

DO $fixture_check$
DECLARE
  v_profile_count integer;
BEGIN
  SELECT pg_catalog.count(*) INTO v_profile_count
    FROM public.user_profiles p
   WHERE p.user_id IN (
     pg_catalog.current_setting('potok.acceptance.free_account_id')::uuid,
     pg_catalog.current_setting('potok.acceptance.premium_account_id')::uuid,
     pg_catalog.current_setting('potok.acceptance.admin_account_id')::uuid
   );
  IF v_profile_count <> 3 THEN
    RAISE EXCEPTION 'fixture did not produce exactly three acceptance profiles';
  END IF;
END
$fixture_check$;

-- FREE / OLD FLAG: old projection true remains unverified and catalog is denied.
UPDATE public.user_profiles
   SET has_premium = true,
       premium_provenance_id = NULL,
       premium_valid_until = NULL
 WHERE user_id = pg_catalog.current_setting('potok.acceptance.free_account_id')::uuid;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', pg_catalog.current_setting('potok.acceptance.free_account_id'), true
);
SET LOCAL ROLE authenticated;
DO $free_case$
BEGIN
  IF public.has_verified_entitlement_v1('premium')
     OR public.has_verified_entitlement_v2('premium') THEN
    RAISE EXCEPTION 'FREE/old-flag account unexpectedly has verified Premium';
  END IF;
  IF EXISTS (SELECT 1 FROM public.premium_plans) THEN
    RAISE EXCEPTION 'FREE account can read Premium catalog';
  END IF;
END
$free_case$;
RESET ROLE;

-- Ordinary own-profile writes remain possible; protected echo/write is denied.
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

-- authenticated and service_role cannot invoke owner-only provisioning.
SET LOCAL ROLE authenticated;
DO $authenticated_provisioning_case$
BEGIN
  BEGIN
    PERFORM potok_control.grant_entitlement_v2(
      pg_catalog.current_setting('potok.acceptance.premium_account_id')::uuid,
      'premium', pg_catalog.statement_timestamp() + interval '1 day',
      'acceptance/authenticated-must-fail', 'must not execute'
    );
    RAISE EXCEPTION 'authenticated unexpectedly invoked provisioning';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$authenticated_provisioning_case$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $service_role_case$
BEGIN
  BEGIN
    PERFORM potok_control.grant_entitlement_v2(
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

-- VERIFIED PREMIUM: owner SQL channel appends audit and projection atomically.
SELECT pg_catalog.set_config(
  'potok.acceptance.premium_expiry',
  (pg_catalog.statement_timestamp() + interval '1 day')::text,
  true
);
SELECT pg_catalog.set_config(
  'potok.acceptance.premium_grant_id',
  potok_control.grant_entitlement_v2(
    pg_catalog.current_setting('potok.acceptance.premium_account_id')::uuid,
    'premium', pg_catalog.current_setting('potok.acceptance.premium_expiry')::timestamptz,
    'acceptance/premium-grant', 'rollback-only verified Premium case'
  )::text,
  true
);

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', pg_catalog.current_setting('potok.acceptance.premium_account_id'), true
);
SET LOCAL ROLE authenticated;
DO $premium_case$
DECLARE
  v_visible integer;
BEGIN
  IF NOT public.has_verified_entitlement_v1('premium')
     OR NOT public.has_verified_entitlement_v2('premium') THEN
    RAISE EXCEPTION 'verified Premium grant was not effective through both predicates';
  END IF;
  IF public.has_verified_entitlement_v2('admin') THEN
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

-- FOREIGN ACCOUNT: Free account cannot inherit Premium or read audit storage.
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', pg_catalog.current_setting('potok.acceptance.free_account_id'), true
);
SET LOCAL ROLE authenticated;
DO $foreign_case$
BEGIN
  IF public.has_verified_entitlement_v2('premium') THEN
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

-- EXPIRED: effective predicate fails exactly at valid_until without waiting.
DO $expired_case$
BEGIN
  IF potok_control.is_effective_entitlement_v2(
    pg_catalog.current_setting('potok.acceptance.premium_account_id')::uuid,
    'premium', pg_catalog.current_setting('potok.acceptance.premium_expiry')::timestamptz
  ) THEN
    RAISE EXCEPTION 'Premium remained effective at expiry';
  END IF;
END
$expired_case$;

-- REVOKED: successor audit event immediately removes effective Premium.
SELECT pg_catalog.set_config(
  'potok.acceptance.premium_revoke_id',
  potok_control.revoke_entitlement_v2(
    pg_catalog.current_setting('potok.acceptance.premium_account_id')::uuid,
    'premium', 'acceptance/premium-revoke', 'rollback-only revoke case'
  )::text,
  true
);

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', pg_catalog.current_setting('potok.acceptance.premium_account_id'), true
);
SET LOCAL ROLE authenticated;
DO $revoked_case$
BEGIN
  IF public.has_verified_entitlement_v2('premium') THEN
    RAISE EXCEPTION 'revoked Premium remained effective';
  END IF;
  IF EXISTS (SELECT 1 FROM public.premium_plans) THEN
    RAISE EXCEPTION 'revoked Premium can still read catalog';
  END IF;
END
$revoked_case$;
RESET ROLE;

-- ADMIN: separate capability, no implicit Premium.
SELECT pg_catalog.set_config(
  'potok.acceptance.admin_grant_id',
  potok_control.grant_entitlement_v2(
    pg_catalog.current_setting('potok.acceptance.admin_account_id')::uuid,
    'admin', NULL, 'acceptance/admin-grant', 'rollback-only admin separation case'
  )::text,
  true
);

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', pg_catalog.current_setting('potok.acceptance.admin_account_id'), true
);
SET LOCAL ROLE authenticated;
DO $admin_case$
BEGIN
  IF NOT public.has_verified_entitlement_v2('admin') THEN
    RAISE EXCEPTION 'verified admin grant was not effective';
  END IF;
  IF public.has_verified_entitlement_v2('premium') THEN
    RAISE EXCEPTION 'admin grant incorrectly implied Premium';
  END IF;
  IF EXISTS (SELECT 1 FROM public.premium_plans) THEN
    RAISE EXCEPTION 'admin-only account can read Premium catalog';
  END IF;
END
$admin_case$;
RESET ROLE;

-- Append-only audit and deterministic lineage/projection assertions.
DO $audit_case$
DECLARE
  v_count integer;
BEGIN
  SELECT pg_catalog.count(*) INTO v_count
    FROM potok_control.access_attestations a
   WHERE a.account_id = pg_catalog.current_setting('potok.acceptance.premium_account_id')::uuid
     AND a.capability = 'premium'
     AND a.operator_db_role = 'postgres'
     AND (
       (a.lineage_sequence = 1
        AND a.attestation_id = pg_catalog.current_setting('potok.acceptance.premium_grant_id')::uuid
        AND a.previous_attestation_id IS NULL
        AND a.effect = 'GRANT')
       OR (a.lineage_sequence = 2
           AND a.attestation_id = pg_catalog.current_setting('potok.acceptance.premium_revoke_id')::uuid
           AND a.previous_attestation_id = pg_catalog.current_setting('potok.acceptance.premium_grant_id')::uuid
           AND a.effect = 'REVOKE')
     );
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Premium grant/revoke audit lineage mismatch';
  END IF;

  BEGIN
    UPDATE potok_control.access_attestations
       SET reason = reason
     WHERE attestation_id = pg_catalog.current_setting('potok.acceptance.premium_grant_id')::uuid;
    RAISE EXCEPTION 'append-only audit update unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$audit_case$;

ROLLBACK;

-- PASS requires reaching ROLLBACK. If the SQL editor stops on any error, issue
-- ROLLBACK before reusing that session and treat acceptance as failed.
-- Save outputs with the exact v2 hashes and actor labels; never export secrets.
