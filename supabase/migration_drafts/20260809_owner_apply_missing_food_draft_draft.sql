-- Owner-approved Missing Food Draft apply RPC draft migration
-- DRAFT ONLY. Do not apply without explicit owner approval.
--
-- Purpose:
-- - allow an admin/owner-approved call to create exactly one core food from one
--   ready_for_owner_apply food_missing_food_drafts row
-- - mark that draft applied only after the food insert succeeds
-- - keep food creation separate from Alias Apply and missing-food review state
--
-- Safety:
-- - creates/replaces one explicit RPC only
-- - migration itself inserts no foods
-- - migration itself inserts no aliases
-- - RPC inserts at most one public.foods row per successful call
-- - RPC never inserts/updates/deletes public.food_aliases
-- - RPC never calls apply_admin_approved_food_alias
-- - no trigger is created from draft status to foods
-- - no import/backfill/recompute is run
-- - diary/favorites/recipes are not remapped or recomputed

begin;

create or replace function public.apply_owner_approved_missing_food_draft(
  p_draft_id uuid
)
returns table (
  result text,
  food_id uuid,
  error text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_draft public.food_missing_food_drafts%rowtype;
  v_review public.food_missing_review_queue%rowtype;
  v_food_id uuid := gen_random_uuid();
  v_result text;
  v_error text;
begin
  if v_admin_id is null or not exists (
    select 1
    from public.user_profiles
    where id_user = v_admin_id
      and is_admin = true
  ) then
    return query
      select
        'permission_denied'::text,
        null::uuid,
        'Current user is not an admin.'::text;
    return;
  end if;

  select *
  into v_draft
  from public.food_missing_food_drafts
  where id = p_draft_id
  for update;

  if not found then
    return query
      select
        'draft_not_found'::text,
        null::uuid,
        'Missing food draft was not found.'::text;
    return;
  end if;

  if v_draft.applied_food_id is not null
     or v_draft.applied_by is not null
     or v_draft.applied_at is not null then
    return query
      select
        'already_applied'::text,
        v_draft.applied_food_id,
        'Draft already has applied food state.'::text;
    return;
  end if;

  if v_draft.status <> 'ready_for_owner_apply' then
    return query
      select
        'not_ready'::text,
        null::uuid,
        'Draft status is not ready_for_owner_apply.'::text;
    return;
  end if;

  select *
  into v_review
  from public.food_missing_review_queue
  where id = v_draft.source_review_id;

  if not found
     or v_review.classification <> 'missing_canonical_food'
     or v_review.status <> 'approved_for_food_draft' then
    return query
      select
        'invalid_review_state'::text,
        null::uuid,
        'Source review row is not approved for missing-food draft apply.'::text;
    return;
  end if;

  if v_draft.source <> 'core'
     or v_draft.unit <> 'g'
     or v_draft.brand is not null
     or v_draft.barcode is not null
     or v_draft.name is null
     or length(trim(v_draft.name)) = 0
     or v_draft.normalized_name is null
     or length(trim(v_draft.normalized_name)) = 0
     or v_draft.normalized_name <> public.normalize_food_text(v_draft.name)
     or v_draft.category is null
     or length(trim(v_draft.category)) = 0
     or v_draft.data_source is null
     or length(trim(v_draft.data_source)) = 0
     or v_draft.calories is null
     or v_draft.protein is null
     or v_draft.fat is null
     or v_draft.carbs is null
     or v_draft.calories < 0
     or v_draft.protein < 0
     or v_draft.fat < 0
     or v_draft.carbs < 0
     or (v_draft.fiber is not null and v_draft.fiber < 0)
     or v_draft.calories::text = 'NaN'
     or v_draft.protein::text = 'NaN'
     or v_draft.fat::text = 'NaN'
     or v_draft.carbs::text = 'NaN'
     or (v_draft.fiber is not null and v_draft.fiber::text = 'NaN') then
    return query
      select
        'invalid_draft'::text,
        null::uuid,
        'Draft does not satisfy owner-approved core food insert requirements.'::text;
    return;
  end if;

  if exists (
    select 1
    from public.foods f
    where (
        f.source in ('core', 'brand')
        or coalesce(f.normalized_brand, '') = ''
      )
      and (
        f.normalized_name = v_draft.normalized_name
        or public.normalize_food_text(f.name) = v_draft.normalized_name
      )
  ) then
    return query
      select
        'duplicate_food'::text,
        null::uuid,
        'A shared food or normalized-name unique-index conflict already exists.'::text;
    return;
  end if;

  begin
    insert into public.foods (
      id,
      name,
      calories,
      protein,
      fat,
      carbs,
      fiber,
      unit,
      category,
      source,
      created_by_user_id,
      canonical_food_id,
      normalized_name,
      normalized_brand,
      nutrition_version,
      verified,
      suspicious,
      confidence_score,
      source_version,
      allergens,
      intolerances,
      aliases,
      auto_filled,
      popularity
    )
    values (
      v_food_id,
      trim(v_draft.name),
      v_draft.calories,
      v_draft.protein,
      v_draft.fat,
      v_draft.carbs,
      v_draft.fiber,
      'g',
      trim(v_draft.category),
      'core',
      null,
      v_food_id,
      v_draft.normalized_name,
      null,
      1,
      true,
      false,
      1,
      concat('missing_food_draft:', v_draft.id::text, '; data_source:', trim(v_draft.data_source)),
      '{}'::text[],
      '{}'::text[],
      '{}'::text[],
      false,
      0
    );

    update public.food_missing_food_drafts
    set
      status = 'applied',
      applied_food_id = v_food_id,
      applied_by = v_admin_id,
      applied_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'owner_apply_result', 'applied',
        'owner_apply_food_id', v_food_id,
        'owner_apply_applied_at', now()
      )
    where id = v_draft.id;

    return query
      select
        'applied'::text,
        v_food_id,
        null::text;
    return;
  exception
    when unique_violation then
      return query
        select
          'duplicate_food'::text,
          null::uuid,
          'Food insert hit a unique constraint.'::text;
      return;
    when foreign_key_violation then
      return query
        select
          'insert_failed'::text,
          null::uuid,
          'Food insert or draft apply tracking hit a foreign key constraint.'::text;
      return;
    when others then
      v_result := 'insert_failed';
      v_error := sqlerrm;

      return query
        select
          v_result,
          null::uuid,
          v_error;
      return;
  end;
end;
$$;

comment on function public.apply_owner_approved_missing_food_draft(uuid) is
  'Owner-approved explicit apply for one ready missing-food draft. Inserts exactly one core food and marks the draft applied; never creates aliases.';

revoke all on function public.apply_owner_approved_missing_food_draft(uuid) from public;
grant execute on function public.apply_owner_approved_missing_food_draft(uuid) to authenticated;

-- Explicit anti-automation guard:
-- This draft defines no trigger on food_missing_food_drafts status changes.
-- Drafts do not create foods automatically. The RPC must be called explicitly
-- after owner approval, and it never writes public.food_aliases.

-- Suggested post-apply validation, if this draft is later approved:
--
-- select proname
-- from pg_proc
-- where proname = 'apply_owner_approved_missing_food_draft';
--
-- select grantee, privilege_type
-- from information_schema.routine_privileges
-- where routine_schema = 'public'
--   and routine_name = 'apply_owner_approved_missing_food_draft'
-- order by grantee, privilege_type;
--
-- select count(*) from public.foods;
-- select count(*) from public.food_aliases;
-- Expected after migration apply only: unchanged from pre-apply counts.

commit;
