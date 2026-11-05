import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {pilotDigestV1} from './pilot-admission-readiness-v1';
type Obj=Record<string,unknown>;
const flags={sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,readyForServerSubmission:false} as const;
const axes=['calories','protein','fat','carbs','fiber'] as const;
function invalid():never{throw Error('INVALID_PILOT_DISCOVERY_REVIEW');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>5000)invalid();return v;}
function text(v:unknown):string{if(typeof v!=='string'||!v||v.length>500)invalid();return v;}
function strings(v:unknown):string[]{const a=list(v).map(text);if(new Set(a).size!==a.length)invalid();return a;}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function notPromoted(v:Obj){for(const k of Object.keys(flags))if(v[k]!==false)invalid();}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const numberText=(v:unknown)=>typeof v==='string'&&/^\d+(\.\d+)?$/.test(v);

/** Explicit discovery selections are reviewer work inputs, never canonical
 * resolution. Even one candidate with matching labels cannot create a binding. */
export function reviewPilotDiscoveryV1(exactRaw:string,snapshotRaw:string,planRaw:string){
 const exact=parse(exactRaw),snapshot=parse(snapshotRaw),plan=parse(planRaw);notPromoted(exact);
 if(exact.contract!=='potok-pilot-catalog-match-review-v1'||snapshot.contract!=='potok-shared-catalog-discovery-snapshot-v1'||plan.contract!=='potok-pilot-discovery-review-plan-v1')invalid();
 if(plan.exactReviewSha256!==pilotDigestV1(exactRaw)||plan.snapshotSha256!==pilotDigestV1(snapshotRaw))invalid();
 if(snapshot.readScope!=='SHARED_CORE_BRAND_ONLY_NO_USER_ROWS'||snapshot.readOnly!==true)invalid();
 const observation=obj(exact.observation);
 if(!['STAGING','PRODUCTION'].includes(String(snapshot.environment))||snapshot.environment!==observation.environment||snapshot.projectId!==observation.projectId||!Number.isFinite(Date.parse(text(snapshot.capturedAt))))invalid();
 const originals=list(exact.rows).map(obj),ids=originals.map(r=>text(r.rowId));
 if(new Set(ids).size!==ids.length)invalid();
 for(const r of originals){notPromoted(r);if(r.proposedCanonicalFoodId!==null||r.proposedStableFoodId!==null)invalid();}
 const targets=originals.filter(r=>r.identityStatus==='NO_EXACT_MATCH'),reviews=list(plan.rows).map(obj);
 if(reviews.length!==targets.length||new Set(reviews.map(r=>text(r.rowId))).size!==targets.length)invalid();
 const foods=list(snapshot.rows).map(obj);
 if(new Set(foods.map(f=>text(f.id))).size!==foods.length)invalid();
 for(const f of foods){
  if(!uuid.test(text(f.id))||!['core','brand'].includes(String(f.source))||f.created_by_user_id!=null)invalid();
  text(f.name);text(f.stable_food_id);
  for(const k of ['verified','suspicious','needs_review','is_searchable'])if(f[k]!==null&&typeof f[k]!=='boolean')invalid();
 }
 const rows=reviews.map(review=>{
  const original=targets.find(r=>r.rowId===review.rowId);if(!original)invalid();
  const remainingAttributes=strings(review.remainingAttributes),states=strings(review.expectedCatalogStateLabels);
  const selections=list(review.candidates).map(obj);
  if(new Set(selections.map(c=>text(c.stableId))).size!==selections.length)invalid();
  const candidates=selections.map(selection=>{
   const stableId=text(selection.stableId),reason=text(selection.reason);
   if(!['POTENTIAL','EXCLUDED_VARIANT'].includes(String(selection.disposition)))invalid();
   const matches=foods.filter(f=>f.stable_food_id===stableId);
   return {stableId,disposition:selection.disposition,reason,
    discoveryStatus:matches.length===0?'NOT_OBSERVED_IN_CAPTURE':matches.length>1?'MULTIPLE_CATALOG_ROWS':'ONE_OBSERVED_ROW_NOT_IDENTITY_APPROVAL',
    observations:matches.sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(f=>{
     const name=String(f.name).toLowerCase();
     const cookedName=/(варен|варён|отвар|на пару|на гриле|запеч|жарен|жарён|копчен|копчён|солен|солён)/.test(name);
     return {candidateFoodId:f.id,name:f.name,catalogState:f.cooking_state,
      stateLabelFinding:cookedName&&f.cooking_state==='raw'?'CATALOG_NAME_STATE_CONFLICT':!f.cooking_state||f.cooking_state==='unknown'?'STATE_LABEL_UNKNOWN':!states.length?'STATE_LABEL_NOT_ASSESSED':states.includes(String(f.cooking_state))?'EXPECTED_LABEL_OBSERVED_NOT_EQUIVALENCE':'STATE_LABEL_CONFLICT',
      canonicalRoot:f.canonical_food_id===f.id?'SELF_ROOT':'BROKEN_OR_REDIRECT',
      explicitFlags:f.needs_review===true||f.is_searchable===false?'UNAVAILABLE':f.needs_review===false&&f.is_searchable===true?'ALLOW_FLAGS_ONLY':'UNKNOWN',
      dataSource:f.data_source,sourceVersion:f.source_version,
      nutrition:Object.fromEntries(axes.map(a=>[a,f[a]])),missingOrInvalidNutrition:axes.filter(a=>!numberText(f[a])),
      evidenceAndStateEquivalence:'NOT_VERIFIED',...flags};
    })};
  });
  return {recipeId:original.recipeId,rowId:original.rowId,keys:original.keys,sourceRecord:original.sourceRecord,
   originalExactStatus:original.identityStatus,expectedCatalogStateLabels:states,remainingAttributes,candidates,
   proposedCanonicalFoodId:null,proposedStableFoodId:null,reviewStatus:'REQUIRES_INDEPENDENT_IDENTITY_AND_EVIDENCE_REVIEW',...flags};
 }).sort((a,b)=>String(a.rowId).localeCompare(String(b.rowId)));
 return {contract:'potok-pilot-catalog-discovery-review-v1',usage:'DISCOVERY_ONLY_NOT_EXACT_RESOLUTION_OR_AUTHORITY',
  inputBindings:{exactReviewSha256:pilotDigestV1(exactRaw),snapshotSha256:pilotDigestV1(snapshotRaw),planSha256:pilotDigestV1(planRaw),freezeSha256:exact.freezeSha256},
  observation:{environment:snapshot.environment,projectId:snapshot.projectId,capturedAt:snapshot.capturedAt,discoveryRows:foods.length},
  summary:{targetRows:rows.length,rowsWithPotentialObservations:rows.filter(r=>r.candidates.some(c=>c.disposition==='POTENTIAL'&&c.observations.length)).length,
   rowsWithoutPotentialObservations:rows.filter(r=>!r.candidates.some(c=>c.disposition==='POTENTIAL'&&c.observations.length)).length,
   admittedRecipes:0,appliedBindings:0},rows,ordinaryAccountAccessibility:'NOT_TESTED',
  captureScope:'EXPLICIT_NAME_FAMILY_QUERY_NOT_EXHAUSTIVE_CATALOG_ABSENCE',...flags};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==5)throw Error('Usage: ... EXACT_REVIEW.json DISCOVERY_SNAPSHOT.json REVIEW_PLAN.json');
 process.stdout.write(JSON.stringify(reviewPilotDiscoveryV1(...process.argv.slice(2).map(p=>readFileSync(p,'utf8')) as [string,string,string]),null,2)+'\n');
}
