-- POTOK trusted entitlement v2 — RUNNABLE REVIEW DRAFT, NOT APPLIED.
-- Target only after separate approval: Supabase STAGING ozidryfvhkcbtpnulakq.
-- Supabase-compatible boundary: no CREATE/ALTER ROLE, no role membership changes.
-- Provisioning is executable only from the existing postgres owner SQL session.
-- No payment integration and no client/service_role provisioning shortcut.

BEGIN;

DO $preflight$
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner SQL session required; current/session roles are %/%',
      CURRENT_USER, SESSION_USER USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.to_regnamespace('potok_control') IS NOT NULL
     OR pg_catalog.to_regclass('potok_control.access_attestations') IS NOT NULL THEN
    RAISE EXCEPTION 'potok_control objects already exist; inspect deployed state instead of rerunning';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'user_profiles'
       AND column_name IN (
         'premium_provenance_id', 'premium_valid_until',
         'admin_provenance_id', 'admin_valid_until'
       )
  ) THEN
    RAISE EXCEPTION 'protected profile columns already exist; inspect deployed state instead of rerunning';
  END IF;
  IF pg_catalog.to_regprocedure('public.has_verified_entitlement_v1(text)') IS NOT NULL
     OR pg_catalog.to_regprocedure('public.has_verified_entitlement_v2(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'verified entitlement predicate already exists; inspect deployed state instead of replacing it';
  END IF;
END
$preflight$;

CREATE SCHEMA potok_control;
REVOKE ALL ON SCHEMA potok_control FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_control
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_control
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE potok_control.access_attestations (
  attestation_id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  capability text NOT NULL,
  effect text NOT NULL,
  previous_attestation_id uuid NULL,
  lineage_sequence bigint NOT NULL,
  issued_at timestamptz NOT NULL,
  valid_until timestamptz NULL,
  operator_db_role name NOT NULL,
  evidence_ref text NOT NULL,
  reason text NOT NULL,
  CONSTRAINT access_attestations_account_fk
    FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT access_attestations_capability_check
    CHECK (capability IN ('premium', 'admin')),
  CONSTRAINT access_attestations_effect_check
    CHECK (effect IN ('GRANT', 'REVOKE')),
  CONSTRAINT access_attestations_sequence_check
    CHECK (lineage_sequence > 0),
  CONSTRAINT access_attestations_validity_check
    CHECK (
      (effect = 'GRANT' AND (valid_until IS NULL OR valid_until > issued_at))
      OR (effect = 'REVOKE' AND valid_until IS NULL)
    ),
  CONSTRAINT access_attestations_evidence_check
    CHECK (evidence_ref <> '' AND evidence_ref = pg_catalog.btrim(evidence_ref)),
  CONSTRAINT access_attestations_reason_check
    CHECK (reason <> '' AND reason = pg_catalog.btrim(reason)),
  CONSTRAINT access_attestations_scope_id_unique
    UNIQUE (account_id, capability, attestation_id),
  CONSTRAINT access_attestations_account_id_unique
    UNIQUE (account_id, attestation_id),
  CONSTRAINT access_attestations_scope_sequence_unique
    UNIQUE (account_id, capability, lineage_sequence),
  CONSTRAINT access_attestations_previous_fk
    FOREIGN KEY (account_id, capability, previous_attestation_id)
    REFERENCES potok_control.access_attestations (account_id, capability, attestation_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX access_attestations_one_successor_idx
  ON potok_control.access_attestations (account_id, capability, previous_attestation_id)
  WHERE previous_attestation_id IS NOT NULL;

ALTER TABLE potok_control.access_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_control.access_attestations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON potok_control.access_attestations FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION potok_control.validate_access_attestation_insert_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_head potok_control.access_attestations%ROWTYPE;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled entitlement channel required' USING ERRCODE = '42501';
  END IF;
  IF NEW.capability NOT IN ('premium', 'admin') OR NEW.effect NOT IN ('GRANT', 'REVOKE') THEN
    RAISE EXCEPTION 'invalid entitlement capability/effect' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-entitlement-v2:' || NEW.account_id::text || ':' || NEW.capability, 0)
  );
  SELECT a.*
    INTO v_head
    FROM potok_control.access_attestations a
   WHERE a.account_id = NEW.account_id
     AND a.capability = NEW.capability
   ORDER BY a.lineage_sequence DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    IF NEW.lineage_sequence <> v_head.lineage_sequence + 1
       OR NEW.previous_attestation_id IS DISTINCT FROM v_head.attestation_id
       OR NEW.issued_at < v_head.issued_at THEN
      RAISE EXCEPTION 'invalid entitlement lineage successor' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.lineage_sequence <> 1 OR NEW.previous_attestation_id IS NOT NULL THEN
    RAISE EXCEPTION 'invalid entitlement lineage root' USING ERRCODE = '23514';
  END IF;

  IF NEW.operator_db_role IS DISTINCT FROM SESSION_USER::name THEN
    RAISE EXCEPTION 'operator identity must be derived from session_user' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION potok_control.validate_access_attestation_insert_v2()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER validate_access_attestation_insert_v2
BEFORE INSERT ON potok_control.access_attestations
FOR EACH ROW EXECUTE FUNCTION potok_control.validate_access_attestation_insert_v2();

CREATE FUNCTION potok_control.reject_access_attestation_mutation_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'entitlement attestations are append-only' USING ERRCODE = '42501';
END
$function$;
REVOKE ALL ON FUNCTION potok_control.reject_access_attestation_mutation_v2()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER reject_access_attestation_update_delete_v2
BEFORE UPDATE OR DELETE ON potok_control.access_attestations
FOR EACH ROW EXECUTE FUNCTION potok_control.reject_access_attestation_mutation_v2();
CREATE TRIGGER reject_access_attestation_truncate_v2
BEFORE TRUNCATE ON potok_control.access_attestations
FOR EACH STATEMENT EXECUTE FUNCTION potok_control.reject_access_attestation_mutation_v2();

ALTER TABLE public.user_profiles
  ADD COLUMN premium_provenance_id uuid NULL,
  ADD COLUMN premium_valid_until timestamptz NULL,
  ADD COLUMN admin_provenance_id uuid NULL,
  ADD COLUMN admin_valid_until timestamptz NULL,
  ADD CONSTRAINT user_profiles_premium_provenance_fk
    FOREIGN KEY (user_id, premium_provenance_id)
    REFERENCES potok_control.access_attestations (account_id, attestation_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT user_profiles_admin_provenance_fk
    FOREIGN KEY (user_id, admin_provenance_id)
    REFERENCES potok_control.access_attestations (account_id, attestation_id)
    ON DELETE RESTRICT;

COMMENT ON COLUMN public.user_profiles.has_premium IS
  'Legacy/UI projection only. Verified Premium requires a valid potok_control attestation.';
COMMENT ON COLUMN public.user_profiles.is_admin IS
  'Legacy/UI projection only. Verified admin requires a valid potok_control attestation.';

CREATE FUNCTION potok_control.guard_user_profile_entitlement_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_owner_channel boolean := SESSION_USER = 'postgres' AND CURRENT_USER = 'postgres';
BEGIN
  IF NOT v_owner_channel THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'profile deletion requires the separate account-erasure boundary' USING ERRCODE = '42501';
    ELSIF TG_OP = 'INSERT' THEN
      IF NEW.has_premium IS DISTINCT FROM false
         OR NEW.is_admin IS DISTINCT FROM false
         OR NEW.premium_provenance_id IS NOT NULL
         OR NEW.premium_valid_until IS NOT NULL
         OR NEW.admin_provenance_id IS NOT NULL
         OR NEW.admin_valid_until IS NOT NULL THEN
        RAISE EXCEPTION 'protected entitlement fields are owner-controlled' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.has_premium IS DISTINCT FROM OLD.has_premium
       OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
       OR NEW.premium_provenance_id IS DISTINCT FROM OLD.premium_provenance_id
       OR NEW.premium_valid_until IS DISTINCT FROM OLD.premium_valid_until
       OR NEW.admin_provenance_id IS DISTINCT FROM OLD.admin_provenance_id
       OR NEW.admin_valid_until IS DISTINCT FROM OLD.admin_valid_until THEN
      RAISE EXCEPTION 'protected entitlement fields are owner-controlled' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION potok_control.guard_user_profile_entitlement_v2()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER guard_user_profile_entitlement_v2
BEFORE INSERT OR UPDATE OR DELETE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION potok_control.guard_user_profile_entitlement_v2();

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.user_profiles FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT (
  user_id, first_name, last_name, middle_name, birth_date, age, height,
  goal, email, phone, avatar_url
) ON public.user_profiles TO authenticated, service_role;
GRANT UPDATE (
  first_name, last_name, middle_name, birth_date, age, height,
  goal, email, phone, avatar_url
) ON public.user_profiles TO authenticated, service_role;

CREATE FUNCTION potok_control.grant_entitlement_v2(
  p_account_id uuid,
  p_capability text,
  p_valid_until timestamptz,
  p_evidence_ref text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_head potok_control.access_attestations%ROWTYPE;
  v_attestation_id uuid := pg_catalog.gen_random_uuid();
  v_sequence bigint;
  v_updated integer;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled entitlement channel required' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NULL OR p_capability NOT IN ('premium', 'admin') THEN
    RAISE EXCEPTION 'invalid entitlement scope' USING ERRCODE = '22023';
  END IF;
  IF p_valid_until IS NOT NULL AND p_valid_until <= v_now THEN
    RAISE EXCEPTION 'grant expiry must be in the future' USING ERRCODE = '22023';
  END IF;
  IF p_evidence_ref IS NULL OR p_evidence_ref = '' OR p_evidence_ref <> pg_catalog.btrim(p_evidence_ref)
     OR p_reason IS NULL OR p_reason = '' OR p_reason <> pg_catalog.btrim(p_reason) THEN
    RAISE EXCEPTION 'evidence and reason are required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-entitlement-v2:' || p_account_id::text || ':' || p_capability, 0)
  );
  SELECT a.* INTO v_head
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id AND a.capability = p_capability
   ORDER BY a.lineage_sequence DESC LIMIT 1 FOR UPDATE;
  v_sequence := pg_catalog.coalesce(v_head.lineage_sequence, 0) + 1;

  INSERT INTO potok_control.access_attestations (
    attestation_id, account_id, capability, effect, previous_attestation_id,
    lineage_sequence, issued_at, valid_until, operator_db_role, evidence_ref, reason
  ) VALUES (
    v_attestation_id, p_account_id, p_capability, 'GRANT', v_head.attestation_id,
    v_sequence, v_now, p_valid_until, SESSION_USER::name, p_evidence_ref, p_reason
  );

  IF p_capability = 'premium' THEN
    UPDATE public.user_profiles
       SET has_premium = true,
           premium_provenance_id = v_attestation_id,
           premium_valid_until = p_valid_until
     WHERE user_id = p_account_id;
  ELSE
    UPDATE public.user_profiles
       SET is_admin = true,
           admin_provenance_id = v_attestation_id,
           admin_valid_until = p_valid_until
     WHERE user_id = p_account_id;
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'exactly one user profile is required for entitlement grant';
  END IF;
  RETURN v_attestation_id;
END
$function$;

CREATE FUNCTION potok_control.revoke_entitlement_v2(
  p_account_id uuid,
  p_capability text,
  p_evidence_ref text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_head potok_control.access_attestations%ROWTYPE;
  v_attestation_id uuid := pg_catalog.gen_random_uuid();
  v_sequence bigint;
  v_updated integer;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled entitlement channel required' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NULL OR p_capability NOT IN ('premium', 'admin') THEN
    RAISE EXCEPTION 'invalid entitlement scope' USING ERRCODE = '22023';
  END IF;
  IF p_evidence_ref IS NULL OR p_evidence_ref = '' OR p_evidence_ref <> pg_catalog.btrim(p_evidence_ref)
     OR p_reason IS NULL OR p_reason = '' OR p_reason <> pg_catalog.btrim(p_reason) THEN
    RAISE EXCEPTION 'evidence and reason are required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-entitlement-v2:' || p_account_id::text || ':' || p_capability, 0)
  );
  SELECT a.* INTO v_head
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id AND a.capability = p_capability
   ORDER BY a.lineage_sequence DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cannot revoke entitlement without prior lineage' USING ERRCODE = '23514';
  END IF;
  v_sequence := v_head.lineage_sequence + 1;

  INSERT INTO potok_control.access_attestations (
    attestation_id, account_id, capability, effect, previous_attestation_id,
    lineage_sequence, issued_at, valid_until, operator_db_role, evidence_ref, reason
  ) VALUES (
    v_attestation_id, p_account_id, p_capability, 'REVOKE', v_head.attestation_id,
    v_sequence, v_now, NULL, SESSION_USER::name, p_evidence_ref, p_reason
  );

  IF p_capability = 'premium' THEN
    UPDATE public.user_profiles
       SET has_premium = false,
           premium_provenance_id = v_attestation_id,
           premium_valid_until = NULL
     WHERE user_id = p_account_id;
  ELSE
    UPDATE public.user_profiles
       SET is_admin = false,
           admin_provenance_id = v_attestation_id,
           admin_valid_until = NULL
     WHERE user_id = p_account_id;
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'exactly one user profile is required for entitlement revoke';
  END IF;
  RETURN v_attestation_id;
END
$function$;

REVOKE ALL ON FUNCTION potok_control.grant_entitlement_v2(uuid, text, timestamptz, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION potok_control.revoke_entitlement_v2(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION potok_control.is_effective_entitlement_v2(
  p_account_id uuid,
  p_capability text,
  p_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_count bigint;
  v_max_sequence bigint;
  v_root_count bigint;
  v_effect text;
  v_valid_until timestamptz;
BEGIN
  IF p_account_id IS NULL OR p_capability NOT IN ('premium', 'admin') OR p_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT pg_catalog.count(*), pg_catalog.max(a.lineage_sequence),
         pg_catalog.count(*) FILTER (
           WHERE a.lineage_sequence = 1 AND a.previous_attestation_id IS NULL
         )
    INTO v_count, v_max_sequence, v_root_count
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id AND a.capability = p_capability;

  IF v_count = 0 OR v_count <> v_max_sequence OR v_root_count <> 1 THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1
      FROM potok_control.access_attestations a
      LEFT JOIN potok_control.access_attestations predecessor
        ON predecessor.account_id = a.account_id
       AND predecessor.capability = a.capability
       AND predecessor.attestation_id = a.previous_attestation_id
     WHERE a.account_id = p_account_id
       AND a.capability = p_capability
       AND (
         (a.lineage_sequence = 1 AND a.previous_attestation_id IS NOT NULL)
         OR (a.lineage_sequence > 1 AND (
           predecessor.attestation_id IS NULL
           OR predecessor.lineage_sequence <> a.lineage_sequence - 1
           OR predecessor.issued_at > a.issued_at
         ))
       )
  ) THEN
    RETURN false;
  END IF;

  SELECT a.effect, a.valid_until
    INTO v_effect, v_valid_until
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id
     AND a.capability = p_capability
     AND a.issued_at <= p_at
   ORDER BY a.lineage_sequence DESC
   LIMIT 1;

  IF NOT FOUND OR v_effect <> 'GRANT' THEN
    RETURN false;
  END IF;
  RETURN v_valid_until IS NULL OR v_valid_until > p_at;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END
$function$;
REVOKE ALL ON FUNCTION potok_control.is_effective_entitlement_v2(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.has_verified_entitlement_v2(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE potok_control.is_effective_entitlement_v2(
      auth.uid(), p_capability, pg_catalog.statement_timestamp()
    )
  END
$function$;
REVOKE ALL ON FUNCTION public.has_verified_entitlement_v2(text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_verified_entitlement_v2(text) TO authenticated;

-- Compatibility name used by the prepared client transition. It delegates only.
CREATE FUNCTION public.has_verified_entitlement_v1(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT public.has_verified_entitlement_v2(p_capability)
$function$;
REVOKE ALL ON FUNCTION public.has_verified_entitlement_v1(text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_verified_entitlement_v1(text) TO authenticated;

ALTER TABLE public.premium_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_meal_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_recipe_hints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_meal_recipe_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS potok_verified_premium_catalog_select_v2 ON public.premium_plans;
CREATE POLICY potok_verified_premium_catalog_select_v2 ON public.premium_plans
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_verified_entitlement_v2('premium'));
DROP POLICY IF EXISTS potok_verified_premium_catalog_select_v2 ON public.premium_plan_days;
CREATE POLICY potok_verified_premium_catalog_select_v2 ON public.premium_plan_days
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_verified_entitlement_v2('premium'));
DROP POLICY IF EXISTS potok_verified_premium_catalog_select_v2 ON public.premium_meal_slots;
CREATE POLICY potok_verified_premium_catalog_select_v2 ON public.premium_meal_slots
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_verified_entitlement_v2('premium'));
DROP POLICY IF EXISTS potok_verified_premium_catalog_select_v2 ON public.premium_recipes;
CREATE POLICY potok_verified_premium_catalog_select_v2 ON public.premium_recipes
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_verified_entitlement_v2('premium'));
DROP POLICY IF EXISTS potok_verified_premium_catalog_select_v2 ON public.premium_recipe_ingredients;
CREATE POLICY potok_verified_premium_catalog_select_v2 ON public.premium_recipe_ingredients
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_verified_entitlement_v2('premium'));
DROP POLICY IF EXISTS potok_verified_premium_catalog_select_v2 ON public.premium_recipe_steps;
CREATE POLICY potok_verified_premium_catalog_select_v2 ON public.premium_recipe_steps
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_verified_entitlement_v2('premium'));
DROP POLICY IF EXISTS potok_verified_premium_catalog_select_v2 ON public.premium_recipe_hints;
CREATE POLICY potok_verified_premium_catalog_select_v2 ON public.premium_recipe_hints
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_verified_entitlement_v2('premium'));
DROP POLICY IF EXISTS potok_verified_premium_catalog_select_v2 ON public.premium_meal_recipe_options;
CREATE POLICY potok_verified_premium_catalog_select_v2 ON public.premium_meal_recipe_options
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.has_verified_entitlement_v2('premium'));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.premium_plans, public.premium_plan_days, public.premium_meal_slots,
     public.premium_recipes, public.premium_recipe_ingredients,
     public.premium_recipe_steps, public.premium_recipe_hints,
     public.premium_meal_recipe_options
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE potok_control.access_attestations IS
  'Append-only owner-SQL-controlled Premium/admin grant/revoke audit. No payment source.';
COMMENT ON FUNCTION public.has_verified_entitlement_v2(text) IS
  'Authenticated own-account predicate. Legacy profile flags are intentionally ignored.';
COMMENT ON FUNCTION public.has_verified_entitlement_v1(text) IS
  'Compatibility alias for the v2 verified own-account predicate.';

COMMIT;

-- Deliberately absent:
--   * CREATE/ALTER ROLE and role membership changes;
--   * EXECUTE/USAGE grants for provisioning to anon/authenticated/service_role;
--   * client-selectable account identity or service_role provisioning;
--   * payment implementation or legacy-flag backfill.
-- A non-postgres operator channel requires a separate externally controlled design,
-- evidence and owner approval; this patch does not manufacture one inside the DB.
