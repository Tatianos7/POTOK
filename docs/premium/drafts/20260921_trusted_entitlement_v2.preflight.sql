-- POTOK trusted entitlement v2 — STAGING READ-ONLY PREFLIGHT, NOT EXECUTED.
-- Target only: Supabase STAGING ozidryfvhkcbtpnulakq.
-- SELECT-only metadata/evidence. It performs no role, schema, data or policy mutation.

-- 0. Session identity. v2 apply requires both values to be postgres.
SELECT
  current_database() AS database_name,
  SESSION_USER AS session_user_name,
  CURRENT_USER AS current_user_name,
  (SESSION_USER = 'postgres' AND CURRENT_USER = 'postgres') AS owner_sql_session_ok;

-- 1. Full rollback verification expected before v2 apply.
SELECT
  pg_catalog.to_regnamespace('potok_control') AS potok_control_schema,
  pg_catalog.to_regclass('potok_control.access_attestations') AS attestation_table,
  pg_catalog.to_regrole('potok_entitlement_owner') AS v1_owner_role,
  pg_catalog.to_regrole('potok_access_provisioner') AS v1_provisioner_role,
  pg_catalog.to_regprocedure('public.has_verified_entitlement_v1(text)') AS public_v1_predicate,
  pg_catalog.to_regprocedure('public.has_verified_entitlement_v2(text)') AS public_v2_predicate;

-- 2. Required base ownership and columns; no profile values are returned.
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  c.relkind AS object_kind,
  pg_catalog.pg_get_userbyid(c.relowner) AS owner_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'user_profiles', 'premium_plans', 'premium_plan_days', 'premium_meal_slots',
    'premium_recipes', 'premium_recipe_ingredients', 'premium_recipe_steps',
    'premium_recipe_hints', 'premium_meal_recipe_options'
  )
ORDER BY c.relname;

SELECT
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'user_profiles'
  AND c.column_name IN (
    'user_id', 'first_name', 'last_name', 'middle_name', 'birth_date',
    'age', 'height', 'goal', 'email', 'phone', 'avatar_url',
    'has_premium', 'is_admin', 'premium_provenance_id',
    'premium_valid_until', 'admin_provenance_id', 'admin_valid_until'
  )
ORDER BY c.ordinal_position;

-- 3. Exact staging acceptance accounts: auth existence and profile-row count only.
WITH acceptance_accounts(account_id, acceptance_case) AS (
  VALUES
    ('d6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid, 'free_old_flag'),
    ('88c26f6b-ebc8-4bff-864d-9194fbd27f8d'::uuid, 'verified_premium'),
    ('8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid, 'verified_admin')
)
SELECT
  a.account_id,
  a.acceptance_case,
  EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.account_id) AS auth_user_exists,
  (SELECT pg_catalog.count(*) FROM public.user_profiles p WHERE p.user_id = a.account_id)
    AS profile_row_count
FROM acceptance_accounts a
ORDER BY a.acceptance_case;

-- 4. Existing policy/grant evidence relevant to compatibility. No definitions execute.
SELECT
  p.schemaname,
  p.tablename,
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check
FROM pg_catalog.pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN (
    'user_profiles', 'premium_plans', 'premium_plan_days', 'premium_meal_slots',
    'premium_recipes', 'premium_recipe_ingredients', 'premium_recipe_steps',
    'premium_recipe_hints', 'premium_meal_recipe_options'
  )
ORDER BY p.tablename, p.policyname;

SELECT
  g.table_schema,
  g.table_name,
  g.grantee,
  g.privilege_type,
  g.is_grantable
FROM information_schema.role_table_grants g
WHERE g.table_schema = 'public'
  AND g.table_name IN (
    'user_profiles', 'premium_plans', 'premium_plan_days', 'premium_meal_slots',
    'premium_recipes', 'premium_recipe_ingredients', 'premium_recipe_steps',
    'premium_recipe_hints', 'premium_meal_recipe_options'
  )
  AND g.grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role', CURRENT_USER)
ORDER BY g.table_name, g.grantee, g.privilege_type;

-- 5. Active-catalog existence needed by acceptance; no catalog rows are returned.
SELECT pg_catalog.count(*) AS active_premium_plan_count
FROM public.premium_plans p
WHERE p.is_active = true;
