import test from 'node:test';
import assert from 'node:assert/strict';
import { screenPilotFamilyCandidateV2 as screen,preparePilotFamilyIdentityReviewV2 as prepare } from './pilot-family-identity-review-v2';
import { readPilotBindingSourceDossiersV1 } from './pilot-source-binding-proposals-v1';
import { calculatePreciseInputV3 } from './foundation-variants-review-v1';
import { buildPilotInputFreezeV1,readAdmissionContractSourcesV1 } from './pilot-admission-readiness-v1';
import type { ReviewInputModelV1 } from './week-quality-preparation-v1';
const food = (name:string,cooking_state:string|null='raw') => ({ name,cooking_state });
test('generic candidate names never establish source identity or wild/farmed origin', () => {
  const r = screen('FDC_SR_LEGACY:175154:RAW:100G',food('Форель радужная'))!;
  assert.equal(r.disposition,'CANDIDATE_FOR_REVIEW'); assert.equal(r.selected,false); assert.equal(r.sourceApplicabilityApproved,false);
  assert.ok(r.remainingAttributes.includes('WILD_RAINBOW_ORIGIN_NOT_PROVEN_BY_GENERIC_LABEL'));
});
test('explicit incompatible species/medium/grain/colour/cooked variants stay excluded', () => {
  for (const [key,name] of [['FDC_SR_LEGACY:175154:RAW:100G','Форель выращенная'],['FDC_SR_LEGACY:173709:WATER_DRAINED:100G','Тунец в масле'],
    ['SR28:20124','Макароны из полбы цельнозерновые'],['FDC_SR_LEGACY:172420:DRY_RAW:100G','Чечевица красная'],['SR28:20009','Гречка зеленая'],
    ['SR28:05062','Куриная грудка на пару']]) assert.equal(screen(key,food(name))!.disposition,'EXCLUDED_VARIANT');
});
test('2 percent milk is not matched by 3.2/1.2 percent or a generic label', () => {
  for (const name of ['Молоко 3.2%','Молоко 1,2%','Молоко 0%']) assert.equal(screen('SR28:01174',food(name))!.disposition,'EXCLUDED_VARIANT');
  assert.equal(screen('SR28:01174',food('Молоко'))!.disposition,'INSUFFICIENT_VARIANT_LABEL');
  assert.equal(screen('SR28:01174',food('Молоко 2.0%'))!.disposition,'CANDIDATE_FOR_REVIEW');
});
test('desserts and mature-soy labels cannot become yogurt/edamame matches', () => {
  assert.equal(screen('SR28:01287',food('Торт йогуртовый')),null);
  assert.equal(screen('FDC_SR_LEGACY:168411:PREPARED:100G',food('Соя'))!.disposition,'INSUFFICIENT_VARIANT_LABEL');
});
test('a raw alias cannot hide a cooked canonical name or confer source approval', () => {
  const r = screen('SR28:05062',{ ...food('Грудка на пару','raw'),aliases:['Куриная грудка'] })!;
  assert.equal(r.matchedVia,'UNVERIFIED_CATALOG_ALIAS'); assert.equal(r.disposition,'EXCLUDED_VARIANT'); assert.equal(r.stateFinding,'NAME_STATE_CONFLICT');
});
function fixture() {
  const sourceRecord = 'SR28:09252',vector = readPilotBindingSourceDossiersV1().get(sourceRecord)!.vector;
  const rows = [{ component:{ rowId:'row',componentKind:'FOOD' as const,sourceRecord,vector,quantityG:'100',quantityDecision:'DECLARED_GRAMS',
    status:'DECLARED_SOURCE_INPUT_MODEL' as const,optional:false } }];
  const models:ReviewInputModelV1[] = [{ recipeId:'synthetic',sourceCategory:'SNACK',declaredServings:1,rows,
    calculation:calculatePreciseInputV3(rows.map(r=>r.component),1),sourceApproved:false,runtimePublishable:false }];
  const candidate = JSON.stringify({ originalAuthoringCatalog:{ recipes:[{ recipeId:'synthetic',declaredServings:1,sourceRecipe:{ meal_type_primary:'SNACK' },
    ingredients:[{ ingredient_row_id:'row',ingredient_name_ru:'груша',canonical_status:'UNRESOLVED' }] }] } });
  const exact = { contract:'potok-shared-catalog-lookup-snapshot-v1',environment:'STAGING',projectId:'ozidryfvhkcbtpnulakq',readOnly:true,
    readScope:'SHARED_CORE_BRAND_ONLY_NO_USER_ROWS',capturedAt:'2026-11-06T00:00:00Z',sharedFoodCount:0,schemaHasReviewFlags:true,
    queries:[{ key:'груша',nameRows:[],aliasRows:[],nameCount:0,aliasCount:0,unavailableAliasCount:0 }] };
  const family = { contract:'potok-shared-catalog-family-observation-v1',environment:'STAGING',projectId:exact.projectId,readOnly:true,
    scope:'EXPLICIT_FAMILIES_SHARED_CORE_BRAND_ONLY',capturedAt:exact.capturedAt,matchingRows:2,limit:700,completeWithinQuery:true,
    rows:[1,2].map(n=>({ id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,canonical_food_id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,
      stable_food_id:'pear',source:'core',created_by_user_id:null,name:'Груша свежая',cooking_state:'fresh',is_searchable:null,needs_review:null })) };
  return { candidate,models,exact,family,freeze:buildPilotInputFreezeV1(candidate,models,readAdmissionContractSourcesV1()) };
}
const run = (f=fixture()) => prepare(f.candidate,f.models,JSON.stringify(f.exact),JSON.stringify(f.family),JSON.stringify(f.freeze));
test('multiple real UUID observations remain multiple candidates with no selected ID, patch or approval', async () => {
  const r = await run(); assert.equal(r.groups[0].candidates.length,2); assert.equal(r.groups[0].selectedCanonicalFoodId,null);
  assert.equal(r.summary.foodRowsWithFamilyCandidates,1); assert.equal(r.summary.approvedBindings,0); assert.equal(r.canApply,false);
  assert.deepEqual(r.proposedFoodUpdates,[]); assert.deepEqual(r.proposedFoodCreates,[]);
});
test('truncated, cross-project, user-owned, malformed and duplicate snapshots fail closed', async () => {
  for (const mode of ['TRUNCATED','PROJECT','USER','DUPLICATE','COUNT','FLAGS']) {
    const f=fixture();
    if (mode==='TRUNCATED') f.family.completeWithinQuery=false;
    if (mode==='PROJECT') f.family.projectId='production';
    if (mode==='USER') Object.assign(f.family.rows[0],{ created_by_user_id:f.family.rows[0].id });
    if (mode==='DUPLICATE') f.family.rows[1].id=f.family.rows[0].id;
    if (mode==='COUNT') f.family.matchingRows=3;
    if (mode==='FLAGS') Object.assign(f.family.rows[0],{ is_searchable:'true' });
    await assert.rejects(run(f));
  }
});
