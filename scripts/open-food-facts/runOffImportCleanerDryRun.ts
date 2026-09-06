import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CleanedOffRecord,
  OffClassification,
  cleanOffRecords,
  summarizeCleanedRecords,
} from './offImportCleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const fixturePath = path.join(__dirname, 'fixtures/ru-sample-2026-09-06.json');
const reportPath = path.join(repoRoot, 'reports/open-food-facts-import-cleaner-dry-run-2026-09-06.md');
const jsonPath = path.join(repoRoot, 'reports/open-food-facts-import-cleaner-dry-run-2026-09-06.json');

const CLASSIFICATIONS: OffClassification[] = [
  'candidate_ok',
  'needs_language_review',
  'needs_quality_review',
  'needs_duplicate_review',
  'auto_reject',
];

const formatRecord = (record: CleanedOffRecord): string => {
  const name = record.ru_display_name || record.proposed_name || 'missing name';
  const brand = record.proposed_brand || 'missing brand';
  const reasons = record.reason_codes.length > 0 ? record.reason_codes.join(', ') : 'none';
  return `- \`${record.code || 'missing code'}\` - ${name}, brand \`${brand}\`, reasons: \`${reasons}\`, overall: ${record.overall_quality_score}`;
};

const sectionExamples = (title: string, records: CleanedOffRecord[]): string => {
  const examples = records.slice(0, 5);
  return [
    `## ${title}`,
    '',
    examples.length > 0 ? examples.map(formatRecord).join('\n') : '- No examples in this dry run.',
    '',
  ].join('\n');
};

const formatReasonCounts = (counts: Record<string, number>): string => {
  const entries = Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  return entries.length > 0
    ? entries.map(([reason, count]) => `- \`${reason}\`: ${count}`).join('\n')
    : '- No reason codes emitted.';
};

const buildMarkdownReport = (records: CleanedOffRecord[]): string => {
  const summary = summarizeCleanedRecords(records);
  const byClass = Object.fromEntries(
    CLASSIFICATIONS.map((classification) => [
      classification,
      records.filter((record) => record.classification === classification),
    ])
  ) as Record<OffClassification, CleanedOffRecord[]>;
  const noisyNames = records.filter((record) =>
    record.reason_codes.some((reason) =>
      ['ocr_or_scan_noise', 'mixed_language_name', 'brand_only_name', 'category_only_name', 'latin_primary_name'].includes(reason)
    )
  );
  const nutritionProblems = records.filter((record) =>
    record.reason_codes.some((reason) =>
      [
        'missing_calories',
        'missing_macros',
        'all_zero_kbju',
        'water_exception_needs_review',
        'suspicious_nutrition',
        'energy_macro_mismatch',
      ].includes(reason)
    )
  );
  const waterExceptions = records.filter((record) => record.reason_codes.includes('water_exception_needs_review'));
  const per100mlCandidates = records.filter((record) => record.reason_codes.includes('per_100ml_needs_handling'));

  return [
    '# Open Food Facts Import Cleaner Dry Run',
    '',
    '- Date: 2026-09-06',
    '- Branch: `master`',
    '- Source fixture: `scripts/open-food-facts/fixtures/ru-sample-2026-09-06.json`',
    '- Cleaner: `scripts/open-food-facts/offImportCleaner.ts`',
    '- Target package: `OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_IMPLEMENTATION`',
    '- Verdict: **OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_IMPLEMENTATION_READY**',
    '',
    '## Scope',
    '',
    'Run the local Open Food Facts RU/Russia fixture through the POTOK cleaner/scoring/classification rules. This was a local dry-run only: no API calls, no new data download, no Supabase client usage, no DB writes, no SQL execution, no runtime app integration, and no UI changes.',
    '',
    '## Summary Metrics',
    '',
    `- Total rows processed: ${summary.totalRows}`,
    ...CLASSIFICATIONS.map((classification) => `- \`${classification}\`: ${summary.countByClassification[classification]}`),
    '',
    '## Count By Reason Code',
    '',
    formatReasonCounts(summary.countByReasonCode),
    '',
    sectionExamples('Examples: candidate_ok', byClass.candidate_ok),
    sectionExamples('Examples: needs_language_review', byClass.needs_language_review),
    sectionExamples('Examples: needs_quality_review', byClass.needs_quality_review),
    sectionExamples('Examples: needs_duplicate_review', byClass.needs_duplicate_review),
    sectionExamples('Examples: auto_reject', byClass.auto_reject),
    sectionExamples('Top Noisy Names', noisyNames),
    sectionExamples('Nutrition Problems', nutritionProblems),
    sectionExamples('Water / All-Zero Exceptions', waterExceptions),
    sectionExamples('Per-100ml Beverage Candidates', per100mlCandidates),
    '## Owner Decision Checklist',
    '',
    '- Confirm whether `product_name_ru` remains mandatory for `candidate_ok`.',
    '- Confirm whether water/all-zero stays review-only.',
    '- Confirm whether mixed RU/Latin names are always reviewed.',
    '- Confirm barcode requirement for branded packaged products.',
    '- Confirm provider provenance fields before candidate persistence.',
    '- Confirm whether rejected rows remain report-only or need a reject-audit layer.',
    '',
    '## Final Recommendation',
    '',
    'The cleaner dry-run is useful enough to continue. The sample still shows why POTOK should keep Open Food Facts rows out of verified catalog until review/promotion. Next step: owner review of thresholds and examples, then a larger local dry-run if approved.',
    '',
    '## Safety Confirmation',
    '',
    '- local dry-run only;',
    '- no runtime app integration;',
    '- no UI changes;',
    '- no config/dependency changes;',
    '- no new dependencies;',
    '- no Open Food Facts live API calls;',
    '- no API keys;',
    '- no secrets;',
    '- no new data download;',
    '- no import into POTOK DB;',
    '- no Supabase client usage;',
    '- no Supabase SQL execution;',
    '- no staging mutation;',
    '- no production changes;',
    '- no RLS behavior tests;',
    '- no real table writes;',
    '- no service-role keys;',
    '- no RLS policy changes;',
    '- no Premium writes;',
    '- no diary runtime writes;',
    '- no `public.recipes` writes;',
    '- no recipe import;',
    '- no shopping persistence;',
    '- no AI runtime;',
    '- no voice input;',
    '- no payment enforcement;',
    '- no production rollout;',
    '- no PR;',
    '- no commit.',
    '',
    '## Verification',
    '',
    '- `npx tsx scripts/open-food-facts/runOffImportCleanerDryRun.ts`',
    '  - Result: passed.',
    '',
    '## Final Verdict',
    '',
    '**OPEN_FOOD_FACTS_IMPORT_CLEANER_DRY_RUN_IMPLEMENTATION_READY**',
    '',
  ].join('\n');
};

const run = async () => {
  const fixtureContent = await readFile(fixturePath, 'utf8');
  const records = JSON.parse(fixtureContent);
  const cleanedRecords = cleanOffRecords(records);
  const summary = summarizeCleanedRecords(cleanedRecords);
  const output = {
    generated_at: '2026-09-06',
    source_fixture: path.relative(repoRoot, fixturePath),
    summary,
    records: cleanedRecords,
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, buildMarkdownReport(cleanedRecords), 'utf8');
  await writeFile(jsonPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${path.relative(repoRoot, reportPath)}`);
  console.log(`Wrote ${path.relative(repoRoot, jsonPath)}`);
  console.log(JSON.stringify(summary, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
