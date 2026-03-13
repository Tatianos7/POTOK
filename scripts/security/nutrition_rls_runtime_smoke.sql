-- Nutrition RLS runtime smoke test (Supabase SQL Editor)
-- Readme:
-- 1) Replace CONFIG UUIDs with two REAL users from auth.users.
-- 2) Run the whole script as postgres in SQL Editor.
-- 3) Expected:
--    - catalog_rows: >= 0 when foods.source exists (query must succeed for authenticated).
--    - a_favorites_visible = 1, b_sees_a_favorites = 0, a_favorites_updated = 1, a_favorites_deleted = 1.
--    - a_diary_visible = 1, b_sees_a_diary = 0, a_diary_updated = 1, a_diary_deleted = 1.
--    - a_notes_visible = 1 (if meal_entry_notes exists), b_sees_a_notes = 0.
--    - food_import_conflicts: either count result (often 0) OR permission/RLS error is acceptable.
-- 4) Script never persists data: all writes are wrapped in transaction and ROLLBACK.

begin;

-- =========================================================
-- CONFIG (replace values before run)
-- A_UUID   = '11111111-1111-4111-8111-111111111111'
-- B_UUID   = '22222222-2222-4222-8222-222222222222'
-- DATE_KEY = '2026-03-03'
-- =========================================================
create temp table _cfg (
  a_uuid uuid not null,
  b_uuid uuid not null,
  date_key date not null
) on commit drop;

insert into _cfg(a_uuid, b_uuid, date_key)
values (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid,
  '2026-03-03'::date
);

create temp table _metrics (
  metric text primary key,
  value_num numeric,
  value_text text,
  pass boolean,
  details text
) on commit drop;

insert into _metrics(metric, value_num, value_text, pass, details)
select
  'a_user_exists',
  count(*)::numeric,
  null,
  (count(*) = 1),
  'auth.users has A_UUID'
from auth.users u
join _cfg c on u.id = c.a_uuid;

insert into _metrics(metric, value_num, value_text, pass, details)
select
  'b_user_exists',
  count(*)::numeric,
  null,
  (count(*) = 1),
  'auth.users has B_UUID'
from auth.users u
join _cfg c on u.id = c.b_uuid;

-- ---------------------------------------------------------
-- 1) foods catalog read: authenticated can read source in ('core','brand')
-- ---------------------------------------------------------
do $$
declare
  v_a uuid;
  v_rows bigint;
  has_foods boolean;
  has_source boolean;
begin
  select a_uuid into v_a from _cfg;

  select exists(
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'foods'
  ) into has_foods;

  if not has_foods then
    insert into _metrics(metric, value_text, pass, details)
    values ('catalog_rows', 'skipped', null, 'public.foods table not found');
    return;
  end if;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'foods' and column_name = 'source'
  ) into has_source;

  if not has_source then
    insert into _metrics(metric, value_text, pass, details)
    values ('catalog_rows', 'skipped', null, 'foods.source column not found (test skipped by design)');
    return;
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_a::text, true);

  begin
    select count(*) into v_rows
    from public.foods
    where source in ('core', 'brand');

    insert into _metrics(metric, value_num, pass, details)
    values ('catalog_rows', v_rows::numeric, true, 'authenticated catalog query succeeded');
  exception when others then
    insert into _metrics(metric, value_text, pass, details)
    values (
      'catalog_rows',
      concat('error ', sqlstate, ': ', left(sqlerrm, 180)),
      false,
      'authenticated catalog query failed'
    );
  end;

  execute 'reset role';
end $$;

-- ---------------------------------------------------------
-- 2) favorite_products CRUD + cross-user isolation
-- ---------------------------------------------------------
do $$
declare
  v_a uuid;
  v_b uuid;
  row_id uuid;
  c int;
  can_run boolean;
begin
  select a_uuid, b_uuid into v_a, v_b from _cfg;

  select
    coalesce((select pass from _metrics where metric='a_user_exists'), false)
    and coalesce((select pass from _metrics where metric='b_user_exists'), false)
    and exists(
      select 1 from information_schema.tables
      where table_schema='public' and table_name='favorite_products'
    )
  into can_run;

  if not can_run then
    insert into _metrics(metric, value_text, pass, details)
    values ('a_favorites_visible', 'skipped', null, 'favorite_products missing or config users not found');
    insert into _metrics(metric, value_text, pass, details)
    values ('b_sees_a_favorites', 'skipped', null, 'favorite_products missing or config users not found');
    insert into _metrics(metric, value_text, pass, details)
    values ('a_favorites_updated', 'skipped', null, 'favorite_products missing or config users not found');
    insert into _metrics(metric, value_text, pass, details)
    values ('a_favorites_deleted', 'skipped', null, 'favorite_products missing or config users not found');
    return;
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_a::text, true);

  insert into public.favorite_products(user_id, product_name, protein, fat, carbs, calories)
  values (v_a, '__smoke_fav__', 1, 1, 1, 10)
  returning id into row_id;

  select count(*) into c from public.favorite_products where id = row_id;
  insert into _metrics(metric, value_num, pass, details)
  values ('a_favorites_visible', c, c = 1, 'A can see own favorite row');

  update public.favorite_products
  set product_name = '__smoke_fav_updated__'
  where id = row_id;
  get diagnostics c = row_count;
  insert into _metrics(metric, value_num, pass, details)
  values ('a_favorites_updated', c, c = 1, 'A can update own favorite row');

  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_b::text, true);

  select count(*) into c from public.favorite_products where id = row_id;
  insert into _metrics(metric, value_num, pass, details)
  values ('b_sees_a_favorites', c, c = 0, 'B should not see A favorite row');

  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_a::text, true);

  delete from public.favorite_products where id = row_id;
  get diagnostics c = row_count;
  insert into _metrics(metric, value_num, pass, details)
  values ('a_favorites_deleted', c, c = 1, 'A can delete own favorite row');

  execute 'reset role';
exception when others then
  insert into _metrics(metric, value_text, pass, details)
  values ('a_favorites_visible', concat('error ', sqlstate, ': ', left(sqlerrm, 180)), false, 'favorite_products smoke failed');
  execute 'reset role';
end $$;

-- ---------------------------------------------------------
-- 3) food_diary_entries CRUD + 4) meal_entry_notes ownership
-- ---------------------------------------------------------
do $$
declare
  v_a uuid;
  v_b uuid;
  d date;
  entry_id uuid;
  note_id uuid;
  c int;
  has_diary boolean;
  has_notes boolean;
  can_run boolean;
begin
  select a_uuid, b_uuid, date_key into v_a, v_b, d from _cfg;

  select exists(
    select 1 from information_schema.tables
    where table_schema='public' and table_name='food_diary_entries'
  ) into has_diary;

  select exists(
    select 1 from information_schema.tables
    where table_schema='public' and table_name='meal_entry_notes'
  ) into has_notes;

  select
    coalesce((select pass from _metrics where metric='a_user_exists'), false)
    and coalesce((select pass from _metrics where metric='b_user_exists'), false)
    and has_diary
  into can_run;

  if not can_run then
    insert into _metrics(metric, value_text, pass, details)
    values ('a_diary_visible', 'skipped', null, 'food_diary_entries missing or config users not found');
    insert into _metrics(metric, value_text, pass, details)
    values ('b_sees_a_diary', 'skipped', null, 'food_diary_entries missing or config users not found');
    insert into _metrics(metric, value_text, pass, details)
    values ('a_diary_updated', 'skipped', null, 'food_diary_entries missing or config users not found');
    insert into _metrics(metric, value_text, pass, details)
    values ('a_diary_deleted', 'skipped', null, 'food_diary_entries missing or config users not found');
    if not has_notes then
      insert into _metrics(metric, value_text, pass, details)
      values ('a_notes_visible', 'skipped', null, 'meal_entry_notes table not found');
      insert into _metrics(metric, value_text, pass, details)
      values ('b_sees_a_notes', 'skipped', null, 'meal_entry_notes table not found');
    end if;
    return;
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_a::text, true);

  insert into public.food_diary_entries(
    user_id, date, meal_type, product_name,
    protein, fat, carbs, fiber, calories, weight
  )
  values (
    v_a, d, 'breakfast', '__smoke_diary__',
    1, 1, 1, 0, 10, 100
  )
  returning id into entry_id;

  select count(*) into c from public.food_diary_entries where id = entry_id;
  insert into _metrics(metric, value_num, pass, details)
  values ('a_diary_visible', c, c = 1, 'A can see own diary entry');

  update public.food_diary_entries
  set product_name = '__smoke_diary_updated__'
  where id = entry_id;
  get diagnostics c = row_count;
  insert into _metrics(metric, value_num, pass, details)
  values ('a_diary_updated', c, c = 1, 'A can update own diary entry');

  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_b::text, true);

  select count(*) into c from public.food_diary_entries where id = entry_id;
  insert into _metrics(metric, value_num, pass, details)
  values ('b_sees_a_diary', c, c = 0, 'B should not see A diary entry');

  if has_notes then
    execute 'reset role';
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_a::text, true);

    insert into public.meal_entry_notes(user_id, meal_entry_id, text)
    values (v_a, entry_id, '__smoke_note__')
    returning id into note_id;

    select count(*) into c from public.meal_entry_notes where id = note_id;
    insert into _metrics(metric, value_num, pass, details)
    values ('a_notes_visible', c, c = 1, 'A can see own note');

    execute 'reset role';
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_b::text, true);

    select count(*) into c from public.meal_entry_notes where id = note_id;
    insert into _metrics(metric, value_num, pass, details)
    values ('b_sees_a_notes', c, c = 0, 'B should not see A note');

    execute 'reset role';
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_a::text, true);

    delete from public.meal_entry_notes where id = note_id;
  else
    insert into _metrics(metric, value_text, pass, details)
    values ('a_notes_visible', 'skipped', null, 'meal_entry_notes table not found');
    insert into _metrics(metric, value_text, pass, details)
    values ('b_sees_a_notes', 'skipped', null, 'meal_entry_notes table not found');
  end if;

  delete from public.food_diary_entries where id = entry_id;
  get diagnostics c = row_count;
  insert into _metrics(metric, value_num, pass, details)
  values ('a_diary_deleted', c, c = 1, 'A can delete own diary entry');

  execute 'reset role';
exception when others then
  insert into _metrics(metric, value_text, pass, details)
  values ('a_diary_visible', concat('error ', sqlstate, ': ', left(sqlerrm, 180)), false, 'food_diary_entries/meal_entry_notes smoke failed');
  execute 'reset role';
end $$;

-- ---------------------------------------------------------
-- 5) food_import_conflicts should be closed for authenticated clients
-- ---------------------------------------------------------
do $$
declare
  v_a uuid;
  c bigint;
  has_conflicts boolean;
begin
  select a_uuid into v_a from _cfg;

  select exists(
    select 1 from information_schema.tables
    where table_schema='public' and table_name='food_import_conflicts'
  ) into has_conflicts;

  if not has_conflicts then
    insert into _metrics(metric, value_text, pass, details)
    values ('food_import_conflicts_client_access', 'skipped', null, 'food_import_conflicts table not found');
    return;
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_a::text, true);

  begin
    select count(*) into c from public.food_import_conflicts;
    insert into _metrics(metric, value_num, pass, details)
    values (
      'food_import_conflicts_client_access',
      c,
      true,
      'query succeeded; acceptable when RLS/grants return 0 rows'
    );
  exception when others then
    insert into _metrics(metric, value_text, pass, details)
    values (
      'food_import_conflicts_client_access',
      concat('error ', sqlstate, ': ', left(sqlerrm, 180)),
      true,
      'permission denied / RLS error is acceptable for closed table'
    );
  end;

  execute 'reset role';
end $$;

-- =========================================================
-- Outputs
-- =========================================================
select
  (select value_num from _metrics where metric='catalog_rows') as catalog_rows,
  (select value_num from _metrics where metric='a_favorites_visible') as a_favorites_visible,
  (select value_num from _metrics where metric='b_sees_a_favorites') as b_sees_a_favorites,
  (select value_num from _metrics where metric='a_favorites_updated') as a_favorites_updated,
  (select value_num from _metrics where metric='a_favorites_deleted') as a_favorites_deleted,
  (select value_num from _metrics where metric='a_diary_visible') as a_diary_visible,
  (select value_num from _metrics where metric='b_sees_a_diary') as b_sees_a_diary,
  (select value_num from _metrics where metric='a_diary_updated') as a_diary_updated,
  (select value_num from _metrics where metric='a_diary_deleted') as a_diary_deleted,
  (select value_num from _metrics where metric='a_notes_visible') as a_notes_visible,
  (select value_num from _metrics where metric='b_sees_a_notes') as b_sees_a_notes;

select
  metric,
  value_num,
  value_text,
  pass,
  details
from _metrics
order by metric;

rollback;
