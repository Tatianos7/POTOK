export const adaptiveNutritionCanonicalEncodingV1 = 'potok-adaptive-nutrition-canonical-json-v1' as const;
export const adaptiveNutritionProtocolV1 = 'adaptive-nutrition-v1-proposed' as const;

export interface AdaptiveNutritionWireSnapshotV1 {
  snapshotRevision: string;
  recipeRevision: string | null;
  portionRevision: string;
}

export interface AdaptiveNutritionWireSlotV1 {
  slotId: string;
  date: string;
  snapshot: AdaptiveNutritionWireSnapshotV1;
}

export interface AdaptiveNutritionWireActualV1 {
  items: Array<{
    foodRef: string;
    amount: string;
    unit: 'g' | 'ml';
    state: 'raw' | 'dry' | 'frozen' | 'cooked' | 'as-sold';
  }>;
}

export type AdaptiveNutritionWireActionV1 =
  | { type: 'CONSUMED_AS_PLANNED' | 'SKIPPED'; slot: AdaptiveNutritionWireSlotV1 }
  | { type: 'CONSUMED_MODIFIED'; slot: AdaptiveNutritionWireSlotV1; actual: AdaptiveNutritionWireActualV1 }
  | { type: 'EXTRA_FOOD'; date: string; mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'; actual: AdaptiveNutritionWireActualV1 }
  | { type: 'REPLACE'; slot: AdaptiveNutritionWireSlotV1; replacementOfferId: string }
  | { type: 'UNDO_ANNOTATION'; targetEventId: string };

export interface AdaptiveNutritionWireRequestV1 {
  contract: typeof adaptiveNutritionProtocolV1;
  expected: {
    accountId: string;
    planId: string;
    planRevision: string;
    goalRevision: string;
    historyRevision: string;
    diaryRevision: string;
    weekAnchor: string;
    timeZone: string;
  };
  idempotencyKey: string;
  explicitConfirmation: true;
  action: AdaptiveNutritionWireActionV1;
}

export interface DecodedAdaptiveNutritionWireEnvelopeV1 {
  request: AdaptiveNutritionWireRequestV1;
  canonicalBytes: Uint8Array;
}

const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function exactKeys(value: object, keys: string[]): boolean {
  return Object.getPrototypeOf(value) === Object.prototype
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

/** Scans the original text so escaped duplicate keys cannot disappear through JSON.parse/jsonb. */
function scanRawJsonWithoutDuplicateKeys(raw: string): void {
  if (typeof raw !== 'string') throw new Error('Raw JSON text required');
  let offset = 0;
  const fail = (message: string): never => { throw new Error(`${message} at ${offset}`); };
  const whitespace = (): void => { while (/[\t\n\r ]/.test(raw[offset] ?? '')) offset += 1; };
  const scanString = (): string => {
    if (raw[offset] !== '"') fail('Expected JSON string');
    const start = offset;
    offset += 1;
    while (offset < raw.length) {
      const code = raw.charCodeAt(offset);
      const character = raw[offset];
      if (character === '"') {
        offset += 1;
        return JSON.parse(raw.slice(start, offset)) as string;
      }
      if (code < 0x20) fail('Unescaped control character');
      if (character === '\\') {
        offset += 1;
        const escape = raw[offset];
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(raw.slice(offset + 1, offset + 5))) fail('Invalid Unicode escape');
          offset += 5;
          continue;
        }
        if (!escape || !'"\\/bfnrt'.includes(escape)) fail('Invalid JSON escape');
      }
      offset += 1;
    }
    return fail('Unterminated JSON string');
  };
  const scanValue = (): void => {
    whitespace();
    const character = raw[offset];
    if (character === '{') {
      offset += 1;
      whitespace();
      const keys = new Set<string>();
      if (raw[offset] === '}') { offset += 1; return; }
      while (offset < raw.length) {
        const key = scanString();
        if (keys.has(key)) throw new Error(`Duplicate JSON key: ${key}`);
        keys.add(key);
        whitespace();
        if (raw[offset] !== ':') fail('Expected colon');
        offset += 1;
        scanValue();
        whitespace();
        if (raw[offset] === '}') { offset += 1; return; }
        if (raw[offset] !== ',') fail('Expected object separator');
        offset += 1;
        whitespace();
      }
      fail('Unterminated JSON object');
    }
    if (character === '[') {
      offset += 1;
      whitespace();
      if (raw[offset] === ']') { offset += 1; return; }
      while (offset < raw.length) {
        scanValue();
        whitespace();
        if (raw[offset] === ']') { offset += 1; return; }
        if (raw[offset] !== ',') fail('Expected array separator');
        offset += 1;
      }
      fail('Unterminated JSON array');
    }
    if (character === '"') { scanString(); return; }
    for (const literal of ['true', 'false', 'null']) {
      if (raw.startsWith(literal, offset)) { offset += literal.length; return; }
    }
    const number = raw.slice(offset).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if (number) { offset += number[0].length; return; }
    fail('Invalid JSON value');
  };
  whitespace();
  scanValue();
  whitespace();
  if (offset !== raw.length) fail('Trailing JSON content');
}

function requireRecord(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !exactKeys(value, keys)) {
    throw new Error(`Invalid ${label} fields`);
  }
  return value as Record<string, unknown>;
}

function requireUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !canonicalUuidPattern.test(value)) throw new Error(`Invalid ${label} UUID`);
  return value;
}

function requireDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ${label} date`);
  }
  return value;
}

function requireTimeZone(value: unknown): string {
  if (typeof value !== 'string' || !value || value.trim() !== value) throw new Error('Invalid IANA timezone');
  try {
    if (new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone !== value) throw new Error();
  } catch {
    throw new Error('Invalid IANA timezone');
  }
  return value;
}

function requireEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`Invalid ${label}`);
  return value as T;
}

export function normalizeAdaptiveNutritionWireAmountV1(value: unknown): string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,5})(\.[0-9]{1,2})?$/.test(value)) {
    throw new Error('Invalid decimal encoding');
  }
  const [whole, fraction = ''] = value.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor === 0n) throw new Error('Amount must be positive');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}

export function decodeAdaptiveNutritionActualV1(value: unknown): AdaptiveNutritionWireActualV1 {
  const record = requireRecord(value, ['items'], 'actual payload');
  if (!Array.isArray(record.items) || record.items.length === 0) throw new Error('Missing actual items');
  return { items: record.items.map((item) => {
    const row = requireRecord(item, ['foodRef', 'amount', 'unit', 'state'], 'actual item');
    return {
      foodRef: requireUuid(row.foodRef, 'food reference'),
      amount: normalizeAdaptiveNutritionWireAmountV1(row.amount),
      unit: requireEnum(row.unit, ['g', 'ml'] as const, 'actual unit'),
      state: requireEnum(row.state, ['raw', 'dry', 'frozen', 'cooked', 'as-sold'] as const, 'actual state'),
    };
  }) };
}

function decodeSnapshot(value: unknown): AdaptiveNutritionWireSnapshotV1 {
  const row = requireRecord(value, ['snapshotRevision', 'recipeRevision', 'portionRevision'], 'snapshot');
  return {
    snapshotRevision: requireUuid(row.snapshotRevision, 'snapshot revision'),
    recipeRevision: row.recipeRevision === null ? null : requireUuid(row.recipeRevision, 'recipe revision'),
    portionRevision: requireUuid(row.portionRevision, 'portion revision'),
  };
}

function decodeSlot(value: unknown): AdaptiveNutritionWireSlotV1 {
  const row = requireRecord(value, ['slotId', 'date', 'snapshot'], 'slot');
  return { slotId: requireUuid(row.slotId, 'slot'), date: requireDate(row.date, 'slot'), snapshot: decodeSnapshot(row.snapshot) };
}

function decodeAction(value: unknown): AdaptiveNutritionWireActionV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid action');
  const type = requireEnum((value as Record<string, unknown>).type,
    ['CONSUMED_AS_PLANNED', 'SKIPPED', 'CONSUMED_MODIFIED', 'EXTRA_FOOD', 'REPLACE', 'UNDO_ANNOTATION'] as const,
    'action type');
  if (type === 'CONSUMED_AS_PLANNED' || type === 'SKIPPED') {
    const row = requireRecord(value, ['type', 'slot'], 'action');
    return { type, slot: decodeSlot(row.slot) };
  }
  if (type === 'CONSUMED_MODIFIED') {
    const row = requireRecord(value, ['type', 'slot', 'actual'], 'action');
    return { type, slot: decodeSlot(row.slot), actual: decodeAdaptiveNutritionActualV1(row.actual) };
  }
  if (type === 'EXTRA_FOOD') {
    const row = requireRecord(value, ['type', 'date', 'mealType', 'actual'], 'action');
    return {
      type,
      date: requireDate(row.date, 'action'),
      mealType: requireEnum(row.mealType, ['breakfast', 'lunch', 'dinner', 'snack'] as const, 'meal type'),
      actual: decodeAdaptiveNutritionActualV1(row.actual),
    };
  }
  if (type === 'REPLACE') {
    const row = requireRecord(value, ['type', 'slot', 'replacementOfferId'], 'action');
    return { type, slot: decodeSlot(row.slot), replacementOfferId: requireUuid(row.replacementOfferId, 'replacement offer') };
  }
  const row = requireRecord(value, ['type', 'targetEventId'], 'action');
  return { type, targetEventId: requireUuid(row.targetEventId, 'target event') };
}

function canonicalJsonV1(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJsonV1).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalJsonV1(row[key])}`).join(',')}}`;
  }
  throw new Error('Unsupported canonical wire value');
}

export function encodeAdaptiveNutritionCanonicalEnvelopeV1(request: AdaptiveNutritionWireRequestV1): Uint8Array {
  return new TextEncoder().encode(canonicalJsonV1({
    encoding: adaptiveNutritionCanonicalEncodingV1,
    protocol: request.contract,
    payload: request,
  }));
}

export function decodeAdaptiveNutritionWireEnvelopeV1(raw: string): DecodedAdaptiveNutritionWireEnvelopeV1 {
  scanRawJsonWithoutDuplicateKeys(raw);
  const parsed: unknown = JSON.parse(raw);
  const row = requireRecord(parsed, ['contract', 'expected', 'idempotencyKey', 'explicitConfirmation', 'action'], 'request');
  if (row.contract !== adaptiveNutritionProtocolV1) throw new Error('Invalid protocol');
  if (row.explicitConfirmation !== true) throw new Error('Explicit confirmation required');
  const expected = requireRecord(row.expected, ['accountId', 'planId', 'planRevision', 'goalRevision',
    'historyRevision', 'diaryRevision', 'weekAnchor', 'timeZone'], 'expected revision vector');
  const weekAnchor = requireDate(expected.weekAnchor, 'week anchor');
  if (new Date(`${weekAnchor}T00:00:00.000Z`).getUTCDay() !== 1) throw new Error('Week anchor must be Monday');
  const request: AdaptiveNutritionWireRequestV1 = {
    contract: adaptiveNutritionProtocolV1,
    expected: {
      accountId: requireUuid(expected.accountId, 'account'),
      planId: requireUuid(expected.planId, 'plan'),
      planRevision: requireUuid(expected.planRevision, 'plan revision'),
      goalRevision: requireUuid(expected.goalRevision, 'goal revision'),
      historyRevision: requireUuid(expected.historyRevision, 'history revision'),
      diaryRevision: requireUuid(expected.diaryRevision, 'diary revision'),
      weekAnchor,
      timeZone: requireTimeZone(expected.timeZone),
    },
    idempotencyKey: requireUuid(row.idempotencyKey, 'idempotency key'),
    explicitConfirmation: true,
    action: decodeAction(row.action),
  };
  return { request, canonicalBytes: encodeAdaptiveNutritionCanonicalEnvelopeV1(request) };
}

export async function adaptiveNutritionSha256HexV1(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('SHA-256 unavailable');
  const stableBytes = new Uint8Array(bytes.byteLength);
  stableBytes.set(bytes);
  const digest = await subtle.digest('SHA-256', stableBytes.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
