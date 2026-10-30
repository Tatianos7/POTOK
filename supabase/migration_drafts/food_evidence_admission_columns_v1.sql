-- INACTIVE STAGING DRAFT. Schema support only, not catalog approval/publication.
-- NULL means unreviewed/unknown. No default, backfill, grant or policy change.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $preflight$
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN
  RAISE EXCEPTION 'FOOD_ADMISSION_SQL_OWNER_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF current_setting('potok_food_evidence.admission_columns_target',true)
    IS DISTINCT FROM 'staging:ozidryfvhkcbtpnulakq' THEN
  RAISE EXCEPTION 'FOOD_ADMISSION_STAGING_TARGET_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF to_regclass('public.foods') IS NULL THEN
  RAISE EXCEPTION 'FOOD_ADMISSION_BASE_SCHEMA_REQUIRED';
 END IF;
 -- Serialize metadata review and both additions; concurrent drift cannot be skipped.
 LOCK TABLE public.foods IN ACCESS EXCLUSIVE MODE;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.foods'::regclass
   AND relkind='r' AND pg_get_userbyid(relowner)=current_user) THEN
  RAISE EXCEPTION 'FOOD_ADMISSION_BASE_OWNER_REQUIRED';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.foods'::regclass
   AND attnum>0 AND NOT attisdropped AND attname IN('is_searchable','needs_review')) THEN
  RAISE EXCEPTION 'FOOD_ADMISSION_EXISTING_COLUMNS_REQUIRE_REVIEW';
 END IF;
 IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.foods'::regclass
   AND attnum>0 AND NOT attisdropped AND attname IN('id','canonical_food_id','stable_food_id',
    'source','created_by_user_id','name','name_original','normalized_name','brand',
    'normalized_brand','barcode','aliases'))<>12 THEN
  RAISE EXCEPTION 'FOOD_ADMISSION_BASE_SCHEMA_REQUIRED';
 END IF;
END $preflight$;
ALTER TABLE public.foods ADD COLUMN is_searchable boolean, ADD COLUMN needs_review boolean;
COMMIT;
