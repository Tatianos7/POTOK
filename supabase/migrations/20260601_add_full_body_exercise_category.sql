insert into public.exercise_categories (name, "order")
values ('Все тело', 8)
on conflict (name) do update set "order" = excluded."order";
