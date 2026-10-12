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
export const ADAPTIVE_NUTRITION_READ_FLAG = 'VITE_ADAPTIVE_NUTRITION_READ_V1' as const;
export const ADAPTIVE_NUTRITION_CONFLICT_DETAILS = 'POTOK_ADAPTIVE_NUTRITION_CONFLICT_V1' as const;
export const ADAPTIVE_NUTRITION_INVARIANT_DETAILS = 'POTOK_ADAPTIVE_NUTRITION_INVARIANT_FAILURE_V1' as const;

/** Build-time runtime gate. No localStorage override: browser input cannot enable writes. */
export function isAdaptiveNutritionRuntimeEnabled(): boolean {
  const env = typeof import.meta !== 'undefined'
    ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    : undefined;
  return env?.[ADAPTIVE_NUTRITION_RUNTIME_FLAG] === 'true';
}

/** Independent build-time read gate. It never enables mutation dispatch. */
export function isAdaptiveNutritionReadEnabled(): boolean {
  const env = typeof import.meta !== 'undefined'
    ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    : undefined;
  return env?.[ADAPTIVE_NUTRITION_READ_FLAG] === 'true';
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
  | { kind: 'conflict' }
  | { kind: 'server-integrity' }
  | { kind: 'technical-failure' };

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

interface AdaptiveNutritionAcceptedResultV1 extends Record<string, unknown> {
  contract: 'adaptive-nutrition-receipt-v1';
  outcome: 'accepted';
  operation_id: string;
  selection_id: string;
  plan_revision: string;
  goal_revision: string;
  history_revision: string;
  diary_revision: string;
  event_ids: string[];
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

function decodeAcceptedResult(value: unknown, operationId: string): AdaptiveNutritionAcceptedResultV1 | null {
  const row = record(value);
  if (!row || row.contract !== 'adaptive-nutrition-receipt-v1' || row.outcome !== 'accepted'
      || row.operation_id !== operationId || typeof row.selection_id !== 'string'
      || !uuidPattern.test(row.selection_id)
      || ![row.plan_revision, row.goal_revision, row.history_revision, row.diary_revision]
        .every((revision) => typeof revision === 'string' && uuidPattern.test(revision))
      || !Array.isArray(row.event_ids) || row.event_ids.length !== 1
      || row.event_ids.some((eventId) => typeof eventId !== 'string' || !uuidPattern.test(eventId))) return null;
  return row as AdaptiveNutritionAcceptedResultV1;
}

export function classifyAdaptiveNutritionMutationError(error: unknown): AdaptiveNutritionRuntimeFailure {
  const row = record(error);
  const code = row && typeof row.code === 'string' ? row.code : '';
  const details = row && typeof row.details === 'string' ? row.details : '';
  if (code === 'PT409' && details === ADAPTIVE_NUTRITION_CONFLICT_DETAILS) return { kind: 'conflict' };
  if (code === 'PT500' && details === ADAPTIVE_NUTRITION_INVARIANT_DETAILS) return { kind: 'server-integrity' };
  if (code === '42501') return { kind: 'denied' };
  return code ? { kind: 'technical-failure' } : { kind: 'unknown' };
}

function decodeReceipt(value: unknown): AdaptiveNutritionReceiptV1 | null {
  const row = record(value);
  if (!row || row.kind !== 'settled' || typeof row.operation_id !== 'string' || !uuidPattern.test(row.operation_id)
      || typeof row.idempotency_key !== 'string' || !uuidPattern.test(row.idempotency_key)
      || typeof row.digest_version !== 'string' || typeof row.request_digest_hex !== 'string'
      || !digestPattern.test(row.request_digest_hex)
      || !['accepted', 'conflict', 'rejected'].includes(String(row.outcome))
      || !nullableString(row.reason) || !nullableString(row.committed_at)
      || (row.outcome === 'accepted' && !decodeAcceptedResult(row.result, row.operation_id))
      || (row.outcome !== 'accepted' && row.result !== null && !record(row.result))) return null;
  const result = row.outcome === 'accepted'
    ? decodeAcceptedResult(row.result, row.operation_id)
    : record(row.result);
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

export async function adaptiveNutritionReceiptMatchesRequestV1(
  receipt: AdaptiveNutritionReceiptV1,
  rawRequest: string,
): Promise<boolean> {
  let decoded: { request: AdaptiveNutritionWireRequestV1; canonicalBytes: Uint8Array };
  try {
    decoded = decodeAdaptiveNutritionWireEnvelopeV1(rawRequest);
    const digest = await adaptiveNutritionSha256HexV1(decoded.canonicalBytes);
    const accepted = receipt.outcome === 'accepted' ? decodeAcceptedResult(receipt.result, receipt.operationId) : null;
    return receipt.idempotencyKey === decoded.request.idempotencyKey
      && receipt.digestVersion === adaptiveNutritionCanonicalEncodingV1
      && receipt.requestDigestHex === digest
      && (receipt.outcome !== 'accepted'
        || Boolean(accepted && accepted.selection_id === decoded.request.expected.planId));
  } catch {
    return false;
  }
}

export function decodeAdaptiveNutritionReadResultV1(value: unknown): AdaptiveNutritionReadResult | null {
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
    private readonly readGate: AdaptiveNutritionRuntimeGate = false,
  ) {}

  private isRuntimeEnabled(): boolean {
    return typeof this.runtimeGate === 'function' ? this.runtimeGate() : this.runtimeGate;
  }

  private isReadEnabled(): boolean {
    return typeof this.readGate === 'function' ? this.readGate() : this.readGate;
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

  private async authenticated(
    session: AdaptiveNutritionRuntimeSession,
    gate: 'read' | 'mutation',
  ): Promise<boolean> {
    const enabled = gate === 'read' ? this.isReadEnabled() : this.isRuntimeEnabled();
    if (!enabled || !this.client || !this.isCurrent(session)) return false;
    const { data, error } = await this.client.auth.getUser();
    return !error && data?.user?.id === session.accountId && this.isCurrent(session);
  }

  private async finish<T>(
    session: AdaptiveNutritionRuntimeSession,
    value: T,
    gate: 'read' | 'mutation',
  ): Promise<T | { kind: 'session-stale' } | { kind: 'unknown' }> {
    if (!this.isCurrent(session)) return { kind: 'session-stale' };
    try {
      if (!await this.authenticated(session, gate)) return { kind: 'session-stale' };
      return value;
    } catch {
      return { kind: 'unknown' };
    }
  }

  async lookup(session: AdaptiveNutritionRuntimeSession, idempotencyKey: string): Promise<AdaptiveNutritionLookupResult> {
    if (!this.isReadEnabled() || !this.client) return { kind: 'unavailable' };
    if (!uuidPattern.test(idempotencyKey)) return { kind: 'invalid-request', reason: 'invalid_idempotency_key' };
    try {
      if (!await this.authenticated(session, 'read')) return { kind: 'session-stale' };
    } catch {
      return { kind: 'session-stale' };
    }
    let response: Awaited<ReturnType<AdaptiveNutritionRpcClient['rpc']>>;
    try {
      response = await this.client.rpc('adaptive_nutrition_lookup_v1', { p_idempotency_key: idempotencyKey });
    } catch {
      return this.finish(session, { kind: 'unknown' }, 'read');
    }
    const { data, error } = response;
    if (error) return this.finish(session, { kind: 'unknown' }, 'read');
    const row = record(data);
    const decoded = row?.kind === 'unknown' ? { kind: 'unknown' as const }
      : row?.kind === 'denied' ? { kind: 'denied' as const }
      : row?.kind === 'conflict' ? { kind: 'conflict' as const }
      : decodeReceipt(data);
    return this.finish(session, decoded ?? { kind: 'invalid-server-response' }, 'read');
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
    if (!this.isReadEnabled() || !this.client) return { kind: 'unavailable' };
    if (!uuidPattern.test(selectionId)) return { kind: 'invalid-request', reason: 'invalid_selection_id' };
    try {
      if (!await this.authenticated(session, 'read')) return { kind: 'session-stale' };
    } catch {
      return { kind: 'session-stale' };
    }
    let response: Awaited<ReturnType<AdaptiveNutritionRpcClient['rpc']>>;
    try {
      response = await this.client.rpc('adaptive_nutrition_read_v1', {
        p_selection_id: selectionId,
        p_operation_id: operationId,
      });
    } catch {
      return this.finish(session, { kind: 'unknown' }, 'read');
    }
    const { data, error } = response;
    if (error) return this.finish(session, { kind: 'unknown' }, 'read');
    const decoded = decodeAdaptiveNutritionReadResultV1(data);
    if (decoded?.kind === 'ready' && (decoded.selectionId !== selectionId
      || decoded.exactOperationId !== operationId)) return this.finish(session, { kind: 'invalid-server-response' }, 'read');
    return this.finish(session, decoded ?? { kind: 'invalid-server-response' }, 'read');
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
    let authenticated = false;
    try {
      authenticated = await this.authenticated(session, 'mutation');
    } catch {
      return { kind: 'session-stale' };
    }
    if (decoded.request.expected.accountId !== session.accountId || !authenticated) {
      return { kind: 'session-stale' };
    }
    let localDigest: string;
    try {
      localDigest = await adaptiveNutritionSha256HexV1(decoded.canonicalBytes);
    } catch {
      return { kind: 'unavailable' };
    }
    let response: Awaited<ReturnType<AdaptiveNutritionRpcClient['rpc']>>;
    try {
      response = await this.client.rpc('adaptive_nutrition_mutate_v1', { p_request_text: rawRequest });
    } catch {
      return this.finish(session, { kind: 'unknown' }, 'mutation');
    }
    const { data, error } = response;
    if (error) {
      return this.finish(session, classifyAdaptiveNutritionMutationError(error), 'mutation');
    }
    const row = record(data);
    if (row?.kind === 'unknown') return this.finish(session, { kind: 'unknown' }, 'mutation');
    if (row?.kind === 'denied') return this.finish(session, { kind: 'denied' }, 'mutation');
    if (row?.kind === 'conflict') return this.finish(session, { kind: 'conflict' }, 'mutation');
    const receipt = decodeReceipt(data);
    if (!receipt || receipt.idempotencyKey !== decoded.request.idempotencyKey
        || receipt.digestVersion !== adaptiveNutritionCanonicalEncodingV1
        || receipt.requestDigestHex !== localDigest
        || receipt.outcome === 'accepted'
          && (receipt.result?.selection_id !== decoded.request.expected.planId)) {
      return this.finish(session, { kind: 'unknown' }, 'mutation');
    }
    return this.finish(session, receipt, 'mutation');
  }
}

export const adaptiveNutritionPersistenceService = new AdaptiveNutritionPersistenceService(
  defaultSupabase,
  isAdaptiveNutritionRuntimeEnabled,
  isAdaptiveNutritionReadEnabled,
);
