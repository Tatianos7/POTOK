-- ============================================================
-- Phase 7.2.2 Adaptation & Safety Layer (v1)
-- ============================================================

create table if not exists public.program_adaptations (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null,
  program_type text not null check (program_type in ('nutrition','training')),
  from_version integer not null,
  to_version integer not null,
  trigger text not null,
  summary jsonb,
  created_at timestamptz not null default now()
);

create index if not exists program_adaptations_program_idx
  on public.program_adaptations (program_id, program_type, created_at desc);

alter table public.program_adaptations enable row level security;

create policy "program_adaptations_owner"
  on public.program_adaptations
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

create table if not exists public.program_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null,
  date date not null,
  session_type text not null check (session_type in ('meal_plan','workout_plan')),
  plan_payload jsonb,
  status text not null default 'planned' check (status in ('planned','completed','skipped')),
  created_at timestamptz not null default now()
);

create index if not exists program_sessions_program_idx
  on public.program_sessions (program_id, date);

alter table public.program_sessions enable row level security;

create policy "program_sessions_owner"
  on public.program_sessions
  for all
  using (
    exists (
      select 1 from public.nutrition_programs np
      where np.id = program_id and np.user_id = auth.uid()
    ) or
    exists (
      select 1 from public.training_programs tp
      where tp.id = program_id and tp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.nutrition_programs np
      where np.id = program_id and np.user_id = auth.uid()
    ) or
    exists (
      select 1 from public.training_programs tp
      where tp.id = program_id and tp.user_id = auth.uid()
    )
  );
