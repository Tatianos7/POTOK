insert into public.muscles (name)
values ('Отводящие мышцы бедра')
on conflict (name) do nothing;
