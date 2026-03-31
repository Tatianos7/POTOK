-- 1. Все пользовательские упражнения без muscle links
select
  e.id,
  e.name,
  c.name as category,
  e.created_by_user_id,
  e.created_at,
  e.updated_at
from public.exercises e
join public.exercise_categories c on c.id = e.category_id
left join public.exercise_muscles em on em.exercise_id = e.id
where e.is_custom = true
group by e.id, e.name, c.name, e.created_by_user_id, e.created_at, e.updated_at
having count(em.muscle_id) = 0
order by e.created_at desc, e.name;

-- 2. Сколько custom exercises вообще без links
select
  count(*) as custom_exercises_without_muscle_links
from (
  select e.id
  from public.exercises e
  left join public.exercise_muscles em on em.exercise_id = e.id
  where e.is_custom = true
  group by e.id
  having count(em.muscle_id) = 0
) t;

-- 3. Сколько custom exercises уже имеют links
select
  count(*) as custom_exercises_with_muscle_links
from (
  select e.id
  from public.exercises e
  join public.exercise_muscles em on em.exercise_id = e.id
  where e.is_custom = true
  group by e.id
) t;

-- 4. Примеры custom exercises с подтянутыми мышцами
select
  e.id,
  e.name,
  c.name as category,
  array_agg(distinct m.name order by m.name) filter (where m.name is not null) as muscles
from public.exercises e
join public.exercise_categories c on c.id = e.category_id
left join public.exercise_muscles em on em.exercise_id = e.id
left join public.muscles m on m.id = em.muscle_id
where e.is_custom = true
group by e.id, e.name, c.name
order by e.created_at desc, e.name
limit 100;

-- 5. Подозрительные исторические custom exercises:
-- есть в exercises, но без links и уже использовались в workout_entries
select
  e.id,
  e.name,
  e.created_by_user_id,
  min(wd.date) as first_used_date,
  max(wd.date) as last_used_date,
  count(we.id) as workout_entry_count
from public.exercises e
join public.workout_entries we on we.exercise_id = e.id
join public.workout_days wd on wd.id = we.workout_day_id
left join public.exercise_muscles em on em.exercise_id = e.id
where e.is_custom = true
group by e.id, e.name, e.created_by_user_id
having count(em.muscle_id) = 0
order by last_used_date desc, e.name;
