import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolveExactFoodCandidates, type ResolverFood} from '../../src/services/canonicalFoodResolver';
import {normalizeFoodText} from '../../src/utils/foodNormalizer';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {pilotCanonicalV1, pilotDigestV1, readPilotFreezeRawV1, verifyPilotInputFreezeV1} from './pilot-admission-readiness-v1';
import type {ReviewInputModelV1} from './week-quality-preparation-v1';

// Offline observation only; never a publisher, runtime repository or authority.
type Obj=Record<string,unknown>;
const axes=['calories','protein','fat','carbs','fiber'] as const;
const flags={sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,readyForServerSubmission:false} as const;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid():never{throw Error('INVALID_PILOT_CATALOG_REVIEW');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function arr(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>5000)invalid();return v;}
function str(v:unknown):string{if(typeof v!=='string'||!v||v.length>500)invalid();return v;}
function count(v:unknown):number{if(!Number.isSafeInteger(v)||Number(v)<0)invalid();return Number(v);}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function decimal(v:unknown):string|null{
 if(typeof v!=='string'||!/^\d{1,6}(\.\d{1,12})?$/.test(v))return null;
 const [a,b='']=v.split('.');return BigInt(a).toString()+'.'+b.replace(/0+$/,'');
}
function validateFood(v:unknown):Obj{
 const f=obj(v);
 if(!uuid.test(str(f.id))||!['core','brand'].includes(String(f.source))||f.created_by_user_id!=null)invalid();
 str(f.name);str(f.normalized_name);
 for(const k of ['is_searchable','needs_review','verified','suspicious'])if(f[k]!==null&&typeof f[k]!=='boolean')invalid();
 if(f.aliases!==null&&(!Array.isArray(f.aliases)||f.aliases.some(a=>typeof a!=='string')))invalid();
 return f;
}
function sameFood(a:Obj,b:Obj){
 const omit=(f:Obj)=>Object.fromEntries(Object.entries(f).filter(([k])=>!['alias_id','normalized_alias','alias_verified'].includes(k)));
 return pilotCanonicalV1(omit(a))===pilotCanonicalV1(omit(b));
}
function readSnapshot(raw:string){
 const s=parse(raw);
 if(s.contract!=='potok-shared-catalog-lookup-snapshot-v1'||s.readOnly!==true||s.readScope!=='SHARED_CORE_BRAND_ONLY_NO_USER_ROWS')invalid();
 if(!['STAGING','PRODUCTION'].includes(String(s.environment))||typeof s.schemaHasReviewFlags!=='boolean'||!Number.isFinite(Date.parse(str(s.capturedAt))))invalid();
 str(s.projectId);count(s.sharedFoodCount);
 const all=new Map<string,Obj>();const queries=new Map<string,{key:string;names:Obj[];aliases:Obj[];unavailable:number}>();
 for(const v of arr(s.queries)){
  const q=obj(v),key=str(q.key);if(normalizeFoodText(key)!==key||queries.has(key))invalid();
  const names=arr(q.nameRows).map(validateFood),aliases=arr(q.aliasRows).map(validateFood);
  if(count(q.nameCount)!==names.length||count(q.aliasCount)!==aliases.length)invalid();
  if(new Set(names.map(f=>f.id)).size!==names.length||new Set(aliases.map(f=>f.alias_id)).size!==aliases.length)invalid();
  for(const f of names)if(f.normalized_name!==key)invalid();
  for(const f of aliases)if(f.normalized_alias!==key||!uuid.test(str(f.alias_id)))invalid();
  for(const f of [...names,...aliases]){const previous=all.get(String(f.id));if(previous&&!sameFood(previous,f))invalid();all.set(String(f.id),f);}
  queries.set(key,{key,names,aliases,unavailable:count(q.unavailableAliasCount)});
 }
 return {s,queries};
}
function resolverFood(f:Obj,key:string,isAlias:boolean):ResolverFood{
 return {...f,...Object.fromEntries(axes.map(a=>[a,f[a]===null?null:Number(f[a])])),
  aliases:[...(Array.isArray(f.aliases)?f.aliases:[]),...(isAlias?[key]:[])]} as unknown as ResolverFood;
}

export function reviewPilotCatalogMatchesV1(candidateRaw:string,models:ReviewInputModelV1[],freezeRaw:string,snapshotRaw:string){
 const freeze=verifyPilotInputFreezeV1(candidateRaw,models,freezeRaw),catalog=obj(parse(candidateRaw).originalAuthoringCatalog);
 const recipes=arr(catalog.recipes).map(obj),{s,queries}=readSnapshot(snapshotRaw);
 const rows=models.flatMap(model=>{
  const recipe=recipes.find(r=>r.recipeId===model.recipeId);if(!recipe)invalid();
  const originalRows=arr(recipe.ingredients).map(obj);
  return model.rows.map(({component})=>{
   const original=originalRows.find(r=>r.ingredient_row_id===component.rowId);if(!original)invalid();
   const keys=[...new Set([original.ingredient_name_ru,original.ingredient_name_en].filter((v):v is string=>typeof v==='string'&&!!v).map(normalizeFoodText))].sort();
   if(!keys.length)invalid();
   const lookups=keys.map(key=>queries.get(key));
   const complete=lookups.every(q=>q&&q.unavailable===0);
   const observations=lookups.flatMap(q=>q?[...q.names,...q.aliases]:[]);
   const candidates=[...new Map(observations.map(f=>[String(f.id),f])).values()].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
   const resolved=lookups.filter(q=>q!==undefined).map(q=>resolveExactFoodCandidates(q.key,[...q.names.map(f=>resolverFood(f,q.key,false)),...q.aliases.map(f=>resolverFood(f,q.key,true))]));
   const eligible=[...new Map(resolved.flatMap(r=>r.candidates).map(f=>[f.id,f])).values()];
   const identityStatus=!complete?'LOOKUP_INCOMPLETE':resolved.some(r=>'reason' in r&&r.reason==='unavailable')?'LOOKUP_UNAVAILABLE':eligible.length>1?'AMBIGUOUS':eligible.length===1?'EXACT_CANDIDATE':candidates.length?'NO_ELIGIBLE_EXACT_MATCH':'NO_EXACT_MATCH';
   const details=candidates.map(f=>({candidateFoodId:f.id,candidateStableFoodId:f.stable_food_id,source:f.source,name:f.name,brand:f.brand,
    canonicalPointer:f.canonical_food_id===f.id?'SELF_ROOT':'INVALID_OR_REDIRECT',
    availability:f.is_searchable===false||f.needs_review===true?'EXPLICITLY_UNAVAILABLE':s.schemaHasReviewFlags&&f.is_searchable===true&&f.needs_review===false?'EXPLICIT_FLAGS_ALLOW':'UNKNOWN_NOT_PROVEN',
    resolverEligible:eligible.some(e=>e.id===f.id),cookingState:f.cooking_state,stateEquivalence:'NOT_REVIEWED',
    nutrition:Object.fromEntries(axes.map(a=>[a,{catalog:f[a],input:component.vector?.[a]??null,
     comparison:decimal(f[a])===null?'MISSING_OR_INVALID':component.vector?.[a]==null?'INPUT_MISSING':decimal(f[a])===decimal(component.vector[a])?'EQUAL_VALUE_ONLY':'DIFFERENT_VALUE'}])),
    nutritionSemanticsAndAuthority:'NOT_VERIFIED',verified:f.verified,suspicious:f.suspicious}));
   return {recipeId:model.recipeId,rowId:component.rowId,componentKind:component.componentKind,keys,identityStatus,
    lookupScope:'EXACT_NORMALIZED_NAME_AND_SHARED_ALIAS_ONLY_NOT_FULL_CATALOG_ABSENCE',
    candidateObservations:details,proposedCanonicalFoodId:null,proposedStableFoodId:null,
    sourceRecord:component.sourceRecord,
    requiredReview:component.componentKind==='FOOD'?'IDENTITY_STATE_NUTRITION_ACCESSIBILITY_AND_EVIDENCE':'EXISTING_TYPED_NONFOOD_REVIEW_OR_REVIEWED_CANONICAL_PATH',...flags};
  });
 });
 return {contract:'potok-pilot-catalog-match-review-v1',usage:'OFFLINE_CANDIDATES_NOT_BINDINGS_OR_AUTHORITY',
  freezeSha256:pilotDigestV1(pilotCanonicalV1(freeze)),snapshotSha256:pilotDigestV1(snapshotRaw),
  observation:{environment:s.environment,projectId:s.projectId,capturedAt:s.capturedAt,sharedFoodCount:s.sharedFoodCount,schemaHasReviewFlags:s.schemaHasReviewFlags},
  summary:{recipes:models.length,componentRows:rows.length,foodRows:rows.filter(r=>r.componentKind==='FOOD').length,
   rowsWithCandidates:rows.filter(r=>r.candidateObservations.length).length,
   identityStatuses:Object.fromEntries(['EXACT_CANDIDATE','AMBIGUOUS','NO_ELIGIBLE_EXACT_MATCH','NO_EXACT_MATCH','LOOKUP_INCOMPLETE','LOOKUP_UNAVAILABLE'].map(status=>[status,rows.filter(r=>r.identityStatus===status).length])),
   admittedRecipes:0,appliedBindings:0},rows,accountRlsAccessibility:'NOT_TESTED_BY_PRIVILEGED_SHARED_CATALOG_READ',
  currentness:'CAPTURED_OBSERVATION_ONLY_REQUIRES_RECHECK_BEFORE_ANY_USE',...flags};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==5)throw Error('Usage: ... CANDIDATE.json MODEL_PACKET.json SHARED_SNAPSHOT.json');
 const packet=parse(readFileSync(process.argv[3],'utf8'));
 process.stdout.write(JSON.stringify(reviewPilotCatalogMatchesV1(readFileSync(process.argv[2],'utf8'),arr(packet.expandedInputModels) as ReviewInputModelV1[],readPilotFreezeRawV1(),readFileSync(process.argv[4],'utf8')),null,2)+'\n');
}
