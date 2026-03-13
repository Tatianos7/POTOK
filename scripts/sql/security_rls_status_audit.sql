-- security RLS status audit
-- Read-only

with target_tables as (
  select unnest(array[
    'habits',
    'user_goals',
    'habit_logs',
    'analytics_events',
    'user_profiles',
    'foods',
    'favorite_products',
    'food_diary_entries',
    'meal_entry_notes',
    'recipes',
    'recipe_ingredients'
  ])::text as table_name
), rels as (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
)
select
  t.table_name,
  coalesce(r.rls_enabled, false) as rls_enabled,
  coalesce(r.rls_forced, false) as rls_forced,
  count(p.policyname) as policy_count,
  coalesce(array_agg(distinct p.policyname order by p.policyname) filter (where p.policyname is not null), array[]::text[]) as policies
from target_tables t
left join rels r
  on r.table_name = t.table_name
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = t.table_name
group by t.table_name, r.rls_enabled, r.rls_forced
order by t.table_name;
