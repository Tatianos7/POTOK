import { supabase } from '../lib/supabaseClient';
import { FoodImportRow, parseCsvToRows } from '../utils/foodImportPipeline';
import { buildNormalizedBrand, buildNormalizedName, validateNutrition } from '../utils/foodNormalizer';
import { aiRecommendationsService } from './aiRecommendationsService';

export type IngestionSource = 'excel' | 'usda' | 'open_food_facts' | 'brand' | 'exercise_library';

export interface ImportBatch {
  id: string;
  status: string;
  source: IngestionSource;
  filename?: string | null;
  source_version?: string | null;
}

export interface ImportConflict {
  id: string;
  batch_id: string;
  staging_id: string;
  conflict_type: string;
  details: Record<string, unknown> | null;
  status: string;
}

const MACRO_DIFF_THRESHOLD = 0.2;
const LOW_CONFIDENCE_THRESHOLD = 0.6;

class FoodIngestionService {
  private async getSessionUserId(): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }
    return data.user.id;
  }

  private buildConfidence(row: FoodImportRow, suspicious: boolean): number {
    if (row.verified) return 0.95;
    if (suspicious) return 0.4;
    if (row.source === 'brand') return 0.85;
    return 0.7;
  }

  async createBatch(payload: { source: IngestionSource; filename?: string | null; sourceVersion?: string | null }): Promise<ImportBatch> {
    if (!supabase) throw new Error('Supabase не инициализирован');
    const userId = await this.getSessionUserId();
    const { data, error } = await supabase
      .from('food_import_batches')
      .insert({
        user_id: userId,
        source: payload.source,
        filename: payload.filename ?? null,
        source_version: payload.sourceVersion ?? null,
        status: 'pending',
      })
      .select('id,status,source,filename,source_version')
      .single();

    if (error || !data) {
      throw error || new Error('Не удалось создать batch');
    }

    return data as ImportBatch;
  }

  async stageCsv(batchId: string, csv: string, options?: { source?: 'core' | 'brand'; sourceVersion?: string | null }): Promise<{ staged: number; conflicts: number } > {
    if (!supabase) throw new Error('Supabase не инициализирован');
    const userId = await this.getSessionUserId();
    const rows = parseCsvToRows(csv);
    if (rows.length === 0) return { staged: 0, conflicts: 0 };

    const payload = rows.map((row) => {
      const nutrition = {
        calories: Number(row.calories) || 0,
        protein: Number(row.protein) || 0,
        fat: Number(row.fat) || 0,
        carbs: Number(row.carbs) || 0,
        fiber: Number(row.fiber) || 0,
      };
      const { suspicious } = validateNutrition(nutrition);
      const name = row.name.trim();
      const normalizedName = buildNormalizedName(name);
      const normalizedBrand = buildNormalizedBrand(row.brand ?? null);
      const confidence = row.confidenceScore ?? this.buildConfidence(row, suspicious);

      return {
        batch_id: batchId,
        user_id: userId,
        name,
        brand: row.brand ?? null,
        calories: nutrition.calories,
        protein: nutrition.protein,
        fat: nutrition.fat,
        carbs: nutrition.carbs,
        fiber: nutrition.fiber,
        unit: row.unit || 'g',
        aliases: row.aliases ?? [],
        allergens: row.allergens ?? [],
        intolerances: row.intolerances ?? [],
        source: options?.source ?? row.source ?? 'core',
        source_version: options?.sourceVersion ?? row.sourceVersion ?? null,
        normalized_name: normalizedName,
        normalized_brand: normalizedBrand,
        confidence_score: confidence,
        verified: row.verified ?? false,
        suspicious,
        status: 'pending',
        raw_data: row,
      };
    });

    const { error } = await supabase.from('food_import_staging').insert(payload);
    if (error) throw error;

    const conflicts = await this.detectConflicts(batchId);
    return { staged: payload.length, conflicts };
  }

  private macrosDiff(a: Record<string, number>, b: Record<string, number>): number {
    const keys = ['calories', 'protein', 'fat', 'carbs'];
    const diffs = keys.map((key) => {
      const av = a[key] ?? 0;
      const bv = b[key] ?? 0;
      if (av === 0 && bv === 0) return 0;
      return Math.abs(av - bv) / Math.max(av, bv, 1);
    });
    return Math.max(...diffs);
  }

  async detectConflicts(batchId: string): Promise<number> {
    if (!supabase) throw new Error('Supabase не инициализирован');

    const { data: stagingRows, error } = await supabase
      .from('food_import_staging')
      .select('*')
      .eq('batch_id', batchId)
      .eq('status', 'pending');

    if (error) throw error;
    if (!stagingRows || stagingRows.length === 0) return 0;

    const names = Array.from(new Set(stagingRows.map((row: any) => row.normalized_name).filter(Boolean)));

    const { data: existingFoods } = await supabase
      .from('foods')
      .select('id,name,brand,normalized_name,normalized_brand,calories,protein,fat,carbs,source,confidence_score')
      .in('normalized_name', names)
      .limit(5000);

    const conflictRows: Array<{ batch_id: string; staging_id: string; conflict_type: string; details: Record<string, unknown> } > = [];
    const updates: Array<{ id: string; status: string; conflict_reason?: string }> = [];

    stagingRows.forEach((row: any) => {
      const candidates = (existingFoods || []).filter((food: any) =>
        food.normalized_name === row.normalized_name &&
        String(food.normalized_brand || '') === String(row.normalized_brand || '')
      );

      if (candidates.length === 0) {
        updates.push({ id: row.id, status: 'accepted' });
        return;
      }

      const best = candidates[0];
      const diff = this.macrosDiff(
        { calories: row.calories, protein: row.protein, fat: row.fat, carbs: row.carbs },
        { calories: best.calories, protein: best.protein, fat: best.fat, carbs: best.carbs }
      );

      if (diff >= MACRO_DIFF_THRESHOLD) {
        conflictRows.push({
          batch_id: batchId,
          staging_id: row.id,
          conflict_type: 'macro_conflict',
          details: {
            existing_food_id: best.id,
            existing: { calories: best.calories, protein: best.protein, fat: best.fat, carbs: best.carbs },
            incoming: { calories: row.calories, protein: row.protein, fat: row.fat, carbs: row.carbs },
            diff,
          },
        });
        updates.push({ id: row.id, status: 'conflict', conflict_reason: 'macro_conflict' });
      } else {
        updates.push({ id: row.id, status: 'accepted' });
      }
    });

    if (updates.length > 0) {
      const { error: updateError } = await supabase.from('food_import_staging').upsert(updates, { onConflict: 'id' });
      if (updateError) throw updateError;
    }

    if (conflictRows.length > 0) {
      const { error: conflictError } = await supabase.from('food_import_conflicts').insert(conflictRows);
      if (conflictError) throw conflictError;
    }

    return conflictRows.length;
  }

  async listConflicts(batchId: string): Promise<ImportConflict[]> {
    if (!supabase) throw new Error('Supabase не инициализирован');
    const { data, error } = await supabase
      .from('food_import_conflicts')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ImportConflict[];
  }

  async resolveConflict(conflictId: string, resolution: 'accept_new' | 'use_existing' | 'reject'): Promise<void> {
    if (!supabase) throw new Error('Supabase не инициализирован');

    const { data: conflict, error } = await supabase
      .from('food_import_conflicts')
      .select('id,staging_id')
      .eq('id', conflictId)
      .single();

    if (error || !conflict) throw error || new Error('Conflict not found');

    const stagingStatus = resolution === 'accept_new' ? 'accepted' : 'rejected';

    const { error: stagingError } = await supabase
      .from('food_import_staging')
      .update({ status: stagingStatus })
      .eq('id', conflict.staging_id);

    if (stagingError) throw stagingError;

    const { error: conflictError } = await supabase
      .from('food_import_conflicts')
      .update({ status: resolution })
      .eq('id', conflictId);

    if (conflictError) throw conflictError;
  }

  async commitBatch(batchId: string): Promise<{ inserted: number; updated: number }> {
    if (!supabase) throw new Error('Supabase не инициализирован');

    const { data: stagingRows, error } = await supabase
      .from('food_import_staging')
      .select('*')
      .eq('batch_id', batchId)
      .in('status', ['accepted', 'pending']);

    if (error) throw error;
    if (!stagingRows || stagingRows.length === 0) return { inserted: 0, updated: 0 };

    const normalizedKeys = stagingRows.map((row: any) => row.normalized_name).filter(Boolean);
    const { data: existingFoods } = await supabase
      .from('foods')
      .select('id,normalized_name,normalized_brand,nutrition_version')
      .in('normalized_name', normalizedKeys);

    const payload = stagingRows.map((row: any) => {
      const existing = (existingFoods || []).find((food: any) =>
        food.normalized_name === row.normalized_name &&
        String(food.normalized_brand || '') === String(row.normalized_brand || '')
      );
      const nextVersion = existing ? (Number(existing.nutrition_version || 1) + 1) : 1;

      return {
        name: row.name,
        brand: row.brand,
        calories: row.calories,
        protein: row.protein,
        fat: row.fat,
        carbs: row.carbs,
        fiber: row.fiber,
        unit: row.unit,
        source: row.source,
        normalized_name: row.normalized_name,
        normalized_brand: row.normalized_brand,
        nutrition_version: nextVersion,
        verified: row.verified,
        suspicious: row.suspicious,
        confidence_score: row.confidence_score,
        source_version: row.source_version,
        allergens: row.allergens ?? [],
        intolerances: row.intolerances ?? [],
        aliases: row.aliases || [],
      };
    });

    const { data: upserted, error: upsertError } = await supabase
      .from('foods')
      .upsert(payload, { onConflict: 'normalized_name,normalized_brand' })
      .select('id,name,name_original,aliases,nutrition_version');

    if (upsertError) throw upsertError;

    const aliasRows: Array<{ canonical_food_id: string; alias: string; source: string; verified: boolean; created_by_user_id?: string }>= [];
    (upserted || []).forEach((row: any) => {
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
      if (aliasError) throw aliasError;
    }

    const foodIds = (upserted || []).map((row: any) => row.id);
    if (foodIds.length > 0) {
      await this.recomputeDiaryEntries(foodIds);
      await this.requeueAiRecommendations(foodIds);
    }

    await supabase.from('food_import_batches').update({ status: 'committed' }).eq('id', batchId);

    return { inserted: upserted?.length ?? 0, updated: 0 };
  }

  private async recomputeDiaryEntries(foodIds: string[]): Promise<void> {
    if (!supabase || foodIds.length === 0) return;
    try {
      await supabase.rpc('recompute_food_entries_for_food_ids', { food_ids: foodIds });
    } catch (error) {
      console.error('[foodIngestionService] recompute diary entries failed:', error);
    }
  }

  private async requeueAiRecommendations(foodIds: string[]): Promise<void> {
    if (!supabase || foodIds.length === 0) return;
    try {
      const sessionUserId = await this.getSessionUserId();
      const { data: entries } = await supabase
        .from('food_diary_entries')
        .select('date')
        .eq('user_id', sessionUserId)
        .in('canonical_food_id', foodIds)
        .limit(5000);

      const uniqueByUserDate = new Set<string>();
      (entries || []).forEach((entry: any) => {
        if (entry?.date) {
          uniqueByUserDate.add(`${sessionUserId}__${entry.date}`);
        }
      });

      for (const key of uniqueByUserDate) {
        const [userId, date] = key.split('__');
        if (userId && date) {
          await aiRecommendationsService.markDayRecommendationOutdated(userId, date);
        }
      }
    } catch (error) {
      console.error('[foodIngestionService] AI requeue failed:', error);
    }
  }

  async shouldBlockAiForLowConfidence(foodIds: string[]): Promise<boolean> {
    if (!supabase || foodIds.length === 0) return false;
    const { data } = await supabase
      .from('foods')
      .select('id,confidence_score,suspicious')
      .in('id', foodIds);
    return (data || []).some((row: any) => row.suspicious || (row.confidence_score ?? 1) < LOW_CONFIDENCE_THRESHOLD);
  }

  async getMinConfidence(foodIds: string[]): Promise<number | null> {
    if (!supabase || foodIds.length === 0) return null;
    const { data } = await supabase
      .from('foods')
      .select('confidence_score')
      .in('id', foodIds);
    const values = (data || []).map((row: any) => Number(row.confidence_score ?? 1)).filter((val: number) => Number.isFinite(val));
    if (values.length === 0) return null;
    return Math.min(...values);
  }
}

export const foodIngestionService = new FoodIngestionService();
