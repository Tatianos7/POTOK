-- ============================================================
-- Phase 2.2 Exercise Knowledge Base migration
-- ============================================================

alter table public.exercises
  add column if not exists canonical_exercise_id uuid references public.exercises (id) on delete set null,
  add column if not exists normalized_name text,
  add column if not exists movement_pattern text,
  add column if not exists equipment_type text,
  add column if not exists difficulty_level text,
  add column if not exists is_compound boolean not null default false,
  add column if not exists energy_system text,
  add column if not exists metabolic_equivalent numeric(6,2),
  add column if not exists safety_flags jsonb,
  add column if not exists aliases text[];

create or replace function normalize_exercise_text(value text)
returns text as $$
  select trim(regexp_replace(lower(coalesce(value, '')), '[^a-z0-9а-яё]+', ' ', 'g'));
$$ language sql immutable;

create or replace function exercises_update_normalized()
returns trigger as $$
begin
  new.normalized_name := normalize_exercise_text(new.name);
  if new.canonical_exercise_id is null then
    new.canonical_exercise_id := new.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists exercises_normalize_trigger on public.exercises;
create trigger exercises_normalize_trigger
  before insert or update on public.exercises
  for each row
  execute function exercises_update_normalized();

create index if not exists exercises_normalized_idx
  on public.exercises (normalized_name);

create table if not exists public.exercise_aliases (
  id uuid primary key default gen_random_uuid(),
  canonical_exercise_id uuid not null references public.exercises (id) on delete cascade,
  alias text not null,
  normalized_alias text,
  source text not null default 'core',
  verified boolean not null default false,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_alias)
);

create index if not exists exercise_aliases_canonical_idx
  on public.exercise_aliases (canonical_exercise_id);

alter table public.exercise_aliases enable row level security;

drop policy if exists "exercise_aliases_select_public" on public.exercise_aliases;
create policy "exercise_aliases_select_public"
  on public.exercise_aliases
  for select
  using (true);

drop policy if exists "exercise_aliases_modify_own" on public.exercise_aliases;
create policy "exercise_aliases_modify_own"
  on public.exercise_aliases
  for all
  using (auth.uid() = created_by_user_id)
  with check (auth.uid() = created_by_user_id);

create or replace function exercise_aliases_normalize()
returns trigger as $$
begin
  new.normalized_alias := normalize_exercise_text(new.alias);
  return new;
end;
$$ language plpgsql;

drop trigger if exists exercise_aliases_normalize_trigger on public.exercise_aliases;
create trigger exercise_aliases_normalize_trigger
  before insert or update on public.exercise_aliases
  for each row
  execute function exercise_aliases_normalize();

alter table public.muscles
  add column if not exists canonical_muscle_id uuid references public.muscles (id) on delete set null,
  add column if not exists region text,
  add column if not exists role text;

create or replace function muscles_update_canonical()
returns trigger as $$
begin
  if new.canonical_muscle_id is null then
    new.canonical_muscle_id := new.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists muscles_canonical_trigger on public.muscles;
create trigger muscles_canonical_trigger
  before insert or update on public.muscles
  for each row
  execute function muscles_update_canonical();

create table if not exists public.muscle_aliases (
  id uuid primary key default gen_random_uuid(),
  canonical_muscle_id uuid not null references public.muscles (id) on delete cascade,
  alias text not null,
  normalized_alias text,
  source text not null default 'core',
  verified boolean not null default false,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_alias)
);

create index if not exists muscle_aliases_canonical_idx
  on public.muscle_aliases (canonical_muscle_id);

alter table public.muscle_aliases enable row level security;

drop policy if exists "muscle_aliases_select_public" on public.muscle_aliases;
create policy "muscle_aliases_select_public"
  on public.muscle_aliases
  for select
  using (true);

drop policy if exists "muscle_aliases_modify_own" on public.muscle_aliases;
create policy "muscle_aliases_modify_own"
  on public.muscle_aliases
  for all
  using (auth.uid() = created_by_user_id)
  with check (auth.uid() = created_by_user_id);

create or replace function muscle_aliases_normalize()
returns trigger as $$
begin
  new.normalized_alias := normalize_exercise_text(new.alias);
  return new;
end;
$$ language plpgsql;

drop trigger if exists muscle_aliases_normalize_trigger on public.muscle_aliases;
create trigger muscle_aliases_normalize_trigger
  before insert or update on public.muscle_aliases
  for each row
  execute function muscle_aliases_normalize();

alter table public.exercise_muscles
  add column if not exists role text;

alter table public.workout_entries
  add column if not exists canonical_exercise_id uuid references public.exercises (id) on delete set null;

create index if not exists workout_entries_canonical_idx
  on public.workout_entries (canonical_exercise_id);

-- Update exercises view to expose canonical fields
create or replace view exercises_full_view as
select
  e.id,
  e.canonical_exercise_id,
  e.name as exercise_name,
  e.normalized_name,
  e.movement_pattern,
  e.equipment_type,
  e.difficulty_level,
  e.is_compound,
  e.energy_system,
  e.metabolic_equivalent,
  c.name as category,
  coalesce(
    array_agg(distinct m.name order by m.name) filter (where m.name is not null),
    array[]::text[]
  ) as muscles
from exercises e
join exercise_categories c on c.id = e.category_id
left join exercise_muscles em on em.exercise_id = e.id
left join muscles m on m.id = em.muscle_id
where e.is_custom = false
group by e.id, e.canonical_exercise_id, e.name, e.normalized_name,
  e.movement_pattern, e.equipment_type, e.difficulty_level, e.is_compound,
  e.energy_system, e.metabolic_equivalent, c.name
order by e.name, c.name;
