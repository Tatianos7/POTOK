-- Exact function definitions read from POTOK Staging on 2026-10-30.
-- DISPOSABLE FIXTURE ONLY. No live installation, users or grants.
DO $guard$
BEGIN
 IF current_database()<>'potok_generation_store_disposable'
  OR current_setting('potok.disposable_generation_store',true) IS DISTINCT FROM 'on'
  OR session_user<>'postgres' OR current_user<>'postgres' THEN
  RAISE EXCEPTION 'DISPOSABLE_GENERATION_ADMISSION_REQUIRED' USING ERRCODE='42501';
 END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION potok_control.is_effective_entitlement_v2(p_account_id uuid, p_capability text, p_at timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
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

CREATE OR REPLACE FUNCTION potok_nutrition.acquire_shared_account_gate_v1(p_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account gate requires account identity' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-shared-account-gate-v1:' || p_account_id::text, 0)
  );
END
$function$;

CREATE OR REPLACE FUNCTION potok_nutrition.assert_generation_request_current_v2(p_request_operation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_state potok_nutrition.adaptive_nutrition_generation_requests_v2%ROWTYPE;
  v_input jsonb;
  v_selection public.user_premium_plan_selections%ROWTYPE;
  v_authority potok_nutrition.nutrition_authority_heads_v1%ROWTYPE;
  v_manifest_head potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2%ROWTYPE;
  v_manifest potok_nutrition.adaptive_nutrition_candidate_manifests_v2%ROWTYPE;
  v_policy potok_nutrition.adaptive_nutrition_generation_policy_head_v2%ROWTYPE;
  v_entitlement_revision uuid;
BEGIN
  IF CURRENT_USER<>'postgres' THEN
    RAISE EXCEPTION 'PROTECTED_EXECUTION_CHANNEL_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT v_state FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
   WHERE r.request_operation_id=p_request_operation_id FOR UPDATE;
  PERFORM potok_nutrition.acquire_shared_account_gate_v1(v_state.account_id);
  v_input:=potok_nutrition.require_canonical_json_v2(v_state.generation_input_canonical);
  IF NOT potok_control.is_effective_entitlement_v2(
       v_state.account_id,'premium',pg_catalog.statement_timestamp()) THEN
    RAISE EXCEPTION 'VERIFIED_PREMIUM_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT a.attestation_id INTO v_entitlement_revision FROM potok_control.access_attestations a
   WHERE a.account_id=v_state.account_id AND a.capability='premium'
     AND a.issued_at<=pg_catalog.statement_timestamp()
   ORDER BY a.lineage_sequence DESC LIMIT 1;
  SELECT * INTO STRICT v_selection FROM public.user_premium_plan_selections s
   WHERE s.user_id=v_state.account_id AND s.id=v_state.selection_id FOR UPDATE;
  IF v_selection.status<>'pending_generation' OR v_selection.plan_revision IS NOT NULL
     OR v_selection.week_anchor::text<>v_input->>'weekStartLocal'
     OR v_selection.timezone<>v_input->>'timezone'
     OR v_selection.goal_revision<>(v_input#>>'{goalNutritionTarget,goalRevision}')::uuid
     OR v_input#>>'{selection,planSelectionRevision}'<>
        v_selection.origin_lineage->>'provisionOperationId'
     OR v_entitlement_revision<>(v_input->>'entitlementEvidenceRevision')::uuid
     OR NOT EXISTS (SELECT 1 FROM public.user_goals g
                     WHERE g.user_id=v_state.account_id
                       AND g.goal_revision=v_selection.goal_revision) THEN
    RAISE EXCEPTION 'GENERATION_REQUEST_STALE_SELECTION' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT v_authority FROM potok_nutrition.nutrition_authority_heads_v1 h
   WHERE h.account_id=v_state.account_id FOR SHARE;
  IF v_authority.current_preference_revision<>(v_input->>'preferenceRevision')::uuid
     OR v_authority.current_safety_revision<>(v_input->>'safetyRevision')::uuid THEN
    RAISE EXCEPTION 'GENERATION_REQUEST_STALE_AUTHORITY' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT v_manifest_head
    FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 h
   WHERE h.singleton FOR SHARE;
  SELECT * INTO STRICT v_manifest
    FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2 m
   WHERE m.manifest_revision=v_manifest_head.current_manifest_revision FOR SHARE;
  IF v_manifest.publication_state<>'PUBLISHED'
     OR v_manifest.manifest_revision<>(v_input->>'candidateManifestRevision')::uuid
     OR v_manifest.canonical_digest<>pg_catalog.decode(v_input->>'candidateManifestDigest','hex')
     OR extensions.digest(v_manifest.canonical_bytes,'sha256')<>v_manifest.canonical_digest THEN
    RAISE EXCEPTION 'GENERATION_REQUEST_STALE_MANIFEST' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT v_policy
    FROM potok_nutrition.adaptive_nutrition_generation_policy_head_v2 p
   WHERE p.singleton AND p.publication_state='PUBLISHED' FOR SHARE;
  IF v_policy.target_policy_revision<>(v_input#>>'{goalNutritionTarget,targetPolicyRevision}')::uuid
     OR v_policy.composition_policy_revision<>(v_input->>'compositionPolicyRevision')::uuid
     OR v_policy.validation_policy_revision<>(v_input->>'validationPolicyRevision')::uuid
     OR v_policy.optimization_policy_revision<>(v_input->>'optimizationPolicyRevision')::uuid
     OR v_policy.generation_policy_revision<>(v_input->>'generationPolicyRevision')::uuid THEN
    RAISE EXCEPTION 'GENERATION_REQUEST_STALE_POLICY' USING ERRCODE='40001';
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION potok_nutrition.canonical_jsonb_text_v1(p_value jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_result text;
BEGIN
  CASE pg_catalog.jsonb_typeof(p_value)
    WHEN 'object' THEN
      SELECT '{' || COALESCE(pg_catalog.string_agg(
        pg_catalog.to_jsonb(entry.key)::text || ':' ||
        potok_nutrition.canonical_jsonb_text_v1(entry.value), ',' ORDER BY entry.key COLLATE "C"
      ), '') || '}' INTO v_result
        FROM pg_catalog.jsonb_each(p_value) entry;
    WHEN 'array' THEN
      SELECT '[' || COALESCE(pg_catalog.string_agg(
        potok_nutrition.canonical_jsonb_text_v1(item.value), ',' ORDER BY item.ordinality
      ), '') || ']' INTO v_result
        FROM pg_catalog.jsonb_array_elements(p_value) WITH ORDINALITY item(value, ordinality);
    WHEN 'string' THEN RETURN pg_catalog.to_jsonb(p_value #>> '{}')::text;
    WHEN 'boolean' THEN RETURN p_value::text;
    WHEN 'null' THEN RETURN 'null';
    ELSE RETURN p_value::text;
  END CASE;
  RETURN v_result;
END
$function$;

CREATE OR REPLACE FUNCTION potok_nutrition.json_has_duplicate_keys_v1(p_value json)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_child json;
BEGIN
  IF pg_catalog.json_typeof(p_value) = 'object' THEN
    IF EXISTS (
      SELECT 1 FROM pg_catalog.json_each(p_value)
       GROUP BY key HAVING pg_catalog.count(*) > 1
    ) THEN
      RETURN true;
    END IF;
    FOR v_child IN SELECT value FROM pg_catalog.json_each(p_value) LOOP
      IF potok_nutrition.json_has_duplicate_keys_v1(v_child) THEN RETURN true; END IF;
    END LOOP;
  ELSIF pg_catalog.json_typeof(p_value) = 'array' THEN
    FOR v_child IN SELECT value FROM pg_catalog.json_array_elements(p_value) LOOP
      IF potok_nutrition.json_has_duplicate_keys_v1(v_child) THEN RETURN true; END IF;
    END LOOP;
  END IF;
  RETURN false;
END
$function$;

CREATE OR REPLACE FUNCTION potok_nutrition.require_canonical_json_v2(p_canonical_bytes bytea)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_raw json;
  v_value jsonb;
BEGIN
  IF p_canonical_bytes IS NULL OR pg_catalog.octet_length(p_canonical_bytes) = 0 THEN
    RAISE EXCEPTION 'canonical bytes required' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_raw := pg_catalog.convert_from(p_canonical_bytes, 'UTF8')::json;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'canonical bytes must be UTF8 JSON' USING ERRCODE = '22023';
  END;
  IF potok_nutrition.json_has_duplicate_keys_v1(v_raw) THEN
    RAISE EXCEPTION 'duplicate JSON keys rejected before jsonb' USING ERRCODE = '22023';
  END IF;
  v_value := v_raw::jsonb;
  IF pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_value), 'UTF8') <> p_canonical_bytes THEN
    RAISE EXCEPTION 'noncanonical JSON bytes' USING ERRCODE = '22023';
  END IF;
  RETURN v_value;
END
$function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_control FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_nutrition FROM PUBLIC,anon,authenticated,service_role;

