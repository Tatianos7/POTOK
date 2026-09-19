-- DRAFT ONLY. NOT EXECUTED. No SQL execution is authorized in this session.
-- Metadata inspection for a separately approved staging contract audit.
-- No user recipes, ingredients, tokens or credentials are selected.

select p.oid::regprocedure::text as signature, p.prosecdef as security_definer,
       p.proconfig as settings, p.proacl as explicit_acl,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('replace_recipe_ingredients_atomic', 'recompute_recipe_totals',
                    'recipe_ingredients_recompute_trigger')
order by signature;

select table_name, column_name, data_type, is_nullable, column_default,
       numeric_precision, numeric_scale
from information_schema.columns
where table_schema = 'public' and table_name in ('recipes', 'recipe_ingredients')
order by table_name, ordinal_position;

-- Policies alone do not establish effective access; retain table RLS and grants.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced, c.relacl as explicit_acl
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('recipes', 'recipe_ingredients')
  and c.relkind in ('r', 'p')
order by table_name;

select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name in ('recipes', 'recipe_ingredients')
order by table_name, grantee, privilege_type;

select c.relname as table_name, con.conname, con.contype,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('recipes', 'recipe_ingredients')
order by table_name, con.conname;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('recipes', 'recipe_ingredients')
order by tablename, policyname;

select c.relname as table_name, t.tgname, t.tgenabled,
       pg_get_triggerdef(t.oid) as definition,
       pg_get_functiondef(t.tgfoid) as trigger_function
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal
  and c.relname in ('recipes', 'recipe_ingredients')
order by table_name, t.tgname;
