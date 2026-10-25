-- Synthetic local CI profile only; never a hosted schema migration.

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
