import { supabase } from '../lib/supabaseClient';
import { FOODS_DATABASE } from '../data/foodsDatabase';
import { buildNormalizedBrand, buildNormalizedName, normalizeFoodText, validateNutrition } from '../utils/foodNormalizer';

const BATCH_SIZE = 100;

const isValidAlias = (value: string) => value && value.trim().length > 0;

export async function seedFoods(): Promise<void> {
  if (!supabase) {
    console.error('Supabase не инициализирован');
    return;
  }

  const items = FOODS_DATABASE.map((item) => {
    const nutrition = {
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      fat: Number(item.fat) || 0,
      carbs: Number(item.carbs) || 0,
      fiber: 0,
    };
    const { suspicious } = validateNutrition(nutrition);
    const name = item.name_ru.trim();
    return {
      name,
      name_original: item.name_en?.trim() || null,
      brand: null,
      category: item.category || null,
      calories: nutrition.calories,
      protein: nutrition.protein,
      fat: nutrition.fat,
      carbs: nutrition.carbs,
      fiber: nutrition.fiber,
      unit: 'g',
      source: 'core',
      normalized_name: buildNormalizedName(name),
      normalized_brand: buildNormalizedBrand(null),
      nutrition_version: 1,
      verified: true,
      suspicious,
      aliases: item.aliases || [],
      auto_filled: false,
      popularity: 0,
    };
  });

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('foods')
      .upsert(batch, { onConflict: 'normalized_name,normalized_brand' })
      .select('id,name,name_original,aliases');

    if (error) {
      console.error('[seedFoods] Error inserting foods:', error);
      continue;
    }

    const aliasRows: Array<{ canonical_food_id: string; alias: string; source: string; verified: boolean }> = [];
    (data || []).forEach((row: any) => {
      const aliases = new Set<string>();
      [row.name, row.name_original, ...(row.aliases || [])].forEach((value: string) => {
        if (isValidAlias(value)) {
          aliases.add(value);
        }
      });
      aliases.forEach((alias) => {
        const normalized = normalizeFoodText(alias);
        if (!normalized) return;
        aliasRows.push({
          canonical_food_id: row.id,
          alias,
          source: 'core',
          verified: true,
        });
      });
    });

    if (aliasRows.length > 0) {
      const { error: aliasError } = await supabase
        .from('food_aliases')
        .upsert(aliasRows, { onConflict: 'normalized_alias' });
      if (aliasError) {
        console.error('[seedFoods] Error inserting aliases:', aliasError);
      }
    }
  }

  console.log('[seedFoods] Foods import completed');
}

if (typeof window !== 'undefined') {
  (window as any).seedFoods = seedFoods;
}
