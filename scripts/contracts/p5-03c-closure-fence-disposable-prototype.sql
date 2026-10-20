-- P5-03C account-closure SERIALIZATION PROTOTYPE ONLY.
-- Intentionally executable exclusively with an explicit disposable test marker.
-- Not a Supabase migration, no live authority or Auth binding, no deletion worker.
-- Must not be promoted into production without full independent review.
DO $$
BEGIN
  IF current_setting('potok_closure.test_target', true) IS DISTINCT FROM 'disposable-postgresql-only' THEN
    RAISE EXCEPTION 'POTOK_CLOSURE_DISPOSABLE_ONLY';
  END IF;
END $$;
CREATE SCHEMA potok_closure_disposable;
REVOKE ALL ON SCHEMA potok_closure_disposable FROM PUBLIC;
CREATE TABLE potok_closure_disposable.accounts (
  account_id uuid PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('ACTIVE','CLOSING','CLOSED')),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  closure_key uuid,
  CHECK ((state='ACTIVE' AND closure_key IS NULL) OR (state<>'ACTIVE' AND closure_key IS NOT NULL))
);
REVOKE ALL ON potok_closure_disposable.accounts FROM PUBLIC;
-- The same account-level lock MUST be first, before any Food/Nonfood
-- catalog/row lock. This is a disposable protocol test, not a runtime grant.
CREATE FUNCTION potok_closure_disposable.assert_active(p_account uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $$
DECLARE v potok_closure_disposable.accounts%ROWTYPE;
BEGIN
  IF p_account IS NULL THEN RAISE EXCEPTION 'ACCOUNT_UNVERIFIED'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('potok-closure-v1:'||p_account::text,0));
  SELECT * INTO v FROM potok_closure_disposable.accounts WHERE account_id=p_account FOR UPDATE;
  IF NOT FOUND OR v.state<>'ACTIVE' THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE'; END IF;
  RETURN v.revision;
END $$;
CREATE FUNCTION potok_closure_disposable.begin_closure(p_account uuid,p_key uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $$
DECLARE v potok_closure_disposable.accounts%ROWTYPE;
BEGIN
  IF p_account IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'CLOSURE_UNVERIFIED'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('potok-closure-v1:'||p_account::text,0));
  SELECT * INTO v FROM potok_closure_disposable.accounts WHERE account_id=p_account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_UNVERIFIED'; END IF;
  IF v.state='ACTIVE' THEN
    UPDATE potok_closure_disposable.accounts
      SET state='CLOSING',revision=v.revision+1,closure_key=p_key WHERE account_id=p_account;
    RETURN v.revision+1;
  END IF;
  IF v.state='CLOSING' AND v.closure_key=p_key THEN RETURN v.revision; END IF;
  RAISE EXCEPTION 'CLOSURE_CONFLICT';
END $$;
-- CLOSED transition and actual data erasure are deliberately NOT implemented.
-- No authenticated/service_role grants, no live endpoint and no runtime imports.
REVOKE ALL ON FUNCTION potok_closure_disposable.assert_active(uuid),
  potok_closure_disposable.begin_closure(uuid,uuid) FROM PUBLIC;
