/** Offline review preparation. Real source bytes/values, never inferred identity, approval or a write. */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readPilotBindingSourceDossiersV1 } from './pilot-source-binding-proposals-v1';
import { pilotDigestV1, pilotCanonicalV1, readPilotFreezeRawV1, verifyPilotInputFreezeV1 } from './pilot-admission-readiness-v1';
import { reviewPilotCatalogMatchesV1 } from './pilot-catalog-match-review-v1';
import { runNonfishLentilAlternativesV1 } from './nonfish-lentil-alternatives-v1';
import type { ReviewInputModelV1 } from './week-quality-preparation-v1';
import { captureExactNutritionInputV2, exactNutritionInputDigestV2, exactNutritionAxesV2 } from '../../src/utils/exactNutritionValuesV2';
import { normalizeFoodEvidenceSourceDecimalV1, decodeCanonicalFoodReviewedRevisionRawV1,
  decodeRetainedFoodSourceSnapshotRawV1 } from '../../src/utils/foodReviewedEvidenceV1';
import { captureFoodNutritionSourceBindingRawV2, retainedFoodSourceSnapshotDigestRawV2 } from '../../src/utils/foodNutritionSourceBindingV2';

const flags = Object.freeze({ sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,readyForServerSubmission:false });
const read = (path: string): string => readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const mappingPolicyRef = 'EXISTING_OFFLINE_SAME_SOURCE_CARBOHYDRATE_MAPPING_NOT_ISSUED_EVIDENCE';
function fail(): never { throw Error('PILOT_EXACT_SOURCE_REVIEW_MISMATCH'); }
function dossier(sourceRecord: string, sources = readPilotBindingSourceDossiersV1()) {
  const source = sources.get(sourceRecord); if (!source) fail();
  const retainedText = read(source.retainedPath);
  if (pilotDigestV1(retainedText)!==source.retainedSha256) fail();
  const capture = JSON.parse(retainedText) as Record<string,unknown>;
  if (typeof capture.sourceUrl!=='string' || typeof capture.retrievedDate!=='string') fail();
  return { source,retainedText,capture };
}
function numericInput(source: ReturnType<typeof dossier>['source']) {
  return captureExactNutritionInputV2({ sourceRecord:source.sourceRecord,declaredRetainedArtifactSha256:source.retainedSha256,
    basis:source.basis,units:{ calories:'kcal',protein:'g',fat:'g',carbs:'g',fiber:'g' },
    carbohydrateSemantics:'AVAILABLE_EXCLUDING_FIBER',mappingPolicyRef },source.vector);
}

/** Group all frozen ingredient occurrences by their existing source binding label.
 * Keep the two oat binding labels distinct; equality of values is not identity equivalence. */
export async function preparePilotExactSourceReviewBatchV2(candidateRaw: string, models: ReviewInputModelV1[], snapshotRaw: string,
  freezeRaw = readPilotFreezeRawV1()) {
  const ownedModels = structuredClone(models);
  const freeze = verifyPilotInputFreezeV1(candidateRaw,ownedModels,freezeRaw);
  const observation = reviewPilotCatalogMatchesV1(candidateRaw,ownedModels,freezeRaw,snapshotRaw);
  const sources = readPilotBindingSourceDossiersV1();
  const groups = new Map<string,{ kind:string; occurrences:{ recipeId:string;rowId:string;quantityG:string|null;quantityDecision:string;optional:boolean }[] }>();
  for (const model of ownedModels) for (const { component:c } of model.rows) {
    const source = sources.get(String(c.sourceRecord));
    if (!source || !c.vector) fail();
    const expectedKind = source.sourceRecord==='SR28:14411'?'POTABLE_WATER':source.sourceRecord==='SR28:02047'?'TABLE_SALT':'FOOD';
    if (c.componentKind!==expectedKind) fail();
    const expected = numericInput(source), provided = captureExactNutritionInputV2(expected.reference,c.vector);
    if (exactNutritionAxesV2.some(axis =>
      // Compare canonical reduced rationals, allowing trailing-zero spellings without changing source text.
      pilotCanonicalV1(provided.values[axis])!==pilotCanonicalV1(expected.values[axis]))) fail();
    const key = source.sourceRecord, group = groups.get(key) ?? { kind:c.componentKind,occurrences:[] };
    if (group.kind!==c.componentKind) fail();
    group.occurrences.push({ recipeId:model.recipeId,rowId:c.rowId,quantityG:c.quantityG,quantityDecision:c.quantityDecision,optional:c.optional }); groups.set(key,group);
  }
  const items = await Promise.all([...groups].sort(([a],[b])=>a<b?-1:a>b?1:0).map(async ([sourceRecord,group]) => {
    const { source,retainedText,capture } = dossier(sourceRecord,sources);
    const input = numericInput(source);
    const precisionBlockedAxes = exactNutritionAxesV2.filter(axis => { try { normalizeFoodEvidenceSourceDecimalV1(source.vector[axis]); return false; } catch { return true; } });
    const isFood = group.kind==='FOOD';
    if (!isFood && (!['POTABLE_WATER','TABLE_SALT'].includes(group.kind)
      || exactNutritionAxesV2.some(axis=>input.values[axis].numerator!=='0'))) fail();
    const occurrences = group.occurrences.map(o=>{
      const matched = observation.rows.find(r=>r.rowId===o.rowId && r.recipeId===o.recipeId); if (!matched) fail();
      return { ...o,catalogIdentityStatus:matched.identityStatus,catalogCandidates:matched.candidateObservations,
        identityReview:'REQUIRED_SOURCE_STATE_EDIBLE_PART_AND_CURRENT_ACCESS',canonicalRevision:null,
        route:isFood?'CANONICAL_REVIEW_THEN_EXACT_V2_SOURCE_REVIEW':'EXISTING_TYPED_NONFOOD_REVIEW',
        // Exact-name absence is never permission to create a duplicate canonical food.
        absenceScope:matched.lookupScope,...flags };
    });
    return { sourceRecord,componentKind:group.kind,sourceDescription:source.description,basis:source.basis,
      retainedMaterial:{ path:source.retainedPath,sha256:source.retainedSha256,bytes:Buffer.byteLength(retainedText),
        sourceUrl:capture.sourceUrl,retrievedDate:capture.retrievedDate,
        captureKind:capture.captureKind??capture.contract,
        sourceResponseSha256:capture.sourceResponseSha256??null,
        retainedCaptureIsNotFullRemoteResponse:capture.captureKind==='SELECTED_NUMERIC_FIELDS_AND_DEFINITIONS_NOT_FULL_RESPONSE' },
      numericInput:isFood?input:null,numericInputDigest:isFood?await exactNutritionInputDigestV2(input):null,
      typedNonfoodSourceVector:isFood?null:{ ...source.vector },
      v1PrecisionBlockedAxes:precisionBlockedAxes,
      numericRoute:isFood?'EXACT_V2_PREPARED_NOT_REVIEWED':'TYPED_NONFOOD_SOURCE_NOT_QUANTITY_CONVERSION',
      canonicalRevision:null,sourceBindingProposal:null,reviewEvent:null,authorityContext:null,occurrences,...flags };
  }));
  const recipes = ownedModels.map(m=>({ recipeId:m.recipeId,declaredServings:m.declaredServings,
    sourceBindings:items.filter(item=>item.occurrences.some(o=>o.recipeId===m.recipeId)).map(item=>item.sourceRecord),
    ingredientRows:m.rows.map(({ component:c })=>({ rowId:c.rowId,sourceRecord:c.sourceRecord,componentKind:c.componentKind,
      quantityG:c.quantityG,quantityDecision:c.quantityDecision,optional:c.optional })),
    runtimeEvidence:'NOT_ISSUED',measuredYieldG:null,measuredPortionG:null,
    physicalMeasurements:'DEFERRED_TO_OWNER_PRELAUNCH_TESTING',...flags }));
  return { contract:'potok-pilot-exact-source-review-batch-v2',usage:'PRIVATE_REVIEW_PREPARATION_NOT_ISSUER_REQUEST',
    inputBindings:{ candidateSha256:pilotDigestV1(candidateRaw),freezeSha256:pilotDigestV1(pilotCanonicalV1(freeze)),snapshotSha256:pilotDigestV1(snapshotRaw) },
    observation:observation.observation,
    summary:{ recipes:recipes.length,ingredientRows:items.reduce((n,i)=>n+i.occurrences.length,0),sourceBindings:items.length,
      retainedMaterials:new Set(items.map(i=>i.retainedMaterial.path)).size,
      foodRows:items.filter(i=>i.componentKind==='FOOD').reduce((n,i)=>n+i.occurrences.length,0),
      typedNonfoodRows:items.filter(i=>i.componentKind!=='FOOD').reduce((n,i)=>n+i.occurrences.length,0),
      foodRowsPreviouslyBlockedByV1Precision:items.filter(i=>i.componentKind==='FOOD'&&i.v1PrecisionBlockedAxes.length).reduce((n,i)=>n+i.occurrences.length,0),
      sourceApprovals:0,issuedCanonicalRevisions:0,issuedNutritionRevisions:0,admittedRecipes:0,appliedBindings:0 },
    items,recipes,sourceStateEquivalence:'REQUIRES_EXPLICIT_REVIEW_NOT_INFERRED_FROM_CATALOG_LABEL',
    catalogCurrentness:'CAPTURED_OBSERVATION_RECHECK_REQUIRED_AT_ISSUANCE',ordinaryAccountAccess:'NOT_VERIFIED',
    recipeQuantitiesAndTotals:'NOT_MODIFIED_OR_RECALCULATED',...flags };
}

/** Concrete mapper-to-issuer handoff AFTER a canonical identity has independently been reviewed.
 * This function validates representation and independently selected pins, NOT reviewer authority/currentness.
 * The server must still register the dossier and issue an explicit admin decision.
 * capturedAt records ingestion of the retained capture, not an invented original API acquisition time. */
export async function preparePinnedPilotSourceBindingForReviewV2(selection: {
  sourceRecord:string;canonicalRaw:string;expectedCanonicalDigest:string;expectedNumericInputDigest:string;
  expectedRetainedSha256:string;expectedFoodState:'raw'|'dry'|'frozen'|'cooked'|'as-sold';sourceArtifactId:string;capturedAt:string;
}) {
  const owned = { ...selection }, { source,retainedText,capture } = dossier(owned.sourceRecord);
  if (['SR28:14411','SR28:02047'].includes(source.sourceRecord)) fail();
  const canonical = await decodeCanonicalFoodReviewedRevisionRawV1(owned.canonicalRaw), input = numericInput(source);
  if (canonical.digest!==owned.expectedCanonicalDigest || canonical.foodState!==owned.expectedFoodState || source.retainedSha256!==owned.expectedRetainedSha256
    || await exactNutritionInputDigestV2(input)!==owned.expectedNumericInputDigest) fail();
  const retainedSource = await decodeRetainedFoodSourceSnapshotRawV1(JSON.stringify({ sourceArtifactId:owned.sourceArtifactId,
    providerIdentity:'USDA_RETAINED_CAPTURE_NOT_NEW_PRIMARY_FETCH',documentIdentity:source.retainedPath,
    sourceRevision:typeof capture.version==='string'?capture.version:typeof capture.publicationDate==='string'?capture.publicationDate:null,
    locator:capture.sourceUrl,capturedAt:owned.capturedAt,mediaType:'application/json; charset=utf-8',
    byteLength:Buffer.byteLength(retainedText),sourceBytesSha256:source.retainedSha256,text:retainedText,
    mappings:exactNutritionAxesV2.map(field=>({ field,sourceField:source.sourceRecord+' | '+field+' | '+mappingPolicyRef,applicability:canonical.applicability })) }));
  const pins = { canonicalRevisionDigest:owned.expectedCanonicalDigest,numericInputDigest:owned.expectedNumericInputDigest,
    retainedSnapshotDigest:await retainedFoodSourceSnapshotDigestRawV2(JSON.stringify(retainedSource)) };
  const proposal = await captureFoodNutritionSourceBindingRawV2(owned.canonicalRaw,JSON.stringify(retainedSource),JSON.stringify(input),JSON.stringify(pins));
  return { proposal,pins,identityApplicability:'EXPLICIT_REVIEW_STILL_REQUIRED',...flags };
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if (process.argv.length!==5) throw Error('Usage: ... ORIGINAL_CANDIDATE.json ORIGINAL_SCENARIO.json STAGING_LOOKUP_SNAPSHOT.json');
  const candidate = readFileSync(process.argv[2],'utf8'), scenario = readFileSync(process.argv[3],'utf8');
  const models = runNonfishLentilAlternativesV1(candidate,scenario).expandedInputModels;
  process.stdout.write(JSON.stringify(await preparePilotExactSourceReviewBatchV2(candidate,models,readFileSync(process.argv[4],'utf8')),null,2)+'\n');
}
