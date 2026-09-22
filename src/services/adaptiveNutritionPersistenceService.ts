import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../lib/supabaseClient';
import {
  adaptiveNutritionCanonicalEncodingV1,
  adaptiveNutritionSha256HexV1,
  decodeAdaptiveNutritionWireEnvelopeV1,
  type AdaptiveNutritionWireRequestV1,
} from '../utils/adaptiveNutritionWireV1';

type AdaptiveNutritionRpcClient = Pick<SupabaseClient, 'auth' | 'rpc'>;
type AdaptiveNutritionRuntimeGate = boolean | (() => boolean);

export const ADAPTIVE_NUTRITION_RUNTIME_FLAG = 'VITE_ADAPTIVE_NUTRITION_RUNTIME_V1' as const;

/** Build-time runtime gate. No localStorage override: browser input cannot enable writes. */
export function isAdaptiveNutritionRuntimeEnabled(): boolean {
  const env = typeof import.meta !== 'undefined'
    ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    : undefined;
  return env?.[ADAPTIVE_NUTRITION_RUNTIME_FLAG] === 'true';
}

export interface AdaptiveNutritionRuntimeSession {
  accountId: string;
  generation: number;
}

export type AdaptiveNutritionRuntimeFailure =
  | { kind: 'unavailable' }
  | { kind: 'invalid-request'; reason: string }
  | { kind: 'invalid-server-response' }
  | { kind: 'session-stale' }
  | { kind: 'unknown' }
  | { kind: 'denied' }
  | { kind: 'conflict' };

export interface AdaptiveNutritionReceiptV1 {
  kind: 'settled';
  operationId: string;
  idempotencyKey: string;
  digestVersion: string;
  requestDigestHex: string;
  outcome: 'accepted' | 'conflict' | 'rejected';
  reason: string | null;
  result: Record<string, unknown> | null;
  committedAt: string | null;
}

export interface AdaptiveNutritionReadModelV1 {
  kind: 'ready';
  selectionId: string;
  weekAnchor: string;
  timeZone: string;
  status: 'active' | 'provisional' | 'paused' | 'completed' | 'archived';
  originKind: 'catalog_template' | 'generated';
  originLineage: Record<string, unknown>;
  planRevision: string;
  goalRevision: string;
  historyRevision: string;
  diaryRevision: string;
  graph: Record<string, unknown>;
  events: unknown[];
  exactOperationId: string | null;
}

export type AdaptiveNutritionLookupResult = AdaptiveNutritionRuntimeFailure | AdaptiveNutritionReceiptV1;
export type AdaptiveNutritionReadResult = AdaptiveNutritionRuntimeFailure | AdaptiveNutritionReadModelV1
  | { kind: 'not-ready'; reason: string };
export type AdaptiveNutritionMutationResult = AdaptiveNutritionRuntimeFailure | AdaptiveNutritionReceiptV1;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const supportedMutationActions = new Set(['REPLACE', 'SKIPPED', 'UNDO_ANNOTATION']);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function decodeReceipt(value: unknown): AdaptiveNutritionReceiptV1 | null {
  const row = record(value);
  const result = row ? record(row.result) : null;
  if (!row || row.kind !== 'settled' || typeof row.operation_id !== 'string' || !uuidPattern.test(row.operation_id)
      || typeof row.idempotency_key !== 'string' || !uuidPattern.test(row.idempotency_key)
      || typeof row.digest_version !== 'string' || typeof row.request_digest_hex !== 'string'
      || !digestPattern.test(row.request_digest_hex)
      || !['accepted', 'conflict', 'rejected'].includes(String(row.outcome))
      || !nullableString(row.reason) || !nullableString(row.committed_at)
      || (row.result !== null && !result)) return null;
  return {
    kind: 'settled',
    operationId: row.operation_id,
    idempotencyKey: row.idempotency_key,
    digestVersion: row.digest_version,
    requestDigestHex: row.request_digest_hex,
    outcome: row.outcome as AdaptiveNutritionReceiptV1['outcome'],
    reason: row.reason,
    result,
    committedAt: row.committed_at,
  };
}

function decodeRead(value: unknown): AdaptiveNutritionReadResult | null {
  const row = record(value);
  if (!row) return null;
  if (row.kind === 'unknown') return { kind: 'unknown' };
  if (row.kind === 'conflict') return { kind: 'conflict' };
  if (row.kind === 'denied') return { kind: 'denied' };
  if (row.kind === 'not-ready' && typeof row.reason === 'string') return { kind: 'not-ready', reason: row.reason };
  const graph = record(row.graph);
  const originLineage = record(row.origin_lineage);
  if (row.kind !== 'ready' || typeof row.selection_id !== 'string' || !uuidPattern.test(row.selection_id)
      || typeof row.week_anchor !== 'string' || typeof row.timezone !== 'string'
      || !['active', 'provisional', 'paused', 'completed', 'archived'].includes(String(row.status))
      || !['catalog_template', 'generated'].includes(String(row.origin_kind)) || !originLineage
      || typeof row.plan_revision !== 'string' || !uuidPattern.test(row.plan_revision)
      || typeof row.goal_revision !== 'string' || !uuidPattern.test(row.goal_revision)
      || typeof row.history_revision !== 'string' || !uuidPattern.test(row.history_revision)
      || typeof row.diary_revision !== 'string' || !uuidPattern.test(row.diary_revision)
      || !graph || !Array.isArray(row.events)
      || graph.plan_revision !== row.plan_revision || graph.goal_revision !== row.goal_revision
      || (row.exact_operation_id !== null
        && (typeof row.exact_operation_id !== 'string' || !uuidPattern.test(row.exact_operation_id)))) return null;
  return {
    kind: 'ready', selectionId: row.selection_id, weekAnchor: row.week_anchor, timeZone: row.timezone,
    status: row.status as AdaptiveNutritionReadModelV1['status'],
    originKind: row.origin_kind as AdaptiveNutritionReadModelV1['originKind'], originLineage,
    planRevision: row.plan_revision, goalRevision: row.goal_revision,
    historyRevision: row.history_revision, diaryRevision: row.diary_revision,
    graph, events: row.events, exactOperationId: row.exact_operation_id as string | null,
  };
}

export class AdaptiveNutritionPersistenceService {
  private generation = 0;
  private accountId: string | null = null;

  constructor(
    private readonly client: AdaptiveNutritionRpcClient | null = defaultSupabase,
    private readonly runtimeGate: AdaptiveNutritionRuntimeGate = false,
  ) {}

  private isRuntimeEnabled(): boolean {
    return typeof this.runtimeGate === 'function' ? this.runtimeGate() : this.runtimeGate;
  }

  beginSession(accountId: string): AdaptiveNutritionRuntimeSession {
    if (!uuidPattern.test(accountId)) throw new Error('invalid_account_id');
    this.generation += 1;
    this.accountId = accountId;
    return { accountId, generation: this.generation };
  }

  endSession(): void {
    this.generation += 1;
    this.accountId = null;
  }

  private isCurrent(session: AdaptiveNutritionRuntimeSession): boolean {
    return session.accountId === this.accountId && session.generation === this.generation;
  }

  private async authenticated(session: AdaptiveNutritionRuntimeSession): Promise<boolean> {
    if (!this.isRuntimeEnabled() || !this.client || !this.isCurrent(session)) return false;
    const { data, error } = await this.client.auth.getUser();
    return !error && data?.user?.id === session.accountId && this.isCurrent(session);
  }

  private async finish<T>(session: AdaptiveNutritionRuntimeSession, value: T): Promise<T | { kind: 'session-stale' }> {
    if (!this.isCurrent(session) || !await this.authenticated(session)) return { kind: 'session-stale' };
    return value;
  }

  async lookup(session: AdaptiveNutritionRuntimeSession, idempotencyKey: string): Promise<AdaptiveNutritionLookupResult> {
    if (!this.isRuntimeEnabled() || !this.client) return { kind: 'unavailable' };
    if (!uuidPattern.test(idempotencyKey)) return { kind: 'invalid-request', reason: 'invalid_idempotency_key' };
    if (!await this.authenticated(session)) return { kind: 'session-stale' };
    const { data, error } = await this.client.rpc('adaptive_nutrition_lookup_v1', { p_idempotency_key: idempotencyKey });
    if (error) return this.finish(session, { kind: 'unknown' });
    const row = record(data);
    const decoded = row?.kind === 'unknown' ? { kind: 'unknown' as const }
      : row?.kind === 'denied' ? { kind: 'denied' as const }
      : row?.kind === 'conflict' ? { kind: 'conflict' as const }
      : decodeReceipt(data);
    return this.finish(session, decoded ?? { kind: 'invalid-server-response' });
  }

  async readCurrent(session: AdaptiveNutritionRuntimeSession, selectionId: string): Promise<AdaptiveNutritionReadResult> {
    return this.read(session, selectionId, null);
  }

  async readExact(session: AdaptiveNutritionRuntimeSession, selectionId: string,
    receipt: AdaptiveNutritionReceiptV1): Promise<AdaptiveNutritionReadResult> {
    const result = receipt.outcome === 'accepted' ? receipt.result : null;
    if (!uuidPattern.test(receipt.operationId) || !result
        || result.operation_id !== receipt.operationId || result.selection_id !== selectionId
        || ![result.plan_revision, result.goal_revision, result.history_revision, result.diary_revision]
          .every((value) => typeof value === 'string' && uuidPattern.test(value))) {
      return { kind: 'invalid-request', reason: 'invalid_exact_receipt' };
    }
    const response = await this.read(session, selectionId, receipt.operationId);
    if (response.kind === 'ready' && (response.planRevision !== result.plan_revision
        || response.goalRevision !== result.goal_revision
        || response.historyRevision !== result.history_revision
        || response.diaryRevision !== result.diary_revision)) return { kind: 'invalid-server-response' };
    return response;
  }

  private async read(session: AdaptiveNutritionRuntimeSession, selectionId: string,
    operationId: string | null): Promise<AdaptiveNutritionReadResult> {
    if (!this.isRuntimeEnabled() || !this.client) return { kind: 'unavailable' };
    if (!uuidPattern.test(selectionId)) return { kind: 'invalid-request', reason: 'invalid_selection_id' };
    if (!await this.authenticated(session)) return { kind: 'session-stale' };
    const { data, error } = await this.client.rpc('adaptive_nutrition_read_v1', {
      p_selection_id: selectionId,
      p_operation_id: operationId,
    });
    if (error) return this.finish(session, { kind: 'unknown' });
    const decoded = decodeRead(data);
    if (decoded?.kind === 'ready' && (decoded.selectionId !== selectionId
        || decoded.exactOperationId !== operationId)) return this.finish(session, { kind: 'invalid-server-response' });
    return this.finish(session, decoded ?? { kind: 'invalid-server-response' });
  }

  async mutate(session: AdaptiveNutritionRuntimeSession, rawRequest: string): Promise<AdaptiveNutritionMutationResult> {
    if (!this.isRuntimeEnabled() || !this.client) return { kind: 'unavailable' };
    let decoded: { request: AdaptiveNutritionWireRequestV1; canonicalBytes: Uint8Array };
    try {
      decoded = decodeAdaptiveNutritionWireEnvelopeV1(rawRequest);
    } catch (error) {
      return { kind: 'invalid-request', reason: error instanceof Error ? error.message : 'invalid_wire_request' };
    }
    if (!supportedMutationActions.has(decoded.request.action.type)) {
      return { kind: 'invalid-request', reason: 'fact_actions_not_enabled' };
    }
    if (decoded.request.expected.accountId !== session.accountId || !await this.authenticated(session)) {
      return { kind: 'session-stale' };
    }
    let localDigest: string;
    try {
      localDigest = await adaptiveNutritionSha256HexV1(decoded.canonicalBytes);
    } catch {
      return { kind: 'unavailable' };
    }
    const { data, error } = await this.client.rpc('adaptive_nutrition_mutate_v1', { p_request_text: rawRequest });
    if (error) {
      const code = typeof error.code === 'string' ? error.code : '';
      const outcome = code === '40001' ? { kind: 'conflict' as const }
        : code === '42501' ? { kind: 'denied' as const }
        : { kind: 'unknown' as const };
      return this.finish(session, outcome);
    }
    const row = record(data);
    if (row?.kind === 'unknown') return this.finish(session, { kind: 'unknown' });
    if (row?.kind === 'denied') return this.finish(session, { kind: 'denied' });
    if (row?.kind === 'conflict') return this.finish(session, { kind: 'conflict' });
    const receipt = decodeReceipt(data);
    if (!receipt || receipt.idempotencyKey !== decoded.request.idempotencyKey
        || receipt.digestVersion !== adaptiveNutritionCanonicalEncodingV1
        || receipt.requestDigestHex !== localDigest) {
      return this.finish(session, { kind: 'invalid-server-response' });
    }
    return this.finish(session, receipt);
  }
}

export const adaptiveNutritionPersistenceService = new AdaptiveNutritionPersistenceService(
  defaultSupabase,
  isAdaptiveNutritionRuntimeEnabled,
);
