# Recipe Images Production Storage Readiness

- Timestamp: 2026-07-24T00:00:00Z
- Target production ref: `dtsdnhbcwpbfrhcazqkb`
- Draft: `scripts/sql/production-add-recipe-images-draft.sql`
- Final verdict: **FRONTEND_STORAGE_LAYER_PASS_AWAITING_OWNER_SCHEMA_APPROVAL**

## Safety

- Food Core is not changed.
- No import, backfill, recompute, delete, or historical data rewrite is included.
- Existing diary, favorites, recipes, and recipe ingredients are not touched.
- This review did not apply the migration or create a bucket in production.

## Current Runtime State

The recipe image runtime is now storage-aware:

- `recipeImagesService.saveImage()` tries Supabase Storage first;
- upload path is `recipe-photos/user/{user_id}/recipes/{recipe_id}/cover.jpg`;
- `public.recipes.image` is updated with the storage path after upload;
- `getImageByRecipeId()` and `getImagesByRecipeIds()` resolve storage paths to signed URLs for rendering;
- `RecipeDetails`, `RecipeAnalyzer`, `RecipesGrid`, and `RecipesList` use `recipeImagesService`;
- localStorage remains only a temporary fallback when the bucket or `recipes.image` column is not available yet.

This means the frontend is ready for the storage schema, but production cross-device photo smoke still requires explicit owner approval and manual application of the SQL draft.

## Draft Review

Reviewed:

```text
scripts/sql/production-add-recipe-images-draft.sql
```

The draft is additive-only:

- wraps changes in `begin` / `commit`;
- adds nullable `public.recipes.image text` with `add column if not exists`;
- creates or updates only bucket `recipe-photos`;
- does not update existing recipe rows;
- does not create, delete, or rewrite storage objects;
- does not touch Food Core, diary, favorites, recipe ingredients, import, backfill, or recompute;
- reloads PostgREST schema with `select pg_notify('pgrst', 'reload schema')`.

## Storage Contract

Expected bucket:

```text
recipe-photos
```

Expected bucket settings:

- private bucket: `public = false`;
- file size limit: `5242880` bytes;
- allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.

Expected object path:

```text
user/{user_id}/recipes/{recipe_id}/cover.jpg
```

Expected DB field:

```text
public.recipes.image = user/{user_id}/recipes/{recipe_id}/cover.jpg
```

The app should render images by creating signed URLs from this storage path. It should not depend on public storage URLs or localStorage as the primary cross-device source.

## Storage RLS / Policies

Expected policies on `storage.objects`:

| policy | command | rule |
| --- | --- | --- |
| `recipe_photos_select_own` | select | bucket is `recipe-photos`, path starts with `user/{auth.uid()}` |
| `recipe_photos_insert_own` | insert | bucket is `recipe-photos`, path starts with `user/{auth.uid()}` |
| `recipe_photos_update_own` | update | bucket is `recipe-photos`, path starts with `user/{auth.uid()}` |
| `recipe_photos_delete_own` | delete | bucket is `recipe-photos`, path starts with `user/{auth.uid()}` |

The bucket is private, so mobile/desktop cross-device display should use authenticated signed URLs.

## Run Instruction

Do not run without explicit owner approval.

After approval:

1. Open Supabase production project `dtsdnhbcwpbfrhcazqkb`.
2. Open SQL Editor.
3. Paste exactly the contents of:

```text
scripts/sql/production-add-recipe-images-draft.sql
```

4. Run only this script.
5. Do not run Food Core import/apply, backfill, recompute, diary writes, or unrelated migrations in the same step.

## Read-Only Post-Apply Validation

After SQL Editor reports success, validate with read-only SQL:

```sql
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'recipes'
  and column_name = 'image';

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'recipe-photos';

select
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'recipe_photos_%'
order by policyname;
```

Expected:

- `public.recipes.image` exists and is nullable `text`;
- `storage.buckets.recipe-photos` exists;
- bucket `public = false`;
- file limit is `5242880`;
- allowed MIME types include jpeg/png/webp;
- four storage own-path policies exist.

## Frontend Implementation Contract

Implemented frontend/service behavior:

- compress/validate file as today;
- upload to `recipe-photos/user/{sessionUserId}/recipes/{recipeId}/cover.jpg`;
- use `upsert: true`, with content type `image/jpeg` after compression;
- update only the owning `recipes` row with `image = storagePath`;
- load `recipes.image` as storage path;
- create signed URLs for render in details/grid/list;
- keep localStorage only as temporary fallback for legacy browser-local photos;
- on upload failure, show a clear user-facing error and do not pretend cross-device save succeeded;
- on replace, overwrite the same object path and update UI after signed URL refresh.

## Manual Smoke Checklist

After schema/storage apply and frontend storage implementation deploy:

- desktop incognito: create recipe photo and confirm it uploads;
- recipe details: photo displays;
- reload: photo persists;
- recipes grid/list: thumbnail displays;
- replace photo: new photo displays after reload;
- mobile same account: same recipe photo is visible;
- verify no Food Core, diary, favorites, backfill, recompute, or historical recipe mutations were run.

## Verdict

**FRONTEND_STORAGE_LAYER_PASS_AWAITING_OWNER_SCHEMA_APPROVAL**

Exact next step: request explicit owner approval before manually applying `scripts/sql/production-add-recipe-images-draft.sql` in production SQL Editor, then run the post-apply validation and manual photo smoke.
