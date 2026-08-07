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

type CreateOrUpdateMissingFoodInput = {
  item: SearchReviewItem;
  suggestedName?: string | null;
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

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client is not initialized');
    }
    return this.client;
  }
}

export const missingFoodReviewQueueService = new MissingFoodReviewQueueService();
