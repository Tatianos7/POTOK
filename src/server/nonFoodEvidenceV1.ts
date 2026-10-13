import { assertRawJsonWithoutDuplicateKeysV1, canonicalJsonV1, adaptiveNutritionSha256HexV1 } from '../utils/adaptiveNutritionWireV1';
import { assertFoodEvidenceDecimalV1, decodeRetainedFoodSourceSnapshotRawV1,
  type RetainedFoodSourceSnapshotV1, type FoodApplicabilityV1 } from '../utils/foodReviewedEvidenceV1';

export const nonFoodContractV1 = 'potok-nonfood-review-request-v1' as const;
export const nonFoodMaxBytesV1 = 1_048_576;
export type HeadV1 = { revisionId: string; digest: string } | null;
export interface DefinitionProposalV1 {
  kind: 'DEFINITION'; definitionId: string | null; stableKey: string; displayName: string;
  applicability: FoodApplicabilityV1; exclusions: string[];
}
export interface NutritionProposalV1 {
  kind: 'NUTRITION'; definitionId: string; definitionRevisionId: string; definitionRevisionDigest: string;
  applicability: FoodApplicabilityV1; basis: 'PER_100_G_EDIBLE';
  units: Record<'calories' | 'protein' | 'fat' | 'carbs' | 'fiber', 'kcal' | 'g'>;
  sourceValues: Record<'calories' | 'protein' | 'fat' | 'carbs' | 'fiber', string>;
  nutrition: NutritionProposalV1['sourceValues'];
  carbohydrateSemantics: 'TOTAL_INCLUDING_FIBER' | 'AVAILABLE_EXCLUDING_FIBER'; mappingPolicyVersion: string;
}
export type NonFoodProposalV1 = DefinitionProposalV1 | NutritionProposalV1;
export interface TargetV1 { kind: 'DEFINITION' | 'NUTRITION'; definitionId: string; revisionId: string; digest: string }
export type NonFoodRequestV1 = { contract: typeof nonFoodContractV1; idempotencyReference: string } & (
  { kind: 'REVIEW_APPROVED' | 'REVIEW_REJECTED'; proposal: NonFoodProposalV1; expectedHead: HeadV1;
    retainedSource: RetainedFoodSourceSnapshotV1; reason: string | null } |
  { kind: 'INVALIDATION'; target: TargetV1; severity: 'CORRECTION' | 'SAFETY_CRITICAL'; reason: string;
    retainedSource: RetainedFoodSourceSnapshotV1 }
);
const fields = ['calories', 'protein', 'fat', 'carbs', 'fiber'] as const;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
export const canonicalNonFoodV1 = (v: unknown) => canonicalJsonV1(v, 'SAFE_INTEGER');
function fail(): never { throw new Error('NONFOOD_INVALID_WIRE'); }
function row(v: unknown, keys: string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) fail();
  const r = v as Record<string, unknown>;
  if (Object.keys(r).length !== keys.length || keys.some(k => !Object.prototype.hasOwnProperty.call(r, k))) fail(); return r;
}
function text(v: unknown): string {
  if (typeof v !== 'string' || !v.trim() || v.includes('\u0000')) fail();
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) { const n = v.charCodeAt(++i); if (!(n >= 0xdc00 && n <= 0xdfff)) fail(); }
    else if (c >= 0xdc00 && c <= 0xdfff) fail();
  } return v;
}
function match(v: unknown, p: RegExp): string { const s = text(v); if (!p.test(s)) fail(); return s; }
function app(v: unknown): FoodApplicabilityV1 {
  const a = row(v, ['kind', 'foodState']);
  if (a.kind !== 'EXACT_FOOD_STATE' || !['raw','dry','cooked','frozen','as-sold'].includes(String(a.foodState))) fail();
  return { kind: 'EXACT_FOOD_STATE', foodState: a.foodState as FoodApplicabilityV1['foodState'] };
}
function head(v: unknown): HeadV1 { if (v === null) return null;
  const h = row(v, ['revisionId','digest']); return { revisionId: match(h.revisionId, uuid), digest: match(h.digest, hash) }; }
function proposal(v: unknown): NonFoodProposalV1 {
  if (!v || typeof v !== 'object') fail();
  if ((v as { kind?: unknown }).kind === 'DEFINITION') {
    const r = row(v, ['kind','definitionId','stableKey','displayName','applicability','exclusions']);
    if (!Array.isArray(r.exclusions)) fail(); const exclusions = r.exclusions.map(v => match(v, /^[a-z0-9][a-z0-9_-]{0,127}$/));
    if (new Set(exclusions).size !== exclusions.length || canonicalNonFoodV1([...exclusions].sort()) !== canonicalNonFoodV1(exclusions)) fail();
    return { kind: 'DEFINITION', definitionId: r.definitionId === null ? null : match(r.definitionId, uuid),
      stableKey: match(r.stableKey, /^[a-z0-9][a-z0-9_-]{0,127}$/), displayName: text(r.displayName), applicability: app(r.applicability), exclusions };
  }
  const r = row(v, ['kind','definitionId','definitionRevisionId','definitionRevisionDigest','applicability','basis','units',
    'sourceValues','nutrition','carbohydrateSemantics','mappingPolicyVersion']);
  if (r.kind !== 'NUTRITION' || r.basis !== 'PER_100_G_EDIBLE') fail();
  const units = row(r.units, [...fields]), source = row(r.sourceValues, [...fields]), n = row(r.nutrition, [...fields]);
  for (const f of fields) {
    if (units[f] !== (f === 'calories' ? 'kcal' : 'g')) fail();
    assertFoodEvidenceDecimalV1(source[f]); assertFoodEvidenceDecimalV1(n[f]);
  }
  if (!['TOTAL_INCLUDING_FIBER','AVAILABLE_EXCLUDING_FIBER'].includes(String(r.carbohydrateSemantics))) fail();
  const policy = r.carbohydrateSemantics === 'TOTAL_INCLUDING_FIBER'
    ? 'potok-source-total-including-fiber-to-available-v1' : 'potok-source-available-direct-v1';
  if (r.mappingPolicyVersion !== policy) fail();
  const minor = (v: unknown) => BigInt(String(v).replace('.', ''));
  const carbs = minor(source.carbs) - (r.carbohydrateSemantics === 'TOTAL_INCLUDING_FIBER' ? minor(source.fiber) : 0n);
  if (carbs < 0n || minor(n.carbs) !== carbs || fields.filter(f => f !== 'carbs').some(f => source[f] !== n[f])) fail();
  // v1 is deliberately non-nutritive only: no positive food macro bypass.
  if (fields.some(f => minor(n[f]) !== 0n)) fail();
  return { kind: 'NUTRITION', definitionId: match(r.definitionId, uuid), definitionRevisionId: match(r.definitionRevisionId, uuid),
    definitionRevisionDigest: match(r.definitionRevisionDigest, hash), applicability: app(r.applicability), basis: 'PER_100_G_EDIBLE',
    units: units as NutritionProposalV1['units'], sourceValues: source as NutritionProposalV1['sourceValues'],
    nutrition: n as NutritionProposalV1['nutrition'], carbohydrateSemantics: r.carbohydrateSemantics as NutritionProposalV1['carbohydrateSemantics'], mappingPolicyVersion: policy };
}
export async function nonFoodDigestV1(domain: string, payload: unknown): Promise<string> {
  return adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalNonFoodV1({ domain, payload })));
}
export async function decodeNonFoodRequestV1(raw: string | Uint8Array): Promise<NonFoodRequestV1> {
  if (!(typeof raw === 'string' || raw instanceof Uint8Array)) fail();
  const bytes = typeof raw === 'string' ? new TextEncoder().encode(text(raw)) : raw;
  if (bytes.length > nonFoodMaxBytesV1) fail();
  const input = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  assertRawJsonWithoutDuplicateKeysV1(input); const parsed: unknown = JSON.parse(input);
  if (!parsed || typeof parsed !== 'object') fail(); const kind = (parsed as { kind?: unknown }).kind;
  const keys = kind === 'INVALIDATION' ? ['target','severity','reason'] : ['proposal','expectedHead','reason'];
  const r = row(parsed, ['contract','kind','idempotencyReference','retainedSource',...keys]);
  if (r.contract !== nonFoodContractV1) fail();
  const source = await decodeRetainedFoodSourceSnapshotRawV1(JSON.stringify(r.retainedSource));
  // Delegated string validation also prevents SQL jsonb NUL/surrogate drift.
  JSON.stringify(source, (_k, v: unknown) => { if (typeof v === 'string') text(v); return v; });
  if (Object.is((r.retainedSource as { byteLength: number }).byteLength, -0)) fail();
  const common = { contract: nonFoodContractV1, idempotencyReference: match(r.idempotencyReference, uuid), retainedSource: source };
  if (kind === 'INVALIDATION') {
    const t = row(r.target, ['kind','definitionId','revisionId','digest']);
    if (!['DEFINITION','NUTRITION'].includes(String(t.kind)) || !['CORRECTION','SAFETY_CRITICAL'].includes(String(r.severity))) fail();
    return { ...common, kind, reason: text(r.reason), severity: r.severity as 'CORRECTION' | 'SAFETY_CRITICAL',
      target: { kind: t.kind as TargetV1['kind'], definitionId: match(t.definitionId, uuid), revisionId: match(t.revisionId, uuid), digest: match(t.digest, hash) } };
  }
  if (kind !== 'REVIEW_APPROVED' && kind !== 'REVIEW_REJECTED') fail();
  const p = proposal(r.proposal), h = head(r.expectedHead);
  const expected = p.kind === 'DEFINITION' ? ['identitySnapshot'] : [...fields];
  if (source.mappings.length !== expected.length || expected.some(f => !source.mappings.some(m => m.field === f))
    || source.mappings.some(m => canonicalNonFoodV1(m.applicability) !== canonicalNonFoodV1(p.applicability))) fail();
  if (kind === 'REVIEW_APPROVED' && r.reason !== null) fail();
  return { ...common, kind, proposal: p, expectedHead: h, reason: kind === 'REVIEW_REJECTED' ? text(r.reason) : null };
}
export async function nonFoodRequestDigestV1(raw: string): Promise<string> {
  return nonFoodDigestV1('potok-nonfood-request-sha256-v1', await decodeNonFoodRequestV1(raw));
}

export async function verifyNonFoodReceiptV1(raw: string, actor: string, value: unknown): Promise<void> {
  const request = await decodeNonFoodRequestV1(raw);
  const r = row(value, ['contract','actorId','idempotencyReference','requestDigest','rawRequestSha256','event','revision','definitionRevision','heads','replayed']);
  if (r.contract !== 'potok-nonfood-receipt-v1' || r.actorId !== actor || r.idempotencyReference !== request.idempotencyReference
    || typeof r.replayed !== 'boolean' || r.requestDigest !== await nonFoodRequestDigestV1(raw)
    || r.rawRequestSha256 !== await adaptiveNutritionSha256HexV1(new TextEncoder().encode(raw))) fail();
  const e = row(r.event, ['contract','eventId','actorId','authorityReference','occurredAt','kind','requestDigest','target','retainedSource','reason','severity','digest']);
  const { digest: ed, ...ep } = e;
  if (e.contract !== 'potok-nonfood-review-event-v1' || ed !== await nonFoodDigestV1('potok-nonfood-event-sha256-v1', ep) || e.actorId !== actor
    || e.kind !== request.kind || e.requestDigest !== r.requestDigest || e.retainedSource === null
    || canonicalNonFoodV1(e.retainedSource) !== canonicalNonFoodV1(request.retainedSource)) fail();
  match(e.eventId, uuid); const authority = text(e.authorityReference);
  if (!authority.startsWith('potok-control-admin-attestation-v2:')) fail();
  match(authority.slice('potok-control-admin-attestation-v2:'.length), uuid);
  const h = row(r.heads, ['definition','nutrition']); head(h.definition); head(h.nutrition);
  if (request.kind !== 'INVALIDATION' && e.severity !== null) fail();
  if (request.kind === 'REVIEW_APPROVED' && e.reason !== null) fail();
  const at = text(e.occurredAt); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(at) || new Date(at).toISOString() !== at) fail();
  if (request.kind === 'REVIEW_REJECTED') { if (r.revision !== null || e.reason !== request.reason || canonicalNonFoodV1(e.target) !== canonicalNonFoodV1({ kind: request.proposal.kind, proposal: request.proposal })) fail(); return; }
  const v = row(r.revision, ['contract','definitionId','revisionId','supersedesRevisionId','reviewEventId','proposal','retainedSource','digest']);
  const { digest: vd, ...vp } = v;
  if (vd !== await nonFoodDigestV1('potok-nonfood-revision-sha256-v1', vp)) fail();
  const p = proposal(v.proposal);
  if (v.contract !== (p.kind === 'DEFINITION' ? 'potok-nonfood-definition-revision-v1' : 'potok-nonfood-nutrition-revision-v1') || p.definitionId !== v.definitionId) fail();
  match(v.definitionId, uuid); match(v.revisionId, uuid); match(v.reviewEventId, uuid);
  if (v.supersedesRevisionId !== null) match(v.supersedesRevisionId, uuid);
  const target = row(e.target, ['kind','definitionId','revisionId','digest']);
  if (target.definitionId !== v.definitionId || target.revisionId !== v.revisionId || target.digest !== vd || target.kind !== p.kind) fail();
  if (request.kind === 'INVALIDATION') {
    if (canonicalNonFoodV1(target) !== canonicalNonFoodV1(request.target) || e.reason !== request.reason || e.severity !== request.severity) fail();
  } else {
    if (v.reviewEventId !== e.eventId || v.supersedesRevisionId !== (request.expectedHead?.revisionId ?? null)
      || canonicalNonFoodV1(v.retainedSource) !== canonicalNonFoodV1(request.retainedSource)) fail();
    const expected = { ...request.proposal };
    if (expected.kind === 'DEFINITION' && expected.definitionId === null) expected.definitionId = String(v.definitionId);
    if (canonicalNonFoodV1(expected) !== canonicalNonFoodV1(p)) fail();
  }
  if (request.kind === 'REVIEW_APPROVED' && canonicalNonFoodV1(h[p.kind === 'DEFINITION' ? 'definition' : 'nutrition'])
    !== canonicalNonFoodV1({ revisionId: v.revisionId, digest: vd })) fail();
  if (p.kind === 'NUTRITION') {
    const d = row(r.definitionRevision, ['contract','definitionId','revisionId','supersedesRevisionId','reviewEventId','proposal','retainedSource','digest']);
    const { digest: dd, ...dp } = d;
    if (dd !== await nonFoodDigestV1('potok-nonfood-revision-sha256-v1', dp) || d.definitionId !== p.definitionId
      || d.revisionId !== p.definitionRevisionId || dd !== p.definitionRevisionDigest
      || canonicalNonFoodV1((d.proposal as DefinitionProposalV1).applicability) !== canonicalNonFoodV1(p.applicability)) fail();
  } else if (r.definitionRevision !== null) fail();
}
