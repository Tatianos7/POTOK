-- REVIEW ONLY. Server-side nutrition target calculation; never use client-supplied macros.
-- This is a pure calculation building block, NOT a completed adaptation command.
-- Requires verified goal/plan data and owner/entitlement checks in its calling RPC.
BEGIN;
CREATE OR REPLACE FUNCTION public.potok_nutrition_adaptation_targets_v1(
 p_calories numeric,p_protein numeric,p_fat numeric,p_carbs numeric,
 p_confidence numeric,p_adjustment numeric,p_refeed boolean
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path TO 'pg_catalog'
AS $potok_targets$
DECLARE
 factor numeric;
BEGIN
 IF p_calories NOT BETWEEN 500 AND 10000 OR
    p_protein NOT BETWEEN 0 AND 1000 OR
    p_fat NOT BETWEEN 0 AND 1000 OR
    p_carbs NOT BETWEEN 0 AND 2000 OR
    p_confidence NOT BETWEEN 0 AND 1 OR
    p_adjustment NOT BETWEEN 0.5 AND 1.1 THEN
   RAISE EXCEPTION 'invalid nutrition adaptation input' USING ERRCODE='22023';
 END IF;
 factor := (CASE WHEN p_confidence < 0.75 THEN 0.9 ELSE 1 END)*p_adjustment;
 RETURN jsonb_build_object(
  'calories',round(p_calories*factor),
  'protein',round(p_protein*factor),
  'fat',round(p_fat*factor),
  'carbs',round(p_carbs*factor*(CASE WHEN p_refeed THEN 1.1 ELSE 1 END))
 );
END $potok_targets$;
REVOKE ALL ON FUNCTION public.potok_nutrition_adaptation_targets_v1(numeric,numeric,numeric,numeric,numeric,numeric,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.potok_nutrition_adaptation_targets_v1(numeric,numeric,numeric,numeric,numeric,numeric,boolean) TO service_role;
ROLLBACK;
