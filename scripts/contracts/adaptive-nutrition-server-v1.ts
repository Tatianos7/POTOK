/** PROPOSED review DTOs + synthetic reference predicates. NOT a server or runtime port.
 * No network/storage/SDK imports. Trusted inputs below are test fixtures, not credentials.
 * Passing tests does not prove SQL/RLS, concurrency, durability or actor enforcement.
 */
import { createHash } from 'node:crypto';
import type { NutritionDatedSlot, NutritionPortionSnapshot, NutritionRevisionContext,
  NutritionSnapshotRevision } from '../../src/types/nutritionPersistence';
import {
  decodeAdaptiveNutritionWireEnvelopeV1,
  encodeAdaptiveNutritionCanonicalEnvelopeV1,
  normalizeAdaptiveNutritionWireAmountV1,
} from '../../src/utils/adaptiveNutritionWireV1';

export { adaptiveNutritionCanonicalEncodingV1 } from '../../src/utils/adaptiveNutritionWireV1';

export const draftStatus = { decision: 'PROPOSED', persistenceEnabled: false } as const;

export interface RevisionVector extends NutritionRevisionContext {
  historyRevision: string;
  /** Scoped to account + instance, never a global legacy diary token. */
  diaryRevision: string;
}
export interface ActualFoodPayload {
  items: Array<{ foodRef: string; amount: string; unit: 'g' | 'ml';
    state: 'raw' | 'dry' | 'frozen' | 'cooked' | 'as-sold' }>;
}
type Slot = { slotId: string; date: string; snapshot: NutritionSnapshotRevision };
export type Action =
  | { type: 'CONSUMED_AS_PLANNED' | 'SKIPPED'; slot: Slot }
  | { type: 'CONSUMED_MODIFIED'; slot: Slot; actual: ActualFoodPayload }
  | { type: 'EXTRA_FOOD'; date: string; mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'; actual: ActualFoodPayload }
  | { type: 'REPLACE'; slot: Slot; replacementOfferId: string }
  | { type: 'UNDO_ANNOTATION'; targetEventId: string };
export interface MutationRequest {
  contract: 'adaptive-nutrition-v1-proposed';
  expected: RevisionVector;
  idempotencyKey: string;
  explicitConfirmation: true;
  action: Action;
}
export type PlanOrigin =
  | { originKind: 'legacy_catalog' | 'catalog_template'; templateRef: string; lineage: string[] }
  | { originKind: 'generated'; templateRef: null; lineage: string[]; generatorVersion: string };
/** The same diary/operation ledger; own FACT correction never requires current plan/Goal CAS. */
export interface FreeDiaryRequest {
  contract: 'free-diary-v1-proposed';
  accountId: string;
  idempotencyKey: string;
  explicitConfirmation: true;
  action:
    | { type: 'CREATE_FACT'; date: string; mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'; actual: ActualFoodPayload }
    | { type: 'CORRECT_FACT'; targetEventId: string; expectedEventRevision: string; actual: ActualFoodPayload }
    | { type: 'RETRACT_FACT'; targetEventId: string; expectedEventRevision: string };
}
export type FreeDiaryReceipt = ReceiptBase & (
  | { outcome: 'accepted'; streamId: string; eventRevision: string; eventIds: string[];
      linkedPlanId: string | null; linkedHistoryRevision: string | null; linkedDiaryRevision: string | null }
  | { outcome: 'conflict' | 'rejected'; reason: string }
);
interface ReceiptBase {
  accountId: string;
  operationId: string;
  idempotencyKey: string;
  requestDigest: string;
  digestVersion: string;
}
export type Receipt = ReceiptBase & (
  | { outcome: 'accepted'; result: RevisionVector; confirmedSlots: Slot[]; eventIds: string[] }
  | { outcome: 'conflict' | 'rejected'; reason: string }
);
export type LookupResult = { kind: 'settled'; receipt: Receipt | FreeDiaryReceipt }
  | { kind: 'unknown'; reason: 'not_observed_or_in_flight' | 'transport_timeout' }
  | { kind: 'denied' };
export interface LookupRequest { idempotencyKey: string }
export type MutationResult = LookupResult
  | { kind: 'invalid-request' }
  /** Does not overwrite the original terminal receipt under this key. */
  | { kind: 'conflict'; reason: 'idempotency_payload_mismatch' };
export type ReadRequest = { mode: 'current'; planId: string }
  | { mode: 'exact-receipt'; planId: string; operationId: string };
export interface ExactReadProof {
  operationId: string;
  revisions: RevisionVector;
  coverage: 'complete';
  matchedEventIds: string[];
  confirmedSlots: Slot[];
  /** A historical result does not authorize replacing a newer current head. */
  historical: boolean;
}
export interface HistoryEventDTO {
  eventId: string;
  eventRevision: string;
  operationId: string;
  accountId: string;
  planId: string | null;
  date: string;
  slotId: string | null;
  supersedesEventId: string | null;
  effect: { kind: 'FACT'; snapshot: NutritionPortionSnapshot }
    | { kind: 'FACT_RETRACTION' | 'ANNOTATION' | 'ANNOTATION_RETRACTION' | 'PLAN_REPLACED' };
}
/** Parsed/validated DTO draft. Wire decimal decoding is an explicit implementation gate. */
export type ReadResult = { kind: 'ready'; revisions: RevisionVector;
  origin: PlanOrigin;
  status: 'active' | 'provisional' | 'paused' | 'completed' | 'archived';
  slots: NutritionDatedSlot[];
  coverage: { complete: true; localDates: string[] };
  effectiveFactEvents: HistoryEventDTO[];
  exactReceiptProof: ExactReadProof | null;
} | { kind: 'not-ready'; reason: 'exact_revision_unavailable' | 'incomplete' | 'conflict' }
  | { kind: 'denied' };
export type HistoryRequest = { scope: 'plan'; planId: string; historyRevision: string; cursor: string | null }
  | { scope: 'fact-stream'; streamId: string; eventRevision: string; cursor: string | null };
export type HistoryResult = { kind: 'page'; accountId: string; scope: 'plan' | 'fact-stream'; scopeId: string;
  revision: string; events: HistoryEventDTO[]; nextCursor: string | null;
} | { kind: 'not-ready' | 'denied' };

/** Synthetic equality only; NOT the proposed server digest encoding/crypto. */
export function syntheticCanonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(syntheticCanonical).join(',')}]`;
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${syntheticCanonical(record[key])}`).join(',')}}`;
  }
  throw new Error('Unsupported synthetic payload');
}
export interface SyntheticLedgerRecord { request: MutationRequest | FreeDiaryRequest; receipt: Receipt | FreeDiaryReceipt }
export interface SyntheticTrustedAccess {
  accountId: string;
  /** Must originate from an approved protected authority; old has_premium is absent. */
  verifiedProvenance: string | null;
  allowed: boolean;
  validUntil: number;
}
export type EntitlementCapabilityV1 = 'premium' | 'admin';
export interface EntitlementAttestationV1 {
  contract: 'potok-entitlement-attestation-v1';
  authority: 'owner-controlled-server-v1';
  attestationId: string;
  accountId: string;
  capability: EntitlementCapabilityV1;
  effect: 'GRANT' | 'REVOKE';
  previousAttestationId: string | null;
  sequence: string;
  issuedAt: string;
  validUntil: string | null;
  operatorId: string;
  evidenceRef: string;
}
export interface LegacyEntitlementFlags {
  hasPremium: boolean;
  isAdmin: boolean;
}
export type EffectiveEntitlementDecisionV1 = {
  allowed: boolean;
  reason: 'verified-grant' | 'no-verified-attestation' | 'old-flag-unverified'
    | 'not-yet-effective' | 'expired' | 'revoked' | 'invalid-lineage';
  provenanceAttestationId: string | null;
  lineageDigestSha256: string | null;
};
const entitlementAttestationKeys = ['contract', 'authority', 'attestationId', 'accountId', 'capability',
  'effect', 'previousAttestationId', 'sequence', 'issuedAt', 'validUntil', 'operatorId', 'evidenceRef'];
function canonicalInstant(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw new Error(`Invalid ${label}`);
  return value;
}
/** Local audit predicate only: the literal authority marker does not prove a protected server caller. */
export function effectiveEntitlementV1(accountId: string, capability: EntitlementCapabilityV1,
  serverNow: string, attestations: readonly EntitlementAttestationV1[], legacyFlags: LegacyEntitlementFlags,
): EffectiveEntitlementDecisionV1 {
  try {
    requireUuid(accountId, 'entitlement account');
    requireEnum(capability, ['premium', 'admin'] as const, 'entitlement capability');
    const now = canonicalInstant(serverNow, 'server time');
    const scoped = attestations.filter(row => row.accountId === accountId && row.capability === capability)
      .map(row => {
        if (!exactKeys(row, entitlementAttestationKeys)
            || row.contract !== 'potok-entitlement-attestation-v1'
            || row.authority !== 'owner-controlled-server-v1') throw new Error('Invalid attestation contract');
        requireUuid(row.attestationId, 'attestation');
        requireUuid(row.accountId, 'attestation account');
        requireEnum(row.capability, ['premium', 'admin'] as const, 'attestation capability');
        requireEnum(row.effect, ['GRANT', 'REVOKE'] as const, 'attestation effect');
        if (row.previousAttestationId !== null) requireUuid(row.previousAttestationId, 'previous attestation');
        if (!/^[1-9][0-9]{0,15}$/.test(row.sequence)) throw new Error('Invalid attestation sequence');
        const issuedAt = canonicalInstant(row.issuedAt, 'attestation time');
        if (row.effect === 'REVOKE' && row.validUntil !== null) throw new Error('Revoke cannot expire');
        const validUntil = row.validUntil === null ? null : canonicalInstant(row.validUntil, 'attestation expiry');
        if (validUntil !== null && validUntil <= issuedAt) throw new Error('Invalid attestation validity');
        requireUuid(row.operatorId, 'operator');
        if (!row.evidenceRef || row.evidenceRef.trim() !== row.evidenceRef) throw new Error('Invalid evidence reference');
        return { row, sequence: BigInt(row.sequence), issuedAt, validUntil };
      })
      .sort((left, right) => left.sequence < right.sequence ? -1 : left.sequence > right.sequence ? 1 : 0);
    if (!scoped.length) {
      const oldFlag = capability === 'premium' ? legacyFlags.hasPremium : legacyFlags.isAdmin;
      return { allowed: false, reason: oldFlag ? 'old-flag-unverified' : 'no-verified-attestation',
        provenanceAttestationId: null, lineageDigestSha256: null };
    }
    if (new Set(scoped.map(item => item.row.attestationId)).size !== scoped.length) throw new Error('Duplicate attestation');
    for (let index = 0; index < scoped.length; index += 1) {
      const item = scoped[index];
      const previous = scoped[index - 1];
      if (item.sequence !== BigInt(index + 1)
          || item.row.previousAttestationId !== (previous?.row.attestationId ?? null)
          || (previous && item.issuedAt < previous.issuedAt)) throw new Error('Invalid attestation lineage');
    }
    const lineageDigestSha256 = createHash('sha256').update(new TextEncoder().encode(canonicalJsonV1({
      encoding: 'potok-entitlement-lineage-v1', accountId, capability,
      lineage: scoped.map(item => item.row),
    }))).digest('hex');
    const effective = scoped.filter(item => item.issuedAt <= now).at(-1);
    if (!effective) return { allowed: false, reason: 'not-yet-effective',
      provenanceAttestationId: null, lineageDigestSha256 };
    if (effective.row.effect === 'REVOKE') return { allowed: false, reason: 'revoked',
      provenanceAttestationId: effective.row.attestationId, lineageDigestSha256 };
    if (effective.validUntil !== null && effective.validUntil <= now) return { allowed: false, reason: 'expired',
      provenanceAttestationId: effective.row.attestationId, lineageDigestSha256 };
    return { allowed: true, reason: 'verified-grant',
      provenanceAttestationId: effective.row.attestationId, lineageDigestSha256 };
  } catch {
    return { allowed: false, reason: 'invalid-lineage',
      provenanceAttestationId: null, lineageDigestSha256: null };
  }
}
export function lookupSynthetic(actor: string | null, key: string, record?: SyntheticLedgerRecord): LookupResult {
  if (!actor || !key) return { kind: 'denied' };
  if (!record) return { kind: 'unknown', reason: 'not_observed_or_in_flight' };
  const account = record.request.contract === 'adaptive-nutrition-v1-proposed'
    ? record.request.expected.accountId : record.request.accountId;
  if (record.receipt.accountId !== actor || account !== actor
      || record.receipt.idempotencyKey !== key || record.request.idempotencyKey !== key) return { kind: 'denied' };
  return { kind: 'settled', receipt: structuredClone(record.receipt) };
}
export function admitSynthetic(
  actor: string | null, request: MutationRequest, head: RevisionVector,
  access: SyntheticTrustedAccess | null, serverNow: number, record?: SyntheticLedgerRecord,
): 'new-paid-effect-eligible' | 'exact-replay' | 'conflict' | 'denied' {
  if (!actor || actor !== request.expected.accountId || !request.idempotencyKey
      || request.contract !== 'adaptive-nutrition-v1-proposed' || request.explicitConfirmation !== true) return 'denied';
  if (record) {
    if (lookupSynthetic(actor, request.idempotencyKey, record).kind !== 'settled') return 'denied';
    return syntheticCanonical(request) === syntheticCanonical(record.request) ? 'exact-replay' : 'conflict';
  }
  if (!access || access.accountId !== actor || !access.verifiedProvenance || !access.allowed
      || !Number.isFinite(access.validUntil) || !Number.isFinite(serverNow) || access.validUntil <= serverNow) return 'denied';
  if (head.accountId !== actor) return 'denied';
  return syntheticCanonical(head) === syntheticCanonical(request.expected) ? 'new-paid-effect-eligible' : 'conflict';
}

const ordinaryProfileColumns = new Set(['first_name', 'last_name', 'middle_name', 'birth_date',
  'age', 'height', 'goal', 'email', 'phone', 'avatar_url']);
/** INSERT defaults flags to false on server; UPDATE cannot even echo protected fields. */
export function ordinaryProfilePatchAllowed(patch: Record<string, unknown>): boolean {
  return Object.keys(patch).every(key => ordinaryProfileColumns.has(key));
}

export interface SyntheticDiaryRow {
  id: string; accountId: string; date: string; eventId: string | null; componentId: string | null;
}
/** Date set is server-derived from retained managed instances, never caller-declared. */
export function legacyWriteAllowed(actor: string, before: SyntheticDiaryRow | null,
  after: SyntheticDiaryRow | null, managedDates: ReadonlySet<string>): boolean {
  return Boolean(actor && (before || after)) && [before, after].every(row => row === null || (
    row.accountId === actor && row.eventId === null && row.componentId === null && !managedDates.has(row.date)
  ));
}
export interface SyntheticEvent {
  id: string; accountId: string; planId: string; streamId: string; date: string;
  kind: 'FACT' | 'FACT_RETRACTION' | 'ANNOTATION' | 'ANNOTATION_RETRACTION';
  supersedes: string | null;
  /** Server-internal ordering fixture, not an opaque revision comparator. */
  ordinal: number;
  componentIds: string[];
}
/** Test oracle for effective projection; does not replace a DB view/RLS or validate food. */
export function effectiveSyntheticDiary(actor: string, allEvents: SyntheticEvent[], allRows: SyntheticDiaryRow[]): SyntheticDiaryRow[] {
  if (!actor) throw new Error('Missing actor');
  const events = allEvents.filter(event => event.accountId === actor);
  const rows = allRows.filter(row => row.accountId === actor);
  const byId = new Map(events.map(event => [event.id, event]));
  if (byId.size !== events.length || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Duplicate identity');
  const superseded = new Set<string>();
  const roots = new Set<string>();
  for (const event of events) {
    if (!Number.isSafeInteger(event.ordinal) || event.ordinal < 1) throw new Error('Invalid order');
    if (event.supersedes) {
      const parent = byId.get(event.supersedes);
      const family = event.kind.startsWith('FACT') ? 'FACT' : 'ANNOTATION';
      if (!parent || parent.planId !== event.planId || parent.streamId !== event.streamId
          || parent.date !== event.date || parent.ordinal >= event.ordinal
          || parent.kind !== family || superseded.has(parent.id)) throw new Error('Invalid history chain');
      superseded.add(parent.id);
    } else {
      if (event.kind.endsWith('RETRACTION')) throw new Error('Retraction needs parent');
      const root = syntheticCanonical([event.planId, event.streamId]);
      if (roots.has(root)) throw new Error('Duplicate stream root');
      roots.add(root);
    }
    const projected = rows.filter(row => row.eventId === event.id);
    const ids = projected.map(row => row.componentId);
    if (event.kind !== 'FACT' && (event.componentIds.length || ids.length)) throw new Error('Annotation/retraction has diary rows');
    if (event.kind === 'FACT' && (!ids.length || ids.some(id => !id)
        || new Set(ids).size !== ids.length || new Set(event.componentIds).size !== event.componentIds.length
        || syntheticCanonical([...ids].sort()) !== syntheticCanonical([...event.componentIds].sort()))) throw new Error('Incomplete fact components');
  }
  for (const row of rows) {
    if (row.eventId === null) {
      if (row.componentId !== null) throw new Error('Forged legacy provenance');
    } else if (!byId.has(row.eventId) || byId.get(row.eventId)!.date !== row.date) throw new Error('Orphan/mismatched projection');
  }
  return structuredClone(rows.filter(row => row.eventId === null || !superseded.has(row.eventId)));
}

/** Equality of authenticated receipt/read fixtures only; no client provenance oracle. */
export function matchesExactSyntheticRead(receipt: Receipt, proof: ExactReadProof): boolean {
  return receipt.outcome === 'accepted' && proof.coverage === 'complete'
    && receipt.operationId === proof.operationId
    && receipt.accountId === proof.revisions.accountId
    && syntheticCanonical(receipt.result) === syntheticCanonical(proof.revisions)
    && syntheticCanonical([...receipt.eventIds].sort()) === syntheticCanonical([...proof.matchedEventIds].sort())
    && syntheticCanonical(receipt.confirmedSlots) === syntheticCanonical(proof.confirmedSlots);
}

/** Storage bound from diary numeric(8,2), NOT a nutrition/clinical threshold. */
export const normalizeWireAmount = normalizeAdaptiveNutritionWireAmountV1;
function exactKeys(value: object, keys: string[]): boolean {
  return Object.getPrototypeOf(value) === Object.prototype
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function requireUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !canonicalUuidPattern.test(value)) throw new Error(`Invalid ${label} UUID`);
  return value;
}
function requireEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`Invalid ${label}`);
  return value as T;
}
function canonicalJsonV1(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJsonV1).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map(key => `${JSON.stringify(key)}:${canonicalJsonV1(row[key])}`).join(',')}}`;
  }
  throw new Error('Unsupported canonical wire value');
}
declare const validatedAdaptiveNutritionWireV1: unique symbol;
export type ValidatedAdaptiveNutritionRequestV1 = MutationRequest & {
  readonly [validatedAdaptiveNutritionWireV1]: true;
};
export interface DecodedAdaptiveNutritionWireV1 {
  request: ValidatedAdaptiveNutritionRequestV1;
  canonicalBytes: Uint8Array;
  digestSha256: string;
}
export function encodeAdaptiveNutritionCanonicalV1(request: ValidatedAdaptiveNutritionRequestV1): Uint8Array {
  return encodeAdaptiveNutritionCanonicalEnvelopeV1(request);
}
export function decodeAdaptiveNutritionWireV1(raw: string): DecodedAdaptiveNutritionWireV1 {
  const decoded = decodeAdaptiveNutritionWireEnvelopeV1(raw);
  const request = decoded.request as ValidatedAdaptiveNutritionRequestV1;
  const canonicalBytes = decoded.canonicalBytes;
  return { request, canonicalBytes,
    digestSha256: createHash('sha256').update(canonicalBytes).digest('hex') };
}
/** Parsed-object fixture decoder; duplicate raw JSON keys must be rejected BEFORE jsonb. */
export function decodeActualFixture(value: unknown): ActualFoodPayload {
  if (!value || typeof value !== 'object' || !exactKeys(value, ['items'])) throw new Error('Invalid actual payload');
  const items = (value as { items: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) throw new Error('Missing actual items');
  return { items: items.map(item => {
    if (!item || typeof item !== 'object' || !exactKeys(item, ['foodRef', 'amount', 'unit', 'state'])) {
      throw new Error('Unknown/missing actual field');
    }
    const row = item as Record<string, unknown>;
    if (typeof row.foodRef !== 'string' || !row.foodRef || row.foodRef.trim() !== row.foodRef
        || typeof row.unit !== 'string' || !['g', 'ml'].includes(row.unit)
        || typeof row.state !== 'string' || !['raw', 'dry', 'frozen', 'cooked', 'as-sold'].includes(row.state)) {
      throw new Error('Invalid actual item');
    }
    return { foodRef: row.foodRef, amount: normalizeWireAmount(row.amount),
      unit: row.unit as 'g' | 'ml', state: row.state as ActualFoodPayload['items'][number]['state'] };
  }) };
}
export function admitFreeCorrectionSynthetic(actor: string | null, request: FreeDiaryRequest,
  target: { accountId: string; eventId: string; eventRevision: string; liveFact: boolean } | null,
  record?: SyntheticLedgerRecord): 'eligible' | 'exact-replay' | 'conflict' | 'denied' {
  if (!actor || actor !== request.accountId || !request.idempotencyKey
      || request.contract !== 'free-diary-v1-proposed' || request.explicitConfirmation !== true
      || !exactKeys(request, ['contract', 'accountId', 'idempotencyKey', 'explicitConfirmation', 'action'])) return 'denied';
  if (record) {
    if (lookupSynthetic(actor, request.idempotencyKey, record).kind !== 'settled') return 'denied';
    return syntheticCanonical(request) === syntheticCanonical(record.request) ? 'exact-replay' : 'conflict';
  }
  if (!target || target.accountId !== actor) return 'denied';
  const action = request.action;
  if (action.type !== 'CORRECT_FACT' && action.type !== 'RETRACT_FACT') return 'denied';
  if (!exactKeys(action, action.type === 'CORRECT_FACT'
    ? ['type', 'targetEventId', 'expectedEventRevision', 'actual'] : ['type', 'targetEventId', 'expectedEventRevision'])) return 'denied';
  if (action.targetEventId !== target.eventId || action.expectedEventRevision !== target.eventRevision || !target.liveFact) return 'conflict';
  if (action.type === 'CORRECT_FACT') {
    try { decodeActualFixture(action.actual); } catch { return 'denied'; }
  }
  return 'eligible'; // No entitlement or current plan revision input; no mutation performed.
}
export interface RestartIntentFixture {
  accountId: string; idempotencyKey: string;
  request: MutationRequest | FreeDiaryRequest;
  canonicalEnvelope: string;
}
export function restartLookupSynthetic(actor: string | null, intent: RestartIntentFixture | null):
  { kind: 'lookup'; idempotencyKey: string } | { kind: 'quarantined' | 'needs-account-recovery' | 'blocked-corrupt' } {
  if (!actor || (intent && actor !== intent.accountId)) return { kind: 'quarantined' };
  if (!intent) return { kind: 'needs-account-recovery' };
  const scope = intent.request.contract === 'adaptive-nutrition-v1-proposed'
    ? intent.request.expected.accountId : intent.request.accountId;
  try {
    if (scope !== actor || !intent.idempotencyKey || intent.request.idempotencyKey !== intent.idempotencyKey
        || intent.canonicalEnvelope !== syntheticCanonical(intent.request)) return { kind: 'blocked-corrupt' };
  } catch { return { kind: 'blocked-corrupt' }; }
  return { kind: 'lookup', idempotencyKey: intent.idempotencyKey };
}
/** Pure lifecycle fixture only. Retention here is an invariant, not durable storage. */
export interface SyntheticLifecycleState {
  activeAccountId: string | null;
  unknownIntent: RestartIntentFixture | null;
  erasurePendingAccountIds: readonly string[];
}
export type SyntheticLifecycleEvent =
  | { type: 'LOGOUT' }
  | { type: 'ACCOUNT_AUTHENTICATED'; accountId: string }
  | { type: 'ERASURE_REQUESTED' };
export type SyntheticLifecycleDecision =
  | { kind: 'signed-out' }
  | { kind: 'lookup'; idempotencyKey: string }
  | { kind: 'quarantined' | 'needs-account-recovery' | 'blocked-corrupt' | 'blocked-erasure-pending' };
export function reduceLifecycleSynthetic(state: SyntheticLifecycleState,
  event: SyntheticLifecycleEvent): SyntheticLifecycleState {
  switch (event.type) {
    case 'LOGOUT':
      return { ...state, activeAccountId: null };
    case 'ACCOUNT_AUTHENTICATED':
      if (!event.accountId || event.accountId.trim() !== event.accountId) throw new Error('Invalid account');
      return { ...state, activeAccountId: event.accountId };
    case 'ERASURE_REQUESTED': {
      if (!state.activeAccountId) throw new Error('Authenticated account required');
      const pending = state.erasurePendingAccountIds.includes(state.activeAccountId)
        ? state.erasurePendingAccountIds : [...state.erasurePendingAccountIds, state.activeAccountId];
      return { ...state, erasurePendingAccountIds: pending };
    }
    default:
      throw new Error('Unsupported lifecycle event');
  }
}
/** Exposes no foreign account, intent or key. Erasure remains pending until an external reviewed protocol exists. */
export function lifecycleDecisionSynthetic(state: SyntheticLifecycleState): SyntheticLifecycleDecision {
  const actor = state.activeAccountId;
  if (!actor) return { kind: 'signed-out' };
  if (state.erasurePendingAccountIds.includes(actor)) return { kind: 'blocked-erasure-pending' };
  return restartLookupSynthetic(actor, state.unknownIntent);
}
/** Entire batch decision only: no prefix application, queue mutation or auto key split. */
export function legacyBatchSynthetic(actor: string, entries: Array<{ before: SyntheticDiaryRow | null; after: SyntheticDiaryRow | null }>,
  managedDates: ReadonlySet<string>, activatedV1Cohort: boolean): 'eligible' | 'upgrade-required' {
  return !activatedV1Cohort && entries.every(entry => legacyWriteAllowed(actor, entry.before, entry.after, managedDates))
    ? 'eligible' : 'upgrade-required';
}
