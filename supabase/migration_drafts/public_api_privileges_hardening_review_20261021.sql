-- POTOK Supabase privilege hardening candidate, REVIEW ONLY.
-- Never run against production without dependency review, disposable tests,
-- explicit owner approval, rollback and verified staging acceptance.
BEGIN;
-- RLS does not protect TRUNCATE; remove dangerous DDL-adjacent privileges
-- from client API roles on existing public tables.
DO $$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT format('%I.%I', n.nspname, c.relname) AS fqname
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLE %s FROM anon, authenticated',
      item.fqname
    );
  END LOOP;
END $$;
-- Privileged subscription and payment writes must use trusted server authority.
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.billing_events, public.entitlements, public.subscriptions
FROM anon, authenticated;
-- Protect role/entitlement fields. Table-level UPDATE must be removed first;
-- restore only user-editable columns, after checking actual app dependencies.
REVOKE UPDATE ON TABLE public.user_profiles FROM anon, authenticated;
-- Exact column allowlist is intentionally deferred until the client usage audit.
-- The candidate is NOT deployable while that allowlist is unresolved.
ROLLBACK;
