import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const SOURCES = [
  {
    file: 'src/data/foodsDatabase.ts',
    kind: 'foods_database',
    pattern: /name_ru:\s*'([^']+)'[\s\S]*?calories:\s*([0-9.]+),[\s\S]*?protein:\s*([0-9.]+),[\s\S]*?fat:\s*([0-9.]+),[\s\S]*?carbs:\s*([0-9.]+)/g,
  },
  {
    file: 'src/data/foodsDatabaseGenerator.ts',
    kind: 'foods_database_generator',
    pattern: /name_ru:\s*'([^']+)'[\s\S]*?calories:\s*([0-9.]+),[\s\S]*?protein:\s*([0-9.]+),[\s\S]*?fat:\s*([0-9.]+),[\s\S]*?carbs:\s*([0-9.]+)/g,
  },
  {
    file: 'src/data/baseFoods.ts',
    kind: 'base_foods',
    pattern: /name:\s*'([^']+)'[\s\S]*?calories:\s*([0-9.]+),[\s\S]*?protein:\s*([0-9.]+),[\s\S]*?fat:\s*([0-9.]+),[\s\S]*?carbs:\s*([0-9.]+)/g,
  },
];

function toLineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

function parseEntries() {
  const all = [];

  for (const source of SOURCES) {
    const abs = path.join(ROOT, source.file);
    const text = fs.readFileSync(abs, 'utf8');
    let match;

    while ((match = source.pattern.exec(text)) !== null) {
      const [raw, name, calories, protein, fat, carbs] = match;
      all.push({
        name,
        calories: Number(calories),
        protein: Number(protein),
        fat: Number(fat),
        carbs: Number(carbs),
        source_kind: source.kind,
        source_file: source.file,
        source_line: toLineNumber(text, match.index),
        raw_length: raw.length,
      });
    }
  }

  return all;
}

function csvEscape(value) {
  const stringValue = value == null ? '' : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function writeCsv(filePath, rows) {
  const header = Object.keys(rows[0] ?? {});
  const lines = [header.join(',')];

  for (const row of rows) {
    lines.push(header.map((key) => csvEscape(row[key])).join(','));
  }

  fs.writeFileSync(path.join(ROOT, filePath), `${lines.join('\n')}\n`, 'utf8');
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildRepoReferenceValues(rows) {
  return rows
    .map(
      (row) =>
        `    (${sqlString(row.name)}, ${row.calories}, ${row.protein}, ${row.fat}, ${row.carbs}, ${sqlString(
          row.source_files,
        )})`,
    )
    .join(',\n');
}

function writeSql(filePath, contents) {
  fs.writeFileSync(path.join(ROOT, filePath), contents, 'utf8');
}

const parsed = parseEntries();
const byName = new Map();

for (const entry of parsed) {
  const list = byName.get(entry.name) ?? [];
  list.push(entry);
  byName.set(entry.name, list);
}

const exactUnique = [];
const ambiguous = [];

for (const [name, entries] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'))) {
  const macroKeys = new Map();
  for (const entry of entries) {
    const key = `${entry.calories}|${entry.protein}|${entry.fat}|${entry.carbs}`;
    const list = macroKeys.get(key) ?? [];
    list.push(entry);
    macroKeys.set(key, list);
  }

  const sourceRefs = entries
    .map((entry) => `${entry.source_file}:${entry.source_line}`)
    .join('; ');

  if (macroKeys.size === 1) {
    const sample = entries[0];
    if (!(sample.calories === 0 && sample.protein === 0 && sample.fat === 0 && sample.carbs === 0)) {
      exactUnique.push({
        name,
        calories: sample.calories,
        protein: sample.protein,
        fat: sample.fat,
        carbs: sample.carbs,
        source_count: entries.length,
        source_files: sourceRefs,
      });
    }
    continue;
  }

  ambiguous.push({
    name,
    candidate_macro_variants: macroKeys.size,
    candidate_values: [...macroKeys.entries()]
      .map(([key, variantEntries]) => `${key} <= ${variantEntries.map((entry) => `${entry.source_file}:${entry.source_line}`).join('|')}`)
      .join(' || '),
    source_count: entries.length,
    source_files: sourceRefs,
  });
}

writeCsv('docs/data/nutrition_repo_exact_unique_reference.csv', exactUnique);
writeCsv('docs/data/nutrition_repo_ambiguous_reference.csv', ambiguous);

const repoValues = buildRepoReferenceValues(exactUnique);

writeSql(
  'scripts/sql/nutrition_zero_macro_exact_unique_batch_preview.sql',
  `-- Nutrition zero-macro exact unique batch preview
-- Read-only
-- Purpose:
-- - classify 2026-03-05 zero-macro incident rows using exact unique repo nutrition matches
-- - separate whitelist-valid zero rows from autofix batch and manual review

with repo_exact_unique_reference (
  name,
  target_calories,
  target_protein,
  target_fat,
  target_carbs,
  authoritative_source
) as (
  values
${repoValues}
),
incident_zero_foods as (
  select
    f.id,
    f.name,
    f.brand,
    f.source,
    f.category,
    f.created_at,
    f.updated_at
  from public.foods f
  where f.created_at::date = date '2026-03-05'
    and coalesce(f.calories, 0) = 0
    and coalesce(f.protein, 0) = 0
    and coalesce(f.fat, 0) = 0
    and coalesce(f.carbs, 0) = 0
),
whitelist_valid_zero as (
  select *
  from incident_zero_foods
  where lower(coalesce(name, '')) in ('вода', 'water')
),
autofix_batch as (
  select
    f.id,
    f.name,
    f.brand,
    f.source,
    f.category,
    r.target_calories,
    r.target_protein,
    r.target_fat,
    r.target_carbs,
    r.authoritative_source
  from incident_zero_foods f
  join repo_exact_unique_reference r
    on lower(r.name) = lower(f.name)
  where f.source in ('core', 'brand')
    and lower(coalesce(f.name, '')) not in ('вода', 'water')
),
manual_review as (
  select
    f.id,
    f.name,
    f.brand,
    f.source,
    f.category,
    case
      when f.source not in ('core', 'brand') then 'out_of_catalog_repair_scope'
      else 'no_exact_unique_repo_match'
    end as review_reason
  from incident_zero_foods f
  where not exists (
      select 1
      from whitelist_valid_zero w
      where w.id = f.id
    )
    and not exists (
      select 1
      from autofix_batch a
      where a.id = f.id
    )
)
select
  (select count(*) from incident_zero_foods) as incident_zero_rows,
  (select count(*) from whitelist_valid_zero) as whitelist_valid_zero_rows,
  (select count(*) from autofix_batch) as autofix_batch_rows,
  (select count(*) from manual_review) as manual_review_rows;

select
  id,
  name,
  brand,
  source,
  category,
  target_calories,
  target_protein,
  target_fat,
  target_carbs,
  authoritative_source
from autofix_batch
order by name, id;

select
  id,
  name,
  brand,
  source,
  category,
  review_reason
from manual_review
order by name, id;
`,
);

writeSql(
  'scripts/sql/nutrition_zero_macro_exact_unique_autofix_draft.sql',
  `-- Nutrition zero-macro exact unique autofix draft
-- DRAFT ONLY
-- Do not run blindly in production
-- Purpose:
-- - autofix 2026-03-05 incident foods rows that have exact unique repo nutrition matches
-- - keep all unmatched rows out of the batch
-- Rules:
-- - exact ids only via exact name join to repo exact-unique reference
-- - update only if row is still all-zero
-- - core/brand only
-- - no category-wide update

begin;

with repo_exact_unique_reference (
  name,
  target_calories,
  target_protein,
  target_fat,
  target_carbs,
  authoritative_source
) as (
  values
${repoValues}
),
autofix_batch as (
  select
    f.id,
    f.name,
    f.source,
    f.category,
    f.created_at,
    r.target_calories,
    r.target_protein,
    r.target_fat,
    r.target_carbs,
    r.authoritative_source
  from public.foods f
  join repo_exact_unique_reference r
    on lower(r.name) = lower(f.name)
  where f.created_at::date = date '2026-03-05'
    and f.source in ('core', 'brand')
    and lower(coalesce(f.name, '')) not in ('вода', 'water')
    and coalesce(f.calories, 0) = 0
    and coalesce(f.protein, 0) = 0
    and coalesce(f.fat, 0) = 0
    and coalesce(f.carbs, 0) = 0
)
select
  id,
  name,
  source,
  category,
  target_calories,
  target_protein,
  target_fat,
  target_carbs,
  authoritative_source
from autofix_batch
order by name, id;

with repo_exact_unique_reference (
  name,
  target_calories,
  target_protein,
  target_fat,
  target_carbs,
  authoritative_source
) as (
  values
${repoValues}
),
autofix_batch as (
  select
    f.id,
    r.target_calories,
    r.target_protein,
    r.target_fat,
    r.target_carbs
  from public.foods f
  join repo_exact_unique_reference r
    on lower(r.name) = lower(f.name)
  where f.created_at::date = date '2026-03-05'
    and f.source in ('core', 'brand')
    and lower(coalesce(f.name, '')) not in ('вода', 'water')
    and coalesce(f.calories, 0) = 0
    and coalesce(f.protein, 0) = 0
    and coalesce(f.fat, 0) = 0
    and coalesce(f.carbs, 0) = 0
)
update public.foods f
set
  calories = a.target_calories,
  protein = a.target_protein,
  fat = a.target_fat,
  carbs = a.target_carbs,
  suspicious = false,
  nutrition_version = coalesce(f.nutrition_version, 1) + 1,
  updated_at = now()
from autofix_batch a
where f.id = a.id
  and coalesce(f.calories, 0) = 0
  and coalesce(f.protein, 0) = 0
  and coalesce(f.fat, 0) = 0
  and coalesce(f.carbs, 0) = 0;

with repo_exact_unique_reference (
  name,
  target_calories,
  target_protein,
  target_fat,
  target_carbs,
  authoritative_source
) as (
  values
${repoValues}
),
autofix_batch as (
  select
    f.id
  from public.foods f
  join repo_exact_unique_reference r
    on lower(r.name) = lower(f.name)
  where f.created_at::date = date '2026-03-05'
    and f.source in ('core', 'brand')
    and lower(coalesce(f.name, '')) not in ('вода', 'water')
),
affected_diary_rows as (
  select
    fde.id,
    fde.user_id,
    fde.date,
    fde.meal_type,
    fde.canonical_food_id,
    f.name as canonical_food_name,
    fde.weight,
    fde.created_at
  from public.food_diary_entries fde
  join autofix_batch a
    on a.id = fde.canonical_food_id
  join public.foods f
    on f.id = fde.canonical_food_id
  where coalesce(fde.calories, 0) = 0
    and coalesce(fde.protein, 0) = 0
    and coalesce(fde.fat, 0) = 0
    and coalesce(fde.carbs, 0) = 0
)
select *
from affected_diary_rows
order by created_at desc, id;

rollback;
`,
);

writeSql(
  'scripts/sql/nutrition_zero_macro_exact_unique_diary_remediation_preview.sql',
  `-- Nutrition zero-macro exact unique diary remediation preview
-- Read-only
-- Purpose:
-- - preview diary rows affected by the exact unique autofix batch
-- - show only rows whose current stored snapshot is all-zero
-- - no writes

with repo_exact_unique_reference (
  name,
  target_calories,
  target_protein,
  target_fat,
  target_carbs,
  authoritative_source
) as (
  values
${repoValues}
),
autofix_batch as (
  select
    f.id,
    f.name,
    r.target_calories,
    r.target_protein,
    r.target_fat,
    r.target_carbs,
    r.authoritative_source
  from public.foods f
  join repo_exact_unique_reference r
    on lower(r.name) = lower(f.name)
  where f.created_at::date = date '2026-03-05'
    and f.source in ('core', 'brand')
    and lower(coalesce(f.name, '')) not in ('вода', 'water')
),
affected_diary_rows as (
  select
    fde.id,
    fde.user_id,
    fde.date,
    fde.meal_type,
    fde.canonical_food_id,
    a.name as canonical_food_name,
    fde.weight,
    fde.calories as current_calories,
    round((a.target_calories * fde.weight / 100.0)::numeric, 2) as target_calories,
    fde.protein as current_protein,
    round((a.target_protein * fde.weight / 100.0)::numeric, 2) as target_protein,
    fde.fat as current_fat,
    round((a.target_fat * fde.weight / 100.0)::numeric, 2) as target_fat,
    fde.carbs as current_carbs,
    round((a.target_carbs * fde.weight / 100.0)::numeric, 2) as target_carbs,
    a.authoritative_source,
    fde.created_at
  from public.food_diary_entries fde
  join autofix_batch a
    on a.id = fde.canonical_food_id
  where coalesce(fde.calories, 0) = 0
    and coalesce(fde.protein, 0) = 0
    and coalesce(fde.fat, 0) = 0
    and coalesce(fde.carbs, 0) = 0
)
select *
from affected_diary_rows
order by created_at desc, id;
`,
);

console.log(
  JSON.stringify(
    {
      parsed_rows: parsed.length,
      exact_unique_names: exactUnique.length,
      ambiguous_names: ambiguous.length,
      outputs: [
        'docs/data/nutrition_repo_exact_unique_reference.csv',
        'docs/data/nutrition_repo_ambiguous_reference.csv',
        'scripts/sql/nutrition_zero_macro_exact_unique_batch_preview.sql',
        'scripts/sql/nutrition_zero_macro_exact_unique_autofix_draft.sql',
        'scripts/sql/nutrition_zero_macro_exact_unique_diary_remediation_preview.sql',
      ],
    },
    null,
    2,
  ),
);
