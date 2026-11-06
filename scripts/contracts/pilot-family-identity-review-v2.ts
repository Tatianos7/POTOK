/** Bounded discovery and negative variant screening, never identity resolution or a catalog writer. */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { assertRawJsonWithoutDuplicateKeysV1 } from '../../src/utils/adaptiveNutritionWireV1';
import { pilotDigestV1 } from './pilot-admission-readiness-v1';
import { preparePilotExactSourceReviewBatchV2 } from './pilot-exact-source-review-batch-v2';
import { runNonfishLentilAlternativesV1 } from './nonfish-lentil-alternatives-v1';
import type { ReviewInputModelV1 } from './week-quality-preparation-v1';
type Rule = { family:RegExp; exclude?:RegExp; require?:RegExp; attributes:string[]; states:string[] };
const fresh = ['raw','fresh'], dry = ['dry','dried','raw'];
const rules: Record<string,Rule> = {};
function add(keys: string[],family:RegExp,attributes:string[],states=fresh,exclude?:RegExp,require?:RegExp) {
  for (const key of keys) rules[key]={ family,attributes,states,exclude,require };
}
add(['SR28:09003'],/^(яблок|apples?\b)/,['WITH_SKIN_EDIBLE_PART'],fresh,/суш|dried|сок|juice/);
add(['SR28:09040'],/^(банан|bananas?\b)/,['RAW_EDIBLE_PART'],fresh,/суш|dried/);
add(['SR28:09252'],/^(груш|pears?\b)/,['RAW_EDIBLE_PART'],fresh,/суш|dried/);
add(['SR28:11124'],/^(морков|carrot)/,['RAW_EDIBLE_PART']);
add(['SR28:11282'],/^(лук|onion)/,['BULB_ONION_EDIBLE_PART'],fresh,/порей|зел[её]н|leek|spring/);
add(['SR28:11260'],/^(шампин|mushroom)/,['WHITE_MUSHROOM_RAW_EDIBLE_PART']);
add(['SR28:11477'],/^(кабач|zucchini)/,['WITH_SKIN_EDIBLE_PART']);
add(['SR28:11529'],/^(помидор|томат|tomato)/,['RED_RIPE_RAW'],fresh,/паст|paste|сок|juice|пюре/);
add(['SR28:12155'],/^(грецк|орех.*грец|walnut)/,['ENGLISH_WALNUT_EDIBLE_PART'],['raw','fresh','dried'],/сол[её]н|salted|roast|жарен|жарён/);
add(['SR28:02010'],/^(кориц|cinnamon)/,['GROUND_SPICE'],['unknown','dry','dried']);
add(['SR28:04053'],/^(масло.*олив|оливков.*масло|olive oil)/,['PLAIN_OLIVE_OIL_NOT_INFUSED'],['unknown','as-sold'],/чеснок|garlic|аромат|infus/);
add(['SR28:18079'],/^(сухар|bread.?crumb)/,['PLAIN_NO_ADDITIVES'],['unknown','dry','dried'],/ванил|изюм|сдоб|слад|sweet/);
add(['SR28:05062'],/^(курин.*груд|груд.*кур|филе.*кур|chicken.*breast)/,['SKINLESS_BONELESS_MEAT_ONLY'],fresh,/кожей|with skin/);
add(['SR28:20009'],/^(греч|buckwheat)/,['ROASTED_DRY_NOT_GREEN'],dry,/зел[её]н|green/);
add(['SR28:20012'],/^(булгур|bulgur)/,['DRY_GRAIN_SIZE_NOT_PROVEN'],dry);
add(['SR28:01174'],/^(молоко(?:\s|$)|milk\b)/,['TWO_PERCENT_NONFORTIFIED_PROFILE_NOT_UNIVERSAL_RETAIL_EQUIVALENCE'],['unknown','as-sold'],/сух|powder|сгущ|condens|соев|орех|soy|nut/,/(?:^|[^0-9.,])2(?:[.,]0+)?\s*%/);
add(['SR28:01287'],/^(йогурт|yogurt)/,['PLAIN_UNSWEETENED_GREEK_PROFILE_NOT_UNIVERSAL_TWO_PERCENT_EQUIVALENCE'],['unknown','as-sold'],/слад|sweet|фрукт|fruit/,/гречес|greek/);
add(['SR28:20124'],/^(макарон|паста(?:\s|$)|pasta\b)/,['WHOLE_COMMON_WHEAT_NOT_SPELT'],dry,/полб|spelt/,/цельнозер|whole.?wheat/);
add(['FDC_SR_LEGACY:168927:PER_100_G_EDIBLE'],/^(макарон|паста(?:\s|$)|pasta\b)/,['DRY_UNENRICHED_COMMON_WHEAT'],dry,/полб|spelt|цельнозер|whole.?wheat/);
add(['FDC_SR_LEGACY:168411:PREPARED:100G'],/^(эдамаме|edamame|соя|соев|soy)/,['SHELLED_FROZEN_PREPARED_NOT_MATURE_SOY'],['frozen','cooked','as-sold'],undefined,/эдамаме|edamame/);
add(['FDC_SR_LEGACY:172420:DRY_RAW:100G'],/^(чечевиц|lentil)/,['WHOLE_BROWN_RECIPE_INTENT_SOURCE_COLOUR_CULTIVAR_NOT_REPORTED'],dry,/красн|зел[её]н|red|green|ростк|sprout|мука|flour/,/коричн|brown/);
add(['FDC_SR_LEGACY:167747:RAW_JUICE:100G'],/^(лимон|lemon)/,['RAW_JUICE_NOT_WHOLE_FRUIT'],fresh,undefined,/сок|juice/);
add(['FDC_SR_LEGACY:168448:RAW:100G'],/^(тыкв|pumpkin)/,['RAW_EDIBLE_PART']);
add(['FDC_SR_LEGACY:169986:RAW:100G'],/^(капуст.*цветн|цветн.*капуст|cauliflower)/,['RAW_EDIBLE_PART']);
add(['FDC_SR_LEGACY:169961:RAW:100G'],/^(фасол|beans?\b)/,['GREEN_SNAP_PODS_NOT_DRY_BEANS'],fresh,/зерн|dry|сух/,/стручк|зел[её]н|green|snap/);
add(['FDC_SR_LEGACY:169703:BROWN_RAW:100G'],/^(рис|rice\b)/,['BROWN_LONG_GRAIN_RAW'],dry,/бел|white/,/бур|коричн|brown/);
add(['FDC_SR_LEGACY:169756:RAW_UNENRICHED:100G'],/^(рис|rice\b)/,['WHITE_LONG_GRAIN_UNENRICHED'],dry,/бур|коричн|brown/);
add(['FDC_SR_LEGACY:175154:RAW:100G'],/^(форел|trout)/,['WILD_RAINBOW_ORIGIN_NOT_PROVEN_BY_GENERIC_LABEL'],fresh,/ферм|выращ|farmed/);
add(['FDC_SR_LEGACY:175167:FARMED_ATLANTIC_RAW:100G'],/^(лосос|с[её]мг|salmon)/,['FARMED_ATLANTIC_ORIGIN_NOT_PROVEN_BY_GENERIC_LABEL'],fresh,/дик|wild|тихоокеан|pacific/);
add(['FDC_SR_LEGACY:173709:WATER_DRAINED:100G'],/^(тунец|tuna)/,['LIGHT_CANNED_IN_WATER_DRAINED_OWN_JUICE_EQUIVALENCE_UNPROVEN'],['as-sold','canned'],/масл|oil/);
add(['FDC_FOUNDATION:2346393:2048:1079:RAW:100G'],/^(миндал|almond)/,['WHOLE_RAW_UNSALTED'],fresh,/сол[её]н|salted|roast|жарен|жарён|мука|flour/);
add(['FDC_FOUNDATION:2346396:2048:2033:100G','FDC_FOUNDATION:2346396:2048:2033:PER_100_G_FOOD'],/^(овсян|ов[её]с|oats?\b)/,['WHOLE_GRAIN_ROLLED_OLD_FASHIONED_NOT_INSTANT'],dry,/быстр|instant|мука|flour/);
const cooked = /варен|варён|отвар|на пару|на гриле|запеч|жарен|жарён|копчен|копчён|boiled|steamed|grilled|baked|fried|smoked|каша|porridge|суп|soup|салат|salad/;
type Food = { id:string;canonical_food_id:string|null;stable_food_id:string;source:string;created_by_user_id:null;name:string;
  cooking_state:string|null;is_searchable:boolean|null;needs_review:boolean|null;[key:string]:unknown };
function fail(): never { throw Error('PILOT_FAMILY_REVIEW_INVALID'); }
function snapshot(raw: string) {
  if (Buffer.byteLength(raw)>4_000_000) fail(); assertRawJsonWithoutDuplicateKeysV1(raw);
  const s = JSON.parse(raw) as { contract:string;environment:string;projectId:string;readOnly:boolean;scope:string;capturedAt:string;
    matchingRows:number;limit:number;completeWithinQuery:boolean;rows:Food[] };
  if (!s || s.contract!=='potok-shared-catalog-family-observation-v1' || s.environment!=='STAGING' || s.projectId!=='ozidryfvhkcbtpnulakq'
    || s.readOnly!==true || s.scope!=='EXPLICIT_FAMILIES_SHARED_CORE_BRAND_ONLY' || !Number.isFinite(Date.parse(s.capturedAt))
    || !Number.isSafeInteger(s.matchingRows) || !Number.isSafeInteger(s.limit) || s.limit<1 || s.limit>700
    || s.completeWithinQuery!==true || !Array.isArray(s.rows) || s.rows.length!==s.matchingRows || s.rows.length>s.limit
    || new Set(s.rows.map(f=>f.id)).size!==s.rows.length) fail();
  for (const f of s.rows) {
    if (!f || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(f.id)
      || !['core','brand'].includes(f.source) || f.created_by_user_id!==null || typeof f.name!=='string' || !f.name.trim()
      || typeof f.stable_food_id!=='string' || !f.stable_food_id
      || ![null,true,false].includes(f.is_searchable) || ![null,true,false].includes(f.needs_review)
      || (f.aliases!=null && (!Array.isArray(f.aliases)||f.aliases.some(a=>typeof a!=='string')))
      || (f.cooking_state!==null && typeof f.cooking_state!=='string')) fail();
  }
  return s;
}
/** Can be used for explicit reviewer screening. A positive name-family hit always remains unselected. */
export function screenPilotFamilyCandidateV2(sourceRecord:string,food:Pick<Food,'name'|'cooking_state'> & { aliases?:unknown }) {
  const rule = rules[sourceRecord]; if (!rule) fail();
  const name = food.name.toLowerCase().trim();
  const matchedVia = rule.family.test(name)?'NAME':Array.isArray(food.aliases)&&food.aliases.some(a=>typeof a==='string'&&rule.family.test(a.toLowerCase().trim()))?'UNVERIFIED_CATALOG_ALIAS':null;
  if (!matchedVia) return null;
  const nominalFat = /([0-9]+(?:[.,][0-9]+)?)\s*%/.exec(name)?.[1];
  const wrongFat = ['SR28:01174','SR28:01287'].includes(sourceRecord)&&nominalFat!==undefined&&!/^0*2(?:[.,]0+)?$/.test(nominalFat);
  const disposition = wrongFat||rule.exclude?.test(name)||cooked.test(name)?'EXCLUDED_VARIANT':rule.require&&!rule.require.test(name)?'INSUFFICIENT_VARIANT_LABEL':'CANDIDATE_FOR_REVIEW';
  const stateFinding = cooked.test(name)&&food.cooking_state==='raw'?'NAME_STATE_CONFLICT'
    :!food.cooking_state||food.cooking_state==='unknown'?'STATE_UNKNOWN'
    :rule.states.includes(food.cooking_state)?'LABEL_ONLY_NOT_EQUIVALENCE':'STATE_LABEL_CONFLICT';
  return { disposition,matchedVia,stateFinding,remainingAttributes:[...rule.attributes],selected:false as const,sourceApplicabilityApproved:false as const };
}
export async function preparePilotFamilyIdentityReviewV2(candidateRaw:string,models:ReviewInputModelV1[],exactSnapshotRaw:string,familyRaw:string,freezeRaw?:string) {
  const s = snapshot(familyRaw), batch = await preparePilotExactSourceReviewBatchV2(candidateRaw,models,exactSnapshotRaw,freezeRaw);
  if (batch.observation.projectId!==s.projectId || batch.observation.environment!==s.environment) fail();
  const groups = batch.items.map(item=>{
    if (item.componentKind!=='FOOD') return { sourceRecord:item.sourceRecord,componentKind:item.componentKind,occurrences:item.occurrences.length,
      route:'EXISTING_TYPED_NONFOOD_REVIEW',candidates:[],selectedCanonicalFoodId:null };
    const candidates = s.rows.flatMap(food=>{
      const finding = screenPilotFamilyCandidateV2(item.sourceRecord,food); if (!finding) return [];
      return [{ ...finding,foodId:food.id,stableFoodId:food.stable_food_id,name:food.name,catalogState:food.cooking_state,
        canonicalRoot:food.canonical_food_id===food.id?'SELF_ROOT':'BROKEN_OR_REDIRECT',
        availability:food.is_searchable===true&&food.needs_review===false?'ALLOW_FLAGS_ONLY':food.is_searchable===false||food.needs_review===true?'UNAVAILABLE':'UNKNOWN',
        legacyNutrition:Object.fromEntries(['calories','protein','fat','carbs','fiber'].map(k=>[k,food[k]??null])),
        proposedPatch:null,reviewEvent:null }];
    }).sort((a,b)=>a.foodId<b.foodId?-1:a.foodId>b.foodId?1:0);
    return { sourceRecord:item.sourceRecord,componentKind:item.componentKind,occurrences:item.occurrences.length,
      route:candidates.some(c=>c.disposition==='CANDIDATE_FOR_REVIEW')?'EXPLICIT_EXISTING_IDENTITY_REVIEW':'INDEPENDENT_IMPORT_PRECHECK_BEFORE_ANY_NEW_DEFINITION',
      candidates,selectedCanonicalFoodId:null };
  });
  const foods = groups.filter(g=>g.componentKind==='FOOD');
  return { contract:'potok-pilot-family-identity-review-v2',usage:'PRIVATE_REVIEW_QUEUE_NOT_CATALOG_PATCH_OR_AUTHORITY',
    inputBindings:{ ...batch.inputBindings,familySnapshotSha256:pilotDigestV1(familyRaw) },
    observation:{ projectId:s.projectId,capturedAt:s.capturedAt,rows:s.rows.length,scope:s.scope },
    summary:{ recipes:batch.summary.recipes,foodRows:batch.summary.foodRows,
      foodRowsWithFamilyCandidates:foods.filter(g=>g.candidates.some(c=>c.disposition==='CANDIDATE_FOR_REVIEW')).reduce((n,g)=>n+g.occurrences,0),
      foodRowsWithoutFamilyCandidates:foods.filter(g=>!g.candidates.some(c=>c.disposition==='CANDIDATE_FOR_REVIEW')).reduce((n,g)=>n+g.occurrences,0),
      sourceGroupsRequiringPrecheck:foods.filter(g=>g.route==='INDEPENDENT_IMPORT_PRECHECK_BEFORE_ANY_NEW_DEFINITION').map(g=>g.sourceRecord),
      approvedBindings:0,catalogWrites:0,sourceApprovals:0 },groups,
    proposedFoodUpdates:[],proposedFoodCreates:[],sourceApprovalRequests:[],
    canApply:false,sourceApproved:false,readyForServerSubmission:false,mayActivate:false,
    currentness:'FRESH_RECHECK_REQUIRED_AT_REVIEW_AND_APPLY',absenceClaim:'NONE_BOUNDED_FAMILY_QUERY_ONLY' };
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if (process.argv.length!==6) throw Error('Usage: ... CANDIDATE.json SCENARIO.json EXACT_SNAPSHOT.json FAMILY_SNAPSHOT.json');
  const candidate = readFileSync(process.argv[2],'utf8'),models = runNonfishLentilAlternativesV1(candidate,readFileSync(process.argv[3],'utf8')).expandedInputModels;
  process.stdout.write(JSON.stringify(await preparePilotFamilyIdentityReviewV2(candidate,models,readFileSync(process.argv[4],'utf8'),readFileSync(process.argv[5],'utf8')),null,2)+'\n');
}
