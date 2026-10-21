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
-- Review candidate: replace broad table INSERT/UPDATE with column-scoped grants.
-- IMPORTANT: validate exact production schema, triggers, RPCs, and all writers
-- before turning this into a separately approved migration.
REVOKE INSERT ON TABLE public.user_profiles FROM anon, authenticated;
-- Existing column-level privileges must also be cleared; REVOKE at table
-- scope alone does not revoke grants previously made on individual columns.
DO $
DECLARE col record;
BEGIN
  FOR col IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_profiles'
  LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON TABLE public.user_profiles FROM anon, authenticated',
      col.column_name, col.column_name);
  END LOOP;
END $;
-- Explicitly fail closed on schema drift. Do not silently omit ordinary fields.
DO $
DECLARE required_cols text[] := ARRAY[
  'id_user','first_name','last_name','middle_name','birth_date','age',
  'height','goal','email','phone','avatar_url','coach_settings','voice_settings'
];
DECLARE missing_cols text[];
BEGIN
  SELECT array_agg(x) INTO missing_cols
  FROM unnest(required_cols) AS x
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_profiles' AND column_name=x
  );
  IF missing_cols IS NOT NULL THEN
    RAISE EXCEPTION 'Review blocked: user_profiles missing required columns: %', missing_cols;
  END IF;
END $;
GRANT INSERT (
  id_user,first_name,last_name,middle_name,birth_date,age,height,goal,
  email,phone,avatar_url,coach_settings,voice_settings
) ON TABLE public.user_profiles TO authenticated;
GRANT UPDATE (
  first_name,last_name,middle_name,birth_date,age,height,goal,
  email,phone,avatar_url,coach_settings,voice_settings
) ON TABLE public.user_profiles TO authenticated;
-- Never grant authenticated write privileges on has_premium/is_admin,
-- provenance, validity, or other privileged authority fields.
-- Review remains NON-DEPLOYABLE: ROLLBACK below is mandatory.
ROLLBACK;
