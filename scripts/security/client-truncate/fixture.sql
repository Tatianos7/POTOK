-- DESTRUCTIVE. Disposable test database only; the runner enforces its name/host.
RESET ROLE;
REVOKE fixture_inherited FROM anon, authenticated;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public AUTHORIZATION postgres;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, fixture_inherited;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, fixture_inherited;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
SET ROLE postgres;
CREATE TABLE public.fixture (id integer PRIMARY KEY, owner_name text NOT NULL, value integer NOT NULL);
INSERT INTO public.fixture VALUES (1, 'authenticated', 10), (2, 'another_user', 20);
ALTER TABLE public.fixture ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON public.fixture TO authenticated
  USING (owner_name = current_user) WITH CHECK (owner_name = current_user);
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.fixture TO authenticated;
GRANT SELECT, TRUNCATE ON public.fixture TO anon;
GRANT ALL ON public.fixture TO service_role;
GRANT TRUNCATE ON public.fixture TO PUBLIC;
CREATE TABLE public.partitioned_fixture (id integer) PARTITION BY RANGE (id);
CREATE TABLE public.partition_fixture PARTITION OF public.partitioned_fixture FOR VALUES FROM (0) TO (100);
GRANT TRUNCATE ON public.partitioned_fixture, public.partition_fixture TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO anon, PUBLIC;
RESET ROLE;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT TRUNCATE ON TABLES TO authenticated;
