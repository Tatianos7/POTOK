-- REVIEW ONLY. Rehearsal rolls back. Not a deployment migration.
-- Historical migrations remain unchanged; a separately reviewed forward migration
-- must accompany any future creation of these tables with auto-exposure disabled.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE t text; p record; expected_count integer;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Expected postgres owner actor';
  END IF;
  FOREACH t IN ARRAY ARRAY['measurement_photo_assets','measurement_photo_deletions'] LOOP
    IF NOT EXISTS (
      SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND c.relkind='r'
        AND c.relowner='postgres'::regrole AND c.relrowsecurity
    ) THEN RAISE EXCEPTION 'Table owner/type/RLS drift: %', t; END IF;
    IF NOT EXISTS (
      SELECT FROM pg_attribute WHERE attrelid=format('public.%I',t)::regclass
        AND attname='user_id' AND atttypid='uuid'::regtype AND attnotnull AND NOT attisdropped
    ) THEN RAISE EXCEPTION 'Owner column drift: %', t; END IF;
    expected_count := CASE WHEN t='measurement_photo_assets' THEN 4 ELSE 3 END;
    IF (SELECT count(*) FROM pg_policy WHERE polrelid=format('public.%I',t)::regclass
        AND polname<> 'measurement_photo_deletions_update_own_explicit_v1') <> expected_count THEN
      RAISE EXCEPTION 'Policy set drift: %', t;
    END IF;
    FOR p IN SELECT *,
      regexp_replace(coalesce(pg_get_expr(polqual,polrelid),''),'[[:space:]()]','','g') AS q,
      regexp_replace(coalesce(pg_get_expr(polwithcheck,polrelid),''),'[[:space:]()]','','g') AS w
      FROM pg_policy WHERE polrelid=format('public.%I',t)::regclass
    LOOP
      IF NOT p.polpermissive OR
        NOT (p.polroles=ARRAY[0::oid] OR p.polroles=ARRAY['authenticated'::regrole::oid]) OR
        p.polcmd NOT IN ('r','a','w','d') OR
        (p.polcmd IN ('r','w','d') AND p.q NOT IN ('user_id=auth.uid','auth.uid=user_id')) OR
        (p.polcmd IN ('a','w') AND p.w NOT IN ('user_id=auth.uid','auth.uid=user_id')) THEN
        RAISE EXCEPTION 'Owner policy semantics drift: %.%',t,p.polname;
      END IF;
    END LOOP;
    -- One policy for each required command; duplicates cannot mask a missing one.
    IF NOT (SELECT array_agg(polcmd::text ORDER BY polcmd::text)=
      CASE WHEN t='measurement_photo_assets' THEN ARRAY['a','d','r','w']
           WHEN count(*)=4 THEN ARRAY['a','d','r','w'] ELSE ARRAY['a','d','r'] END
      FROM pg_policy WHERE polrelid=format('public.%I',t)::regclass) THEN
      RAISE EXCEPTION 'Policy command coverage drift: %',t;
    END IF;
  END LOOP;
END
$preflight$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_photo_assets TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.measurement_photo_deletions TO authenticated;
-- PostgREST upsert updates all supplied fields on conflict, including its key.
GRANT UPDATE (user_id, day, deleted_at) ON public.measurement_photo_deletions TO authenticated;
DROP POLICY IF EXISTS measurement_photo_deletions_update_own_explicit_v1
  ON public.measurement_photo_deletions;
CREATE POLICY measurement_photo_deletions_update_own_explicit_v1
  ON public.measurement_photo_deletions FOR UPDATE TO authenticated
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

ROLLBACK;
