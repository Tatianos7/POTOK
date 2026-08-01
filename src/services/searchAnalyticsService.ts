import type { SupabaseClient } from '@supabase/supabase-js';
import type { Food } from '../types';
import { supabase as defaultSupabase } from '../lib/supabaseClient';
import { normalizeFoodText } from '../utils/foodNormalizer';

export type FoodSearchAnalyticsContext = 'diary' | 'recipe' | 'favorites' | 'barcode' | 'admin' | 'other';
type FoodSearchAnalyticsEventType = 'query' | 'selection' | 'not_found' | 'ambiguous';

type SearchAnalyticsMetadata = {
  source_surface?: string;
  app_version?: string;
  result_source_counts?: Partial<Record<Food['source'], number>>;
  latency_ms?: number;
  redacted?: boolean;
  reason?: string;
};

type LogSearchResultInput = {
  query: string;
  context?: FoodSearchAnalyticsContext;
  userId?: string | null;
  resultCount: number;
  results?: Food[];
  ambiguous?: boolean;
  metadata?: Record<string, unknown>;
};

type LogSelectionInput = {
  query: string;
  context?: FoodSearchAnalyticsContext;
  userId?: string | null;
  food: Pick<Food, 'id' | 'canonical_food_id' | 'source'>;
  resultCount?: number;
  metadata?: Record<string, unknown>;
};

type FoodSearchEventPayload = {
  user_id: string | null;
  session_id_hash: string | null;
  query: string;
  normalized_query: string;
  context: FoodSearchAnalyticsContext;
  event_type: FoodSearchAnalyticsEventType;
  result_count: number;
  selected_canonical_food_id: string | null;
  no_selection: false;
  not_found: boolean;
  ambiguous: boolean;
  candidate_canonical_food_ids: string[];
  metadata: SearchAnalyticsMetadata;
};

const MAX_QUERY_LENGTH = 120;
const MIN_QUERY_LENGTH = 2;
const DEDUPE_WINDOW_MS = 30_000;
const SESSION_STORAGE_KEY = 'potok_food_search_analytics_session_v1';
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /\+?\d[\d\s\-().]{6,}\d/;

const runtimeStorage = {
  memorySessionId: '',
};

const cleanQuery = (query: string): string => query.trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH);
const normalizeUserId = (userId?: string | null): string | null => {
  return typeof userId === 'string' && userId.trim() ? userId : null;
};

export const shouldSkipFoodSearchAnalyticsQuery = (query: string): boolean => {
  const cleaned = cleanQuery(query);
  if (cleaned.length < MIN_QUERY_LENGTH) return true;
  return EMAIL_RE.test(cleaned) || PHONE_RE.test(cleaned);
};

const sanitizeReason = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  return normalized || undefined;
};

export const sanitizeFoodSearchAnalyticsMetadata = (metadata?: Record<string, unknown>): SearchAnalyticsMetadata => {
  if (!metadata) return {};

  const sanitized: SearchAnalyticsMetadata = {};
  if (typeof metadata.source_surface === 'string') {
    sanitized.source_surface = metadata.source_surface.trim().slice(0, 64);
  }
  if (typeof metadata.app_version === 'string') {
    sanitized.app_version = metadata.app_version.trim().slice(0, 64);
  }
  if (typeof metadata.latency_ms === 'number' && Number.isFinite(metadata.latency_ms)) {
    sanitized.latency_ms = Math.max(0, Math.round(metadata.latency_ms));
  }
  if (typeof metadata.redacted === 'boolean') {
    sanitized.redacted = metadata.redacted;
  }
  const reason = sanitizeReason(metadata.reason);
  if (reason) {
    sanitized.reason = reason;
  }
  if (metadata.result_source_counts && typeof metadata.result_source_counts === 'object') {
    const rawCounts = metadata.result_source_counts as Record<string, unknown>;
    const resultSourceCounts: SearchAnalyticsMetadata['result_source_counts'] = {};
    for (const source of ['core', 'brand', 'user'] as const) {
      const count = rawCounts[source];
      if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
        resultSourceCounts[source] = Math.max(0, Math.round(count));
      }
    }
    if (Object.keys(resultSourceCounts).length > 0) {
      sanitized.result_source_counts = resultSourceCounts;
    }
  }

  return sanitized;
};

const getResultSourceCounts = (results: Food[] = []): Partial<Record<Food['source'], number>> => {
  return results.reduce<Partial<Record<Food['source'], number>>>((acc, food) => {
    acc[food.source] = (acc[food.source] ?? 0) + 1;
    return acc;
  }, {});
};

const getCanonicalFoodId = (food: Pick<Food, 'id' | 'canonical_food_id'>): string => {
  return food.canonical_food_id || food.id;
};

const getCandidateCanonicalFoodIds = (results: Food[] = []): string[] => {
  const ids = new Set<string>();
  for (const food of results) {
    const id = getCanonicalFoodId(food);
    if (id) ids.add(id);
    if (ids.size >= 10) break;
  }
  return [...ids];
};

const getSessionId = (): string => {
  if (runtimeStorage.memorySessionId) return runtimeStorage.memorySessionId;
  const next = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  runtimeStorage.memorySessionId = next;

  try {
    const stored = globalThis.localStorage?.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      runtimeStorage.memorySessionId = stored;
      return stored;
    }
    globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, next);
  } catch {
    // Ignore unavailable storage; memory session is enough for non-blocking analytics.
  }

  return runtimeStorage.memorySessionId;
};

const hashString = async (value: string): Promise<string> => {
  const subtle = globalThis.crypto?.subtle;
  if (subtle && typeof TextEncoder !== 'undefined') {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv_${(hash >>> 0).toString(16)}`;
};

const buildEventPayload = async (
  input: Omit<FoodSearchEventPayload, 'session_id_hash'>
): Promise<FoodSearchEventPayload> => ({
  ...input,
  session_id_hash: input.user_id ? null : await hashString(getSessionId()),
});

export class SearchAnalyticsService {
  private client: SupabaseClient | null;
  private readonly lastEventAt = new Map<string, number>();

  constructor(client: SupabaseClient | null = defaultSupabase) {
    this.client = client;
  }

  setClientForTests(client: SupabaseClient | null): void {
    this.client = client;
    this.lastEventAt.clear();
  }

  resetForTests(): void {
    this.lastEventAt.clear();
    runtimeStorage.memorySessionId = '';
  }

  async logSearchResult(input: LogSearchResultInput): Promise<void> {
    const cleaned = cleanQuery(input.query);
    if (shouldSkipFoodSearchAnalyticsQuery(cleaned)) return;

    const normalizedQuery = normalizeFoodText(cleaned).slice(0, MAX_QUERY_LENGTH);
    if (!normalizedQuery || normalizedQuery.length < MIN_QUERY_LENGTH) return;

    const context = input.context ?? 'other';
    const metadata = sanitizeFoodSearchAnalyticsMetadata({
      ...input.metadata,
      result_source_counts: getResultSourceCounts(input.results),
      reason: input.ambiguous ? 'manual_disambiguation' : input.metadata?.reason,
    });

    await this.insertNonBlocking({
      user_id: normalizeUserId(input.userId),
      query: cleaned,
      normalized_query: normalizedQuery,
      context,
      event_type: 'query',
      result_count: input.resultCount,
      selected_canonical_food_id: null,
      no_selection: false,
      not_found: false,
      ambiguous: false,
      candidate_canonical_food_ids: [],
      metadata,
    });

    if (input.resultCount === 0) {
      await this.insertNonBlocking({
        user_id: normalizeUserId(input.userId),
        query: cleaned,
        normalized_query: normalizedQuery,
        context,
        event_type: 'not_found',
        result_count: 0,
        selected_canonical_food_id: null,
        no_selection: false,
        not_found: true,
        ambiguous: false,
        candidate_canonical_food_ids: [],
        metadata: sanitizeFoodSearchAnalyticsMetadata({ ...input.metadata, reason: 'zero_results' }),
      });
      return;
    }

    if (input.ambiguous) {
      await this.insertNonBlocking({
        user_id: normalizeUserId(input.userId),
        query: cleaned,
        normalized_query: normalizedQuery,
        context,
        event_type: 'ambiguous',
        result_count: input.resultCount,
        selected_canonical_food_id: null,
        no_selection: false,
        not_found: false,
        ambiguous: true,
        candidate_canonical_food_ids: getCandidateCanonicalFoodIds(input.results),
        metadata,
      });
    }
  }

  async logSelection(input: LogSelectionInput): Promise<void> {
    const cleaned = cleanQuery(input.query);
    if (shouldSkipFoodSearchAnalyticsQuery(cleaned)) return;

    const normalizedQuery = normalizeFoodText(cleaned).slice(0, MAX_QUERY_LENGTH);
    if (!normalizedQuery || normalizedQuery.length < MIN_QUERY_LENGTH) return;

    await this.insertNonBlocking({
      user_id: normalizeUserId(input.userId),
      query: cleaned,
      normalized_query: normalizedQuery,
      context: input.context ?? 'other',
      event_type: 'selection',
      result_count: input.resultCount ?? 1,
      selected_canonical_food_id: getCanonicalFoodId(input.food),
      no_selection: false,
      not_found: false,
      ambiguous: false,
      candidate_canonical_food_ids: [],
      metadata: sanitizeFoodSearchAnalyticsMetadata(input.metadata),
    });
  }

  private async insertNonBlocking(input: Omit<FoodSearchEventPayload, 'session_id_hash'>): Promise<void> {
    const client = this.client;
    if (!client) return;

    const key = `${input.context}:${input.event_type}:${input.normalized_query}:${input.selected_canonical_food_id ?? ''}`;
    const now = Date.now();
    const lastAt = this.lastEventAt.get(key) ?? 0;
    if (now - lastAt < DEDUPE_WINDOW_MS) return;
    this.lastEventAt.set(key, now);

    try {
      const payload = await buildEventPayload(input);
      const { error } = await client.from('food_search_events').insert(payload);
      if (error && import.meta.env?.DEV) {
        console.warn('[searchAnalyticsService] insert failed:', error.message || error);
      }
    } catch (error: any) {
      if (import.meta.env?.DEV) {
        console.warn('[searchAnalyticsService] unexpected logging error:', error?.message || error);
      }
    }
  }
}

export const searchAnalyticsService = new SearchAnalyticsService();
