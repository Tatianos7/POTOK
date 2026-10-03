-- POTOK protected execution binding v1 — ROLLBACK-ONLY BEHAVIORAL ACCEPTANCE.
-- Target: Supabase STAGING ozidryfvhkcbtpnulakq only, after separately approved apply.
-- Synthetic identities and two previously verified empty Auth test accounts only.
-- No real manifest, recipe, FACT, diary or replacement effect survives final ROLLBACK.

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
  plan_revision uuid UNIQUE NULL,
  generation_key uuid UNIQUE NOT NULL,
  generation_operation_id uuid NULL,
  activation_key uuid UNIQUE NOT NULL,
  activation_operation_id uuid NULL,
  input_snapshot jsonb NULL,
  plan_snapshot jsonb NULL,
  input_canonical bytea NULL,
  plan_canonical bytea NULL,
  request_key uuid NULL,
  request_operation_id uuid NULL,
  request_response jsonb NULL,
  load_response jsonb NULL,
  valid_plan_canonical bytea NULL,
  exact_graph_digest text NULL
) ON COMMIT DROP;

INSERT INTO potok_graph_v2_acceptance_config (
  account_main, account_other, week_anchor, selection_id, other_selection_id,
  provision_operation_id, preference_revision, preference_revision_2,
  safety_revision, safety_revision_2, authority_head_revision,
  authority_head_revision_2, authority_head_revision_3, manifest_revision,
  manifest_head_revision, recipe_id, recipe_revision_id, portion_revision_id,
  eligibility_revision_id, generation_key, activation_key
) VALUES (
  'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
  '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid,
  pg_catalog.date_trunc('week', pg_catalog.statement_timestamp() AT TIME ZONE 'Europe/Moscow')::date,
  '93020000-0000-4000-8000-000000000001'::uuid,
  '93020000-0000-4000-8000-000000000002'::uuid,
  '93020000-0000-4000-8000-000000000003'::uuid,
  '93020000-0000-4000-8000-000000000010'::uuid,
  '93020000-0000-4000-8000-000000000011'::uuid,
  '93020000-0000-4000-8000-000000000012'::uuid,
  '93020000-0000-4000-8000-000000000013'::uuid,
  '93020000-0000-4000-8000-000000000014'::uuid,
  '93020000-0000-4000-8000-000000000015'::uuid,
  '93020000-0000-4000-8000-000000000016'::uuid,
  '93020000-0000-4000-8000-000000000020'::uuid,
  '93020000-0000-4000-8000-000000000021'::uuid,
  '93020000-0000-4000-8000-000000000030'::uuid,
  '93020000-0000-4000-8000-000000000031'::uuid,
  '93020000-0000-4000-8000-000000000032'::uuid,
  '93020000-0000-4000-8000-000000000033'::uuid,
  '93020000-0000-4000-8000-000000000041'::uuid,
  '93020000-0000-4000-8000-000000000042'::uuid
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
    UNION ALL SELECT 1 FROM potok_nutrition.adaptive_nutrition_goal_targets_v1 t
      WHERE t.account_id IN (v.account_main,v.account_other)
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
       '93020000-0000-4000-8000-000000000004'::uuid,
       '93020000-0000-4000-8000-000000000005'::uuid,
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
       g.goal_revision,'93020000-0000-4000-8000-000000000006'::uuid,
       '93020000-0000-4000-8000-000000000007'::uuid,'generated',
       '{"source":"graph-v2-rollback-only-v1"}'::jsonb
  FROM potok_graph_v2_acceptance_config c
  JOIN public.user_goals g ON g.user_id=c.account_other;

INSERT INTO public.adaptive_nutrition_operations(
  user_id,idempotency_key,operation_id,selection_id,contract_version,action_type,
  canonical_request,digest_version,request_digest,outcome,result_references,committed_at
)
SELECT c.account_main,'93020000-0000-4000-8000-000000000003',c.provision_operation_id,
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
    '93020000-0000-4000-8000-000000000017'::uuid);
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
    '93020000-0000-4000-8000-000000000018'::uuid);
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
    '93020000-0000-4000-8000-000000000019'::uuid);
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
    'publicationRevision','93020000-0000-4000-8000-000000000034'::uuid,
    'publicationStatus','PUBLISHED','canonicalEvidenceRevision','93020000-0000-4000-8000-000000000035'::uuid,
    'canonicalEvidenceDigest',repeat('1',64),'nutritionEvidenceRevision','93020000-0000-4000-8000-000000000036'::uuid,
    'nutritionEvidenceDigest',repeat('2',64),'allergenEvidenceRevision','93020000-0000-4000-8000-000000000037'::uuid,
    'dietaryEvidenceRevision','93020000-0000-4000-8000-000000000038'::uuid,
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
      'manifestRevision','93020000-0000-4000-8000-000000000022'::uuid,
      'supersedesManifestRevision',NULL,'publicationState','PUBLISHED',
      'publishedAt','2026-09-27T00:03:00.000Z','entries',pg_catalog.jsonb_build_array(v_entry,v_entry));
    PERFORM potok_nutrition.publish_candidate_manifest_v2(
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_manifest),'UTF8'),
      NULL,'93020000-0000-4000-8000-000000000023'::uuid,
      '93020000-0000-4000-8000-000000000024'::uuid);
  EXCEPTION WHEN unique_violation THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'duplicate manifest identity was accepted'; END IF;

  v_failed:=false;
  BEGIN
    v_manifest:=pg_catalog.jsonb_build_object('contract','potok-adaptive-candidate-manifest-v2',
      'encoding','potok-adaptive-candidate-manifest-v2-canonical-json-v1',
      'manifestRevision','93020000-0000-4000-8000-000000000025'::uuid,
      'supersedesManifestRevision',NULL,'publicationState','DRAFT','publishedAt',NULL,
      'entries',pg_catalog.jsonb_build_array(v_entry));
    PERFORM potok_nutrition.publish_candidate_manifest_v2(
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_manifest),'UTF8'),
      NULL,'93020000-0000-4000-8000-000000000026'::uuid,
      '93020000-0000-4000-8000-000000000027'::uuid);
  EXCEPTION WHEN OTHERS THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'unpublished manifest was accepted'; END IF;

  v_manifest:=pg_catalog.jsonb_build_object('contract','potok-adaptive-candidate-manifest-v2',
    'encoding','potok-adaptive-candidate-manifest-v2-canonical-json-v1',
    'manifestRevision',v.manifest_revision,'supersedesManifestRevision',NULL,
    'publicationState','PUBLISHED','publishedAt','2026-09-27T00:03:00.000Z',
    'entries',pg_catalog.jsonb_build_array(v_entry));
  PERFORM potok_nutrition.publish_candidate_manifest_v2(
    pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_manifest),'UTF8'),
    NULL,v.manifest_head_revision,'93020000-0000-4000-8000-000000000028'::uuid);
  IF (SELECT pg_catalog.count(*) FROM potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2 e
       WHERE e.manifest_revision=v.manifest_revision AND e.recipe_id=v.recipe_id
         AND e.recipe_revision_id=v.recipe_revision_id AND e.portion_revision_id=v.portion_revision_id
         AND e.eligibility_revision_id=v.eligibility_revision_id)<>1 THEN
    RAISE EXCEPTION 'published manifest membership projection differs';
  END IF;
END
$manifest_contract$;


-- Rollback-only policy authority fixture. The migration itself inserts no policy row.
INSERT INTO potok_nutrition.adaptive_nutrition_generation_policy_head_v2(
  singleton,target_policy_revision,composition_policy_revision,validation_policy_revision,
  optimization_policy_revision,generation_policy_revision,policy_head_revision,
  publication_state,published_at,publication_evidence
) VALUES (
  true,'93020000-0000-4000-8000-000000000043'::uuid,
  '93020000-0000-4000-8000-000000000044'::uuid,
  '93020000-0000-4000-8000-000000000045'::uuid,
  '93020000-0000-4000-8000-000000000046'::uuid,
  '93020000-0000-4000-8000-000000000047'::uuid,
  '93020000-0000-4000-8000-000000000048'::uuid,
  'PUBLISHED',pg_catalog.statement_timestamp(),'synthetic-protected-channel-rollback-only'
);

-- Rollback-only reviewed Goal-target fixture. The migration publishes no target
-- and the request boundary never derives hard corridors from mutable Goal fields.
DO $goal_target_fixture$
DECLARE
  v potok_graph_v2_acceptance_config%ROWTYPE;
  v_target jsonb;
  v_canonical bytea;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_target:=pg_catalog.jsonb_build_object(
    'contract','potok-adaptive-goal-nutrition-target-v1',
    'goalRevision',v.goal_revision,
    'targetPolicyRevision','93020000-0000-4000-8000-000000000043'::uuid,
    'calories',pg_catalog.jsonb_build_object(
      'target','2000.000','min','1500.000','max','2500.000'),
    'protein',NULL,'fat',NULL,'carbs',NULL,'fiber',NULL
  );
  v_canonical:=pg_catalog.convert_to(
    potok_nutrition.canonical_jsonb_text_v1(v_target),'UTF8');
  INSERT INTO potok_nutrition.adaptive_nutrition_goal_targets_v1(
    account_id,goal_revision,target_policy_revision,canonical_bytes,
    canonical_snapshot,canonical_digest,evidence_ref
  ) VALUES (
    v.account_main,v.goal_revision,'93020000-0000-4000-8000-000000000043'::uuid,
    v_canonical,v_target,extensions.digest(v_canonical,'sha256'),
    'synthetic-protected-channel-rollback-only'
  );
END
$goal_target_fixture$;

UPDATE potok_graph_v2_acceptance_config
   SET request_key='93020000-0000-4000-8000-000000000050'::uuid;
GRANT SELECT,UPDATE ON pg_temp.potok_graph_v2_acceptance_config TO authenticated,service_role;

-- 01 unauthenticated request denied.
SELECT pg_catalog.set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE authenticated;
DO $unauthenticated_request_denied$
DECLARE v_failed boolean:=false; v_message text;
BEGIN
  BEGIN
    PERFORM public.adaptive_nutrition_request_generation_v2(
      'potok-adaptive-generation-request-v2','93020000-0000-4000-8000-000000000051'::uuid);
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    v_failed:=v_message='AUTH_REQUIRED';
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'unauthenticated request was not denied'; END IF;
END
$unauthenticated_request_denied$;
RESET ROLE;

-- 01a authenticated malformed request is INVALID_REQUEST / 22023.
SELECT pg_catalog.set_config('request.jwt.claim.sub',account_other::text,true)
  FROM potok_graph_v2_acceptance_config;
SET LOCAL ROLE authenticated;
DO $authenticated_invalid_request$
DECLARE v_null_protocol boolean:=false; v_null_key boolean:=false; v_message text;
BEGIN
  BEGIN
    PERFORM public.adaptive_nutrition_request_generation_v2(
      NULL::text,'93020000-0000-4000-8000-000000000053'::uuid);
  EXCEPTION WHEN invalid_parameter_value THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    v_null_protocol:=v_message='INVALID_REQUEST';
  END;
  BEGIN
    PERFORM public.adaptive_nutrition_request_generation_v2(
      'potok-adaptive-generation-request-v2',NULL::uuid);
  EXCEPTION WHEN invalid_parameter_value THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    v_null_key:=v_message='INVALID_REQUEST';
  END;
  IF NOT v_null_protocol OR NOT v_null_key THEN
    RAISE EXCEPTION 'authenticated malformed request contract failed';
  END IF;
END
$authenticated_invalid_request$;
RESET ROLE;

-- 01b authenticated syntactically valid unsupported protocol is 22023.
SELECT pg_catalog.set_config('request.jwt.claim.sub',account_other::text,true)
  FROM potok_graph_v2_acceptance_config;
SET LOCAL ROLE authenticated;
DO $authenticated_unsupported_protocol$
DECLARE v_failed boolean:=false; v_message text;
BEGIN
  BEGIN
    PERFORM public.adaptive_nutrition_request_generation_v2(
      'potok-adaptive-generation-request-v3','93020000-0000-4000-8000-000000000054'::uuid);
  EXCEPTION WHEN invalid_parameter_value THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    v_failed:=v_message='UNSUPPORTED_PROTOCOL';
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'unsupported protocol contract failed'; END IF;
END
$authenticated_unsupported_protocol$;
RESET ROLE;

-- 02 Free user denied before any selection disclosure.
SELECT pg_catalog.set_config('request.jwt.claim.sub',account_other::text,true)
  FROM potok_graph_v2_acceptance_config;
SET LOCAL ROLE authenticated;
DO $free_user_denied$
DECLARE v_failed boolean:=false;
BEGIN
  BEGIN
    PERFORM public.adaptive_nutrition_request_generation_v2(
      'potok-adaptive-generation-request-v2','93020000-0000-4000-8000-000000000052'::uuid);
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Free request was not denied'; END IF;
END
$free_user_denied$;
RESET ROLE;

-- 03 Premium request accepted; 04 identity comes only from auth.uid; 05 exact replay.
SELECT pg_catalog.set_config('request.jwt.claim.sub',account_main::text,true)
  FROM potok_graph_v2_acceptance_config;
SET LOCAL ROLE authenticated;
UPDATE potok_graph_v2_acceptance_config
   SET request_response=public.adaptive_nutrition_request_generation_v2(
     'potok-adaptive-generation-request-v2',request_key);
UPDATE potok_graph_v2_acceptance_config
   SET request_operation_id=(request_response->>'requestOperationId')::uuid;
DO $premium_request_and_replay$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE; v_replay jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_replay:=public.adaptive_nutrition_request_generation_v2(
    'potok-adaptive-generation-request-v2',v.request_key);
  IF v.request_response->>'status'<>'REQUESTED' OR v_replay IS DISTINCT FROM v.request_response THEN
    RAISE EXCEPTION 'Premium request/replay contract failed';
  END IF;
END
$premium_request_and_replay$;
RESET ROLE;

-- 06 same key with changed protocol is an idempotency mismatch, not a rebase.
SELECT pg_catalog.set_config('request.jwt.claim.sub',account_main::text,true)
  FROM potok_graph_v2_acceptance_config;
SET LOCAL ROLE authenticated;
DO $changed_request_mismatch$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE; v_failed boolean:=false;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  BEGIN
    PERFORM public.adaptive_nutrition_request_generation_v2(
      'potok-adaptive-generation-request-v2-changed',v.request_key);
  EXCEPTION WHEN serialization_failure THEN
    v_failed:=SQLERRM LIKE '%IDEMPOTENCY_PAYLOAD_MISMATCH%';
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'changed request did not conflict'; END IF;
END
$changed_request_mismatch$;
RESET ROLE;

-- 07 service_role direct internal writer denied by ACL before body execution.
SET LOCAL ROLE service_role;
DO $direct_writer_denied$
DECLARE v_failed boolean:=false;
BEGIN
  BEGIN
    PERFORM potok_nutrition.record_generated_week_v2(NULL,NULL,NULL,NULL,NULL);
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'service_role directly reached internal writer'; END IF;
END
$direct_writer_denied$;
RESET ROLE;

-- 08 authenticated direct gateway denied.
SELECT pg_catalog.set_config('request.jwt.claim.sub',account_main::text,true)
  FROM potok_graph_v2_acceptance_config;
SET LOCAL ROLE authenticated;
DO $authenticated_gateway_denied$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE; v_failed boolean:=false;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  BEGIN PERFORM potok_nutrition.load_generation_request_v2(v.request_operation_id);
  EXCEPTION WHEN insufficient_privilege THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'authenticated directly reached service gateway'; END IF;
END
$authenticated_gateway_denied$;
RESET ROLE;

-- 10-14 stale Goal/preference/safety/manifest/digest checks fail closed and are rolled back.
DO $stale_authority_matrix$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE; v_result jsonb; v_marker text;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  BEGIN
    UPDATE public.user_goals SET calories=calories+1 WHERE user_id=v.account_main;
    v_result:=potok_nutrition.load_generation_request_v2(v.request_operation_id);
    IF v_result->>'status'<>'CONFLICT' THEN RAISE EXCEPTION 'stale Goal was not denied'; END IF;
    RAISE EXCEPTION 'rollback-stale-goal';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_marker=MESSAGE_TEXT;
    IF v_marker<>'rollback-stale-goal' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE potok_nutrition.nutrition_authority_heads_v1
       SET current_preference_revision=v.preference_revision
     WHERE account_id=v.account_main;
    v_result:=potok_nutrition.load_generation_request_v2(v.request_operation_id);
    IF v_result->>'status'<>'CONFLICT' THEN RAISE EXCEPTION 'stale preference was not denied'; END IF;
    RAISE EXCEPTION 'rollback-stale-preference';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_marker=MESSAGE_TEXT;
    IF v_marker<>'rollback-stale-preference' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE potok_nutrition.nutrition_authority_heads_v1
       SET current_safety_revision=v.safety_revision
     WHERE account_id=v.account_main;
    v_result:=potok_nutrition.load_generation_request_v2(v.request_operation_id);
    IF v_result->>'status'<>'CONFLICT' THEN RAISE EXCEPTION 'stale safety was not denied'; END IF;
    RAISE EXCEPTION 'rollback-stale-safety';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_marker=MESSAGE_TEXT;
    IF v_marker<>'rollback-stale-safety' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO potok_nutrition.adaptive_nutrition_candidate_manifests_v2(
      manifest_revision,supersedes_manifest_revision,publication_state,canonical_bytes,
      manifest_snapshot,canonical_digest,published_at,publication_operation_id,published_by_role
    )
    SELECT '93020000-0000-4000-8000-000000000099'::uuid,m.manifest_revision,
           m.publication_state,m.canonical_bytes,m.manifest_snapshot,m.canonical_digest,
           pg_catalog.statement_timestamp(),'93020000-0000-4000-8000-000000000096'::uuid,
           SESSION_USER::name
      FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2 m
     WHERE m.manifest_revision=v.manifest_revision;
    UPDATE potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2
       SET current_manifest_revision='93020000-0000-4000-8000-000000000099'::uuid
     WHERE singleton;
    v_result:=potok_nutrition.load_generation_request_v2(v.request_operation_id);
    IF v_result->>'status'<>'CONFLICT' THEN RAISE EXCEPTION 'stale manifest was not denied'; END IF;
    RAISE EXCEPTION 'rollback-stale-manifest';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_marker=MESSAGE_TEXT;
    IF v_marker<>'rollback-stale-manifest' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE potok_nutrition.adaptive_nutrition_generation_policy_head_v2
       SET validation_policy_revision='93020000-0000-4000-8000-000000000098'::uuid
     WHERE singleton;
    v_result:=potok_nutrition.load_generation_request_v2(v.request_operation_id);
    IF v_result->>'status'<>'CONFLICT' THEN RAISE EXCEPTION 'stale policy was not denied'; END IF;
    RAISE EXCEPTION 'rollback-stale-policy';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_marker=MESSAGE_TEXT;
    IF v_marker<>'rollback-stale-policy' THEN RAISE; END IF;
  END;
END
$stale_authority_matrix$;

-- 09 narrow service gateway allowed; 26 repeated worker load reuses one attempt identity.
SET LOCAL ROLE service_role;
UPDATE potok_graph_v2_acceptance_config
   SET load_response=potok_nutrition.load_generation_request_v2(request_operation_id);
DO $gateway_and_worker_race$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE; v_second jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_second:=potok_nutrition.load_generation_request_v2(v.request_operation_id);
  IF v.load_response->>'status'<>'GENERATING'
     OR v_second->>'attemptOperationId'<>v.load_response->>'attemptOperationId'
     OR v_second->>'generationInputCanonicalHex'<>v.load_response->>'generationInputCanonicalHex' THEN
    RAISE EXCEPTION 'narrow gateway/two-worker replay contract failed';
  END IF;
END
$gateway_and_worker_race$;
RESET ROLE;

-- Build a deterministic synthetic empty-slot plan from server-loaded trusted input.
DO $build_channel_plan$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE; v_input jsonb; v_graph jsonb;
  v_graph_bytes bytea; v_graph_digest text; v_base jsonb; v_plan jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_input:=pg_catalog.convert_from(pg_catalog.decode(
    v.load_response->>'generationInputCanonicalHex','hex'),'UTF8')::jsonb;
  SELECT pg_catalog.jsonb_build_object(
    'contract','adaptive_nutrition_graph_v2','contractVersion',2,
    'selectionId',v_input#>'{selection,selectionId}',
    'planSelectionRevision',v_input#>'{selection,planSelectionRevision}',
    'planRevision',v_input#>'{selection,proposedPlanRevision}',
    'weekStartLocal',v_input->'weekStartLocal','timezone',v_input->'timezone',
    'goalRevision',v_input#>'{goalNutritionTarget,goalRevision}',
    'targetPolicyRevision',v_input#>'{goalNutritionTarget,targetPolicyRevision}',
    'goalNutritionTarget',v_input->'goalNutritionTarget',
    'preferenceRevision',v_input->'preferenceRevision','safetyRevision',v_input->'safetyRevision',
    'catalogManifestRevision',v_input->'candidateManifestRevision',
    'candidateManifestDigest',v_input->'candidateManifestDigest',
    'compositionPolicyRevision',v_input->'compositionPolicyRevision',
    'validationPolicyRevision',v_input->'validationPolicyRevision',
    'optimizationPolicyRevision',v_input->'optimizationPolicyRevision',
    'generationPolicyRevision',v_input->'generationPolicyRevision',
    'days',pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'date',((v_input->>'weekStartLocal')::date+x)::date,'dayIndex',x,'slots','[]'::jsonb,
      'nutritionTotal',pg_catalog.jsonb_build_object('calories','0.000','protein','0.000',
        'fat','0.000','carbs','0.000','fiber','0.000'),
      'validationResultDigest',repeat('3',64)) ORDER BY x),
    'weekValidationResultDigest',repeat('4',64),'weekOptimizationResultDigest',repeat('5',64))
    INTO v_graph FROM pg_catalog.generate_series(0,6) x;
  v_graph_bytes:=pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(
    pg_catalog.jsonb_build_object('encoding','potok-adaptive-nutrition-graph-v2-canonical-json-v1',
      'contract','adaptive_nutrition_graph_v2','graph',v_graph)),'UTF8');
  v_graph_digest:=pg_catalog.encode(extensions.digest(v_graph_bytes,'sha256'),'hex');
  v_base:=pg_catalog.jsonb_build_object(
    'contract','potok-adaptive-generated-week-plan-v1','accountId',v_input->'accountId',
    'selectionId',v_input#>'{selection,selectionId}',
    'planSelectionRevision',v_input#>'{selection,planSelectionRevision}',
    'weekStartLocal',v_input->'weekStartLocal','timezone',v_input->'timezone',
    'generationInputDigest',pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      potok_nutrition.canonical_jsonb_text_v1(pg_catalog.jsonb_build_object(
        'contract','potok-adaptive-trusted-generation-input-v1','input',v_input)),'UTF8'),'sha256'),'hex'),
    'generationPolicyRevision',v_input->'generationPolicyRevision',
    'candidateManifestDigest',v_input->'candidateManifestDigest',
    'goalRevision',v_input#>'{goalNutritionTarget,goalRevision}',
    'targetPolicyRevision',v_input#>'{goalNutritionTarget,targetPolicyRevision}',
    'proposedPlanRevision',v_input#>'{selection,proposedPlanRevision}',
    'graph',v_graph,'graphDigest',v_graph_digest,'generatedAt',NULL,'facts','[]'::jsonb);
  v_plan:=v_base||pg_catalog.jsonb_build_object('deterministicContentDigest',
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      potok_nutrition.canonical_jsonb_text_v1(v_base),'UTF8'),'sha256'),'hex'));
  UPDATE potok_graph_v2_acceptance_config SET valid_plan_canonical=pg_catalog.convert_to(
    potok_nutrition.canonical_jsonb_text_v1(v_plan),'UTF8');
END
$build_channel_plan$;

-- 15 malformed output, 16 invalid candidate, 17 graph/manifest digest mismatch all reject atomically.
DO $invalid_generator_matrix$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE; v_result jsonb; v_plan jsonb; v_base jsonb;
  v_graph jsonb; v_graph_bytes bytea; v_marker text;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  BEGIN
    v_result:=potok_nutrition.record_generated_week_gateway_v2(
      v.request_operation_id,pg_catalog.convert_to('{}','UTF8'));
    IF v_result->>'status'<>'REJECTED' THEN RAISE EXCEPTION 'invalid generator output was not rejected'; END IF;
    RAISE EXCEPTION 'rollback-invalid-output';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_marker=MESSAGE_TEXT;
    IF v_marker<>'rollback-invalid-output' THEN RAISE; END IF;
  END;
  v_plan:=pg_catalog.convert_from(v.valid_plan_canonical,'UTF8')::jsonb;
  BEGIN
    v_base:=(v_plan-'deterministicContentDigest')||pg_catalog.jsonb_build_object(
      'candidateManifestDigest',repeat('0',64));
    v_plan:=v_base||pg_catalog.jsonb_build_object('deterministicContentDigest',
      pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
        potok_nutrition.canonical_jsonb_text_v1(v_base),'UTF8'),'sha256'),'hex'));
    v_result:=potok_nutrition.record_generated_week_gateway_v2(v.request_operation_id,
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_plan),'UTF8'));
    IF v_result->>'status'<>'REJECTED' THEN RAISE EXCEPTION 'manifest digest mismatch was not rejected'; END IF;
    RAISE EXCEPTION 'rollback-manifest-digest';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_marker=MESSAGE_TEXT;
    IF v_marker<>'rollback-manifest-digest' THEN RAISE; END IF;
  END;
  v_plan:=pg_catalog.convert_from(v.valid_plan_canonical,'UTF8')::jsonb;
  BEGIN
    v_plan:=pg_catalog.jsonb_set(v_plan,'{graphDigest}',pg_catalog.to_jsonb(repeat('0',64)));
    v_result:=potok_nutrition.record_generated_week_gateway_v2(v.request_operation_id,
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_plan),'UTF8'));
    IF v_result->>'status'<>'REJECTED' THEN RAISE EXCEPTION 'Graph digest mismatch was not rejected'; END IF;
    RAISE EXCEPTION 'rollback-graph-digest';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_marker=MESSAGE_TEXT;
    IF v_marker<>'rollback-graph-digest' THEN RAISE; END IF;
  END;
  v_plan:=pg_catalog.convert_from(v.valid_plan_canonical,'UTF8')::jsonb;
  BEGIN
    v_graph:=pg_catalog.jsonb_set(v_plan->'graph','{days,0,slots}',pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('mealSnapshot',pg_catalog.jsonb_build_object('components',
        pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'recipeId','93020000-0000-4000-8000-000000000090'::uuid,
          'recipeRevision','93020000-0000-4000-8000-000000000091'::uuid,
          'portionRevision','93020000-0000-4000-8000-000000000092'::uuid,
          'eligibility',pg_catalog.jsonb_build_object(
            'eligibilityRevisionId','93020000-0000-4000-8000-000000000093'::uuid),
          'recipe',pg_catalog.jsonb_build_object('fixture','not-in-manifest')))))));
    v_graph_bytes:=pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(
      pg_catalog.jsonb_build_object('encoding','potok-adaptive-nutrition-graph-v2-canonical-json-v1',
        'contract','adaptive_nutrition_graph_v2','graph',v_graph)),'UTF8');
    v_base:=(v_plan-'deterministicContentDigest')||pg_catalog.jsonb_build_object(
      'graph',v_graph,'graphDigest',pg_catalog.encode(extensions.digest(v_graph_bytes,'sha256'),'hex'));
    v_plan:=v_base||pg_catalog.jsonb_build_object('deterministicContentDigest',
      pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
        potok_nutrition.canonical_jsonb_text_v1(v_base),'UTF8'),'sha256'),'hex'));
    v_result:=potok_nutrition.record_generated_week_gateway_v2(v.request_operation_id,
      pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_plan),'UTF8'));
    IF v_result->>'status'<>'REJECTED' THEN RAISE EXCEPTION 'invalid candidate was not rejected'; END IF;
    RAISE EXCEPTION 'rollback-invalid-candidate';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_marker=MESSAGE_TEXT;
    IF v_marker<>'rollback-invalid-candidate' THEN RAISE; END IF;
  END;
END
$invalid_generator_matrix$;

-- 18 record success, 19 exact record replay, 20 crash-after-record resume.
SET LOCAL ROLE service_role;
DO $record_and_resume$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE; v_first jsonb; v_replay jsonb; v_resume jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_first:=potok_nutrition.record_generated_week_gateway_v2(
    v.request_operation_id,v.valid_plan_canonical);
  v_replay:=potok_nutrition.record_generated_week_gateway_v2(
    v.request_operation_id,v.valid_plan_canonical);
  v_resume:=potok_nutrition.load_generation_request_v2(v.request_operation_id);
  IF v_first->>'status'<>'GENERATED' OR v_replay IS DISTINCT FROM v_first
     OR v_resume->>'status'<>'GENERATED' THEN
    RAISE EXCEPTION 'record/replay/crash-after-record resume failed';
  END IF;
END
$record_and_resume$;
RESET ROLE;

-- 23 CAS loss and 24 entitlement expiry before activation fail without partial graph/head.
DO $activation_failure_matrix$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE; v_result jsonb; v_marker text;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  BEGIN
    UPDATE public.user_premium_plan_selections SET status='archived'
     WHERE user_id=v.account_main AND id=v.selection_id;
    v_result:=potok_nutrition.activate_generated_week_gateway_v2(v.request_operation_id);
    IF v_result->>'status'<>'CONFLICT' THEN RAISE EXCEPTION 'CAS loss was not rejected'; END IF;
    IF EXISTS(SELECT 1 FROM public.adaptive_nutrition_graph_revisions
               WHERE user_id=v.account_main AND selection_id=v.selection_id) THEN
      RAISE EXCEPTION 'CAS loss left a partial graph';
    END IF;
    RAISE EXCEPTION 'rollback-cas-loss';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_marker=MESSAGE_TEXT;
    IF v_marker<>'rollback-cas-loss' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM potok_control.revoke_entitlement_v2(v.account_main,'premium',
      'protected-channel-rollback-only/revoke','expiry/revoke before activation');
    v_result:=potok_nutrition.activate_generated_week_gateway_v2(v.request_operation_id);
    IF v_result->>'status'<>'REJECTED' THEN RAISE EXCEPTION 'entitlement loss did not deny activation'; END IF;
    IF EXISTS(SELECT 1 FROM public.adaptive_nutrition_graph_revisions
               WHERE user_id=v.account_main AND selection_id=v.selection_id) THEN
      RAISE EXCEPTION 'entitlement loss left a partial graph';
    END IF;
    RAISE EXCEPTION 'rollback-entitlement-loss';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_marker=MESSAGE_TEXT;
    IF v_marker<>'rollback-entitlement-loss' THEN RAISE; END IF;
  END;
END
$activation_failure_matrix$;

-- 21 activation success, 22 activation replay.
SET LOCAL ROLE service_role;
DO $activation_success_replay$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE; v_first jsonb; v_replay jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_first:=potok_nutrition.activate_generated_week_gateway_v2(v.request_operation_id);
  v_replay:=potok_nutrition.activate_generated_week_gateway_v2(v.request_operation_id);
  IF v_first->>'status'<>'ACTIVE' OR v_replay IS DISTINCT FROM v_first THEN
    RAISE EXCEPTION 'activation/replay contract failed';
  END IF;
END
$activation_success_replay$;
RESET ROLE;

-- Bind the exact activated revision/digest under the postgres owner session.
-- Application actors must prove the public reader contract without direct table access.
DO $bind_exact_graph_read_evidence$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE;
  v_plan jsonb; v_plan_revision uuid; v_expected_plan_revision uuid;
  v_graph_digest text; v_recomputed_graph_digest text;
  v_graph_canonical_bytes bytea; v_recomputed_graph_canonical_bytes bytea;
BEGIN
  IF CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner session required for internal acceptance evidence'
      USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  SELECT s.plan_revision,pg_catalog.encode(g.content_digest,'hex'),g.graph_canonical_bytes
    INTO STRICT v_plan_revision,v_graph_digest,v_graph_canonical_bytes
    FROM public.user_premium_plan_selections s
    JOIN public.adaptive_nutrition_graph_revisions g
      ON g.user_id=s.user_id AND g.selection_id=s.id AND g.plan_revision=s.plan_revision
   WHERE s.user_id=v.account_main AND s.id=v.selection_id;
  v_plan:=pg_catalog.convert_from(v.valid_plan_canonical,'UTF8')::jsonb;
  v_expected_plan_revision:=(v_plan->>'proposedPlanRevision')::uuid;
  v_recomputed_graph_canonical_bytes:=pg_catalog.convert_to(
    potok_nutrition.canonical_jsonb_text_v1(pg_catalog.jsonb_build_object(
      'encoding','potok-adaptive-nutrition-graph-v2-canonical-json-v1',
      'contract','adaptive_nutrition_graph_v2','graph',v_plan->'graph')),'UTF8');
  v_recomputed_graph_digest:=pg_catalog.encode(
    extensions.digest(v_recomputed_graph_canonical_bytes,'sha256'),'hex');
  IF v_plan_revision IS DISTINCT FROM v_expected_plan_revision
     OR v_plan#>>'{graph,planRevision}' IS DISTINCT FROM v_expected_plan_revision::text THEN
    RAISE EXCEPTION 'activated plan revision does not match the server proposal';
  END IF;
  IF v_graph_canonical_bytes IS DISTINCT FROM v_recomputed_graph_canonical_bytes
     OR v_graph_digest IS DISTINCT FROM pg_catalog.encode(
       extensions.digest(v_graph_canonical_bytes,'sha256'),'hex')
     OR v_graph_digest IS DISTINCT FROM v_recomputed_graph_digest
     OR v_plan->>'graphDigest' IS DISTINCT FROM v_recomputed_graph_digest THEN
    RAISE EXCEPTION 'persisted Graph digest domain does not match the canonical Graph envelope';
  END IF;
  UPDATE potok_graph_v2_acceptance_config
     SET plan_revision=v_plan_revision,exact_graph_digest=v_graph_digest;
END
$bind_exact_graph_read_evidence$;

-- 25 crash-after-activation exact status/read, 27 account isolation, 29/30 Graph v1/v2 compatibility.
SELECT pg_catalog.set_config('request.jwt.claim.sub',account_main::text,true)
  FROM potok_graph_v2_acceptance_config;
SET LOCAL ROLE authenticated;
DO $exact_status_and_reads$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE; v_status jsonb; v_read jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  v_status:=public.adaptive_nutrition_generation_status_v2(v.request_operation_id);
  v_read:=public.adaptive_nutrition_read_graph_v2(
    v.selection_id,v.plan_revision,v.exact_graph_digest);
  IF v.exact_graph_digest IS NULL
     OR v_status->>'status' IS DISTINCT FROM 'ACTIVE'
     OR v_read->>'kind' IS DISTINCT FROM 'ready'
     OR v_read->>'plan_revision' IS DISTINCT FROM v.plan_revision::text
     OR v_read->>'graph_digest_hex' IS DISTINCT FROM v.exact_graph_digest THEN
    RAISE EXCEPTION 'crash-after-activation lookup/exact Graph v2 read failed';
  END IF;
END
$exact_status_and_reads$;
RESET ROLE;

SELECT pg_catalog.set_config('request.jwt.claim.sub',account_other::text,true)
  FROM potok_graph_v2_acceptance_config;
SET LOCAL ROLE authenticated;
DO $account_isolation$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE; v_failed boolean:=false;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  BEGIN PERFORM public.adaptive_nutrition_generation_status_v2(v.request_operation_id);
  EXCEPTION WHEN no_data_found THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'foreign account read leaked request state'; END IF;
END
$account_isolation$;
RESET ROLE;

DO $final_owner_assertions$
DECLARE v potok_graph_v2_acceptance_config%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v FROM potok_graph_v2_acceptance_config;
  IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_proc p
       JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname='adaptive_nutrition_read_v1'
         AND pg_catalog.pg_get_functiondef(p.oid) LIKE '%adaptive_nutrition_graph_revisions%'
         AND pg_catalog.pg_get_functiondef(p.oid) LIKE '%user_premium_plan_selections%')<>1
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_read_graph_v2(uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Graph v1/v2 read compatibility failed';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions
       WHERE user_id=v.account_main AND selection_id=v.selection_id)<>1
     OR EXISTS(SELECT 1 FROM public.adaptive_nutrition_events
                WHERE user_id=v.account_main AND selection_id=v.selection_id)
     OR EXISTS(SELECT 1 FROM public.food_diary_entries WHERE user_id=v.account_main)
     OR EXISTS(SELECT 1 FROM public.user_premium_meal_selections
                WHERE user_premium_plan_selection_id=v.selection_id)
     OR EXISTS(SELECT 1 FROM potok_nutrition.validated_plan_replacement_offers_v1
                WHERE account_id=v.account_main) THEN
    RAISE EXCEPTION 'PLAN-only channel wrote forbidden FACT/diary/event/replacement state';
  END IF;
  IF EXISTS(SELECT 1 FROM public.adaptive_nutrition_operations o
             WHERE o.user_id=v.account_main AND o.action_type='GENERATION_REQUESTED_V2'
               AND o.outcome<>'accepted')
     OR NOT EXISTS(SELECT 1 FROM public.adaptive_nutrition_operations o
                    WHERE o.user_id=v.account_main AND o.action_type='GENERATION_ATTEMPTED_V2'
                      AND o.outcome='accepted') THEN
    RAISE EXCEPTION 'request/attempt ledger settlement failed';
  END IF;
END
$final_owner_assertions$;

-- 28 mandatory rollback; separate SELECT-only postcheck proves zero fixture residue.
ROLLBACK;
