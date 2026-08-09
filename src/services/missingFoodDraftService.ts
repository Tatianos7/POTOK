import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../lib/supabaseClient';
import { normalizeFoodText } from '../utils/foodNormalizer';

export type MissingFoodDraftStatus = 'draft' | 'needs_revision' | 'ready_for_owner_apply' | 'rejected' | 'applied';
export type EditableMissingFoodDraftStatus = Exclude<MissingFoodDraftStatus, 'applied'>;

export type MissingFoodDraftRow = {
  id: string;
  source_review_id: string;
  query: string;
  normalized_query: string;
  name: string | null;
  normalized_name: string | null;
  category: string | null;
  source: 'core';
  brand: null;
  barcode: null;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  unit: 'g';
  data_source: string | null;
  source_url: string | null;
  source_notes: string | null;
  reviewer_notes: string | null;
  status: MissingFoodDraftStatus;
  prepared_by: string | null;
  prepared_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  applied_food_id: string | null;
  applied_by: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MissingFoodDraftInput = {
  sourceReviewId: string;
  query: string;
  normalizedQuery: string;
  reviewerId: string;
  status: EditableMissingFoodDraftStatus;
  name?: string | null;
  category?: string | null;
  calories?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  dataSource?: string | null;
  sourceUrl?: string | null;
  sourceNotes?: string | null;
  reviewerNotes?: string | null;
};

export type MissingFoodDraftValidation = {
  isComplete: boolean;
  normalizedName: string;
  errors: string[];
};

export type MissingFoodDraftDuplicate = {
  id: string;
  name: string;
  normalized_name: string | null;
  source: string;
};

export type MissingFoodOwnerApplyResult =
  | 'applied'
  | 'permission_denied'
  | 'draft_not_found'
  | 'already_applied'
  | 'not_ready'
  | 'invalid_review_state'
  | 'invalid_draft'
  | 'duplicate_food'
  | 'insert_failed';

export type MissingFoodOwnerApplyResponse = {
  result: MissingFoodOwnerApplyResult;
  foodId: string | null;
  error: string | null;
};

type MissingFoodOwnerApplyRpcRow = {
  result: MissingFoodOwnerApplyResult;
  food_id: string | null;
  error: string | null;
};

const DRAFT_COLUMNS = [
  'id',
  'source_review_id',
  'query',
  'normalized_query',
  'name',
  'normalized_name',
  'category',
  'source',
  'brand',
  'barcode',
  'calories',
  'protein',
  'fat',
  'carbs',
  'fiber',
  'unit',
  'data_source',
  'source_url',
  'source_notes',
  'reviewer_notes',
  'status',
  'prepared_by',
  'prepared_at',
  'reviewed_by',
  'reviewed_at',
  'applied_food_id',
  'applied_by',
  'applied_at',
  'created_at',
  'updated_at',
].join(', ');

const cleanOptionalText = (value?: string | null): string | null => {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
};

const cleanRequiredText = (value?: string | null): string => cleanOptionalText(value) ?? '';

const isValidNumber = (value: number | null | undefined, max: number): boolean => {
  return value !== null && value !== undefined && Number.isFinite(value) && value >= 0 && value <= max;
};

const toNullableFiniteNumber = (value: number | null | undefined): number | null => {
  return Number.isFinite(value) ? Number(value) : null;
};

export const validateMissingFoodDraft = (input: MissingFoodDraftInput): MissingFoodDraftValidation => {
  const name = cleanRequiredText(input.name);
  const normalizedName = normalizeFoodText(name);
  const category = cleanRequiredText(input.category);
  const dataSource = cleanRequiredText(input.dataSource);
  const errors: string[] = [];

  if (!name) errors.push('Name is required.');
  if (!normalizedName) errors.push('Normalized name is required.');
  if (!category) errors.push('Category is required.');
  if (!dataSource) errors.push('Data source is required.');
  if (!isValidNumber(input.calories, 1000)) errors.push('Calories must be 0..1000.');
  if (!isValidNumber(input.protein, 100)) errors.push('Protein must be 0..100.');
  if (!isValidNumber(input.fat, 100)) errors.push('Fat must be 0..100.');
  if (!isValidNumber(input.carbs, 100)) errors.push('Carbs must be 0..100.');
  if (input.fiber !== null && input.fiber !== undefined && !isValidNumber(input.fiber, 100)) {
    errors.push('Fiber must be empty or 0..100.');
  }

  return {
    isComplete: errors.length === 0,
    normalizedName,
    errors,
  };
};

export class MissingFoodDraftService {
  private client: SupabaseClient | null;

  constructor(client: SupabaseClient | null = defaultSupabase) {
    this.client = client;
  }

  setClientForTests(client: SupabaseClient | null): void {
    this.client = client;
  }

  async getDraftsByReviewIds(reviewIds: string[]): Promise<MissingFoodDraftRow[]> {
    const ids = [...new Set(reviewIds.filter(Boolean))];
    if (ids.length === 0) return [];

    const client = this.requireClient();
    const { data, error } = await client
      .from('food_missing_food_drafts')
      .select(DRAFT_COLUMNS)
      .in('source_review_id', ids)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as MissingFoodDraftRow[];
  }

  async saveDraft(input: MissingFoodDraftInput): Promise<void> {
    if (input.status === 'ready_for_owner_apply') {
      const validation = validateMissingFoodDraft(input);
      if (!validation.isComplete) {
        throw new Error(`Draft is incomplete: ${validation.errors.join(' ')}`);
      }
    }

    const client = this.requireClient();
    const now = new Date().toISOString();
    const normalizedName = normalizeFoodText(input.name);
    const payload = {
      query: cleanRequiredText(input.query),
      normalized_query: cleanRequiredText(input.normalizedQuery),
      name: cleanOptionalText(input.name),
      normalized_name: normalizedName || null,
      category: cleanOptionalText(input.category),
      source: 'core',
      brand: null,
      barcode: null,
      calories: toNullableFiniteNumber(input.calories),
      protein: toNullableFiniteNumber(input.protein),
      fat: toNullableFiniteNumber(input.fat),
      carbs: toNullableFiniteNumber(input.carbs),
      fiber: toNullableFiniteNumber(input.fiber),
      unit: 'g',
      data_source: cleanOptionalText(input.dataSource),
      source_url: cleanOptionalText(input.sourceUrl),
      source_notes: cleanOptionalText(input.sourceNotes),
      reviewer_notes: cleanOptionalText(input.reviewerNotes),
      status: input.status,
      prepared_by: input.reviewerId,
      prepared_at: now,
      reviewed_by: input.status === 'ready_for_owner_apply' ? input.reviewerId : null,
      reviewed_at: input.status === 'ready_for_owner_apply' ? now : null,
    };

    const { data: existingRows, error: existingError } = await client
      .from('food_missing_food_drafts')
      .select('id')
      .eq('source_review_id', input.sourceReviewId)
      .limit(1);

    if (existingError) throw existingError;

    const existing = existingRows?.[0] as { id: string } | undefined;
    if (existing) {
      const { error } = await client.from('food_missing_food_drafts').update(payload).eq('id', existing.id);
      if (error) throw error;
      return;
    }

    const { error } = await client.from('food_missing_food_drafts').insert({
      ...payload,
      source_review_id: input.sourceReviewId,
      metadata: {},
    });
    if (error) throw error;
  }

  async findDuplicateFoods(normalizedName: string): Promise<MissingFoodDraftDuplicate[]> {
    const normalized = normalizeFoodText(normalizedName);
    if (!normalized) return [];

    const client = this.requireClient();
    const { data, error } = await client
      .from('foods')
      .select('id, name, normalized_name, source')
      .eq('normalized_name', normalized)
      .in('source', ['core', 'brand'])
      .order('name', { ascending: true })
      .limit(5);

    if (error) throw error;
    return (data ?? []) as unknown as MissingFoodDraftDuplicate[];
  }

  async applyOwnerApprovedDraft(draftId: string): Promise<MissingFoodOwnerApplyResponse> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('apply_owner_approved_missing_food_draft', {
      p_draft_id: draftId,
    });

    if (error) throw error;

    const row = Array.isArray(data)
      ? (data[0] as MissingFoodOwnerApplyRpcRow | undefined)
      : (data as MissingFoodOwnerApplyRpcRow | null);

    if (!row?.result) {
      return {
        result: 'insert_failed',
        foodId: null,
        error: 'RPC did not return an owner apply result.',
      };
    }

    return {
      result: row.result,
      foodId: row.food_id ?? null,
      error: row.error ?? null,
    };
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client is not initialized');
    }
    return this.client;
  }
}

export const missingFoodDraftService = new MissingFoodDraftService();
