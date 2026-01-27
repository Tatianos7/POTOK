import { supabase } from '../lib/supabaseClient';
import { buildNormalizedBrand, buildNormalizedName, normalizeFoodText, validateNutrition } from './foodNormalizer';

export interface FoodImportRow {
  name: string;
  brand?: string | null;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
  unit?: string;
  source?: 'core' | 'brand' | 'user';
  aliases?: string[];
  verified?: boolean;
  confidenceScore?: number;
  sourceVersion?: string | null;
  allergens?: string[];
  intolerances?: string[];
}

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result;
};

export const parseCsvToRows = (csv: string): FoodImportRow[] => {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map((h) => normalizeFoodText(h));

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });

    const aliases = row.aliases ? row.aliases.split(';').map((a) => a.trim()).filter(Boolean) : [];
    const allergens = row.allergens ? row.allergens.split(';').map((a) => a.trim()).filter(Boolean) : [];
    const intolerances = row.intolerances ? row.intolerances.split(';').map((a) => a.trim()).filter(Boolean) : [];

    return {
      name: row.name || row['name_ru'] || row['название'] || '',
      brand: row.brand || null,
      calories: Number(row.calories || 0),
      protein: Number(row.protein || 0),
      fat: Number(row.fat || 0),
      carbs: Number(row.carbs || 0),
      fiber: Number(row.fiber || 0),
      unit: row.unit || 'g',
      source: (row.source as FoodImportRow['source']) || 'core',
      aliases,
      verified: row.verified ? row.verified === 'true' || row.verified === '1' : undefined,
      confidenceScore: row.confidence ? Number(row.confidence) : undefined,
      sourceVersion: row['source version'] || row.source_version || row['sourceversion'] || null,
      allergens,
      intolerances,
    };
  });
};

export async function importFoodsFromRows(rows: FoodImportRow[]): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase не инициализирован');
  }

  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const payload = batch.map((row) => {
      const nutrition = {
        calories: Number(row.calories) || 0,
        protein: Number(row.protein) || 0,
        fat: Number(row.fat) || 0,
        carbs: Number(row.carbs) || 0,
        fiber: Number(row.fiber) || 0,
      };
      const { suspicious } = validateNutrition(nutrition);
      const name = row.name.trim();
      return {
        name,
        brand: row.brand || null,
        calories: nutrition.calories,
        protein: nutrition.protein,
        fat: nutrition.fat,
        carbs: nutrition.carbs,
        fiber: nutrition.fiber,
        unit: row.unit || 'g',
        source: row.source || 'core',
        normalized_name: buildNormalizedName(name),
        normalized_brand: buildNormalizedBrand(row.brand ?? null),
        nutrition_version: 1,
        verified: row.verified ?? false,
        suspicious,
        confidence_score: row.confidenceScore ?? (row.verified ? 0.95 : 0.7),
        source_version: row.sourceVersion ?? null,
        allergens: row.allergens ?? [],
        intolerances: row.intolerances ?? [],
        aliases: row.aliases ?? [],
        auto_filled: false,
        popularity: 0,
      };
    });

    const { data, error } = await supabase
      .from('foods')
      .upsert(payload, { onConflict: 'normalized_name,normalized_brand' })
      .select('id,name,name_original,aliases');

    if (error) {
      throw error;
    }

    const aliasRows: Array<{ canonical_food_id: string; alias: string; source: string; verified: boolean }>= [];
    (data || []).forEach((row: any) => {
      const aliasSet = new Set<string>();
      [row.name, row.name_original, ...(row.aliases || [])].forEach((value: string) => {
        if (value && value.trim()) {
          aliasSet.add(value.trim());
        }
      });
      aliasSet.forEach((alias) => {
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
        throw aliasError;
      }
    }
  }
}

export async function importFoodsFromCsv(csv: string): Promise<void> {
  const rows = parseCsvToRows(csv);
  if (rows.length === 0) return;
  await importFoodsFromRows(rows);
}
