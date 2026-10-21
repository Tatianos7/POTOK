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
CREATE TABLE IF NOT EXISTS public.billing_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id), description text, provider text, event_type text, idempotency_key text NOT NULL UNIQUE, payload jsonb NOT NULL DEFAULT '{}'::jsonb);
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
ALTER TABLE public.entitlements ADD COLUMN IF NOT EXISTS flags jsonb NOT NULL DEFAULT '{}'::jsonb;
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
