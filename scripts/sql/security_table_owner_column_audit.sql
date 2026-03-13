-- security table owner-column audit
-- Read-only

with target_tables as (
  select * from (values
    ('habits'),
    ('user_goals'),
    ('habit_logs'),
    ('analytics_events'),
    ('user_profiles')
  ) as t(table_name)
), cols as (
  select
    c.table_name,
    c.column_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name in (select table_name from target_tables)
), habits_owner as (
  select c.column_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'habits'
    and c.column_name in ('user_id', 'id_user', 'id')
  order by case c.column_name when 'user_id' then 1 when 'id_user' then 2 when 'id' then 3 else 100 end
  limit 1
)
select
  t.table_name,
  coalesce(array_agg(c.column_name order by c.column_name) filter (where c.column_name is not null), array[]::text[]) as columns_present,
  case
    when t.table_name in ('habits', 'user_goals', 'analytics_events', 'user_profiles') then (
      select c2.column_name
      from information_schema.columns c2
      where c2.table_schema = 'public'
        and c2.table_name = t.table_name
        and c2.column_name in ('user_id', 'id_user', 'id')
      order by case c2.column_name when 'user_id' then 1 when 'id_user' then 2 when 'id' then 3 else 100 end
      limit 1
    )
    when t.table_name = 'habit_logs' then coalesce(
      (
        select c2.column_name
        from information_schema.columns c2
        where c2.table_schema = 'public'
          and c2.table_name = 'habit_logs'
          and c2.column_name in ('user_id', 'id_user', 'id')
        order by case c2.column_name when 'user_id' then 1 when 'id_user' then 2 when 'id' then 3 else 100 end
        limit 1
      ),
      'via_habits_join'
    )
    else null
  end as owner_column_used,
  case
    when t.table_name in ('habits', 'user_goals', 'user_profiles') and exists (
      select 1
      from information_schema.columns c2
      where c2.table_schema = 'public'
        and c2.table_name = t.table_name
        and c2.column_name in ('user_id', 'id_user', 'id')
    ) then 'direct_owner'
    when t.table_name = 'analytics_events' and exists (
      select 1
      from information_schema.columns c2
      where c2.table_schema = 'public'
        and c2.table_name = t.table_name
        and c2.column_name in ('user_id', 'id_user', 'id')
    ) then 'insert_only_direct_owner'
    when t.table_name = 'analytics_events' then 'skip_no_safe_owner'
    when t.table_name = 'habit_logs' and exists (
      select 1
      from information_schema.columns c2
      where c2.table_schema = 'public'
        and c2.table_name = 'habit_logs'
        and c2.column_name = 'habit_id'
    ) and exists (select 1 from habits_owner) and exists (
      select 1
      from information_schema.columns c2
      where c2.table_schema = 'public'
        and c2.table_name = 'habit_logs'
        and c2.column_name in ('user_id', 'id_user', 'id')
    ) then 'direct_plus_habit_join'
    when t.table_name = 'habit_logs' and exists (
      select 1
      from information_schema.columns c2
      where c2.table_schema = 'public'
        and c2.table_name = 'habit_logs'
        and c2.column_name = 'habit_id'
    ) and exists (select 1 from habits_owner) then 'habit_join_owner'
    when t.table_name = 'habit_logs' and exists (
      select 1
      from information_schema.columns c2
      where c2.table_schema = 'public'
        and c2.table_name = 'habit_logs'
        and c2.column_name in ('user_id', 'id_user', 'id')
    ) then 'direct_owner'
    else 'skip_no_safe_owner'
  end as policy_mode
from target_tables t
left join cols c
  on c.table_name = t.table_name
group by t.table_name
order by t.table_name;
