-- Synthetic, empty potok_profile_api_test database only; never a restored database.
DO $$ BEGIN
  IF current_database() <> 'potok_profile_api_test'
    OR to_regclass('public.user_profiles') IS NOT NULL
    OR EXISTS (SELECT FROM pg_namespace WHERE nspname='auth') THEN
    RAISE EXCEPTION 'Expected empty disposable API database';
  END IF;
END $$;
CREATE ROLE postgres NOSUPERUSER;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'disposable-api-only';
GRANT anon,authenticated TO authenticator;
ALTER SCHEMA public OWNER TO postgres;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path=pg_catalog AS
$$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;

GRANT USAGE ON SCHEMA auth TO postgres,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO postgres,anon,authenticated,service_role;
SET ROLE postgres;
CREATE TABLE public.user_profiles(
 id_user uuid PRIMARY KEY, first_name text,last_name text,middle_name text,birth_date date,
 age integer,height numeric(5,2),goal text,email text,phone text,avatar_url text,
 has_premium boolean NOT NULL DEFAULT false,is_admin boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 coach_settings jsonb NOT NULL DEFAULT '{}',voice_settings jsonb NOT NULL DEFAULT '{}');
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.user_profiles FOR SELECT TO authenticated USING(auth.uid()=id_user);
CREATE POLICY owner_insert ON public.user_profiles FOR INSERT TO authenticated WITH CHECK(auth.uid()=id_user);
CREATE POLICY owner_update ON public.user_profiles FOR UPDATE TO authenticated USING(auth.uid()=id_user) WITH CHECK(auth.uid()=id_user);
GRANT SELECT,INSERT,UPDATE ON public.user_profiles TO authenticated;
GRANT INSERT,UPDATE ON public.user_profiles TO PUBLIC;
GRANT ALL ON public.user_profiles TO service_role;
RESET ROLE;
