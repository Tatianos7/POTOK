-- ============================================================
-- Phase 7.2 Cleanup: program_sessions de-duplication
-- ============================================================

-- Remove duplicates by (program_id, date), keep latest by created_at
with ranked as (
  select id,
         row_number() over (
           partition by program_id, date
           order by created_at desc, id desc
         ) as rn
  from public.program_sessions
)
delete from public.program_sessions
where id in (
  select id from ranked where rn > 1
);

-- Enforce uniqueness going forward
create unique index if not exists program_sessions_program_date_unique
  on public.program_sessions (program_id, date);
