-- P5-03C account closure admission candidate — DISPOSABLE TEST ONLY.
-- This is NOT a Supabase migration or an authorization endpoint.
-- Must never be applied to live databases. No real account erasure.
-- The candidate is separate from the existing prototype and real issuer drafts.
DO $guard$
BEGIN
  IF current_setting('potok_closure.test_target', true)
     IS DISTINCT FROM 'disposable-postgresql-only' THEN
    RAISE EXCEPTION 'POTOK_CLOSURE_DISPOSABLE_ONLY' USING ERRCODE='42501';
  END IF;
END $guard$;

CREATE SCHEMA potok_closure_candidate;
REVOKE ALL ON SCHEMA potok_closure_candidate FROM PUBLIC;
CREATE TABLE potok_closure_candidate.accounts_v1 (
  account_id uuid PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('ACTIVE','CLOSING','CLOSED')),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  closure_key uuid,
  CHECK (
    (state = 'ACTIVE' AND closure_key IS NULL) OR
    (state IN ('CLOSING','CLOSED') AND closure_key IS NOT NULL)
  )
);
REVOKE ALL ON potok_closure_candidate.accounts_v1 FROM PUBLIC;

-- Caller identity MUST be independently verified by real issuer authority_v1().
-- Do not expose this function to clients; its uuid argument is NOT authentication.
CREATE FUNCTION potok_closure_candidate.assert_active_v1(p_verified_actor uuid)
RETURNS bigint LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog AS $fn$
DECLARE v potok_closure_candidate.accounts_v1%ROWTYPE;
BEGIN
  IF p_verified_actor IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_UNVERIFIED' USING ERRCODE='42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-closure-v1:' || p_verified_actor::text, 0));
  SELECT * INTO v FROM potok_closure_candidate.accounts_v1
    WHERE account_id = p_verified_actor FOR UPDATE;
  IF NOT FOUND OR v.state <> 'ACTIVE' THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE='42501';
  END IF;
  RETURN v.revision;
END $fn$;

-- This is a state transition ONLY, not an erasure operation.
-- Real caller authorization, Auth row lifecycle and deletion orchestration
-- are not implemented here and MUST be independently reviewed.
CREATE FUNCTION potok_closure_candidate.begin_closure_v1(
  p_verified_actor uuid, p_request_key uuid)
RETURNS bigint LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog AS $fn$
DECLARE v potok_closure_candidate.accounts_v1%ROWTYPE;
BEGIN
  IF p_verified_actor IS NULL OR p_request_key IS NULL THEN
    RAISE EXCEPTION 'CLOSURE_UNVERIFIED' USING ERRCODE='42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-closure-v1:' || p_verified_actor::text, 0));
  SELECT * INTO v FROM potok_closure_candidate.accounts_v1
    WHERE account_id = p_verified_actor FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_UNVERIFIED' USING ERRCODE='42501';
  END IF;
  IF v.state = 'ACTIVE' THEN
    UPDATE potok_closure_candidate.accounts_v1
      SET state = 'CLOSING', revision = v.revision + 1,
          closure_key = p_request_key
      WHERE account_id = p_verified_actor;
    RETURN v.revision + 1;
  END IF;
  IF v.state = 'CLOSING' AND v.closure_key = p_request_key THEN
    RETURN v.revision;
  END IF;
  RAISE EXCEPTION 'CLOSURE_CONFLICT' USING ERRCODE='40001';
END $fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_closure_candidate FROM PUBLIC;
-- No grants to authenticated, anon or service_role; no runtime wiring.
