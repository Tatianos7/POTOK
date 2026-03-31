-- 1. Policy presence for exercise_muscles
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'exercise_muscles'
order by policyname;

-- 2. Grants for authenticated role
select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'exercise_muscles'
order by grantee, privilege_type;

-- 3. Are there custom exercises with muscle links at all
select
  count(distinct e.id) as custom_exercises_with_links,
  count(*) as custom_exercise_muscle_links
from public.exercise_muscles em
join public.exercises e on e.id = em.exercise_id
where e.is_custom = true;

-- 4. Sample custom exercises with resolved muscles
select
  e.id,
  e.name,
  c.name as category,
  array_agg(distinct m.name order by m.name) as muscles
from public.exercises e
join public.exercise_categories c on c.id = e.category_id
join public.exercise_muscles em on em.exercise_id = e.id
join public.muscles m on m.id = em.muscle_id
where e.is_custom = true
group by e.id, e.name, c.name
order by e.name
limit 50;

-- 5. Custom exercises without muscle links after fix
select
  e.id,
  e.name,
  c.name as category,
  e.created_by_user_id
from public.exercises e
join public.exercise_categories c on c.id = e.category_id
left join public.exercise_muscles em on em.exercise_id = e.id
where e.is_custom = true
group by e.id, e.name, c.name, e.created_by_user_id
having count(em.muscle_id) = 0
order by e.name
limit 100;

-- 6. Exercises visible through direct read contract with muscles
select
  e.id,
  e.name,
  e.created_by_user_id,
  array_agg(distinct m.name order by m.name) filter (where m.name is not null) as muscles
from public.exercises e
left join public.exercise_muscles em on em.exercise_id = e.id
left join public.muscles m on m.id = em.muscle_id
where e.is_custom = true
group by e.id, e.name, e.created_by_user_id
order by e.name
limit 50;
