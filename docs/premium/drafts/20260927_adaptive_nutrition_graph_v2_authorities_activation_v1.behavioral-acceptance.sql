-- POTOK Graph v2 authorities + activation v1 — ROLLBACK-ONLY BEHAVIORAL ACCEPTANCE.
-- Target: Supabase STAGING ozidryfvhkcbtpnulakq only, after separately approved apply.
-- Uses two previously verified empty STAGING Auth test accounts and synthetic UUIDs only.
-- This script never publishes a real recipe and its final executable statement is ROLLBACK.
-- Cross-session blocking needs a separate two-session operator check; this transaction proves
-- that every mutable writer uses the same exact account-gate helper and resource contract.

BEGIN;

CREATE TEMP TABLE potok_graph_v2_acceptance_config (
  account_main uuid PRIMARY KEY,
  account_other uuid UNIQUE NOT NULL,
  week_anchor date NOT NULL,
  selection_id uuid UNIQUE NOT NULL,
  other_selection_id uuid UNIQUE NOT NULL,
  provision_operation_id uuid UNIQUE NOT NULL,
  goal_revision uuid NULL,
  premium_attestation_id uuid NULL,
  preference_revision uuid UNIQUE NOT NULL,
  preference_revision_2 uuid UNIQUE NOT NULL,
  safety_revision uuid UNIQUE NOT NULL,
  safety_revision_2 uuid UNIQUE NOT NULL,
  authority_head_revision uuid UNIQUE NOT NULL,
  authority_head_revision_2 uuid UNIQUE NOT NULL,
  authority_head_revision_3 uuid UNIQUE NOT NULL,
  manifest_revision uuid UNIQUE NOT NULL,
  manifest_head_revision uuid UNIQUE NOT NULL,
  recipe_id uuid UNIQUE NOT NULL,
  recipe_revision_id uuid UNIQUE NOT NULL,
  portion_revision_id uuid UNIQUE NOT NULL,
  eligibility_revision_id uuid UNIQUE NOT NULL,
  plan_revision uuid UNIQUE NOT NULL,
  generation_key uuid UNIQUE NOT NULL,
  generation_operation_id uuid NULL,
  activation_key uuid UNIQUE NOT NULL,
  activation_operation_id uuid NULL,
  input_snapshot jsonb NULL,
  plan_snapshot jsonb NULL,
  input_canonical bytea NULL,
  plan_canonical bytea NULL
) ON COMMIT DROP;

INSERT INTO potok_graph_v2_acceptance_config (
  account_main, account_other, week_anchor, selection_id, other_selection_id,
  provision_operation_id, preference_revision, preference_revision_2,
  safety_revision, safety_revision_2, authority_head_revision,
  authority_head_revision_2, authority_head_revision_3, manifest_revision,
  manifest_head_revision, recipe_id, recipe_revision_id, portion_revision_id,
  eligibility_revision_id, plan_revision, generation_key, activation_key
) VALUES (
  'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
  '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid,
  pg_catalog.date_trunc('week', pg_catalog.statement_timestamp() AT TIME ZONE 'Europe/Moscow')::date,
  '92720000-0000-4000-8000-000000000001'::uuid,
  '92720000-0000-4000-8000-000000000002'::uuid,
  '92720000-0000-4000-8000-000000000003'::uuid,
  '92720000-0000-4000-8000-000000000010'::uuid,
  '92720000-0000-4000-8000-000000000011'::uuid,
  '92720000-0000-4000-8000-000000000012'::uuid,
  '92720000-0000-4000-8000-000000000013'::uuid,
  '92720000-0000-4000-8000-000000000014'::uuid,
  '92720000-0000-4000-8000-000000000015'::uuid,
  '92720000-0000-4000-8000-000000000016'::uuid,
  '92720000-0000-4000-8000-000000000020'::uuid,
  '92720000-0000-4000-8000-000000000021'::uuid,
  '92720000-0000-4000-8000-000000000030'::uuid,
  '92720000-0000-4000-8000-000000000031'::uuid,
  '92720000-0000-4000-8000-000000000032'::uuid,
  '92720000-0000-4000-8000-000000000033'::uuid,
  '92720000-0000-4000-8000-000000000040'::uuid,
  '92720000-0000-4000-8000-000000000041'::uuid,
  '92720000-0000-4000-8000-000000000042'::uuid
);

DO $preflight$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_name text;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner SQL session required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  IF EXTRACT(isodow FROM v.week_anchor) <> 1 THEN
    RAISE EXCEPTION 'fixture week anchor must be Monday';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM auth.users u
       WHERE u.id IN (v.account_main,v.account_other)) <> 2 THEN
    RAISE EXCEPTION 'exact verified empty STAGING Auth fixture accounts are required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.user_id IN (v.account_main,v.account_other)
    UNION ALL SELECT 1 FROM public.user_goals g WHERE g.user_id IN (v.account_main,v.account_other)
    UNION ALL SELECT 1 FROM public.user_premium_plan_selections s WHERE s.user_id IN (v.account_main,v.account_other)
    UNION ALL SELECT 1 FROM public.adaptive_nutrition_operations o WHERE o.user_id IN (v.account_main,v.account_other)
    UNION ALL SELECT 1 FROM public.adaptive_nutrition_graph_revisions g WHERE g.user_id IN (v.account_main,v.account_other)
    UNION ALL SELECT 1 FROM public.adaptive_nutrition_events e WHERE e.user_id IN (v.account_main,v.account_other)
    UNION ALL SELECT 1 FROM public.food_diary_entries d WHERE d.user_id IN (v.account_main,v.account_other)
    UNION ALL SELECT 1 FROM potok_control.access_attestations a WHERE a.account_id IN (v.account_main,v.account_other)
    UNION ALL SELECT 1 FROM potok_nutrition.nutrition_authority_heads_v1 h WHERE h.account_id IN (v.account_main,v.account_other)
  ) THEN
    RAISE EXCEPTION 'fixture accounts are not empty; do not overwrite existing state';
  END IF;
  IF EXISTS (
    SELECT 1 FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2 m
     WHERE m.manifest_revision=v.manifest_revision
  ) THEN RAISE EXCEPTION 'fixture manifest identity already exists'; END IF;

  FOREACH v_name IN ARRAY ARRAY[
    'potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)',
    'potok_control.revoke_entitlement_v2(uuid,text,text,text)',
    'public.adaptive_nutrition_provision_current_week_v1(text,uuid)',
    'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)',
    'potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea)',
    'potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid)'
  ] LOOP
    IF pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(v_name))
         NOT LIKE '%acquire_shared_account_gate_v1%' THEN
      RAISE EXCEPTION 'mutable writer does not use shared account gate: %', v_name;
    END IF;
  END LOOP;
  IF pg_catalog.pg_get_functiondef(
       'potok_nutrition.acquire_shared_account_gate_v1(uuid)'::pg_catalog.regprocedure
     ) NOT LIKE '%potok-shared-account-gate-v1:%' THEN
    RAISE EXCEPTION 'shared account gate resource contract changed';
  END IF;
  IF pg_catalog.hashtextextended('potok-shared-account-gate-v1:'||v.account_main::text,0)
       = pg_catalog.hashtextextended('potok-shared-account-gate-v1:'||v.account_other::text,0) THEN
    RAISE EXCEPTION 'fixture accounts unexpectedly collide on advisory resource';
  END IF;
  PERFORM potok_nutrition.acquire_shared_account_gate_v1(v.account_main);
  PERFORM potok_nutrition.acquire_shared_account_gate_v1(v.account_other);
END
$preflight$;

-- Fixture authority only: minimal profiles, Goals and pending weekly identities.
INSERT INTO public.user_profiles(user_id)
SELECT account_main FROM potok_graph_v2_acceptance_config
UNION ALL SELECT account_other FROM potok_graph_v2_acceptance_config;

INSERT INTO public.user_goals(user_id,calories,protein,fat,carbs,goal_type)
SELECT account_main,2000,100.00,70.00,250.00,'graph_v2_rollback_acceptance'
  FROM potok_graph_v2_acceptance_config
UNION ALL
SELECT account_other,2000,100.00,70.00,250.00,'graph_v2_rollback_acceptance'
  FROM potok_graph_v2_acceptance_config;

UPDATE potok_graph_v2_acceptance_config c SET goal_revision=g.goal_revision
  FROM public.user_goals g WHERE g.user_id=c.account_main;

INSERT INTO public.user_premium_plan_selections(
  id,user_id,user_goal_id,premium_plan_id,status,start_date,contract_version,
  week_anchor,timezone,plan_revision,goal_revision,history_revision,diary_revision,
  origin_kind,origin_lineage
)
SELECT c.selection_id,c.account_main,c.account_main,NULL,'pending_generation',c.week_anchor,1,
       c.week_anchor,'Europe/Moscow',NULL,c.goal_revision,
       '92720000-0000-4000-8000-000000000004'::uuid,
       '92720000-0000-4000-8000-000000000005'::uuid,
       'generated',pg_catalog.jsonb_build_object(
         'source','potok-goal-plan-engine-v1','generationState','pending_generation',
         'provisionOperationId',c.provision_operation_id)
  FROM potok_graph_v2_acceptance_config c;

INSERT INTO public.user_premium_plan_selections(
  id,user_id,user_goal_id,premium_plan_id,status,start_date,contract_version,
  week_anchor,timezone,plan_revision,goal_revision,history_revision,diary_revision,
  origin_kind,origin_lineage
)
SELECT c.other_selection_id,c.account_other,c.account_other,NULL,'archived',
       c.week_anchor-interval '7 days',1,c.week_anchor-7,'Europe/Moscow',NULL,
       g.goal_revision,'92720000-0000-4000-8000-000000000006'::uuid,
       '92720000-0000-4000-8000-000000000007'::uuid,'generated',
       '{"source":"graph-v2-rollback-only-v1"}'::jsonb
  FROM potok_graph_v2_acceptance_config c
  JOIN public.user_goals g ON g.user_id=c.account_other;

INSERT INTO public.adaptive_nutrition_operations(
  user_id,idempotency_key,operation_id,selection_id,contract_version,action_type,
  canonical_request,digest_version,request_digest,outcome,result_references,committed_at
)
SELECT c.account_main,'92720000-0000-4000-8000-000000000003',c.provision_operation_id,
       c.selection_id,'adaptive-nutrition-plan-provision-v1','PLAN_PROVISIONED',
       pg_catalog.convert_to('{}','UTF8'),'acceptance/sha256',
       extensions.digest(pg_catalog.convert_to('{}','UTF8'),'sha256'),'accepted',
       pg_catalog.jsonb_build_object('selection_id',c.selection_id,'event_ids','[]'::jsonb),
       pg_catalog.statement_timestamp()
  FROM potok_graph_v2_acceptance_config c;

UPDATE potok_graph_v2_acceptance_config c
   SET premium_attestation_id=potok_control.grant_entitlement_v2(
     c.account_main,'premium',pg_catalog.statement_timestamp()+interval '1 day',
     'graph-v2-rollback-only-v1/grant','rollback-only Graph v2 acceptance grant');

-- 03/04 explicit empty preference and safety authorities.
DO $initialize_authorities$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_preference jsonb;
  v_safety jsonb;
  v_result jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_preference:=pg_catalog.jsonb_build_object(
    'contract','potok-nutrition-preference-snapshot-v1','accountId',v.account_main,
    'revisionId',v.preference_revision,'supersedesRevisionId',NULL,
    'hard',pg_catalog.jsonb_build_object('dietaryPattern','UNSPECIFIED',
      'excludedMealTypes','[]'::jsonb,'excludedIngredientIds','[]'::jsonb,
      'excludedRecipeIds','[]'::jsonb),
    'soft',pg_catalog.jsonb_build_object('likedIngredientIds','[]'::jsonb,
      'dislikedIngredientIds','[]'::jsonb,'conveniencePreference',NULL,
      'mealStylePreferences','[]'::jsonb),'createdAt','2026-09-27T00:00:00.000Z');
  v_safety:=pg_catalog.jsonb_build_object(
    'contract','potok-nutrition-safety-snapshot-v1','accountId',v.account_main,
    'revisionId',v.safety_revision,'supersedesRevisionId',NULL,
    'declaredAllergenCodes','[]'::jsonb,'declaredIntoleranceCodes','[]'::jsonb,
    'dietaryHardExclusionCodes','[]'::jsonb,'createdAt','2026-09-27T00:00:00.000Z');
  v_result:=potok_nutrition.initialize_nutrition_authorities_v1(
    v.account_main,v.authority_head_revision,
    pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_preference),'UTF8'),
    pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_safety),'UTF8'),
    '92720000-0000-4000-8000-000000000017'::uuid);
  IF v_result->>'preference_revision'<>v.preference_revision::text
     OR v_result->>'safety_revision'<>v.safety_revision::text
     OR EXISTS (SELECT 1 FROM potok_nutrition.nutrition_preference_snapshots_v1 p
                 WHERE p.account_id=v.account_main AND (
                   cardinality(p.excluded_meal_types)<>0 OR cardinality(p.excluded_ingredient_ids)<>0
                   OR cardinality(p.excluded_recipe_ids)<>0 OR cardinality(p.liked_ingredient_ids)<>0
                   OR cardinality(p.disliked_ingredient_ids)<>0 OR cardinality(p.meal_style_preferences)<>0))
     OR EXISTS (SELECT 1 FROM potok_nutrition.nutrition_safety_snapshots_v1 s
                 WHERE s.account_id=v.account_main AND (
                   cardinality(s.declared_allergen_codes)<>0 OR cardinality(s.declared_intolerance_codes)<>0
                   OR cardinality(s.dietary_hard_exclusion_codes)<>0)) THEN
    RAISE EXCEPTION 'explicit empty authority snapshot contract failed';
  END IF;
END
$initialize_authorities$;

-- 05 preference successor and immutable history.
DO $preference_successor$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_snapshot jsonb;
  v_immutable boolean:=false;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_snapshot:=pg_catalog.jsonb_build_object(
    'contract','potok-nutrition-preference-snapshot-v1','accountId',v.account_main,
    'revisionId',v.preference_revision_2,'supersedesRevisionId',v.preference_revision,
    'hard',pg_catalog.jsonb_build_object('dietaryPattern','UNSPECIFIED',
      'excludedMealTypes','[]'::jsonb,'excludedIngredientIds','[]'::jsonb,
      'excludedRecipeIds','[]'::jsonb),
    'soft',pg_catalog.jsonb_build_object('likedIngredientIds','[]'::jsonb,
      'dislikedIngredientIds','[]'::jsonb,'conveniencePreference','simple',
      'mealStylePreferences','[]'::jsonb),'createdAt','2026-09-27T00:01:00.000Z');
  PERFORM potok_nutrition.create_preference_successor_v1(
    v.account_main,v.authority_head_revision,v.authority_head_revision_2,
    pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_snapshot),'UTF8'),
    '92720000-0000-4000-8000-000000000018'::uuid);
  BEGIN
    UPDATE potok_nutrition.nutrition_preference_snapshots_v1 SET dietary_pattern='VEGAN'
     WHERE account_id=v.account_main AND revision_id=v.preference_revision;
  EXCEPTION WHEN OTHERS THEN v_immutable:=true; END;
  IF NOT v_immutable THEN RAISE EXCEPTION 'preference history was mutable'; END IF;
END
$preference_successor$;

-- 06 safety successor and immutable history.
DO $safety_successor$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_snapshot jsonb;
  v_immutable boolean:=false;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_snapshot:=pg_catalog.jsonb_build_object(
    'contract','potok-nutrition-safety-snapshot-v1','accountId',v.account_main,
    'revisionId',v.safety_revision_2,'supersedesRevisionId',v.safety_revision,
    'declaredAllergenCodes','[]'::jsonb,'declaredIntoleranceCodes','[]'::jsonb,
    'dietaryHardExclusionCodes','[]'::jsonb,'createdAt','2026-09-27T00:02:00.000Z');
  PERFORM potok_nutrition.create_safety_successor_v1(
    v.account_main,v.authority_head_revision_2,v.authority_head_revision_3,
    pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_snapshot),'UTF8'),
    '92720000-0000-4000-8000-000000000019'::uuid);
  BEGIN
    DELETE FROM potok_nutrition.nutrition_safety_snapshots_v1
     WHERE account_id=v.account_main AND revision_id=v.safety_revision;
  EXCEPTION WHEN OTHERS THEN v_immutable:=true; END;
  IF NOT v_immutable THEN RAISE EXCEPTION 'safety history was mutable'; END IF;
END
$safety_successor$;

-- 07/08 rejected duplicate and unpublished manifests; 09 exact published membership.
DO $manifest_contract$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_recipe jsonb:=pg_catalog.jsonb_build_object('fixture','synthetic-graph-v2-only');
  v_entry jsonb;
  v_manifest jsonb;
  v_failed boolean;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_entry:=pg_catalog.jsonb_build_object(
    'recipeId',v.recipe_id,'recipeRevisionId',v.recipe_revision_id,
    'portionRevisionId',v.portion_revision_id,'eligibilityRevisionId',v.eligibility_revision_id,
    'publicationRevision','92720000-0000-4000-8000-000000000034'::uuid,
    'publicationStatus','PUBLISHED','canonicalEvidenceRevision','92720000-0000-4000-8000-000000000035'::uuid,
    'canonicalEvidenceDigest',repeat('1',64),'nutritionEvidenceRevision','92720000-0000-4000-8000-000000000036'::uuid,
    'nutritionEvidenceDigest',repeat('2',64),'allergenEvidenceRevision','92720000-0000-4000-8000-000000000037'::uuid,
    'dietaryEvidenceRevision','92720000-0000-4000-8000-000000000038'::uuid,
    'ingredientIds','[]'::jsonb,'allergenCodes','[]'::jsonb,'intoleranceCodes','[]'::jsonb,
    'dietaryCodes','[]'::jsonb,'allowedMealTypes',pg_catalog.jsonb_build_array('breakfast'),
    'role','MAIN_COMPONENT','anchorKind','COMPLETE','requiredCompanionRoleSets','[]'::jsonb,
    'pairingTags','[]'::jsonb,'incompatiblePairingTags','[]'::jsonb,'repeatFamily','synthetic',
    'energyClass','BALANCED','beverageClass','NOT_BEVERAGE','dominantIngredientFamily','synthetic',
    'accessibility','EVERYDAY','specialty',false,'expensive',false,
    'portionRules',pg_catalog.jsonb_build_object('mode','HYBRID'),'recipeSnapshot',v_recipe,
    'recipeSnapshotDigest',pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      potok_nutrition.canonical_jsonb_text_v1(v_recipe),'UTF8'),'sha256'),'hex'));

  v_failed:=false;
  BEGIN
    v_manifest:=pg_catalog.jsonb_build_object('contract','potok-adaptive-candidate-manifest-v2',
      'encoding','potok-adaptive-candidate-manifest-v2-canonical-json-v1',
      'manifestRevision','92720000-0000-4000-8000-000000000022'::uuid,
      'supersedesManifestRevision',NULL,'publicationState','PUBLISHED',
      'publishedAt','2026-09-27T00:03:00.000Z','entries',pg_catalog.jsonb_build_array(v_entry,v_entry));
    PERFORM potok_nutrition.publish_candidate_manifest_v2(
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_manifest),'UTF8'),
      NULL,'92720000-0000-4000-8000-000000000023'::uuid,
      '92720000-0000-4000-8000-000000000024'::uuid);
  EXCEPTION WHEN unique_violation THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'duplicate manifest identity was accepted'; END IF;

  v_failed:=false;
  BEGIN
    v_manifest:=pg_catalog.jsonb_build_object('contract','potok-adaptive-candidate-manifest-v2',
      'encoding','potok-adaptive-candidate-manifest-v2-canonical-json-v1',
      'manifestRevision','92720000-0000-4000-8000-000000000025'::uuid,
      'supersedesManifestRevision',NULL,'publicationState','DRAFT','publishedAt',NULL,
      'entries',pg_catalog.jsonb_build_array(v_entry));
    PERFORM potok_nutrition.publish_candidate_manifest_v2(
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_manifest),'UTF8'),
      NULL,'92720000-0000-4000-8000-000000000026'::uuid,
      '92720000-0000-4000-8000-000000000027'::uuid);
  EXCEPTION WHEN OTHERS THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'unpublished manifest was accepted'; END IF;

  v_manifest:=pg_catalog.jsonb_build_object('contract','potok-adaptive-candidate-manifest-v2',
    'encoding','potok-adaptive-candidate-manifest-v2-canonical-json-v1',
    'manifestRevision',v.manifest_revision,'supersedesManifestRevision',NULL,
    'publicationState','PUBLISHED','publishedAt','2026-09-27T00:03:00.000Z',
    'entries',pg_catalog.jsonb_build_array(v_entry));
  PERFORM potok_nutrition.publish_candidate_manifest_v2(
    pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_manifest),'UTF8'),
    NULL,v.manifest_head_revision,'92720000-0000-4000-8000-000000000028'::uuid);
  IF (SELECT pg_catalog.count(*) FROM potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2 e
       WHERE e.manifest_revision=v.manifest_revision AND e.recipe_id=v.recipe_id
         AND e.recipe_revision_id=v.recipe_revision_id AND e.portion_revision_id=v.portion_revision_id
         AND e.eligibility_revision_id=v.eligibility_revision_id)<>1 THEN
    RAISE EXCEPTION 'published manifest membership projection differs';
  END IF;
END
$manifest_contract$;

-- 10 stale manifest CAS fails and its attempted header/entries roll back as one subtransaction.
DO $stale_manifest_cas$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_manifest jsonb;
  v_failed boolean:=false;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_manifest:=(SELECT m.manifest_snapshot FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2 m
                WHERE m.manifest_revision=v.manifest_revision)
    || pg_catalog.jsonb_build_object('manifestRevision','92720000-0000-4000-8000-000000000029'::uuid,
      'supersedesManifestRevision',v.manifest_revision,'publishedAt','2026-09-27T00:04:00.000Z');
  BEGIN
    PERFORM potok_nutrition.publish_candidate_manifest_v2(
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_manifest),'UTF8'),
      '92720000-0000-4000-8000-000000000099'::uuid,
      '92720000-0000-4000-8000-000000000098'::uuid,
      '92720000-0000-4000-8000-000000000097'::uuid);
  EXCEPTION WHEN serialization_failure THEN v_failed:=true; END;
  IF NOT v_failed OR EXISTS (SELECT 1 FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2
                              WHERE manifest_revision='92720000-0000-4000-8000-000000000029'::uuid) THEN
    RAISE EXCEPTION 'stale manifest CAS was not atomic';
  END IF;
END
$stale_manifest_cas$;

-- Build one canonical trusted input and one seven-day empty-slot Graph v2 result.
DO $build_generation_payloads$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_input jsonb;
  v_graph jsonb;
  v_graph_bytes bytea;
  v_graph_digest text;
  v_plan_base jsonb;
  v_plan jsonb;
  v_manifest_digest text;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  SELECT pg_catalog.encode(m.canonical_digest,'hex') INTO STRICT v_manifest_digest
    FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2 m
   WHERE m.manifest_revision=v.manifest_revision;
  v_input:=pg_catalog.jsonb_build_object(
    'contract','potok-adaptive-trusted-generation-input-v1',
    'accountGateContract','potok-shared-account-gate-v1','accountId',v.account_main,
    'selection',pg_catalog.jsonb_build_object('selectionId',v.selection_id,
      'planSelectionRevision',v.provision_operation_id,'expectedStatus','pending_generation',
      'expectedPlanRevision',NULL,'proposedPlanRevision',v.plan_revision),
    'weekStartLocal',v.week_anchor,'timezone','Europe/Moscow',
    'goalNutritionTarget',pg_catalog.jsonb_build_object(
      'contract','potok-adaptive-goal-nutrition-target-v1','goalRevision',v.goal_revision,
      'targetPolicyRevision','92720000-0000-4000-8000-000000000043'::uuid,
      'calories',pg_catalog.jsonb_build_object('target','2000.000','min','1500.000','max','2500.000'),
      'protein',NULL,'fat',NULL,'carbs',NULL,'fiber',NULL),
    'preferenceRevision',v.preference_revision_2,'safetyRevision',v.safety_revision_2,
    'entitlementEvidenceRevision',v.premium_attestation_id,
    'candidateManifestRevision',v.manifest_revision,'candidateManifestDigest',v_manifest_digest,
    'compositionPolicyRevision','92720000-0000-4000-8000-000000000044'::uuid,
    'validationPolicyRevision','92720000-0000-4000-8000-000000000045'::uuid,
    'optimizationPolicyRevision','92720000-0000-4000-8000-000000000046'::uuid,
    'generationPolicyRevision','92720000-0000-4000-8000-000000000047'::uuid,
    'operation',pg_catalog.jsonb_build_object('requestId','92720000-0000-4000-8000-000000000048'::uuid,
      'idempotencyKey',v.generation_key));
  SELECT pg_catalog.jsonb_build_object(
    'contract','adaptive_nutrition_graph_v2','contractVersion',2,'selectionId',v.selection_id,
    'planSelectionRevision',v.provision_operation_id,'planRevision',v.plan_revision,
    'weekStartLocal',v.week_anchor,'timezone','Europe/Moscow','goalRevision',v.goal_revision,
    'targetPolicyRevision',v_input#>'{goalNutritionTarget,targetPolicyRevision}',
    'goalNutritionTarget',v_input->'goalNutritionTarget',
    'preferenceRevision',v.preference_revision_2,'safetyRevision',v.safety_revision_2,
    'catalogManifestRevision',v.manifest_revision,'candidateManifestDigest',v_manifest_digest,
    'compositionPolicyRevision',v_input->'compositionPolicyRevision',
    'validationPolicyRevision',v_input->'validationPolicyRevision',
    'optimizationPolicyRevision',v_input->'optimizationPolicyRevision',
    'generationPolicyRevision',v_input->'generationPolicyRevision',
    'days',pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'date',(v.week_anchor+x)::date,'dayIndex',x,'slots','[]'::jsonb,
      'nutritionTotal',pg_catalog.jsonb_build_object('calories','0.000','protein','0.000',
        'fat','0.000','carbs','0.000','fiber','0.000'),
      'validationResultDigest',repeat('3',64)) ORDER BY x),
    'weekValidationResultDigest',repeat('4',64),'weekOptimizationResultDigest',repeat('5',64))
    INTO v_graph FROM pg_catalog.generate_series(0,6) x;
  v_graph_bytes:=pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(
    pg_catalog.jsonb_build_object('encoding','potok-adaptive-nutrition-graph-v2-canonical-json-v1',
      'contract','adaptive_nutrition_graph_v2','graph',v_graph)),'UTF8');
  v_graph_digest:=pg_catalog.encode(extensions.digest(v_graph_bytes,'sha256'),'hex');
  v_plan_base:=pg_catalog.jsonb_build_object(
    'contract','potok-adaptive-generated-week-plan-v1','accountId',v.account_main,
    'selectionId',v.selection_id,'planSelectionRevision',v.provision_operation_id,
    'weekStartLocal',v.week_anchor,'timezone','Europe/Moscow',
    'generationInputDigest',pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      potok_nutrition.canonical_jsonb_text_v1(pg_catalog.jsonb_build_object(
        'contract','potok-adaptive-trusted-generation-input-v1','input',v_input)),'UTF8'),'sha256'),'hex'),
    'generationPolicyRevision',v_input->'generationPolicyRevision',
    'candidateManifestDigest',v_manifest_digest,'goalRevision',v.goal_revision,
    'targetPolicyRevision',v_input#>'{goalNutritionTarget,targetPolicyRevision}',
    'proposedPlanRevision',v.plan_revision,'graph',v_graph,'graphDigest',v_graph_digest,
    'generatedAt',NULL,'facts','[]'::jsonb);
  v_plan:=v_plan_base||pg_catalog.jsonb_build_object('deterministicContentDigest',
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      potok_nutrition.canonical_jsonb_text_v1(v_plan_base),'UTF8'),'sha256'),'hex'));
  UPDATE potok_graph_v2_acceptance_config SET input_snapshot=v_input,plan_snapshot=v_plan,
    input_canonical=pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_input),'UTF8'),
    plan_canonical=pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_plan),'UTF8');
END
$build_generation_payloads$;

-- 11 generation exact replay; 13 same key with changed canonical payload conflicts.
DO $generation_replay_and_conflict$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_first jsonb;
  v_replay jsonb;
  v_changed_input jsonb;
  v_changed_plan_base jsonb;
  v_changed_plan jsonb;
  v_failed boolean:=false;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_first:=potok_nutrition.record_generated_week_v2(
    v.account_main,v.selection_id,v.generation_key,v.input_canonical,v.plan_canonical);
  v_replay:=potok_nutrition.record_generated_week_v2(
    v.account_main,v.selection_id,v.generation_key,v.input_canonical,v.plan_canonical);
  IF v_replay IS DISTINCT FROM v_first OR v_first->>'outcome'<>'accepted' THEN
    RAISE EXCEPTION 'generation exact replay changed result';
  END IF;
  UPDATE potok_graph_v2_acceptance_config SET generation_operation_id=(v_first->>'operation_id')::uuid;
  v_changed_input:=pg_catalog.jsonb_set(v.input_snapshot,'{operation,requestId}',
    pg_catalog.to_jsonb('92720000-0000-4000-8000-000000000049'::uuid));
  v_changed_plan_base:=(v.plan_snapshot-'deterministicContentDigest')||pg_catalog.jsonb_build_object(
    'generationInputDigest',pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      potok_nutrition.canonical_jsonb_text_v1(pg_catalog.jsonb_build_object(
        'contract','potok-adaptive-trusted-generation-input-v1','input',v_changed_input)),'UTF8'),'sha256'),'hex'));
  v_changed_plan:=v_changed_plan_base||pg_catalog.jsonb_build_object('deterministicContentDigest',
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      potok_nutrition.canonical_jsonb_text_v1(v_changed_plan_base),'UTF8'),'sha256'),'hex'));
  BEGIN
    PERFORM potok_nutrition.record_generated_week_v2(v.account_main,v.selection_id,v.generation_key,
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_changed_input),'UTF8'),
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_changed_plan),'UTF8'));
  EXCEPTION WHEN serialization_failure THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'same generation key with changed payload did not conflict'; END IF;
END
$generation_replay_and_conflict$;

-- 14/15/16/17 stale Goal/preference/safety and revoked Premium all fail closed.
DO $stale_authority_failures$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_failed boolean;
  v_snapshot jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_failed:=false;
  BEGIN
    UPDATE public.user_goals SET calories=calories+1 WHERE user_id=v.account_main;
    PERFORM potok_nutrition.activate_generated_week_v2(v.generation_operation_id,
      '92720000-0000-4000-8000-000000000050'::uuid,NULL);
  EXCEPTION WHEN serialization_failure THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'stale Goal was accepted'; END IF;

  v_failed:=false;
  BEGIN
    v_snapshot:=(SELECT canonical_snapshot FROM potok_nutrition.nutrition_preference_snapshots_v1
                  WHERE account_id=v.account_main AND revision_id=v.preference_revision_2)
      || pg_catalog.jsonb_build_object('revisionId','92720000-0000-4000-8000-000000000051'::uuid,
        'supersedesRevisionId',v.preference_revision_2,'createdAt','2026-09-27T00:05:00.000Z');
    PERFORM potok_nutrition.create_preference_successor_v1(v.account_main,v.authority_head_revision_3,
      '92720000-0000-4000-8000-000000000052'::uuid,
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_snapshot),'UTF8'),
      '92720000-0000-4000-8000-000000000053'::uuid);
    PERFORM potok_nutrition.activate_generated_week_v2(v.generation_operation_id,
      '92720000-0000-4000-8000-000000000054'::uuid,NULL);
  EXCEPTION WHEN serialization_failure THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'stale preference was accepted'; END IF;

  v_failed:=false;
  BEGIN
    v_snapshot:=(SELECT canonical_snapshot FROM potok_nutrition.nutrition_safety_snapshots_v1
                  WHERE account_id=v.account_main AND revision_id=v.safety_revision_2)
      || pg_catalog.jsonb_build_object('revisionId','92720000-0000-4000-8000-000000000055'::uuid,
        'supersedesRevisionId',v.safety_revision_2,'createdAt','2026-09-27T00:06:00.000Z');
    PERFORM potok_nutrition.create_safety_successor_v1(v.account_main,v.authority_head_revision_3,
      '92720000-0000-4000-8000-000000000056'::uuid,
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_snapshot),'UTF8'),
      '92720000-0000-4000-8000-000000000057'::uuid);
    PERFORM potok_nutrition.activate_generated_week_v2(v.generation_operation_id,
      '92720000-0000-4000-8000-000000000058'::uuid,NULL);
  EXCEPTION WHEN serialization_failure THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'stale safety was accepted'; END IF;

  v_failed:=false;
  BEGIN
    PERFORM potok_control.revoke_entitlement_v2(v.account_main,'premium',
      'graph-v2-rollback-only-v1/revoke','rollback-only denied activation');
    PERFORM potok_nutrition.activate_generated_week_v2(v.generation_operation_id,
      '92720000-0000-4000-8000-000000000059'::uuid,NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'revoked Premium activation was accepted'; END IF;
END
$stale_authority_failures$;

-- 18 Graph digest mismatch is rejected before a generation receipt is stored.
DO $graph_digest_mismatch$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_plan jsonb;
  v_failed boolean:=false;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_plan:=pg_catalog.jsonb_set(v.plan_snapshot,'{graphDigest}',pg_catalog.to_jsonb(repeat('f',64)));
  BEGIN
    PERFORM potok_nutrition.record_generated_week_v2(v.account_main,v.selection_id,
      '92720000-0000-4000-8000-000000000060'::uuid,v.input_canonical,
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_plan),'UTF8'));
  EXCEPTION WHEN invalid_parameter_value THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Graph digest mismatch was accepted'; END IF;
END
$graph_digest_mismatch$;

-- 19 a graph component absent from the published manifest is rejected on activation.
DO $missing_manifest_component$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_input jsonb;
  v_graph jsonb;
  v_graph_bytes bytea;
  v_plan_base jsonb;
  v_plan jsonb;
  v_failed boolean:=false;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_input:=pg_catalog.jsonb_set(v.input_snapshot,'{selection,proposedPlanRevision}',
    pg_catalog.to_jsonb('92720000-0000-4000-8000-000000000061'::uuid));
  v_input:=pg_catalog.jsonb_set(v_input,'{operation,requestId}',
    pg_catalog.to_jsonb('92720000-0000-4000-8000-000000000062'::uuid));
  v_graph:=pg_catalog.jsonb_set(v.plan_snapshot->'graph','{planRevision}',
    pg_catalog.to_jsonb('92720000-0000-4000-8000-000000000061'::uuid));
  v_graph:=pg_catalog.jsonb_set(v_graph,'{days,0,slots}',pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('mealSnapshot',pg_catalog.jsonb_build_object('components',
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'recipeId','92720000-0000-4000-8000-000000000099'::uuid,
        'recipeRevision','92720000-0000-4000-8000-000000000098'::uuid,
        'portionRevision','92720000-0000-4000-8000-000000000097'::uuid,
        'eligibility',pg_catalog.jsonb_build_object('eligibilityRevisionId',
          '92720000-0000-4000-8000-000000000096'::uuid),
        'recipe',pg_catalog.jsonb_build_object('fixture','missing')))))));
  v_graph_bytes:=pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(
    pg_catalog.jsonb_build_object('encoding','potok-adaptive-nutrition-graph-v2-canonical-json-v1',
      'contract','adaptive_nutrition_graph_v2','graph',v_graph)),'UTF8');
  v_plan_base:=(v.plan_snapshot-'deterministicContentDigest')||pg_catalog.jsonb_build_object(
    'proposedPlanRevision','92720000-0000-4000-8000-000000000061'::uuid,'graph',v_graph,
    'graphDigest',pg_catalog.encode(extensions.digest(v_graph_bytes,'sha256'),'hex'),
    'generationInputDigest',pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      potok_nutrition.canonical_jsonb_text_v1(pg_catalog.jsonb_build_object(
        'contract','potok-adaptive-trusted-generation-input-v1','input',v_input)),'UTF8'),'sha256'),'hex'));
  v_plan:=v_plan_base||pg_catalog.jsonb_build_object('deterministicContentDigest',
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      potok_nutrition.canonical_jsonb_text_v1(v_plan_base),'UTF8'),'sha256'),'hex'));
  BEGIN
    PERFORM potok_nutrition.record_generated_week_v2(v.account_main,v.selection_id,
      '92720000-0000-4000-8000-000000000063'::uuid,
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_input),'UTF8'),
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_plan),'UTF8'));
  EXCEPTION WHEN invalid_parameter_value THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'missing manifest component was accepted'; END IF;
END
$missing_manifest_component$;

-- 20 first valid activation and 12 exact activation replay.
DO $valid_activation_and_replay$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_first jsonb;
  v_replay jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_first:=potok_nutrition.activate_generated_week_v2(
    v.generation_operation_id,v.activation_key,NULL);
  v_replay:=potok_nutrition.activate_generated_week_v2(
    v.generation_operation_id,v.activation_key,NULL);
  IF v_first IS DISTINCT FROM v_replay OR v_first->>'outcome'<>'accepted'
     OR v_first->'event_ids' IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION 'activation/replay contract failed';
  END IF;
  UPDATE potok_graph_v2_acceptance_config
     SET activation_operation_id=(v_first->>'operation_id')::uuid;
END
$valid_activation_and_replay$;

-- 21 one-successor/predecessor schema relation; 22 synthetic Graph v1 remains unchanged.
DO $history_and_graph_v1_compatibility$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_graph public.adaptive_nutrition_graph_revisions%ROWTYPE;
  v_successor_revision uuid:='92720000-0000-4000-8000-000000000070'::uuid;
  v_generation_operation uuid:='92720000-0000-4000-8000-000000000071'::uuid;
  v_activation_operation uuid:='92720000-0000-4000-8000-000000000072'::uuid;
  v_bytes bytea;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  SELECT * INTO STRICT v_graph FROM public.adaptive_nutrition_graph_revisions
   WHERE user_id=v.account_main AND selection_id=v.selection_id AND plan_revision=v.plan_revision;

  INSERT INTO public.adaptive_nutrition_operations(user_id,idempotency_key,operation_id,selection_id,
    contract_version,action_type,canonical_request,digest_version,request_digest,outcome,
    result_references,committed_at,result_canonical,result_digest,result_plan_revision,result_graph_digest)
  VALUES(v.account_main,'92720000-0000-4000-8000-000000000071',v_generation_operation,v.selection_id,
    'adaptive-nutrition-v2','PLAN_GENERATED_V2',pg_catalog.convert_to('{}','UTF8'),'acceptance/sha256',
    extensions.digest(pg_catalog.convert_to('{}','UTF8'),'sha256'),'accepted','{}'::jsonb,
    pg_catalog.statement_timestamp(),pg_catalog.convert_to('{}','UTF8'),
    extensions.digest(pg_catalog.convert_to('{}','UTF8'),'sha256'),v_successor_revision,
    extensions.digest(pg_catalog.convert_to('{"successor":true}','UTF8'),'sha256'));
  INSERT INTO public.adaptive_nutrition_operations(user_id,idempotency_key,operation_id,selection_id,
    contract_version,action_type,canonical_request,digest_version,request_digest,outcome,
    result_references,committed_at,result_canonical,result_digest,result_plan_revision,result_graph_digest)
  VALUES(v.account_main,'92720000-0000-4000-8000-000000000072',v_activation_operation,v.selection_id,
    'adaptive-nutrition-v2','PLAN_ACTIVATED_V2',pg_catalog.convert_to('{}','UTF8'),'acceptance/sha256',
    extensions.digest(pg_catalog.convert_to('{}','UTF8'),'sha256'),'accepted','{}'::jsonb,
    pg_catalog.statement_timestamp(),pg_catalog.convert_to('{}','UTF8'),
    extensions.digest(pg_catalog.convert_to('{}','UTF8'),'sha256'),v_successor_revision,
    extensions.digest(pg_catalog.convert_to('{"successor":true}','UTF8'),'sha256'));
  v_bytes:=pg_catalog.convert_to('{"successor":true}','UTF8');
  INSERT INTO public.adaptive_nutrition_graph_revisions(
    user_id,selection_id,plan_revision,goal_revision,goal_snapshot,graph_snapshot,
    snapshot_encoding_version,content_digest,created_by_operation_id,graph_contract,
    graph_contract_version,graph_canonical_bytes,generated_week_plan_digest,generation_input_digest,
    target_policy_revision,preference_revision,safety_revision,candidate_manifest_revision,
    candidate_manifest_digest,composition_policy_revision,validation_policy_revision,
    optimization_policy_revision,generation_policy_revision,generation_operation_id,
    activation_operation_id,supersedes_plan_revision
  ) VALUES(v.account_main,v.selection_id,v_successor_revision,v_graph.goal_revision,v_graph.goal_snapshot,
    v_graph.graph_snapshot,'potok-adaptive-nutrition-graph-v2-canonical-json-v1',
    extensions.digest(v_bytes,'sha256'),v_activation_operation,'adaptive_nutrition_graph_v2',2,v_bytes,
    extensions.digest(v_bytes,'sha256'),extensions.digest(v_bytes,'sha256'),v_graph.target_policy_revision,
    v_graph.preference_revision,v_graph.safety_revision,v_graph.candidate_manifest_revision,
    v_graph.candidate_manifest_digest,v_graph.composition_policy_revision,v_graph.validation_policy_revision,
    v_graph.optimization_policy_revision,v_graph.generation_policy_revision,v_generation_operation,
    v_activation_operation,v.plan_revision);
  IF (SELECT supersedes_plan_revision FROM public.adaptive_nutrition_graph_revisions
       WHERE user_id=v.account_main AND selection_id=v.selection_id
         AND plan_revision=v_successor_revision)<>v.plan_revision THEN
    RAISE EXCEPTION 'Graph v2 predecessor relation was not preserved';
  END IF;

  INSERT INTO public.adaptive_nutrition_operations(user_id,idempotency_key,operation_id,selection_id,
    contract_version,action_type,canonical_request,digest_version,request_digest,outcome,
    result_references,committed_at)
  VALUES(v.account_other,'92720000-0000-4000-8000-000000000073',
    '92720000-0000-4000-8000-000000000073'::uuid,v.other_selection_id,
    'adaptive-nutrition-v1','PLAN_PROVISIONED',pg_catalog.convert_to('{}','UTF8'),'acceptance/sha256',
    extensions.digest(pg_catalog.convert_to('{}','UTF8'),'sha256'),'accepted','{}'::jsonb,
    pg_catalog.statement_timestamp());
  INSERT INTO public.adaptive_nutrition_graph_revisions(user_id,selection_id,plan_revision,
    goal_revision,goal_snapshot,graph_snapshot,snapshot_encoding_version,content_digest,
    created_by_operation_id)
  SELECT c.account_other,c.other_selection_id,'92720000-0000-4000-8000-000000000074'::uuid,
    g.goal_revision,'{}'::jsonb,'{"legacy":"graph-v1"}'::jsonb,'legacy-v1',
    extensions.digest(pg_catalog.convert_to('{"legacy":"graph-v1"}','UTF8'),'sha256'),
    '92720000-0000-4000-8000-000000000073'::uuid
    FROM potok_graph_v2_acceptance_config c JOIN public.user_goals g ON g.user_id=c.account_other;
  IF NOT EXISTS (SELECT 1 FROM public.adaptive_nutrition_graph_revisions g
    WHERE g.user_id=v.account_other AND g.graph_contract IS NULL AND g.graph_contract_version IS NULL
      AND g.graph_canonical_bytes IS NULL AND g.supersedes_plan_revision IS NULL
      AND g.graph_snapshot='{"legacy":"graph-v1"}'::jsonb) THEN
    RAISE EXCEPTION 'Graph v1 compatibility shape changed';
  END IF;
END
$history_and_graph_v1_compatibility$;

-- 23 no FACT/event/diary writes; 24 failed subtransactions left no fragments.
DO $final_atomicity_assertions$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  IF EXISTS (SELECT 1 FROM public.adaptive_nutrition_events e
              WHERE e.user_id IN(v.account_main,v.account_other))
     OR EXISTS (SELECT 1 FROM public.food_diary_entries d
                WHERE d.user_id IN(v.account_main,v.account_other))
     OR EXISTS (SELECT 1 FROM public.user_premium_meal_selections m
                JOIN public.user_premium_plan_selections s
                  ON s.id=m.user_premium_plan_selection_id
                WHERE s.user_id IN(v.account_main,v.account_other))
     OR EXISTS (SELECT 1 FROM potok_nutrition.validated_plan_replacement_offers_v1 o
                WHERE o.account_id IN(v.account_main,v.account_other)) THEN
    RAISE EXCEPTION 'activation created FACT/event/diary/meal/replacement side effects';
  END IF;
  IF EXISTS (SELECT 1 FROM public.adaptive_nutrition_operations o
    WHERE o.idempotency_key IN(
      '92720000-0000-4000-8000-000000000050',
      '92720000-0000-4000-8000-000000000054',
      '92720000-0000-4000-8000-000000000058',
      '92720000-0000-4000-8000-000000000059',
      '92720000-0000-4000-8000-000000000063',
      '92720000-0000-4000-8000-000000000064')) THEN
    RAISE EXCEPTION 'failed activation left an operation fragment';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions g
       WHERE g.user_id=v.account_main AND g.graph_contract='adaptive_nutrition_graph_v2')<>2
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
          WHERE o.user_id=v.account_main AND o.action_type='PLAN_ACTIVATED_V2'
            AND o.outcome='accepted')<>2
     OR (SELECT status FROM public.user_premium_plan_selections s
          WHERE s.user_id=v.account_main AND s.id=v.selection_id)<>'active' THEN
    RAISE EXCEPTION 'valid activation/history count differs or failure was not atomic';
  END IF;
END
$final_atomicity_assertions$;

-- 25 zero residue is proved by the separately executed SELECT-only postcheck after this rollback.
ROLLBACK;
