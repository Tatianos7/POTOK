-- ============================================================
-- Phase 7.2.3 Program Delivery & UX Layer (v1)
-- ============================================================

create table if not exists public.program_feedback (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null,
  program_type text not null check (program_type in ('nutrition','training')),
  program_session_id uuid references public.program_sessions (id) on delete set null,
  energy integer check (energy between 1 and 5),
  hunger integer check (hunger between 1 and 5),
  difficulty integer check (difficulty between 1 and 5),
  pain integer check (pain between 1 and 5),
  motivation integer check (motivation between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists program_feedback_program_idx
  on public.program_feedback (program_id, program_type, created_at desc);

alter table public.program_feedback enable row level security;

create policy "program_feedback_owner"
  on public.program_feedback
  for all
  using (
    (program_type = 'nutrition' and exists (
      select 1 from public.nutrition_programs np
      where np.id = program_id and np.user_id = auth.uid()
    )) or
    (program_type = 'training' and exists (
      select 1 from public.training_programs tp
      where tp.id = program_id and tp.user_id = auth.uid()
    ))
  )
  with check (
    (program_type = 'nutrition' and exists (
      select 1 from public.nutrition_programs np
      where np.id = program_id and np.user_id = auth.uid()
    )) or
    (program_type = 'training' and exists (
      select 1 from public.training_programs tp
      where tp.id = program_id and tp.user_id = auth.uid()
    ))
  );

create or replace function public.get_active_program(p_program_type text default null)
returns table (
  program_id uuid,
  program_type text,
  status text,
  program_version integer,
  start_date date,
  end_date date,
  knowledge_version_ref jsonb
)
language sql
security invoker
as $$
  select np.id, 'nutrition'::text, np.status, np.program_version, np.start_date, np.end_date, np.knowledge_version_ref
  from public.nutrition_programs np
  where np.user_id = auth.uid()
    and (p_program_type is null or p_program_type = 'nutrition')
  union all
  select tp.id, 'training'::text, tp.status, tp.program_version, tp.start_date, tp.end_date, tp.knowledge_version_ref
  from public.training_programs tp
  where tp.user_id = auth.uid()
    and (p_program_type is null or p_program_type = 'training');
$$;

create or replace function public.get_program_phases(p_program_id uuid)
returns table (
  id uuid,
  program_id uuid,
  program_type text,
  name text,
  phase_type text,
  phase_goal text,
  start_date date,
  end_date date
)
language sql
security invoker
as $$
  select id, program_id, program_type, name, phase_type, phase_goal, start_date, end_date
  from public.program_phases
  where program_id = p_program_id
  order by start_date asc;
$$;

create or replace function public.get_program_days(p_program_id uuid)
returns table (
  date date,
  block_id uuid,
  phase_id uuid,
  phase_type text,
  block_type text,
  targets jsonb,
  session_plan jsonb,
  session_status text,
  explainability_summary jsonb
)
language sql
security invoker
as $$
  with latest_explain as (
    select pe.program_id, pe.version, pe.decision_ref, pe.guard_notes
    from public.program_explainability pe
    join public.nutrition_programs np on np.id = pe.program_id
    where pe.program_id = p_program_id and pe.version = np.program_version
    union all
    select pe.program_id, pe.version, pe.decision_ref, pe.guard_notes
    from public.program_explainability pe
    join public.training_programs tp on tp.id = pe.program_id
    where pe.program_id = p_program_id and pe.version = tp.program_version
  ),
  latest_days as (
    select distinct on (pd.date) pd.*
    from public.program_days pd
    join public.program_blocks pb on pb.id = pd.block_id
    join public.program_phases pp on pp.id = pb.phase_id
    where pp.program_id = p_program_id
    order by pd.date asc, pd.created_at desc
  ),
  latest_sessions as (
    select distinct on (ps.date) ps.*
    from public.program_sessions ps
    where ps.program_id = p_program_id
    order by ps.date asc, ps.created_at desc
  )
  select ld.date,
         ld.block_id,
         pb.phase_id,
         pp.phase_type,
         pb.block_type,
         ld.targets,
         ld.session_plan,
         ls.status as session_status,
         jsonb_build_object('decision_ref', le.decision_ref, 'reason_code', le.guard_notes->>'reason_code') as explainability_summary
  from latest_days ld
  join public.program_blocks pb on pb.id = ld.block_id
  join public.program_phases pp on pp.id = pb.phase_id
  left join latest_sessions ls on ls.program_id = p_program_id and ls.date = ld.date
  left join latest_explain le on le.program_id = p_program_id
  order by ld.date asc;
$$;

create or replace function public.get_program_day_details(p_program_id uuid, p_date date)
returns jsonb
language sql
security invoker
as $$
  with day_row as (
    select pd.*, pb.block_type, pp.phase_type, pp.phase_goal
    from public.program_days pd
    join public.program_blocks pb on pb.id = pd.block_id
    join public.program_phases pp on pp.id = pb.phase_id
    where pp.program_id = p_program_id and pd.date = p_date
    order by pd.created_at desc
    limit 1
  ),
  session_row as (
    select ps.*
    from public.program_sessions ps
    where ps.program_id = p_program_id and ps.date = p_date
    order by ps.created_at desc
    limit 1
  ),
  explain_row as (
    select pe.*
    from public.program_explainability pe
    join public.nutrition_programs np on np.id = pe.program_id
    where pe.program_id = p_program_id and pe.version = np.program_version
    union all
    select pe.*
    from public.program_explainability pe
    join public.training_programs tp on tp.id = pe.program_id
    where pe.program_id = p_program_id and pe.version = tp.program_version
  )
  select jsonb_build_object(
    'day', (select to_jsonb(day_row) from day_row),
    'session', (select to_jsonb(session_row) from session_row),
    'explainability', (select jsonb_agg(to_jsonb(explain_row)) from explain_row)
  );
$$;

create or replace function public.get_program_explainability(p_program_id uuid, p_version integer default null)
returns setof public.program_explainability
language sql
security invoker
as $$
  select pe.*
  from public.program_explainability pe
  where pe.program_id = p_program_id
    and (p_version is null or pe.version = p_version)
  order by pe.created_at desc;
$$;

create or replace function public.get_program_status(p_program_id uuid)
returns jsonb
language sql
security invoker
as $$
  select jsonb_build_object(
    'status',
    case
      when np.status = 'paused' then 'paused'
      when np.status = 'completed' then 'completed'
      when np.status = 'draft' then 'planned'
      when exists (
        select 1 from public.program_guard_events pge
        where pge.program_id = np.id and pge.risk_level = 'danger'
        and pge.created_at > now() - interval '7 days'
      ) then 'blocked'
      else 'active'
    end
  )
  from public.nutrition_programs np
  where np.id = p_program_id
  union all
  select jsonb_build_object(
    'status',
    case
      when tp.status = 'paused' then 'paused'
      when tp.status = 'completed' then 'completed'
      when tp.status = 'draft' then 'planned'
      when exists (
        select 1 from public.program_guard_events pge
        where pge.program_id = tp.id and pge.risk_level = 'danger'
        and pge.created_at > now() - interval '7 days'
      ) then 'blocked'
      else 'active'
    end
  )
  from public.training_programs tp
  where tp.id = p_program_id;
$$;
