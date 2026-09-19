import type { SupabaseClient } from '@supabase/supabase-js';
import type { Food } from '../types';
import { supabase } from '../lib/supabaseClient';
import { normalizeFoodText } from '../utils/foodNormalizer';
import { filterVisibleFoods } from '../utils/myProductsVisibility';
import { parseDiaryNutrient } from './diaryCreateService';

export type ResolverFood = Food & { is_searchable?: boolean; needs_review?: boolean };
export type FoodResolution =
  | { status: 'resolved'; food: ResolverFood; candidates: ResolverFood[] }
  | { status: 'ambiguous' | 'unresolved'; food: null; candidates: ResolverFood[]; reason: 'multiple_matches' | 'no_match' | 'unavailable' };

export interface ExactFoodRepository {
  /** Must include all exact name AND alias matches, without ranked-search deduplication. */
  findExact(normalized: string): Promise<ResolverFood[]>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VARIANT_WORDS = ['ростки', 'проростки', 'пророщенная', 'пророщенный', 'пророщенные'];
const SNAPSHOT_FIELDS = [
  'canonical_food_id', 'source', 'created_by_user_id', 'is_searchable', 'needs_review',
  'name', 'name_original', 'normalized_name', 'calories', 'protein', 'fat', 'carbs', 'fiber',
] as const;

export function resolveExactFoodCandidates(query: string, foods: ResolverFood[], userId?: string): FoodResolution {
  const key = normalizeFoodText(query);
  if (!key) return { status: 'unresolved', food: null, candidates: [], reason: 'no_match' };
  // Name and alias reads are separate requests. Do not choose a later snapshot
  // if a food changes between them, including changes that would hide one row.
  const snapshots = new Map<string, ResolverFood>();
  for (const food of foods) {
    const previous = snapshots.get(food.id);
    if (previous && SNAPSHOT_FIELDS.some((field) => !Object.is(previous[field], food[field]))) {
      return { status: 'unresolved', food: null, candidates: [], reason: 'unavailable' };
    }
    snapshots.set(food.id, { ...food, aliases: [...new Set([...(previous?.aliases ?? []), ...(food.aliases ?? [])])] });
  }
  const candidates = (filterVisibleFoods([...snapshots.values()], userId) as ResolverFood[]).filter((food) => {
    if (!UUID.test(food.id) || food.canonical_food_id !== food.id || food.is_searchable === false || food.needs_review === true) return false;
    const names = [food.name, food.name_original, food.normalized_name, ...(food.aliases ?? [])]
      .filter((value): value is string => typeof value === 'string').map(normalizeFoodText);
    // Preserve the existing base-food versus sprouts safety rule.
    if (!VARIANT_WORDS.some((word) => key.includes(word)) &&
        names.some((name) => VARIANT_WORDS.some((word) => name.includes(word)))) return false;
    return names.includes(key);
  });
  const unique = candidates.sort((a, b) => a.id.localeCompare(b.id));
  if (unique.length === 1) return { status: 'resolved', food: unique[0], candidates: unique };
  return { status: unique.length ? 'ambiguous' : 'unresolved', food: null, candidates: unique,
    reason: unique.length ? 'multiple_matches' : 'no_match' };
}

type FoodRow = Omit<ResolverFood, 'calories' | 'protein' | 'fat' | 'carbs' | 'fiber'> & {
  calories: unknown; protein: unknown; fat: unknown; carbs: unknown; fiber?: unknown;
};
const mapFood = (row: FoodRow): ResolverFood => ({
  ...row,
  calories: parseDiaryNutrient(row.calories), protein: parseDiaryNutrient(row.protein),
  fat: parseDiaryNutrient(row.fat), carbs: parseDiaryNutrient(row.carbs),
  fiber: row.fiber == null ? null : parseDiaryNutrient(row.fiber),
});

// A bounded read may only resolve when the server confirms the COMPLETE result.
// Missing counts, capped results, missing alias targets and errors fail closed.
const READ_LIMIT = 100;
function completeRows<T>(result: { data: T[] | null; count: number | null; error: unknown }): T[] {
  if (result.error || !result.data || result.count === null || result.count !== result.data.length) {
    throw new Error('exact_food_lookup_incomplete');
  }
  return result.data;
}

export function createExactFoodRepository(client: Pick<SupabaseClient, 'from'> | null): ExactFoodRepository {
  return {
    async findExact(normalized) {
      if (!client) throw new Error('catalog_unavailable');
      const [namesResult, aliasesResult] = await Promise.all([
        client.from('foods').select('*', { count: 'exact' }).eq('normalized_name', normalized).limit(READ_LIMIT),
        client.from('food_aliases').select('canonical_food_id', { count: 'exact' }).eq('normalized_alias', normalized).limit(READ_LIMIT),
      ]);
      const names = completeRows<FoodRow>(namesResult).map(mapFood);
      const aliases = completeRows<{ canonical_food_id: string }>(aliasesResult);
      const ids = [...new Set(aliases.map((row) => row.canonical_food_id))];
      if (ids.some((id) => !UUID.test(id))) throw new Error('invalid_alias_target');
      if (!ids.length) return names;
      const targetsResult = await client.from('foods').select('*', { count: 'exact' }).in('id', ids).limit(READ_LIMIT);
      const targets = completeRows<FoodRow>(targetsResult);
      const returnedIds = new Set(targets.map((row) => row.id));
      if (targets.length !== ids.length || returnedIds.size !== ids.length || ids.some((id) => !returnedIds.has(id))) {
        throw new Error('alias_target_unavailable');
      }
      return [...names, ...targets.map((row) => ({ ...mapFood(row), aliases: [...(row.aliases ?? []), normalized] }))];
    },
  };
}

export const exactFoodRepository = createExactFoodRepository(supabase);

export const canonicalFoodResolver = {
  async resolve(query: string, userId?: string, repository: ExactFoodRepository = exactFoodRepository): Promise<FoodResolution> {
    const normalized = normalizeFoodText(query);
    if (!normalized) return { status: 'unresolved', food: null, candidates: [], reason: 'no_match' };
    try {
      return resolveExactFoodCandidates(normalized, await repository.findExact(normalized), userId);
    } catch {
      return { status: 'unresolved', food: null, candidates: [], reason: 'unavailable' };
    }
  },
};
