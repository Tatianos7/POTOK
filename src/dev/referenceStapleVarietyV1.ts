/** Reference-only culinary variety. Literal source names, never canonical identity,
 * allergen screening, nutrient approval or a complete recipe-family taxonomy. */
export interface ReferenceStapleRecipe {
  name: string;
  ingredients?: {name: string; optional: boolean}[];
}
const rules = [
  ['buckwheat', /греч(?:к|нев)/u], ['rice', /(?:^|[^а-яa-z])рис(?:а|ом|овый|овая|овые)?(?:$|[^а-яa-z])/u],
  ['oats', /овся|овес/u], ['millet', /пшено|пшенн/u], ['barley', /перлов/u],
  ['quinoa', /киноа/u], ['bulgur', /булгур/u], ['couscous', /кус[ -]?кус/u],
  ['pasta', /макарон|спагетти|(?:^|[^а-яa-z])паста(?:$|[^а-яa-z])|лапша|соба/u],
  ['potato', /картоф/u], ['lentils', /чечевиц/u], ['beans', /фасол/u],
] as const;
export function referenceStapleGroups(recipe: ReferenceStapleRecipe): string[] {
  const texts = [recipe.name, ...(recipe.ingredients ?? []).filter(i => !i.optional).map(i => i.name)]
    .map(s => s.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е'));
  return rules.filter(([group, pattern]) => texts.some(text => {
    // These are not grain side dishes. Green beans are vegetables, not dry beans.
    if (group === 'rice' && /мука|крахмал|масло|молоко|напиток|уксус/u.test(text)) return false;
    if (group === 'pasta' && /(?:томатная|арахисовая|ореховая|кунжутная) паста|паста (?:томатная|арахисовая|ореховая|кунжутная)/u.test(text)) return false;
    if (group === 'beans' && /стручков/u.test(text)) return false;
    return pattern.test(text);
  })).map(([group]) => group);
}
export function referenceDayHasDistinctStaples(recipes: ReferenceStapleRecipe[]): boolean {
  const used = new Set<string>();
  for (const recipe of recipes) for (const group of referenceStapleGroups(recipe)) {
    if (used.has(group)) return false;
    used.add(group);
  }
  return true;
}
