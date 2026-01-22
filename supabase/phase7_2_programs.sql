-- ============================================================
-- Phase 7.2 Programs: Nutrition + Training Programs (v1)
-- ============================================================

create table if not exists public.nutrition_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid references public.user_goals (user_id) on delete set null,
  status text not null default 'draft' check (status in ('draft','active','paused','completed')),
  program_version integer not null default 1,
  knowledge_version_ref jsonb,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid references public.user_goals (user_id) on delete set null,
  status text not null default 'draft' check (status in ('draft','active','paused','completed')),
  program_version integer not null default 1,
  knowledge_version_ref jsonb,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_phases (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null,
  program_type text not null check (program_type in ('nutrition','training')),
  name text,
  phase_type text,
  phase_goal text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.program_blocks (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.program_phases (id) on delete cascade,
  block_type text,
  block_goal text,
  duration_days integer not null default 7,
  created_at timestamptz not null default now()
);

create table if not exists public.program_days (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.program_blocks (id) on delete cascade,
  date date not null,
  targets jsonb,
  session_plan jsonb,
  constraints_applied jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.program_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null,
  program_type text not null check (program_type in ('nutrition','training')),
  version integer not null,
  snapshot jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.program_explainability (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null,
  program_type text not null check (program_type in ('nutrition','training')),
  version integer not null,
  decision_ref text not null,
  knowledge_refs jsonb,
  confidence numeric(4,3),
  guard_notes jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.program_guard_events (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null,
  program_type text not null check (program_type in ('nutrition','training')),
  risk_level text not null check (risk_level in ('safe','caution','danger')),
  flags text[],
  blocked_actions text[],
  created_at timestamptz not null default now()
);

create table if not exists public.program_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_type text not null check (program_type in ('nutrition','training')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  input_context jsonb,
  output_program_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nutrition_programs_user_idx on public.nutrition_programs (user_id, created_at desc);
create index if not exists training_programs_user_idx on public.training_programs (user_id, created_at desc);
create index if not exists program_phases_program_idx on public.program_phases (program_id, program_type);
create index if not exists program_blocks_phase_idx on public.program_blocks (phase_id);
create index if not exists program_days_block_idx on public.program_days (block_id, date);
create index if not exists program_versions_program_idx on public.program_versions (program_id, program_type, version);
create index if not exists program_explainability_program_idx on public.program_explainability (program_id, program_type, version);
create index if not exists program_guard_events_program_idx on public.program_guard_events (program_id, program_type);
create index if not exists program_generation_jobs_user_idx on public.program_generation_jobs (user_id, created_at desc);

alter table public.nutrition_programs enable row level security;
alter table public.training_programs enable row level security;
alter table public.program_phases enable row level security;
alter table public.program_blocks enable row level security;
alter table public.program_days enable row level security;
alter table public.program_versions enable row level security;
alter table public.program_explainability enable row level security;
alter table public.program_guard_events enable row level security;
alter table public.program_generation_jobs enable row level security;

create policy "nutrition_programs_owner"
  on public.nutrition_programs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "training_programs_owner"
  on public.training_programs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "program_phases_owner"
  on public.program_phases
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

create policy "program_blocks_owner"
  on public.program_blocks
  for all
  using (
    exists (
      select 1 from public.program_phases pp
      where pp.id = phase_id and (
        (pp.program_type = 'nutrition' and exists (
          select 1 from public.nutrition_programs np
          where np.id = pp.program_id and np.user_id = auth.uid()
        )) or
        (pp.program_type = 'training' and exists (
          select 1 from public.training_programs tp
          where tp.id = pp.program_id and tp.user_id = auth.uid()
        ))
      )
    )
  )
  with check (
    exists (
      select 1 from public.program_phases pp
      where pp.id = phase_id and (
        (pp.program_type = 'nutrition' and exists (
          select 1 from public.nutrition_programs np
          where np.id = pp.program_id and np.user_id = auth.uid()
        )) or
        (pp.program_type = 'training' and exists (
          select 1 from public.training_programs tp
          where tp.id = pp.program_id and tp.user_id = auth.uid()
        ))
      )
    )
  );

create policy "program_days_owner"
  on public.program_days
  for all
  using (
    exists (
      select 1 from public.program_blocks pb
      join public.program_phases pp on pp.id = pb.phase_id
      where pb.id = block_id and (
        (pp.program_type = 'nutrition' and exists (
          select 1 from public.nutrition_programs np
          where np.id = pp.program_id and np.user_id = auth.uid()
        )) or
        (pp.program_type = 'training' and exists (
          select 1 from public.training_programs tp
          where tp.id = pp.program_id and tp.user_id = auth.uid()
        ))
      )
    )
  )
  with check (
    exists (
      select 1 from public.program_blocks pb
      join public.program_phases pp on pp.id = pb.phase_id
      where pb.id = block_id and (
        (pp.program_type = 'nutrition' and exists (
          select 1 from public.nutrition_programs np
          where np.id = pp.program_id and np.user_id = auth.uid()
        )) or
        (pp.program_type = 'training' and exists (
          select 1 from public.training_programs tp
          where tp.id = pp.program_id and tp.user_id = auth.uid()
        ))
      )
    )
  );

create policy "program_versions_owner"
  on public.program_versions
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

create policy "program_explainability_owner"
  on public.program_explainability
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

create policy "program_guard_events_owner"
  on public.program_guard_events
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

create policy "program_generation_jobs_owner"
  on public.program_generation_jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function update_programs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists nutrition_programs_updated_at on public.nutrition_programs;
create trigger nutrition_programs_updated_at
  before update on public.nutrition_programs
  for each row
  execute function update_programs_updated_at();

drop trigger if exists training_programs_updated_at on public.training_programs;
create trigger training_programs_updated_at
  before update on public.training_programs
  for each row
  execute function update_programs_updated_at();

drop trigger if exists program_generation_jobs_updated_at on public.program_generation_jobs;
create trigger program_generation_jobs_updated_at
  before update on public.program_generation_jobs
  for each row
  execute function update_programs_updated_at();
