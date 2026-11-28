BEGIN;
DO $guard$
BEGIN
  IF md5(pg_get_functiondef('public.adaptive_nutrition_read_graph_v2(uuid,uuid,text)'::regprocedure)) <> '0ef54cd2021763f7798d8cb3c913f781' THEN
    RAISE EXCEPTION 'GENERATION_READER_DEFINITION_CHANGED';
  END IF;
END
$guard$;
CREATE OR REPLACE FUNCTION public.adaptive_nutrition_read_graph_v2(p_selection_id uuid, p_plan_revision uuid DEFAULT NULL::uuid, p_graph_digest_hex text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_actor uuid:=auth.uid(); v_selection public.user_premium_plan_selections%ROWTYPE;
  v_graph public.adaptive_nutrition_graph_revisions%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RETURN pg_catalog.jsonb_build_object('kind','denied'); END IF;
  SELECT * INTO v_selection FROM public.user_premium_plan_selections
   WHERE user_id=v_actor AND id=p_selection_id;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('kind','not_found'); END IF;
  IF p_plan_revision IS NULL AND p_graph_digest_hex IS NULL THEN
    IF NOT potok_control.is_effective_entitlement_v2(v_actor,'premium',pg_catalog.statement_timestamp()) THEN
      RETURN pg_catalog.jsonb_build_object('kind','denied','reason','verified_premium_required');
    END IF;
    IF v_selection.status <> 'active' OR v_selection.plan_revision IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('kind','no_active_plan');
    END IF;
    SELECT * INTO v_graph FROM public.adaptive_nutrition_graph_revisions
     WHERE user_id=v_actor AND selection_id=p_selection_id AND plan_revision=v_selection.plan_revision
       AND graph_contract='adaptive_nutrition_graph_v2' AND graph_contract_version=2;
  ELSE
    SELECT * INTO v_graph FROM public.adaptive_nutrition_graph_revisions
     WHERE user_id=v_actor AND selection_id=p_selection_id
       AND graph_contract='adaptive_nutrition_graph_v2' AND graph_contract_version=2
       AND (p_plan_revision IS NULL OR plan_revision=p_plan_revision)
       AND (p_graph_digest_hex IS NULL OR content_digest=pg_catalog.decode(p_graph_digest_hex,'hex'));
  END IF;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('kind','not_found'); END IF;
  IF p_plan_revision IS NULL AND p_graph_digest_hex IS NULL
     AND v_graph.generation_operation_id IS NOT NULL
     AND NOT EXISTS (
       SELECT FROM potok_nutrition.nutrition_authority_heads_v1 h
       JOIN potok_nutrition.nutrition_preference_snapshots_v1 p
         ON p.account_id=h.account_id AND p.revision_id=h.current_preference_revision
       JOIN potok_nutrition.nutrition_safety_snapshots_v1 s
         ON s.account_id=h.account_id AND s.revision_id=h.current_safety_revision
       WHERE h.account_id=v_actor AND p.dietary_pattern='UNSPECIFIED'
         AND cardinality(p.excluded_meal_types)=0 AND cardinality(p.excluded_ingredient_ids)=0
         AND cardinality(p.excluded_recipe_ids)=0 AND cardinality(s.declared_allergen_codes)=0
         AND cardinality(s.declared_intolerance_codes)=0 AND cardinality(s.dietary_hard_exclusion_codes)=0
     ) THEN
    RETURN pg_catalog.jsonb_build_object('kind','no_active_plan');
  END IF;
  RETURN pg_catalog.jsonb_build_object('kind','ready','selection_id',v_graph.selection_id,
    'plan_revision',v_graph.plan_revision,'graph_contract',v_graph.graph_contract,
    'graph_contract_version',v_graph.graph_contract_version,
    'graph_digest_hex',pg_catalog.encode(v_graph.content_digest,'hex'),'graph',v_graph.graph_snapshot);
END
$function$;
COMMIT;
