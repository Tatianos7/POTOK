alter table if exists public.measurement_photo_assets
  add column if not exists thumb_path text;
