import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateRecipeCandidates } from './validateRecipeCandidates';

const args = process.argv.slice(2);
const allowed = new Set(['--recipes', '--foods', '--output']);
const options = new Map<string, string>();
for (let i = 0; i < args.length; i += 2) {
  if (!allowed.has(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options.has(args[i])) {
    throw new Error('Usage: runRecipeDryRun --recipes candidates.json --foods canonical-export.json --output new-report.json');
  }
  options.set(args[i], args[i + 1]);
}
if (options.size !== 3) throw new Error('All three local file arguments are required. This tool has no apply mode.');

const [recipeText, foodText] = await Promise.all([
  readFile(options.get('--recipes')!, 'utf8'), readFile(options.get('--foods')!, 'utf8'),
]);
const recipes = JSON.parse(recipeText);
const catalog = JSON.parse(foodText);
if (!Array.isArray(recipes) || recipes.length === 0 || !catalog || !Array.isArray(catalog.foods) ||
    typeof catalog.exported_at !== 'string' || !Number.isFinite(Date.parse(catalog.exported_at)) ||
    typeof catalog.source_project_ref !== 'string' || !catalog.source_project_ref.trim()) {
  throw new Error('Expected candidate array and catalog {exported_at, source_project_ref, foods}.');
}
const report = {
  ...validateRecipeCandidates(recipes, catalog.foods),
  catalog: { exported_at: catalog.exported_at, source_project_ref: catalog.source_project_ref },
  input_sha256: {
    recipes: createHash('sha256').update(recipeText).digest('hex'),
    foods: createHash('sha256').update(foodText).digest('hex'),
  },
};
// Exclusive creation prevents accidental replacement of an input or owner file.
await writeFile(options.get('--output')!, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report.summary));
process.exitCode = report.summary.rejected || report.summary.review ? 1 : 0;
