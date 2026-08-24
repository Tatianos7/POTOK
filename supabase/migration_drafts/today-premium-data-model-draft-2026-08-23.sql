-- POTOK Premium data model draft migration
-- DRAFT ONLY. Do not apply without explicit owner approval.
--
-- Purpose:
-- - add a separate Premium catalog for POTOK plans and recipes
-- - keep Premium recipes separate from user-owned public.recipes
-- - keep Premium plans separate from diary facts
-- - support user-selected Premium plans and local meal replacements
-- - keep shopping list derived from ingredients; no shopping source-of-truth table
--
-- Safety:
-- - does not touch public.recipes
-- - does not touch public.recipe_ingredients
-- - does not touch public.food_diary_entries
-- - does not touch payment/auth tables
-- - does not create diary/workout writes
-- - does not create AI-generated records
-- - does not create real shopping runtime tables

begin;

-- ============================================================
-- Catalog: Premium plans
-- ============================================================

create table if not exists public.premium_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  goal_type text,
  duration_days integer not null default 14,
  difficulty text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_plans'::regclass
      and conname = 'premium_plans_duration_days_positive_check'
  ) then
    alter table public.premium_plans
      add constraint premium_plans_duration_days_positive_check
      check (duration_days > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_plans'::regclass
      and conname = 'premium_plans_title_not_blank_check'
  ) then
    alter table public.premium_plans
      add constraint premium_plans_title_not_blank_check
      check (length(trim(title)) > 0);
  end if;
end $$;

comment on table public.premium_plans is
  'POTOK Premium plan catalog. Source of truth for reusable Premium plans; not user diary data.';
comment on column public.premium_plans.goal_type is
  'Loose MVP goal mapping. Keep nullable/free-form until goal taxonomy is finalized.';
comment on column public.premium_plans.difficulty is
  'Human-readable difficulty label for MVP. Do not over-constrain before content taxonomy is approved.';

create index if not exists premium_plans_active_goal_type_idx
  on public.premium_plans (is_active, goal_type);

create index if not exists premium_plans_created_at_idx
  on public.premium_plans (created_at desc);

-- ============================================================
-- Catalog: Premium plan days
-- ============================================================

create table if not exists public.premium_plan_days (
  id uuid primary key default gen_random_uuid(),
  premium_plan_id uuid not null references public.premium_plans (id) on delete cascade,
  day_number integer not null,
  calories integer,
  protein numeric(8,2),
  fat numeric(8,2),
  carbs numeric(8,2),
  workout_title text,
  workout_duration_min integer,
  workout_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_plan_days'::regclass
      and conname = 'premium_plan_days_day_number_positive_check'
  ) then
    alter table public.premium_plan_days
      add constraint premium_plan_days_day_number_positive_check
      check (day_number > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_plan_days'::regclass
      and conname = 'premium_plan_days_workout_duration_positive_check'
  ) then
    alter table public.premium_plan_days
      add constraint premium_plan_days_workout_duration_positive_check
      check (workout_duration_min is null or workout_duration_min > 0);
  end if;
end $$;

comment on table public.premium_plan_days is
  'Day-level plan catalog rows for POTOK Premium. Planned macros/workout summary only; not diary facts.';
comment on column public.premium_plan_days.calories is
  'Planned day calories. Nullable in MVP so draft/workout-only days can be created before publishing.';

create unique index if not exists premium_plan_days_plan_day_unique_idx
  on public.premium_plan_days (premium_plan_id, day_number);

create index if not exists premium_plan_days_plan_day_idx
  on public.premium_plan_days (premium_plan_id, day_number);

-- ============================================================
-- Catalog: Premium meal slots
-- ============================================================

create table if not exists public.premium_meal_slots (
  id uuid primary key default gen_random_uuid(),
  premium_plan_day_id uuid not null references public.premium_plan_days (id) on delete cascade,
  meal_type text,
  title text not null,
  calories integer,
  protein numeric(8,2),
  fat numeric(8,2),
  carbs numeric(8,2),
  sort_order integer not null default 0
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_meal_slots'::regclass
      and conname = 'premium_meal_slots_title_not_blank_check'
  ) then
    alter table public.premium_meal_slots
      add constraint premium_meal_slots_title_not_blank_check
      check (length(trim(title)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_meal_slots'::regclass
      and conname = 'premium_meal_slots_meal_type_check'
  ) then
    alter table public.premium_meal_slots
      add constraint premium_meal_slots_meal_type_check
      check (meal_type is null or meal_type in ('breakfast', 'lunch', 'dinner', 'snack'));
  end if;
end $$;

comment on table public.premium_meal_slots is
  'Planned meal slots within a Premium plan day. A slot points to recipe options through premium_meal_recipe_options.';
comment on column public.premium_meal_slots.meal_type is
  'Canonical meal type. Nullable in MVP while localized labels remain the UI source.';

create unique index if not exists premium_meal_slots_day_sort_unique_idx
  on public.premium_meal_slots (premium_plan_day_id, sort_order);

create index if not exists premium_meal_slots_day_sort_idx
  on public.premium_meal_slots (premium_plan_day_id, sort_order);

create index if not exists premium_meal_slots_meal_type_idx
  on public.premium_meal_slots (meal_type);

-- ============================================================
-- Catalog: Premium recipes
-- ============================================================

create table if not exists public.premium_recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  calories integer,
  protein numeric(8,2),
  fat numeric(8,2),
  carbs numeric(8,2),
  cooking_time_min integer,
  difficulty_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_recipes'::regclass
      and conname = 'premium_recipes_title_not_blank_check'
  ) then
    alter table public.premium_recipes
      add constraint premium_recipes_title_not_blank_check
      check (length(trim(title)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_recipes'::regclass
      and conname = 'premium_recipes_cooking_time_positive_check'
  ) then
    alter table public.premium_recipes
      add constraint premium_recipes_cooking_time_positive_check
      check (cooking_time_min is null or cooking_time_min > 0);
  end if;
end $$;

comment on table public.premium_recipes is
  'POTOK Premium ready recipe catalog. Separate from user-owned public.recipes and not editable by regular users.';
comment on column public.premium_recipes.category is
  'Loose MVP category label such as breakfast/lunch/dinner/snack/quick. Keep nullable until taxonomy is final.';
comment on column public.premium_recipes.difficulty_label is
  'Human-readable preparation difficulty/copy label, not a strict enum in MVP.';

create index if not exists premium_recipes_active_category_idx
  on public.premium_recipes (is_active, category);

create index if not exists premium_recipes_title_idx
  on public.premium_recipes (title);

create index if not exists premium_recipes_created_at_idx
  on public.premium_recipes (created_at desc);

-- ============================================================
-- Catalog: Premium recipe ingredients
-- ============================================================

create table if not exists public.premium_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  premium_recipe_id uuid not null references public.premium_recipes (id) on delete cascade,
  ingredient_name text not null,
  amount_g numeric(10,2),
  display_amount text,
  sort_order integer not null default 0
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_recipe_ingredients'::regclass
      and conname = 'premium_recipe_ingredients_name_not_blank_check'
  ) then
    alter table public.premium_recipe_ingredients
      add constraint premium_recipe_ingredients_name_not_blank_check
      check (length(trim(ingredient_name)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_recipe_ingredients'::regclass
      and conname = 'premium_recipe_ingredients_amount_g_positive_check'
  ) then
    alter table public.premium_recipe_ingredients
      add constraint premium_recipe_ingredients_amount_g_positive_check
      check (amount_g is null or amount_g > 0);
  end if;
end $$;

comment on table public.premium_recipe_ingredients is
  'Ingredients for POTOK Premium recipes. Supports recipe detail and derived shopping list aggregation.';
comment on column public.premium_recipe_ingredients.amount_g is
  'Nullable grams amount. Some MVP ingredients may use display-only quantities such as pieces.';
comment on column public.premium_recipe_ingredients.display_amount is
  'User-facing quantity text, for example 50 g or 1 medium banana.';

create index if not exists premium_recipe_ingredients_recipe_sort_idx
  on public.premium_recipe_ingredients (premium_recipe_id, sort_order);

create index if not exists premium_recipe_ingredients_name_idx
  on public.premium_recipe_ingredients (ingredient_name);

-- ============================================================
-- Catalog: Premium recipe steps
-- ============================================================

create table if not exists public.premium_recipe_steps (
  id uuid primary key default gen_random_uuid(),
  premium_recipe_id uuid not null references public.premium_recipes (id) on delete cascade,
  step_number integer not null,
  instruction text not null
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_recipe_steps'::regclass
      and conname = 'premium_recipe_steps_step_number_positive_check'
  ) then
    alter table public.premium_recipe_steps
      add constraint premium_recipe_steps_step_number_positive_check
      check (step_number > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_recipe_steps'::regclass
      and conname = 'premium_recipe_steps_instruction_not_blank_check'
  ) then
    alter table public.premium_recipe_steps
      add constraint premium_recipe_steps_instruction_not_blank_check
      check (length(trim(instruction)) > 0);
  end if;
end $$;

comment on table public.premium_recipe_steps is
  'Ordered preparation steps for POTOK Premium recipe details.';

create unique index if not exists premium_recipe_steps_recipe_step_unique_idx
  on public.premium_recipe_steps (premium_recipe_id, step_number);

create index if not exists premium_recipe_steps_recipe_step_idx
  on public.premium_recipe_steps (premium_recipe_id, step_number);

-- ============================================================
-- Catalog: Premium recipe portion hints
-- ============================================================

create table if not exists public.premium_recipe_hints (
  id uuid primary key default gen_random_uuid(),
  premium_recipe_id uuid not null references public.premium_recipes (id) on delete cascade,
  hint_text text not null,
  sort_order integer not null default 0
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.premium_recipe_hints'::regclass
      and conname = 'premium_recipe_hints_text_not_blank_check'
  ) then
    alter table public.premium_recipe_hints
      add constraint premium_recipe_hints_text_not_blank_check
      check (length(trim(hint_text)) > 0);
  end if;
end $$;

comment on table public.premium_recipe_hints is
  'Portion hints without scales for POTOK Premium recipes.';

create index if not exists premium_recipe_hints_recipe_sort_idx
  on public.premium_recipe_hints (premium_recipe_id, sort_order);

-- ============================================================
-- Catalog: Premium meal recipe options
-- ============================================================

create table if not exists public.premium_meal_recipe_options (
  id uuid primary key default gen_random_uuid(),
  premium_meal_slot_id uuid not null references public.premium_meal_slots (id) on delete cascade,
  premium_recipe_id uuid not null references public.premium_recipes (id) on delete restrict,
  option_type text,
  label text,
  sort_order integer not null default 0
);

comment on table public.premium_meal_recipe_options is
  'Allowed primary and replacement recipe options for a Premium meal slot.';
comment on column public.premium_meal_recipe_options.option_type is
  'Loose MVP option type such as primary, simpler, lower_calorie, higher_protein, no_cook, or similar_macros.';
comment on column public.premium_meal_recipe_options.label is
  'User-facing filter/replacement label. Nullable until replacement taxonomy is finalized.';

create unique index if not exists premium_meal_recipe_options_slot_recipe_unique_idx
  on public.premium_meal_recipe_options (premium_meal_slot_id, premium_recipe_id);

create index if not exists premium_meal_recipe_options_slot_sort_idx
  on public.premium_meal_recipe_options (premium_meal_slot_id, sort_order);

create index if not exists premium_meal_recipe_options_recipe_idx
  on public.premium_meal_recipe_options (premium_recipe_id);

create index if not exists premium_meal_recipe_options_type_idx
  on public.premium_meal_recipe_options (option_type);

-- ============================================================
-- User state: selected Premium plans
-- ============================================================

create table if not exists public.user_premium_plan_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_goal_id uuid references public.user_goals (user_id) on delete set null,
  premium_plan_id uuid not null references public.premium_plans (id) on delete restrict,
  status text not null default 'active',
  start_date date,
  selected_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_premium_plan_selections'::regclass
      and conname = 'user_premium_plan_selections_status_check'
  ) then
    alter table public.user_premium_plan_selections
      add constraint user_premium_plan_selections_status_check
      check (status in ('active', 'paused', 'completed', 'archived'));
  end if;
end $$;

comment on table public.user_premium_plan_selections is
  'User-specific selection of a Premium catalog plan. Links a user and optional goal to the plan without mutating catalog rows.';
comment on column public.user_premium_plan_selections.user_goal_id is
  'Optional link to public.user_goals(user_id). Nullable for preview/no-goal or demo-safe flows.';
comment on column public.user_premium_plan_selections.start_date is
  'Optional plan start date. Plan preview and activation can remain separate.';

create index if not exists user_premium_plan_selections_user_status_idx
  on public.user_premium_plan_selections (user_id, status, selected_at desc);

create index if not exists user_premium_plan_selections_plan_idx
  on public.user_premium_plan_selections (premium_plan_id);

create index if not exists user_premium_plan_selections_goal_idx
  on public.user_premium_plan_selections (user_goal_id);

create unique index if not exists user_premium_plan_selections_one_active_idx
  on public.user_premium_plan_selections (user_id)
  where status = 'active';

-- ============================================================
-- User state: selected meal replacements
-- ============================================================

create table if not exists public.user_premium_meal_selections (
  id uuid primary key default gen_random_uuid(),
  user_premium_plan_selection_id uuid not null references public.user_premium_plan_selections (id) on delete cascade,
  premium_meal_slot_id uuid not null references public.premium_meal_slots (id) on delete restrict,
  selected_premium_recipe_id uuid references public.premium_recipes (id) on delete restrict,
  selected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_premium_meal_selections is
  'User-specific Premium meal replacement state. Does not mutate plan, recipe catalog, or historical diary entries.';
comment on column public.user_premium_meal_selections.selected_premium_recipe_id is
  'Selected replacement recipe. Nullable so a future UI can clear a replacement back to default.';

create unique index if not exists user_premium_meal_selections_selection_slot_unique_idx
  on public.user_premium_meal_selections (user_premium_plan_selection_id, premium_meal_slot_id);

create index if not exists user_premium_meal_selections_plan_selection_idx
  on public.user_premium_meal_selections (user_premium_plan_selection_id);

create index if not exists user_premium_meal_selections_meal_slot_idx
  on public.user_premium_meal_selections (premium_meal_slot_id);

create index if not exists user_premium_meal_selections_recipe_idx
  on public.user_premium_meal_selections (selected_premium_recipe_id);

-- ============================================================
-- updated_at triggers
-- ============================================================

create or replace function public.update_premium_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_premium_plans_updated_at
  on public.premium_plans;
create trigger update_premium_plans_updated_at
  before update on public.premium_plans
  for each row
  execute function public.update_premium_updated_at();

drop trigger if exists update_premium_plan_days_updated_at
  on public.premium_plan_days;
create trigger update_premium_plan_days_updated_at
  before update on public.premium_plan_days
  for each row
  execute function public.update_premium_updated_at();

drop trigger if exists update_premium_recipes_updated_at
  on public.premium_recipes;
create trigger update_premium_recipes_updated_at
  before update on public.premium_recipes
  for each row
  execute function public.update_premium_updated_at();

drop trigger if exists update_user_premium_plan_selections_updated_at
  on public.user_premium_plan_selections;
create trigger update_user_premium_plan_selections_updated_at
  before update on public.user_premium_plan_selections
  for each row
  execute function public.update_premium_updated_at();

drop trigger if exists update_user_premium_meal_selections_updated_at
  on public.user_premium_meal_selections;
create trigger update_user_premium_meal_selections_updated_at
  before update on public.user_premium_meal_selections
  for each row
  execute function public.update_premium_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table public.premium_plans enable row level security;
alter table public.premium_plan_days enable row level security;
alter table public.premium_meal_slots enable row level security;
alter table public.premium_recipes enable row level security;
alter table public.premium_recipe_ingredients enable row level security;
alter table public.premium_recipe_steps enable row level security;
alter table public.premium_recipe_hints enable row level security;
alter table public.premium_meal_recipe_options enable row level security;
alter table public.user_premium_plan_selections enable row level security;
alter table public.user_premium_meal_selections enable row level security;

-- Catalog read policies. Regular authenticated users can read active catalog
-- rows only. No insert/update/delete policy is created for regular users.

drop policy if exists premium_plans_select_active on public.premium_plans;
create policy premium_plans_select_active
  on public.premium_plans
  for select
  to authenticated
  using (is_active = true);

drop policy if exists premium_plan_days_select_active_plan on public.premium_plan_days;
create policy premium_plan_days_select_active_plan
  on public.premium_plan_days
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.premium_plans pp
      where pp.id = premium_plan_id
        and pp.is_active = true
    )
  );

drop policy if exists premium_meal_slots_select_active_plan on public.premium_meal_slots;
create policy premium_meal_slots_select_active_plan
  on public.premium_meal_slots
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.premium_plan_days ppd
      join public.premium_plans pp on pp.id = ppd.premium_plan_id
      where ppd.id = premium_plan_day_id
        and pp.is_active = true
    )
  );

drop policy if exists premium_recipes_select_active on public.premium_recipes;
create policy premium_recipes_select_active
  on public.premium_recipes
  for select
  to authenticated
  using (is_active = true);

drop policy if exists premium_recipe_ingredients_select_active_recipe on public.premium_recipe_ingredients;
create policy premium_recipe_ingredients_select_active_recipe
  on public.premium_recipe_ingredients
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.premium_recipes pr
      where pr.id = premium_recipe_id
        and pr.is_active = true
    )
  );

drop policy if exists premium_recipe_steps_select_active_recipe on public.premium_recipe_steps;
create policy premium_recipe_steps_select_active_recipe
  on public.premium_recipe_steps
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.premium_recipes pr
      where pr.id = premium_recipe_id
        and pr.is_active = true
    )
  );

drop policy if exists premium_recipe_hints_select_active_recipe on public.premium_recipe_hints;
create policy premium_recipe_hints_select_active_recipe
  on public.premium_recipe_hints
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.premium_recipes pr
      where pr.id = premium_recipe_id
        and pr.is_active = true
    )
  );

drop policy if exists premium_meal_recipe_options_select_active_catalog on public.premium_meal_recipe_options;
create policy premium_meal_recipe_options_select_active_catalog
  on public.premium_meal_recipe_options
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.premium_meal_slots pms
      join public.premium_plan_days ppd on ppd.id = pms.premium_plan_day_id
      join public.premium_plans pp on pp.id = ppd.premium_plan_id
      where pms.id = premium_meal_slot_id
        and pp.is_active = true
    )
    and exists (
      select 1
      from public.premium_recipes pr
      where pr.id = premium_recipe_id
        and pr.is_active = true
    )
  );

-- User-owned state policies.

drop policy if exists user_premium_plan_selections_select_own on public.user_premium_plan_selections;
create policy user_premium_plan_selections_select_own
  on public.user_premium_plan_selections
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_premium_plan_selections_insert_own on public.user_premium_plan_selections;
create policy user_premium_plan_selections_insert_own
  on public.user_premium_plan_selections
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (user_goal_id is null or user_goal_id = auth.uid())
    and exists (
      select 1
      from public.premium_plans pp
      where pp.id = premium_plan_id
        and pp.is_active = true
    )
  );

drop policy if exists user_premium_plan_selections_update_own on public.user_premium_plan_selections;
create policy user_premium_plan_selections_update_own
  on public.user_premium_plan_selections
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (user_goal_id is null or user_goal_id = auth.uid())
    and exists (
      select 1
      from public.premium_plans pp
      where pp.id = premium_plan_id
        and pp.is_active = true
    )
  );

drop policy if exists user_premium_plan_selections_delete_own on public.user_premium_plan_selections;
create policy user_premium_plan_selections_delete_own
  on public.user_premium_plan_selections
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_premium_meal_selections_select_own on public.user_premium_meal_selections;
create policy user_premium_meal_selections_select_own
  on public.user_premium_meal_selections
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_premium_plan_selections upps
      where upps.id = user_premium_plan_selection_id
        and upps.user_id = auth.uid()
    )
  );

drop policy if exists user_premium_meal_selections_insert_own on public.user_premium_meal_selections;
create policy user_premium_meal_selections_insert_own
  on public.user_premium_meal_selections
  for insert
  to authenticated
  with check (
    -- The parent selection must belong to the user, the meal slot must belong
    -- to that selected plan, and any selected recipe must be an active allowed
    -- option for the slot.
    exists (
      select 1
      from public.user_premium_plan_selections upps
      join public.premium_plan_days ppd on ppd.premium_plan_id = upps.premium_plan_id
      join public.premium_meal_slots pms on pms.premium_plan_day_id = ppd.id
      where upps.id = user_premium_plan_selection_id
        and upps.user_id = auth.uid()
        and pms.id = premium_meal_slot_id
        and (
          selected_premium_recipe_id is null
          or exists (
            select 1
            from public.premium_meal_recipe_options pmro
            join public.premium_recipes pr on pr.id = pmro.premium_recipe_id
            where pmro.premium_meal_slot_id = public.user_premium_meal_selections.premium_meal_slot_id
              and pmro.premium_recipe_id = public.user_premium_meal_selections.selected_premium_recipe_id
              and pr.is_active = true
          )
        )
    )
  );

drop policy if exists user_premium_meal_selections_update_own on public.user_premium_meal_selections;
create policy user_premium_meal_selections_update_own
  on public.user_premium_meal_selections
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_premium_plan_selections upps
      where upps.id = user_premium_plan_selection_id
        and upps.user_id = auth.uid()
    )
  )
  with check (
    -- Preserve ownership and plan/slot/recipe integrity on replacement edits.
    exists (
      select 1
      from public.user_premium_plan_selections upps
      join public.premium_plan_days ppd on ppd.premium_plan_id = upps.premium_plan_id
      join public.premium_meal_slots pms on pms.premium_plan_day_id = ppd.id
      where upps.id = user_premium_plan_selection_id
        and upps.user_id = auth.uid()
        and pms.id = premium_meal_slot_id
        and (
          selected_premium_recipe_id is null
          or exists (
            select 1
            from public.premium_meal_recipe_options pmro
            join public.premium_recipes pr on pr.id = pmro.premium_recipe_id
            where pmro.premium_meal_slot_id = public.user_premium_meal_selections.premium_meal_slot_id
              and pmro.premium_recipe_id = public.user_premium_meal_selections.selected_premium_recipe_id
              and pr.is_active = true
          )
        )
    )
  );

drop policy if exists user_premium_meal_selections_delete_own on public.user_premium_meal_selections;
create policy user_premium_meal_selections_delete_own
  on public.user_premium_meal_selections
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_premium_plan_selections upps
      where upps.id = user_premium_plan_selection_id
        and upps.user_id = auth.uid()
    )
  );

-- ============================================================
-- Optional future shopping checkbox persistence
-- ============================================================
--
-- Intentionally not active in this draft. Shopping list source of truth should
-- remain derived from Premium recipes/ingredients and user meal selections.
-- If persistent bought checkboxes are approved later, use a separate migration
-- for a user-owned table like:
--
-- create table public.user_premium_shopping_checks (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid not null references auth.users (id) on delete cascade,
--   user_premium_plan_selection_id uuid not null references public.user_premium_plan_selections (id) on delete cascade,
--   period_days integer not null,
--   shopping_key text not null,
--   is_bought boolean not null default false,
--   updated_at timestamptz not null default now(),
--   unique (user_premium_plan_selection_id, period_days, shopping_key)
-- );

-- ============================================================
-- Suggested dry-run/readiness checks if this draft is approved later
-- ============================================================
--
-- select table_name
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name in (
--     'premium_plans',
--     'premium_plan_days',
--     'premium_meal_slots',
--     'premium_recipes',
--     'premium_recipe_ingredients',
--     'premium_recipe_steps',
--     'premium_recipe_hints',
--     'premium_meal_recipe_options',
--     'user_premium_plan_selections',
--     'user_premium_meal_selections'
--   )
-- order by table_name;
--
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and (
--     tablename like 'premium_%'
--     or tablename like 'user_premium_%'
--   )
-- order by tablename, policyname;
--
-- select count(*) from public.premium_plans;
-- select count(*) from public.premium_recipes;
-- Expected immediately after schema-only apply: 0 unless a separate seed
-- migration is explicitly approved.

commit;
