import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../lib/supabaseClient';
import type { AliasApplyResult } from './aliasApplyService';
import type { FoodSearchAnalyticsContext } from './searchAnalyticsService';

export type SearchReviewEventType = 'not_found' | 'ambiguous';
export type SearchReviewStatus = 'pending' | 'approved' | 'rejected' | 'snoozed';
export type SearchReviewClassification =
  | 'alias_candidate'
  | 'missing_canonical_food'
  | 'ambiguous_broad_query'
  | 'typo_or_prefix';

export type SearchReviewEventRow = {
  id: string;
  query: string;
  normalized_query: string;
  context: FoodSearchAnalyticsContext;
  event_type: SearchReviewEventType;
  result_count: number;
  candidate_canonical_food_ids: string[];
  created_at: string;
};

export type SearchReviewCandidate = {
  id: string;
  name: string;
  brand: string | null;
  source: 'core' | 'brand' | 'user';
  canonical_food_id: string | null;
};

export type SearchReviewQueueRow = {
  id: string;
  query: string;
  normalized_query: string;
  context: FoodSearchAnalyticsContext | null;
  suggested_canonical_food_id: string | null;
  frequency: number;
  status: SearchReviewStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  comment: string | null;
  source_event_ids: string[];
  applied_alias_id: string | null;
  alias_applied_by: string | null;
  alias_applied_at: string | null;
  alias_apply_result: AliasApplyResult | null;
  alias_apply_error: string | null;
  created_at: string;
  updated_at: string;
};

export type SearchReviewItem = {
  key: string;
  query: string;
  normalizedQuery: string;
  context: FoodSearchAnalyticsContext;
  eventType: SearchReviewEventType;
  frequency: number;
  lastSeen: string;
  resultCount: number;
  sourceEventIds: string[];
  candidateIds: string[];
  candidates: SearchReviewCandidate[];
  pendingRows: SearchReviewQueueRow[];
  classification: SearchReviewClassification;
  classificationReason: string;
};

const REVIEW_EVENT_LIMIT = 500;
const REVIEW_ITEM_LIMIT = 50;
const MEANINGFUL_MISSING_FOOD_TERMS = new Set(['стейк']);
const KNOWN_NOISE_PREFIXES = ['ыва'];

const isLikelyNoiseOrPrefix = (query: string): boolean => {
  const normalized = query.trim().toLowerCase();
  if (normalized.length <= 4) return true;
  if (KNOWN_NOISE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;
  return false;
};

const buildClassificationReason = (classification: SearchReviewClassification): string => {
  switch (classification) {
    case 'alias_candidate':
      return 'Есть один точный общий canonical target, можно рассматривать Alias Apply.';
    case 'missing_canonical_food':
      return 'Похоже на реальный продукт, но точного canonical food нет.';
    case 'ambiguous_broad_query':
      return 'Есть несколько возможных canonical targets или запрос слишком широкий.';
    case 'typo_or_prefix':
    default:
      return 'Похоже на шум, опечатку или неполный префикс.';
  }
};

export const classifySearchReviewItem = ({
  item,
  existingAliasCount,
  exactSharedCanonicalCount,
  containsCandidateCount,
}: {
  item: Pick<SearchReviewItem, 'eventType' | 'normalizedQuery' | 'candidateIds'>;
  existingAliasCount: number;
  exactSharedCanonicalCount: number;
  containsCandidateCount: number;
}): { classification: SearchReviewClassification; classificationReason: string } => {
  let classification: SearchReviewClassification;

  if (item.eventType === 'ambiguous' || item.candidateIds.length > 1 || exactSharedCanonicalCount > 1) {
    classification = 'ambiguous_broad_query';
  } else if (existingAliasCount === 1 || exactSharedCanonicalCount === 1 || item.candidateIds.length === 1) {
    classification = 'alias_candidate';
  } else if (containsCandidateCount > 1) {
    classification = 'ambiguous_broad_query';
  } else if (
    MEANINGFUL_MISSING_FOOD_TERMS.has(item.normalizedQuery)
    || (!isLikelyNoiseOrPrefix(item.normalizedQuery) && containsCandidateCount === 0)
  ) {
    classification = 'missing_canonical_food';
  } else {
    classification = 'typo_or_prefix';
  }

  return {
    classification,
    classificationReason: buildClassificationReason(classification),
  };
};

export const aggregateSearchReviewEvents = (events: SearchReviewEventRow[]): SearchReviewItem[] => {
  const grouped = new Map<string, SearchReviewItem>();

  for (const event of events) {
    const key = `${event.context}:${event.event_type}:${event.normalized_query}`;
    const existing = grouped.get(key);
    const candidateIds = (event.candidate_canonical_food_ids ?? []).filter(Boolean);

    if (!existing) {
      grouped.set(key, {
        key,
        query: event.query,
        normalizedQuery: event.normalized_query,
        context: event.context,
        eventType: event.event_type,
        frequency: 1,
        lastSeen: event.created_at,
        resultCount: event.result_count,
        sourceEventIds: [event.id],
        candidateIds,
        candidates: [],
        pendingRows: [],
        classification: 'typo_or_prefix',
        classificationReason: buildClassificationReason('typo_or_prefix'),
      });
      continue;
    }

    existing.frequency += 1;
    existing.sourceEventIds.push(event.id);
    existing.resultCount = Math.max(existing.resultCount, event.result_count);
    for (const candidateId of candidateIds) {
      if (!existing.candidateIds.includes(candidateId)) {
        existing.candidateIds.push(candidateId);
      }
    }
    if (new Date(event.created_at).getTime() > new Date(existing.lastSeen).getTime()) {
      existing.lastSeen = event.created_at;
      existing.query = event.query;
    }
  }

  return [...grouped.values()].sort((a, b) => {
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
  });
};

const escapeLike = (value: string): string => value.replace(/[%_]/g, '\\$&');

export class SearchAdminReviewService {
  private client: SupabaseClient | null;

  constructor(client: SupabaseClient | null = defaultSupabase) {
    this.client = client;
  }

  setClientForTests(client: SupabaseClient | null): void {
    this.client = client;
  }

  async getReviewItems(): Promise<SearchReviewItem[]> {
    const client = this.requireClient();
    const { data: events, error: eventsError } = await client
      .from('food_search_events')
      .select('id, query, normalized_query, context, event_type, result_count, candidate_canonical_food_ids, created_at')
      .in('event_type', ['not_found', 'ambiguous'])
      .order('created_at', { ascending: false })
      .limit(REVIEW_EVENT_LIMIT);

    if (eventsError) throw eventsError;

    const items = aggregateSearchReviewEvents((events ?? []) as SearchReviewEventRow[]).slice(0, REVIEW_ITEM_LIMIT);
    const queueRows = await this.getReviewQueueRows();

    return Promise.all(
      items.map(async (item) => {
        const candidateResolution = await this.getCandidatesForItem(item);
        const classification = classifySearchReviewItem({
          item,
          existingAliasCount: candidateResolution.existingAliasCount,
          exactSharedCanonicalCount: candidateResolution.exactSharedCanonicalCount,
          containsCandidateCount: candidateResolution.containsCandidateCount,
        });

        return {
          ...item,
          candidates: candidateResolution.candidates,
          pendingRows: queueRows.filter(
            (row) => row.normalized_query === item.normalizedQuery && (row.context ?? item.context) === item.context
          ),
          ...classification,
        };
      })
    );
  }

  async createOrUpdatePending(item: SearchReviewItem, suggestedCanonicalFoodId?: string | null): Promise<void> {
    const client = this.requireClient();
    const suggestedId = suggestedCanonicalFoodId || null;
    let query = client
      .from('food_search_review_queue')
      .select('id, frequency, source_event_ids')
      .eq('status', 'pending')
      .eq('normalized_query', item.normalizedQuery)
      .eq('context', item.context);

    query = suggestedId
      ? query.eq('suggested_canonical_food_id', suggestedId)
      : query.is('suggested_canonical_food_id', null);

    const { data: existingRows, error: existingError } = await query.limit(1);
    if (existingError) throw existingError;

    const existing = existingRows?.[0] as { id: string; frequency: number; source_event_ids: string[] } | undefined;
    if (existing) {
      const sourceEventIds = [...new Set([...(existing.source_event_ids ?? []), ...item.sourceEventIds])];
      const { error } = await client
        .from('food_search_review_queue')
        .update({
          query: item.query,
          frequency: Math.max(existing.frequency ?? 1, item.frequency),
          source_event_ids: sourceEventIds,
          metadata: { event_type: item.eventType, last_seen: item.lastSeen },
        })
        .eq('id', existing.id);
      if (error) throw error;
      return;
    }

    const { error } = await client.from('food_search_review_queue').insert({
      query: item.query,
      normalized_query: item.normalizedQuery,
      context: item.context,
      suggested_canonical_food_id: suggestedId,
      frequency: item.frequency,
      status: 'pending',
      source_event_ids: item.sourceEventIds,
      metadata: { event_type: item.eventType, last_seen: item.lastSeen },
    });
    if (error) throw error;
  }

  async updateQueueStatus(rowId: string, status: Exclude<SearchReviewStatus, 'pending'>, reviewerId: string, comment?: string): Promise<void> {
    const client = this.requireClient();
    const { error } = await client
      .from('food_search_review_queue')
      .update({
        status,
        reviewer_id: reviewerId,
        reviewed_at: new Date().toISOString(),
        comment: comment?.trim() || null,
      })
      .eq('id', rowId);
    if (error) throw error;
  }

  private async getReviewQueueRows(): Promise<SearchReviewQueueRow[]> {
    const client = this.requireClient();
    const { data, error } = await client
      .from('food_search_review_queue')
      .select('id, query, normalized_query, context, suggested_canonical_food_id, frequency, status, reviewer_id, reviewed_at, comment, source_event_ids, applied_alias_id, alias_applied_by, alias_applied_at, alias_apply_result, alias_apply_error, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return (data ?? []) as SearchReviewQueueRow[];
  }

  private async getCandidatesForItem(item: SearchReviewItem): Promise<{
    candidates: SearchReviewCandidate[];
    existingAliasCount: number;
    exactSharedCanonicalCount: number;
    containsCandidateCount: number;
  }> {
    const client = this.requireClient();
    const ids = [...item.candidateIds];

    const { data: aliasRows, count: existingAliasCount } = await client
      .from('food_aliases')
      .select('canonical_food_id', { count: 'exact' })
      .eq('normalized_alias', item.normalizedQuery)
      .limit(10);

    for (const row of aliasRows ?? []) {
      const id = (row as { canonical_food_id?: string }).canonical_food_id;
      if (id && !ids.includes(id)) ids.push(id);
    }

    const { data: exactFoods } = await client
      .from('foods')
      .select('id, name, brand, source, canonical_food_id')
      .eq('normalized_name', item.normalizedQuery)
      .in('source', ['core', 'brand'])
      .limit(10);

    const candidatesById = new Map<string, SearchReviewCandidate>();
    for (const row of exactFoods ?? []) {
      const candidate = row as SearchReviewCandidate;
      candidatesById.set(candidate.id, candidate);
    }

    if (ids.length > 0) {
      const { data: foodsById } = await client
        .from('foods')
        .select('id, name, brand, source, canonical_food_id')
        .in('id', ids.slice(0, 10))
        .limit(10);
      for (const row of foodsById ?? []) {
        const candidate = row as SearchReviewCandidate;
        candidatesById.set(candidate.id, candidate);
      }
    }

    const likeQuery = `%${escapeLike(item.normalizedQuery)}%`;
    const { data: foodsByName } = await client
      .from('foods')
      .select('id, name, brand, source, canonical_food_id')
      .or(`normalized_name.ilike.${likeQuery},name.ilike.${likeQuery}`)
      .limit(10);

    for (const row of foodsByName ?? []) {
      const candidate = row as SearchReviewCandidate;
      candidatesById.set(candidate.id, candidate);
    }

    return {
      candidates: [...candidatesById.values()].slice(0, 8),
      existingAliasCount: existingAliasCount ?? 0,
      exactSharedCanonicalCount: exactFoods?.length ?? 0,
      containsCandidateCount: foodsByName?.length ?? 0,
    };
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client is not initialized');
    }
    return this.client;
  }
}

export const searchAdminReviewService = new SearchAdminReviewService();
