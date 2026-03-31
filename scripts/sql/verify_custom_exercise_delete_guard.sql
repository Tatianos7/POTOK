-- 1. Delete policy for custom exercises
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
  and tablename = 'exercises'
  and policyname = 'Users can delete their custom exercises';

-- 2. Custom exercises that are referenced in workout_entries
select
  e.id,
  e.name,
  e.created_by_user_id,
  count(we.id) as workout_entry_count,
  min(wd.date) as first_used_date,
  max(wd.date) as last_used_date
from public.exercises e
join public.workout_entries we on we.exercise_id = e.id
join public.workout_days wd on wd.id = we.workout_day_id
where e.is_custom = true
group by e.id, e.name, e.created_by_user_id
order by last_used_date desc, e.name;

-- 3. Custom exercises safe to delete (not referenced)
select
  e.id,
  e.name,
  e.created_by_user_id,
  c.name as category
from public.exercises e
join public.exercise_categories c on c.id = e.category_id
left join public.workout_entries we on we.exercise_id = e.id
where e.is_custom = true
group by e.id, e.name, e.created_by_user_id, c.name
having count(we.id) = 0
order by e.name;
