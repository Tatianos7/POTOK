import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../lib/supabaseClient';
import {
  ADAPTIVE_NUTRITION_READ_FLAG,
  decodeAdaptiveNutritionReadResultV1,
  isAdaptiveNutritionReadEnabled,
  type AdaptiveNutritionReadResult,
} from './adaptiveNutritionPersistenceService';

type AdaptiveNutritionReadClient = Pick<SupabaseClient, 'auth' | 'rpc'>;
type AdaptiveNutritionReadGate = boolean | (() => boolean);

export { ADAPTIVE_NUTRITION_READ_FLAG, isAdaptiveNutritionReadEnabled };

export interface AdaptiveNutritionReadSession {
  accountId: string;
  generation: number;
}

export type AdaptiveNutritionDiscoveryResult =
  | {
    kind: 'ready';
    selectionId: string;
    weekAnchor: string;
    timeZone: string;
    status: 'active';
    contractVersion: 1;
  }
  | { kind: 'no_active_plan' }
  | { kind: 'ambiguous' }
  | { kind: 'denied' }
  | { kind: 'unavailable' }
  | { kind: 'invalid-request'; reason: string }
  | { kind: 'invalid-server-response' }
  | { kind: 'session-stale' };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function isValidAdaptiveNutritionTimeZone(value: string): boolean {
  if (!value || value !== value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function getAdaptiveNutritionLocalTimeZone(): string | null {
  try {
    const value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidAdaptiveNutritionTimeZone(value) ? value : null;
  } catch {
    return null;
  }
}

function decodeDiscovery(value: unknown): AdaptiveNutritionDiscoveryResult | null {
  const row = record(value);
  if (!row || typeof row.kind !== 'string') return null;
  if (row.kind === 'no_active_plan' && hasExactKeys(row, ['kind'])) return { kind: 'no_active_plan' };
  if (row.kind === 'ambiguous' && hasExactKeys(row, ['kind'])) return { kind: 'ambiguous' };
  if (row.kind === 'denied' && hasExactKeys(row, ['kind'])) return { kind: 'denied' };
  if (row.kind !== 'ready'
      || !hasExactKeys(row, ['kind', 'selection_id', 'week_anchor', 'timezone', 'status', 'contract_version'])
      || typeof row.selection_id !== 'string' || !uuidPattern.test(row.selection_id)
      || typeof row.week_anchor !== 'string' || !datePattern.test(row.week_anchor)
      || typeof row.timezone !== 'string' || !isValidAdaptiveNutritionTimeZone(row.timezone)
      || row.status !== 'active' || row.contract_version !== 1) return null;
  return {
    kind: 'ready',
    selectionId: row.selection_id,
    weekAnchor: row.week_anchor,
    timeZone: row.timezone,
    status: 'active',
    contractVersion: 1,
  };
}

export class AdaptiveNutritionReadOnlyService {
  private generation = 0;
  private accountId: string | null = null;

  constructor(
    private readonly client: AdaptiveNutritionReadClient | null = defaultSupabase,
    private readonly readGate: AdaptiveNutritionReadGate = false,
  ) {}

  private isReadEnabled(): boolean {
    return typeof this.readGate === 'function' ? this.readGate() : this.readGate;
  }

  beginSession(accountId: string): AdaptiveNutritionReadSession {
    if (!uuidPattern.test(accountId)) throw new Error('invalid_account_id');
    this.generation += 1;
    this.accountId = accountId;
    return { accountId, generation: this.generation };
  }

  endSession(): void {
    this.generation += 1;
    this.accountId = null;
  }

  private isCurrent(session: AdaptiveNutritionReadSession): boolean {
    return session.accountId === this.accountId && session.generation === this.generation;
  }

  private async authenticated(session: AdaptiveNutritionReadSession): Promise<boolean> {
    if (!this.isReadEnabled() || !this.client || !this.isCurrent(session)) return false;
    const { data, error } = await this.client.auth.getUser();
    return !error && data?.user?.id === session.accountId && this.isCurrent(session);
  }

  private async finish<T>(session: AdaptiveNutritionReadSession, value: T): Promise<T | { kind: 'session-stale' }> {
    if (!this.isCurrent(session) || !await this.authenticated(session)) return { kind: 'session-stale' };
    return value;
  }

  async discoverCurrent(
    session: AdaptiveNutritionReadSession,
    timeZone: string,
  ): Promise<AdaptiveNutritionDiscoveryResult> {
    if (!this.isReadEnabled() || !this.client) return { kind: 'unavailable' };
    if (!isValidAdaptiveNutritionTimeZone(timeZone)) return { kind: 'invalid-request', reason: 'invalid_timezone' };
    if (!await this.authenticated(session)) return { kind: 'session-stale' };
    const { data, error } = await this.client.rpc('adaptive_nutrition_discover_current_v1', {
      p_timezone: timeZone,
    });
    if (error) return this.finish(session, { kind: 'unavailable' });
    const decoded = decodeDiscovery(data) ?? { kind: 'invalid-server-response' as const };
    if (decoded.kind === 'ready' && decoded.timeZone !== timeZone) {
      return this.finish(session, { kind: 'invalid-server-response' });
    }
    return this.finish(session, decoded);
  }

  async readCurrent(
    session: AdaptiveNutritionReadSession,
    selectionId: string,
  ): Promise<AdaptiveNutritionReadResult> {
    if (!this.isReadEnabled() || !this.client) return { kind: 'unavailable' };
    if (!uuidPattern.test(selectionId)) return { kind: 'invalid-request', reason: 'invalid_selection_id' };
    if (!await this.authenticated(session)) return { kind: 'session-stale' };
    const { data, error } = await this.client.rpc('adaptive_nutrition_read_v1', {
      p_selection_id: selectionId,
      p_operation_id: null,
    });
    if (error) return this.finish(session, { kind: 'unavailable' });
    const decoded = decodeAdaptiveNutritionReadResultV1(data) ?? { kind: 'invalid-server-response' as const };
    if (decoded.kind === 'ready' && (decoded.selectionId !== selectionId || decoded.exactOperationId !== null)) {
      return this.finish(session, { kind: 'invalid-server-response' });
    }
    return this.finish(session, decoded);
  }
}

export const adaptiveNutritionReadOnlyService = new AdaptiveNutritionReadOnlyService(
  defaultSupabase,
  isAdaptiveNutritionReadEnabled,
);

export function discoverCurrentAdaptiveNutritionSelectionV1(
  session: AdaptiveNutritionReadSession,
  timeZone: string,
): Promise<AdaptiveNutritionDiscoveryResult> {
  return adaptiveNutritionReadOnlyService.discoverCurrent(session, timeZone);
}
