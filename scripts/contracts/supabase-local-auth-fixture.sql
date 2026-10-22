-- Disposable Supabase local acceptance schema ONLY; never apply to cloud POTOK.
CREATE TABLE IF NOT EXISTS public.user_profiles (
 id_user uuid PRIMARY KEY REFERENCES auth.users(id),
 first_name text,
 last_name text,
 middle_name text,
 birth_date date,
 age integer,
 height numeric,
 goal text,
 email text,
 phone text,
 avatar_url text,
 coach_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
 voice_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
 has_premium boolean NOT NULL DEFAULT false,
 is_admin boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, plan text NOT NULL CHECK (plan IN ('free','pro','vision_pro')), status text NOT NULL CHECK (status IN ('active','canceled','past_due','trial')), current_period_start timestamptz, current_period_end timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.entitlements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, tier text NOT NULL CHECK (tier IN ('free','pro','vision_pro','coach')), flags jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.billing_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, provider text NOT NULL CHECK (provider IN ('app_store','play_store','vision_pro')), event_type text NOT NULL, idempotency_key text NOT NULL UNIQUE, payload jsonb, created_at timestamptz NOT NULL DEFAULT now());
-- Minimal program owners for server-side explainability authorization tests.
CREATE TABLE IF NOT EXISTS public.nutrition_programs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'active',
 program_version integer NOT NULL DEFAULT 1,
 knowledge_version_ref jsonb
);
CREATE TABLE IF NOT EXISTS public.training_programs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'active',
 program_version integer NOT NULL DEFAULT 1,
 knowledge_version_ref jsonb
);
ALTER TABLE public.nutrition_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrition_programs_owner ON public.nutrition_programs
 FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY training_programs_owner ON public.training_programs
 FOR SELECT TO authenticated USING (auth.uid() = user_id);
GRANT SELECT ON public.nutrition_programs,public.training_programs TO authenticated;
-- Minimal program-day hierarchy matching the reviewed production RPC column contract.
CREATE TABLE public.program_phases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_id uuid NOT NULL,phase_type text,phase_goal text);
CREATE TABLE public.program_blocks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),phase_id uuid NOT NULL,block_type text);
CREATE TABLE public.program_days (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),block_id uuid NOT NULL,date date NOT NULL,targets jsonb,session_plan jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.program_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_id uuid NOT NULL,program_type text NOT NULL,version integer NOT NULL,snapshot jsonb NOT NULL,reason text,created_at timestamptz NOT NULL DEFAULT now(),CONSTRAINT disposable_adapt_rollback CHECK (NOT (program_type='training' AND reason='adaptation_pending')));
CREATE TABLE public.program_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_id uuid NOT NULL,date date NOT NULL,status text,created_at timestamptz NOT NULL DEFAULT now());
-- Server-generated program evidence: disposable minimal mirror for privilege replay.
-- Ownership RLS is tested separately; this fixture validates SQL grants only.
CREATE TABLE IF NOT EXISTS public.program_explainability (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 program_id uuid NOT NULL,
 program_type text NOT NULL,
 version integer NOT NULL DEFAULT 1,
 decision_ref text NOT NULL,
 knowledge_refs jsonb,
 confidence numeric,
 guard_notes jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.program_guard_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_id uuid NOT NULL,program_type text NOT NULL,risk_level text NOT NULL,flags text[],blocked_actions text[], CONSTRAINT disposable_training_failure CHECK (NOT (program_type='training' AND risk_level='caution')));
ALTER TABLE public.program_explainability ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_explainability TO anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_user_idx ON public.entitlements(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS billing_events_idempotency_idx ON public.billing_events(idempotency_key);
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

-- Disposable mirror of proposed Premium RPC authorization; not a cloud migration.
CREATE OR REPLACE FUNCTION public.get_entitlements(p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE caller uuid := auth.uid(); resolved_user uuid; row_ent public.entitlements;
BEGIN
 IF auth.role() <> 'authenticated' OR caller IS NULL THEN
  RAISE EXCEPTION 'authentication required' USING ERRCODE='42501';
 END IF;
 resolved_user := coalesce(p_user_id,caller);
 IF resolved_user <> caller THEN
  RAISE EXCEPTION 'cross-account entitlement access denied' USING ERRCODE='42501';
 END IF;
 SELECT * INTO row_ent FROM public.entitlements WHERE user_id=resolved_user;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('tier','free','flags',jsonb_build_object('can_view_plan',true,'can_adapt',false,'can_explain',false,'can_voice',false,'can_spatial',false));
 END IF;
 RETURN jsonb_build_object('tier',row_ent.tier,'flags',row_ent.flags);
END $$;
CREATE OR REPLACE FUNCTION public.get_paywall_state(p_feature text,p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE ent jsonb; flags jsonb;
BEGIN
 ent:=public.get_entitlements(p_user_id);
 flags:=ent->'flags';
 IF p_feature='adaptation' AND NOT coalesce((flags->>'can_adapt')::boolean,false) THEN
  RETURN jsonb_build_object('locked',true,'required_tier','pro','reason','adaptation_locked');
 END IF;
 IF p_feature='explainability' AND NOT coalesce((flags->>'can_explain')::boolean,false) THEN
  RETURN jsonb_build_object('locked',true,'required_tier','pro','reason','explainability_locked');
 END IF;
 IF p_feature='spatial' AND NOT coalesce((flags->>'can_spatial')::boolean,false) THEN
  RETURN jsonb_build_object('locked',true,'required_tier','vision_pro','reason','spatial_locked');
 END IF;
 RETURN jsonb_build_object('locked',false,'tier',ent->>'tier');
END $$;
CREATE OR REPLACE FUNCTION public.start_purchase(p_user_id uuid,p_provider text,p_plan text,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ BEGIN
 INSERT INTO public.billing_events(user_id,provider,event_type,idempotency_key,payload)
 VALUES(p_user_id,p_provider,'purchase_started',p_idempotency_key,jsonb_build_object('plan',p_plan))
 ON CONFLICT(idempotency_key) DO NOTHING;
 RETURN jsonb_build_object('status','started','plan',p_plan);
END $$;
CREATE OR REPLACE FUNCTION public.restore_purchase(p_user_id uuid,p_provider text,p_receipt text,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ BEGIN
 INSERT INTO public.billing_events(user_id,provider,event_type,idempotency_key,payload)
 VALUES(p_user_id,p_provider,'restore',p_idempotency_key,jsonb_build_object('receipt',p_receipt))
 ON CONFLICT(idempotency_key) DO NOTHING;
 RETURN jsonb_build_object('status','restored');
END $$;
REVOKE ALL ON FUNCTION public.get_entitlements(uuid),public.get_paywall_state(text,uuid),
 public.start_purchase(uuid,text,text,text),public.restore_purchase(uuid,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_entitlements(uuid),public.get_paywall_state(text,uuid)
 TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.start_purchase(uuid,text,text,text),
 public.restore_purchase(uuid,text,text,text) TO service_role;
