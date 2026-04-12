create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Public exercise definition layer
-- ------------------------------------------------------------

create table if not exists public.exercise_definitions (
  exercise_id uuid primary key references public.exercises (id) on delete cascade,
  description text,
  mistakes text,
  muscle_map_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_definition_media (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  url text not null,
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (exercise_id, sort_order)
);

create index if not exists exercise_definition_media_exercise_idx
  on public.exercise_definition_media (exercise_id, sort_order);

create or replace function public.ensure_public_exercise_definition_target()
returns trigger as $$
begin
  if not exists (
    select 1
    from public.exercises e
    where e.id = new.exercise_id
      and coalesce(e.is_custom, false) = false
  ) then
    raise exception 'exercise definitions support only public exercises';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists exercise_definitions_public_only_trigger on public.exercise_definitions;
create trigger exercise_definitions_public_only_trigger
  before insert or update on public.exercise_definitions
  for each row
  execute function public.ensure_public_exercise_definition_target();

drop trigger if exists exercise_definition_media_public_only_trigger on public.exercise_definition_media;
create trigger exercise_definition_media_public_only_trigger
  before insert or update on public.exercise_definition_media
  for each row
  execute function public.ensure_public_exercise_definition_target();

alter table public.exercise_definitions enable row level security;
alter table public.exercise_definition_media enable row level security;

drop policy if exists "exercise_definitions_select_public_v1" on public.exercise_definitions;
create policy "exercise_definitions_select_public_v1"
  on public.exercise_definitions
  for select
  using (true);

drop policy if exists "exercise_definition_media_select_public_v1" on public.exercise_definition_media;
create policy "exercise_definition_media_select_public_v1"
  on public.exercise_definition_media
  for select
  using (true);

revoke all on public.exercise_definitions from public, anon, authenticated;
revoke all on public.exercise_definition_media from public, anon, authenticated;
grant select on public.exercise_definitions to authenticated;
grant select on public.exercise_definition_media to authenticated;

create or replace view public.exercise_definition_cards as
with media_agg as (
  select
    edm.exercise_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', edm.media_type,
          'url', edm.url,
          'order', edm.sort_order
        )
        order by edm.sort_order
      ),
      '[]'::jsonb
    ) as media
  from public.exercise_definition_media edm
  group by edm.exercise_id
),
muscle_agg as (
  select
    em.exercise_id,
    coalesce(
      array_agg(distinct m.name order by m.name)
        filter (where m.name is not null),
      array[]::text[]
    ) as primary_muscles,
    array[]::text[] as secondary_muscles
  from public.exercise_muscles em
  join public.muscles m on m.id = em.muscle_id
  group by em.exercise_id
)
select
  e.id,
  e.name,
  coalesce(d.description, e.description) as description,
  d.mistakes,
  coalesce(ma.primary_muscles, array[]::text[]) as primary_muscles,
  coalesce(ma.secondary_muscles, array[]::text[]) as secondary_muscles,
  d.muscle_map_image_url,
  coalesce(media_agg.media, '[]'::jsonb) as media
from public.exercises e
left join public.exercise_definitions d on d.exercise_id = e.id
left join muscle_agg ma on ma.exercise_id = e.id
left join media_agg on media_agg.exercise_id = e.id
where coalesce(e.is_custom, false) = false;

alter view public.exercise_definition_cards set (security_invoker = true);
revoke all on public.exercise_definition_cards from public, anon, authenticated;
grant select on public.exercise_definition_cards to authenticated;

-- ------------------------------------------------------------
-- 2) Private user exercise media
-- ------------------------------------------------------------

create table if not exists public.user_exercise_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  workout_entry_id uuid references public.workout_entries (id) on delete set null,
  workout_date date,
  file_path text not null unique,
  file_type text not null check (file_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create index if not exists user_exercise_media_user_exercise_idx
  on public.user_exercise_media (user_id, exercise_id, created_at desc);

create or replace function public.validate_user_exercise_media()
returns trigger as $$
declare
  existing_count integer;
begin
  if new.user_id <> auth.uid() and auth.uid() is not null then
    raise exception 'cannot manage media for another user';
  end if;

  if split_part(new.file_path, '/', 1) <> new.user_id::text then
    raise exception 'file_path must start with user_id';
  end if;

  if split_part(new.file_path, '/', 2) <> new.exercise_id::text then
    raise exception 'file_path second segment must match exercise_id';
  end if;

  if split_part(new.file_path, '/', 3) = '' then
    raise exception 'file_path must end with a file identifier';
  end if;

  select count(*)
  into existing_count
  from public.user_exercise_media uem
  where uem.user_id = new.user_id
    and uem.exercise_id = new.exercise_id
    and (tg_op = 'INSERT' or uem.id <> new.id);

  if existing_count >= 9 then
    raise exception 'user exercise media limit reached (max 9 files per exercise)';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists user_exercise_media_validate_trigger on public.user_exercise_media;
create trigger user_exercise_media_validate_trigger
  before insert or update on public.user_exercise_media
  for each row
  execute function public.validate_user_exercise_media();

alter table public.user_exercise_media enable row level security;

drop policy if exists "user_exercise_media_select_own_v1" on public.user_exercise_media;
create policy "user_exercise_media_select_own_v1"
  on public.user_exercise_media
  for select
  using (user_id = auth.uid());

drop policy if exists "user_exercise_media_insert_own_v1" on public.user_exercise_media;
create policy "user_exercise_media_insert_own_v1"
  on public.user_exercise_media
  for insert
  with check (user_id = auth.uid());

drop policy if exists "user_exercise_media_delete_own_v1" on public.user_exercise_media;
create policy "user_exercise_media_delete_own_v1"
  on public.user_exercise_media
  for delete
  using (user_id = auth.uid());

revoke all on public.user_exercise_media from public, anon, authenticated;
grant select, insert, delete on public.user_exercise_media to authenticated;

-- ------------------------------------------------------------
-- 3) Private storage bucket + object policies
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('user-exercise-media', 'user-exercise-media', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "user_exercise_media_storage_select_own_v1" on storage.objects;
create policy "user_exercise_media_storage_select_own_v1"
  on storage.objects
  for select
  using (
    bucket_id = 'user-exercise-media'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "user_exercise_media_storage_insert_own_v1" on storage.objects;
create policy "user_exercise_media_storage_insert_own_v1"
  on storage.objects
  for insert
  with check (
    bucket_id = 'user-exercise-media'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "user_exercise_media_storage_delete_own_v1" on storage.objects;
create policy "user_exercise_media_storage_delete_own_v1"
  on storage.objects
  for delete
  using (
    bucket_id = 'user-exercise-media'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- ------------------------------------------------------------
-- 4) Reload PostgREST schema cache
-- ------------------------------------------------------------

select pg_notify('pgrst', 'reload schema');
