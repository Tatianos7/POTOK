// Run with Node.js. Reads retained files only, with no account or database connection.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(name, import.meta.url));
const request = JSON.parse(read('one-request-staging-inputs.json'));
const rawWeek = read(request.referenceWeek);
assert.equal(createHash('sha256').update(rawWeek).digest('hex'), request.referenceWeekSha256);
const week = JSON.parse(rawWeek);
const rules = request.dailyAcceptance;
assert.equal(rules.allBoundsInclusive, true);
assert.equal(week.days.length, request.scope.expectedDays);
assert.deepEqual(week.axes, ['kcal', 'protein_g', 'fat_g', 'available_carbohydrate_g']);

const scaledTargets = week.target.map((value) => value * week.totalsScale);
const deltas = [
  rules.calorieDeltaKcal * week.totalsScale,
  scaledTargets[1] * rules.proteinDeltaPercent / 100,
  scaledTargets[2] * rules.fatDeltaPercent / 100,
  scaledTargets[3] * rules.carbohydrateDeltaPercent / 100,
];
const uses = new Map();
for (const [index, day] of week.days.entries()) {
  assert.equal(day.totals.length, week.axes.length);
  assert.equal(new Set(day.ids).size, day.ids.length, `Repeated recipe on day ${index + 1}`);
  for (const id of day.ids) uses.set(id, (uses.get(id) ?? 0) + 1);
  for (const [axis, total] of day.totals.entries()) {
    assert.ok(Number.isSafeInteger(total) && Math.abs(total - scaledTargets[axis]) <= deltas[axis],
      `Day ${index + 1}: ${week.axes[axis]} outside the approved interval`);
  }
}

const expectedUses = request.candidateRecipes.map(({ authoringRecipeId, referenceUses }) =>
  [authoringRecipeId, referenceUses]);
assert.deepEqual([...uses].sort(), expectedUses.sort());
assert.ok([...uses.values()].every((count) => count <= 2));
console.log(`Reference totals pass on all ${week.days.length} days, using ${uses.size} distinct recipes.`);

const missingPortions = request.candidateRecipes.filter((recipe) => recipe.portionReference.portionEvidence === null);
const missingPublication = request.candidateRecipes.filter((recipe) => recipe.publicationEvidence === null);
const missingBindings = Object.entries(request.requiredBindings)
  .filter(([, value]) => value === null).map(([name]) => name);
console.log(`Missing from the retained inputs: ${missingPortions.length} portion records, ` +
  `${missingPublication.length} publication records, ${missingBindings.length} request bindings.`);
if (missingBindings.length) console.log(missingBindings.join(', '));
if (process.argv.includes('--require-complete-inventory') &&
    (missingPortions.length || missingPublication.length || missingBindings.length)) {
  process.exitCode = 1;
}
