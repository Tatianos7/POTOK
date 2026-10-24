RESET ROLE;
DO $check$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND (has_table_privilege('anon', c.oid, 'TRUNCATE')
        OR has_table_privilege('authenticated', c.oid, 'TRUNCATE'))) THEN
    RAISE EXCEPTION 'Client TRUNCATE not contained';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','REFERENCES','TRIGGER']) p(privilege) WHERE NOT has_table_privilege('authenticated', 'public.fixture', p.privilege))
     OR NOT has_table_privilege('service_role', 'public.fixture', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Unrelated privileges changed';
  END IF;
  IF (SELECT sum(value) FROM public.fixture) <> 30 THEN
    RAISE EXCEPTION 'Fixture rows changed';
  END IF;
END
$check$;
SET ROLE authenticated;
DO $check$
BEGIN
  BEGIN
    TRUNCATE public.fixture;
    RAISE EXCEPTION 'TRUNCATE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF (SELECT count(*) FROM public.fixture) <> 1 THEN RAISE EXCEPTION 'RLS read changed'; END IF;
  INSERT INTO public.fixture VALUES (3, 'authenticated', 30);
  UPDATE public.fixture SET value = 31 WHERE id = 3;
  IF (SELECT value FROM public.fixture WHERE id = 3) <> 31 THEN RAISE EXCEPTION 'Update failed'; END IF;
  BEGIN
    INSERT INTO public.fixture VALUES (4, 'another_user', 40);
    RAISE EXCEPTION 'RLS write unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  DELETE FROM public.fixture WHERE id = 3;
END
$check$;
SET ROLE anon;
DO $check$
BEGIN
  BEGIN
    TRUNCATE public.fixture;
    RAISE EXCEPTION 'Anonymous TRUNCATE unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF (SELECT count(*) FROM public.fixture) <> 0 THEN RAISE EXCEPTION 'Anonymous RLS changed'; END IF;
END
$check$;
SET ROLE postgres;
CREATE TABLE public.future_fixture (id integer);
DO $check$
BEGIN
  IF has_table_privilege('anon', 'public.future_fixture', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.future_fixture', 'TRUNCATE')
     OR NOT has_table_privilege('authenticated', 'public.future_fixture', 'INSERT') THEN
    RAISE EXCEPTION 'Future postgres privileges incorrect';
  END IF;
END
$check$;
RESET ROLE;
-- Explicitly reproduce the residual, rather than pretending it was fixed.
SET ROLE supabase_admin;
CREATE TABLE public.admin_future_fixture (id integer);
RESET ROLE;
DO $check$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.admin_future_fixture', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Fixture did not reproduce other-owner default residual';
  END IF;
END
$check$;
DROP TABLE public.admin_future_fixture;
