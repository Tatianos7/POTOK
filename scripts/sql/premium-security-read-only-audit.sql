-- Metadata only; no application rows, purchase tokens, or credentials.
-- Run against the explicitly selected project using an existing secure channel.
-- This is NOT a migration and does not prove authenticated actor isolation.

select current_database() as database_name, current_user as audit_role,
       current_timestamp as inspected_at;

select n.nspname as schema_name, c.relname as relation_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
       c.relacl as explicit_acl
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
  and (c.relname in ('user_profiles', 'profiles', 'subscriptions', 'entitlements',
                    'billing_events', 'recipes', 'recipe_ingredients')
       or c.relname like 'premium\_%' escape '\')
order by c.relname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (tablename in ('user_profiles', 'profiles', 'subscriptions', 'entitlements',
                     'billing_events', 'recipes', 'recipe_ingredients')
       or tablename like 'premium\_%' escape '\')
order by tablename, policyname;

-- Column grants alone are insufficient: table-level UPDATE grants also apply.
select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('user_profiles', 'profiles', 'subscriptions', 'entitlements', 'billing_events')
order by table_name, grantee, privilege_type;

select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('user_profiles', 'profiles')
  and column_name in ('has_premium', 'is_admin')
order by table_name, column_name, grantee, privilege_type;

-- Include overloads, SECURITY DEFINER, search_path, ACL and actual scope checks.
select p.oid::regprocedure::text as signature, p.prosecdef as security_definer,
       p.proconfig as function_settings, p.proacl as explicit_acl,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_entitlements', 'get_paywall_state', 'start_purchase', 'restore_purchase')
order by signature;

-- Existing protective triggers must be inspected before concluding a field is writable.
select c.relname as table_name, t.tgname as trigger_name, t.tgenabled,
       pg_get_triggerdef(t.oid) as trigger_definition,
       pg_get_functiondef(t.tgfoid) as trigger_function
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal
  and c.relname in ('user_profiles', 'profiles', 'subscriptions', 'entitlements', 'billing_events')
order by table_name, trigger_name;
