-- Draft only. Do not run without explicit owner approval.
-- Purpose: persistent recipe image support.

begin;

alter table public.recipes
  add column if not exists image text;

comment on column public.recipes.image is
  'Optional recipe image URL or data URL. Intended production path is storage URL from recipe-photos bucket.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-photos',
  'recipe-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'recipe_photos_select_own'
  ) then
    create policy recipe_photos_select_own
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'recipe-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'recipe_photos_insert_own'
  ) then
    create policy recipe_photos_insert_own
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'recipe-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'recipe_photos_update_own'
  ) then
    create policy recipe_photos_update_own
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'recipe-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'recipe-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'recipe_photos_delete_own'
  ) then
    create policy recipe_photos_delete_own
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'recipe-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');

commit;
