-- Disposable Supabase local acceptance schema ONLY; never apply to cloud POTOK.
CREATE TABLE IF NOT EXISTS public.user_profiles (
 id_user uuid PRIMARY KEY REFERENCES auth.users(id),
 first_name text,
 coach_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
 voice_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
 has_premium boolean NOT NULL DEFAULT false,
 is_admin boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.subscriptions (user_id uuid PRIMARY KEY REFERENCES auth.users(id), status text);
CREATE TABLE IF NOT EXISTS public.entitlements (user_id uuid PRIMARY KEY REFERENCES auth.users(id), tier text);
CREATE TABLE IF NOT EXISTS public.billing_events (user_id uuid PRIMARY KEY REFERENCES auth.users(id), description text);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_select_own ON public.user_profiles FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id_user);
CREATE POLICY profile_insert_own ON public.user_profiles FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = id_user);
CREATE POLICY profile_update_own ON public.user_profiles FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id_user) WITH CHECK ((SELECT auth.uid()) = id_user);
CREATE POLICY subscriptions_owner ON public.subscriptions FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY entitlements_owner ON public.entitlements FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY billing_events_owner ON public.billing_events FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
REVOKE ALL ON public.user_profiles,public.subscriptions,public.entitlements,public.billing_events FROM anon,authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT INSERT (id_user,first_name,coach_settings,voice_settings) ON public.user_profiles TO authenticated;
GRANT UPDATE (first_name,coach_settings,voice_settings) ON public.user_profiles TO authenticated;
GRANT SELECT ON public.subscriptions,public.entitlements,public.billing_events TO authenticated;
