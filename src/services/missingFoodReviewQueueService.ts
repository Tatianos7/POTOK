import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../lib/supabaseClient';
import type { SearchReviewClassification, SearchReviewItem } from './searchAdminReviewService';
import type { FoodSearchAnalyticsContext } from './searchAnalyticsService';

export type MissingFoodReviewStatus =
  | 'pending'
  | 'needs_research'
  | 'approved_for_food_draft'
  | 'rejected'
  | 'snoozed';

export type MissingFoodReviewQueueRow = {
  id: string;
  query: string;
  normalized_query: string;
  context: FoodSearchAnalyticsContext | null;
  frequency: number;
  classification: SearchReviewClassification;
  status: MissingFoodReviewStatus;
  source_event_ids: string[];
  suggested_name: string | null;
  suggested_category: string | null;
  suggested_source: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type MissingFoodReviewSuggestedSource = 'core' | 'brand' | 'barcode' | 'open_food_facts' | 'other';

export type MissingFoodReviewFilters = {
  status?: MissingFoodReviewStatus | 'all';
  classification?: SearchReviewClassification | 'all';
  context?: FoodSearchAnalyticsContext | 'all';
};

type CreateOrUpdateMissingFoodInput = {
  item: SearchReviewItem;
  suggestedName?: string | null;
  comment?: string | null;
};

type UpdateMissingFoodReviewInput = {
  rowId: string;
  reviewerId: string;
  status?: Exclude<MissingFoodReviewStatus, 'pending'>;
  suggestedName?: string | null;
  suggestedCategory?: string | null;
  suggestedSource?: MissingFoodReviewSuggestedSource | null;
  comment?: string | null;
};

const cleanOptionalText = (value?: string | null): string | null => {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
};

export class MissingFoodReviewQueueService {
  private client: SupabaseClient | null;

  constructor(client: SupabaseClient | null = defaultSupabase) {
    this.client = client;
  }

  setClientForTests(client: SupabaseClient | null): void {
    this.client = client;
  }

  async getRows(filters: MissingFoodReviewFilters = {}): Promise<MissingFoodReviewQueueRow[]> {
    const client = this.requireClient();
    let query = client
      .from('food_missing_review_queue')
      .select('id, query, normalized_query, context, frequency, classification, status, source_event_ids, suggested_name, suggested_category, suggested_source, reviewer_id, reviewed_at, comment, created_at, updated_at');

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters.classification && filters.classification !== 'all') {
      query = query.eq('classification', filters.classification);
    }
    if (filters.context && filters.context !== 'all') {
      query = query.eq('context', filters.context);
    }

    const { data, error } = await query
      .order('frequency', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as MissingFoodReviewQueueRow[];
  }

  async createOrUpdatePending({ item, suggestedName, comment }: CreateOrUpdateMissingFoodInput): Promise<void> {
    if (item.classification !== 'missing_canonical_food') {
      throw new Error('Missing Food Review can be created only for missing_canonical_food items.');
    }

    const client = this.requireClient();
    const { data: existingRows, error: existingError } = await client
      .from('food_missing_review_queue')
      .select('id, frequency, source_event_ids')
      .eq('status', 'pending')
      .eq('normalized_query', item.normalizedQuery)
      .eq('context', item.context)
      .eq('classification', item.classification)
      .limit(1);

    if (existingError) throw existingError;

    const existing = existingRows?.[0] as { id: string; frequency: number; source_event_ids: string[] } | undefined;
    const payload = {
      query: item.query,
      frequency: existing ? Math.max(existing.frequency ?? 1, item.frequency) : item.frequency,
      source_event_ids: existing ? [...new Set([...(existing.source_event_ids ?? []), ...item.sourceEventIds])] : item.sourceEventIds,
      suggested_name: cleanOptionalText(suggestedName) ?? item.query,
      comment: cleanOptionalText(comment),
      metadata: {
        event_type: item.eventType,
        last_seen: item.lastSeen,
        result_count: item.resultCount,
      },
    };

    if (existing) {
      const { error } = await client.from('food_missing_review_queue').update(payload).eq('id', existing.id);
      if (error) throw error;
      return;
    }

    const { error } = await client.from('food_missing_review_queue').insert({
      ...payload,
      normalized_query: item.normalizedQuery,
      context: item.context,
      classification: item.classification,
      status: 'pending',
    });
    if (error) throw error;
  }

  async updateRow(input: UpdateMissingFoodReviewInput): Promise<void> {
    const client = this.requireClient();
    const payload: Record<string, unknown> = {
      suggested_name: cleanOptionalText(input.suggestedName),
      suggested_category: cleanOptionalText(input.suggestedCategory),
      suggested_source: input.suggestedSource ?? null,
      comment: cleanOptionalText(input.comment),
    };

    if (input.status) {
      payload.status = input.status;
      payload.reviewer_id = input.reviewerId;
      payload.reviewed_at = new Date().toISOString();
    }

    const { error } = await client.from('food_missing_review_queue').update(payload).eq('id', input.rowId);
    if (error) throw error;
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client is not initialized');
    }
    return this.client;
  }
}

export const missingFoodReviewQueueService = new MissingFoodReviewQueueService();
