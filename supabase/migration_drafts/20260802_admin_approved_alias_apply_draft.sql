-- Admin-approved Alias Apply draft migration
-- DRAFT ONLY. Do not apply without explicit owner approval.
--
-- Purpose:
-- - allow admins to explicitly apply an approved Search Review row as one food_aliases row
-- - validate duplicate/conflict/orphan/ambiguous states before insert
-- - record an audit trail for every apply attempt
--
-- Safety:
-- - no automatic trigger from food_search_review_queue.status
-- - no automatic alias insertion
-- - no automatic food creation
-- - never writes to public.foods
-- - never remaps diary/favorites/recipes
-- - never recomputes nutrition snapshots

begin;

create table if not exists public.food_alias_apply_audit (
  id uuid primary key default gen_random_uuid(),
  source_review_id uuid references public.food_search_review_queue (id) on delete restrict,
  alias_id uuid references public.food_aliases (id) on delete set null,
  alias text not null,
  normalized_alias text not null,
  canonical_food_id uuid references public.foods (id) on delete set null,
  applied_by uuid references auth.users (id) on delete set null,
  applied_at timestamptz not null default now(),
  result text not null,
  error text,
  validation jsonb not null default '{}'::jsonb,
  comment text,
  constraint food_alias_apply_audit_result_check
    check (
      result in (
        'applied',
        'duplicate_alias',
        'existing_alias_conflict',
        'orphan_canonical',
        'invalid_canonical_source',
        'not_approved',
        'ambiguous_alias',
        'missing_source_evidence',
        'already_applied',
        'permission_denied',
        'invalid_alias',
        'review_not_found',
        'insert_failed'
      )
    ),
  constraint food_alias_apply_audit_alias_not_blank_check
    check (length(trim(alias)) > 0),
  constraint food_alias_apply_audit_normalized_alias_not_blank_check
    check (length(trim(normalized_alias)) > 0),
  constraint food_alias_apply_audit_applied_shape_check
    check (
      (
        result = 'applied'
        and source_review_id is not null
        and alias_id is not null
        and canonical_food_id is not null
        and applied_by is not null
        and error is null
      )
      or result <> 'applied'
    )
);

comment on table public.food_alias_apply_audit is
  'Immutable audit trail for explicit admin-approved alias apply attempts. Does not create aliases automatically.';
comment on column public.food_alias_apply_audit.source_review_id is
  'Approved Search Review queue row that the admin attempted to apply.';
comment on column public.food_alias_apply_audit.result is
  'Validation/apply result. Only result=applied means a food_aliases row was inserted.';

create index if not exists food_alias_apply_audit_source_review_id_idx
  on public.food_alias_apply_audit (source_review_id, applied_at desc);

create index if not exists food_alias_apply_audit_normalized_alias_idx
  on public.food_alias_apply_audit (normalized_alias, applied_at desc);

create index if not exists food_alias_apply_audit_canonical_food_id_idx
  on public.food_alias_apply_audit (canonical_food_id, applied_at desc)
  where canonical_food_id is not null;

create index if not exists food_alias_apply_audit_result_idx
  on public.food_alias_apply_audit (result, applied_at desc);

alter table public.food_search_review_queue
  add column if not exists applied_alias_id uuid references public.food_aliases (id) on delete set null,
  add column if not exists alias_applied_by uuid references auth.users (id) on delete set null,
  add column if not exists alias_applied_at timestamptz,
  add column if not exists alias_apply_result text,
  add column if not exists alias_apply_error text;

alter table public.food_search_review_queue
  drop constraint if exists food_search_review_queue_alias_apply_result_check;

alter table public.food_search_review_queue
  add constraint food_search_review_queue_alias_apply_result_check
    check (
      alias_apply_result is null
      or alias_apply_result in (
        'applied',
        'duplicate_alias',
        'existing_alias_conflict',
        'orphan_canonical',
        'invalid_canonical_source',
        'not_approved',
        'ambiguous_alias',
        'missing_source_evidence',
        'already_applied',
        'permission_denied',
        'invalid_alias',
        'review_not_found',
        'insert_failed'
      )
    );

alter table public.food_search_review_queue
  drop constraint if exists food_search_review_queue_alias_apply_shape_check;

alter table public.food_search_review_queue
  add constraint food_search_review_queue_alias_apply_shape_check
    check (
      (
        alias_apply_result = 'applied'
        and applied_alias_id is not null
        and alias_applied_by is not null
        and alias_applied_at is not null
        and alias_apply_error is null
      )
      or alias_apply_result is distinct from 'applied'
    );

create index if not exists food_search_review_queue_alias_apply_result_idx
  on public.food_search_review_queue (alias_apply_result, alias_applied_at desc)
  where alias_apply_result is not null;

create index if not exists food_search_review_queue_applied_alias_id_idx
  on public.food_search_review_queue (applied_alias_id)
  where applied_alias_id is not null;

alter table public.food_alias_apply_audit enable row level security;

drop policy if exists food_alias_apply_audit_admin_select on public.food_alias_apply_audit;
create policy food_alias_apply_audit_admin_select
  on public.food_alias_apply_audit
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profiles
      where id_user = auth.uid()
        and is_admin = true
    )
  );

drop policy if exists food_alias_apply_audit_admin_insert on public.food_alias_apply_audit;
create policy food_alias_apply_audit_admin_insert
  on public.food_alias_apply_audit
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_profiles
      where id_user = auth.uid()
        and is_admin = true
    )
  );

create or replace function public.apply_admin_approved_food_alias(
  p_review_id uuid,
  p_alias text default null,
  p_comment text default null
)
returns table (
  result text,
  alias_id uuid,
  error text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_review public.food_search_review_queue%rowtype;
  v_alias text;
  v_normalized_alias text;
  v_existing_alias public.food_aliases%rowtype;
  v_canonical_source text;
  v_has_ambiguous_event boolean := false;
  v_alias_id uuid;
  v_result text;
  v_error text;
  v_validation jsonb := '{}'::jsonb;
begin
  if v_admin_id is null or not exists (
    select 1
    from public.user_profiles
    where id_user = v_admin_id
      and is_admin = true
  ) then
    v_result := 'permission_denied';
    v_error := 'Current user is not an admin.';

    if v_admin_id is not null then
      v_alias := coalesce(nullif(trim(coalesce(p_alias, '')), ''), 'unknown');
      v_normalized_alias := public.normalize_food_text(v_alias);

      insert into public.food_alias_apply_audit (
        source_review_id,
        alias,
        normalized_alias,
        applied_by,
        result,
        error,
        validation,
        comment
      )
      values (
        null,
        v_alias,
        v_normalized_alias,
        v_admin_id,
        v_result,
        v_error,
        jsonb_build_object('review_id', p_review_id),
        p_comment
      );
    end if;

    return query select v_result, null::uuid, v_error;
    return;
  end if;

  select *
  into v_review
  from public.food_search_review_queue
  where id = p_review_id
  for update;

  if not found then
    v_alias := coalesce(nullif(trim(coalesce(p_alias, '')), ''), 'unknown');
    v_normalized_alias := public.normalize_food_text(v_alias);
    v_result := 'review_not_found';
    v_error := 'Review row was not found.';

    insert into public.food_alias_apply_audit (
      source_review_id,
      alias,
      normalized_alias,
      applied_by,
      result,
      error,
      validation,
      comment
    )
    values (
      null,
      v_alias,
      v_normalized_alias,
      v_admin_id,
      v_result,
      v_error,
      jsonb_build_object('review_id', p_review_id),
      p_comment
    );

    return query select v_result, null::uuid, v_error;
    return;
  end if;

  v_alias := coalesce(nullif(trim(coalesce(p_alias, '')), ''), trim(v_review.query));
  v_normalized_alias := public.normalize_food_text(v_alias);

  v_validation := jsonb_build_object(
    'review_id', v_review.id,
    'review_status', v_review.status,
    'suggested_canonical_food_id', v_review.suggested_canonical_food_id,
    'alias', v_alias,
    'normalized_alias', v_normalized_alias,
    'source_event_ids', v_review.source_event_ids
  );

  if length(v_alias) = 0 or length(v_normalized_alias) = 0 then
    v_result := 'invalid_alias';
    v_error := 'Alias is blank after normalization.';
  elsif v_review.status <> 'approved' then
    v_result := 'not_approved';
    v_error := 'Review row is not approved.';
  elsif v_review.applied_alias_id is not null then
    v_result := 'already_applied';
    v_error := 'Review row already has an applied alias.';
  elsif v_review.suggested_canonical_food_id is null then
    v_result := 'orphan_canonical';
    v_error := 'Approved review row has no suggested canonical food.';
  else
    select source
    into v_canonical_source
    from public.foods
    where id = v_review.suggested_canonical_food_id;

    if not found then
      v_result := 'orphan_canonical';
      v_error := 'Suggested canonical food does not exist.';
    elsif v_canonical_source not in ('core', 'brand') then
      v_result := 'invalid_canonical_source';
      v_error := 'Suggested canonical food is not a shared core/brand food.';
    end if;
  end if;

  if v_result = 'already_applied' then
    insert into public.food_alias_apply_audit (
      source_review_id,
      alias_id,
      alias,
      normalized_alias,
      canonical_food_id,
      applied_by,
      result,
      error,
      validation,
      comment
    )
    values (
      v_review.id,
      v_review.applied_alias_id,
      v_alias,
      v_normalized_alias,
      v_review.suggested_canonical_food_id,
      v_admin_id,
      v_result,
      v_error,
      v_validation,
      p_comment
    );

    return query select v_result, v_review.applied_alias_id, v_error;
    return;
  end if;

  if v_result is null then
    if coalesce(array_length(v_review.source_event_ids, 1), 0) = 0 then
      v_result := 'missing_source_evidence';
      v_error := 'Review row has no source search events for safe alias apply.';
    end if;
  end if;

  if v_result is null then
    select exists (
      select 1
      from public.food_search_events
      where id = any(v_review.source_event_ids)
        and event_type = 'ambiguous'
    )
    into v_has_ambiguous_event;

    if v_has_ambiguous_event or v_review.metadata->>'event_type' = 'ambiguous' then
      v_result := 'ambiguous_alias';
      v_error := 'Ambiguous review rows are blocked from alias apply in this MVP.';
    end if;
  end if;

  if v_result is null then
    select *
    into v_existing_alias
    from public.food_aliases
    where normalized_alias = v_normalized_alias
    limit 1;

    if found and v_existing_alias.canonical_food_id = v_review.suggested_canonical_food_id then
      v_result := 'duplicate_alias';
      v_error := 'Alias already exists for the same canonical food.';
    elsif found then
      v_result := 'existing_alias_conflict';
      v_error := 'Alias already exists for another canonical food.';
    end if;
  end if;

  if v_result is null then
    begin
      insert into public.food_aliases (
        canonical_food_id,
        alias,
        source,
        verified,
        created_by_user_id
      )
      values (
        v_review.suggested_canonical_food_id,
        v_alias,
        'core',
        true,
        v_admin_id
      )
      returning id into v_alias_id;

      v_result := 'applied';
      v_error := null;
    exception
      when unique_violation then
        v_result := 'duplicate_alias';
        v_error := 'Alias became duplicate during apply.';
      when foreign_key_violation then
        v_result := 'orphan_canonical';
        v_error := 'Canonical food reference failed during apply.';
      when others then
        v_result := 'insert_failed';
        v_error := sqlerrm;
    end;
  end if;

  insert into public.food_alias_apply_audit (
    source_review_id,
    alias_id,
    alias,
    normalized_alias,
    canonical_food_id,
    applied_by,
    result,
    error,
    validation,
    comment
  )
  values (
    v_review.id,
    v_alias_id,
    v_alias,
    v_normalized_alias,
    v_review.suggested_canonical_food_id,
    v_admin_id,
    v_result,
    v_error,
    v_validation,
    p_comment
  );

  update public.food_search_review_queue
  set
    applied_alias_id = coalesce(v_alias_id, applied_alias_id),
    alias_applied_by = case when v_result = 'applied' then v_admin_id else alias_applied_by end,
    alias_applied_at = case when v_result = 'applied' then now() else alias_applied_at end,
    alias_apply_result = v_result,
    alias_apply_error = v_error,
    updated_at = now()
  where id = v_review.id;

  return query select v_result, v_alias_id, v_error;
end;
$$;

comment on function public.apply_admin_approved_food_alias(uuid, text, text) is
  'Explicit admin-only apply for approved Search Review rows. Validates and inserts at most one food_aliases row; never writes foods.';

revoke all on function public.apply_admin_approved_food_alias(uuid, text, text) from public;
grant execute on function public.apply_admin_approved_food_alias(uuid, text, text) to authenticated;

-- Explicit anti-automation guard:
-- This draft defines no trigger on food_search_review_queue status changes.
-- Approved rows do not create aliases until an admin explicitly calls
-- public.apply_admin_approved_food_alias(...).

-- Suggested post-apply validation, if this draft is later approved:
--
-- select column_name
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'food_search_review_queue'
--   and column_name in (
--     'applied_alias_id',
--     'alias_applied_by',
--     'alias_applied_at',
--     'alias_apply_result',
--     'alias_apply_error'
--   )
-- order by column_name;
--
-- select table_name
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name = 'food_alias_apply_audit';
--
-- select proname
-- from pg_proc
-- where proname = 'apply_admin_approved_food_alias';
--
-- select count(*) from public.foods;
-- select count(*) from public.food_aliases;
-- Expected: unchanged from pre-apply counts.

commit;
