-- ============================================================
-- Consistency helpers (Stage 1.5.2)
-- ============================================================

-- Toggle habit log atomically (insert or flip)
create or replace function public.toggle_habit_log(
  p_user_id uuid,
  p_habit_id uuid,
  p_date date
)
returns public.habit_logs
language plpgsql
security invoker
as $$
declare
  result public.habit_logs;
begin
  insert into public.habit_logs (user_id, habit_id, date, completed)
  values (p_user_id, p_habit_id, p_date, true)
  on conflict (habit_id, date)
  do update set completed = not public.habit_logs.completed
  returning * into result;

  return result;
end;
$$;
