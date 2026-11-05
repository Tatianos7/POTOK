import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {normalizeFoodEvidenceSourceDecimalV1} from '../../src/utils/foodReviewedEvidenceV1';
import {pilotDigestV1,pilotCanonicalV1,readPilotFreezeRawV1,verifyPilotInputFreezeV1} from './pilot-admission-readiness-v1';
import type {ReviewInputModelV1} from './week-quality-preparation-v1';
import {reviewPilotDiscoveryV1} from './pilot-catalog-discovery-review-v1';
import {validatePilotBatchSourcesV1,readPilotBatchEvidenceV1} from './pilot-source-quantity-batch-v1';
import {mapFoundationOatsSourceV1,readFoundationReviewEvidenceV1} from './foundation-variants-review-v1';
import {inspectOwnerGrainTunaSourcesV1,readOwnerGrainTunaEvidenceV1} from './owner-grain-tuna-choices-v1';
import {mapExpansionPrimarySourcesV1,readSourceExpansionEvidenceV1} from './source-gaps-expansion-v1';
import {mapBreakfastMainSourcesV1,readBreakfastMainEvidenceV1} from './breakfast-main-capacity-v1';
import {mapGrainMainSourcesV1,readGrainMainEvidenceV1} from './grain-main-week-v1';
import {mapDryLentilSourceV1,readLentilReviewEvidenceV1} from './nonfish-lentil-alternatives-v1';

type Obj=Record<string,unknown>;
const axes=['calories','protein','fat','carbs','fiber'] as const;
type Vector=Record<typeof axes[number],string>;
const root='docs/premium/retained-sources/';
const flags={sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,readyForServerSubmission:false} as const;
function invalid():never{throw Error('INVALID_PILOT_SOURCE_BINDING_PROPOSAL');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>5000)invalid();return v;}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
const read=(p:string)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
function pin(raw:string,materials:Record<string,string>){
 const p=parse(raw);for(const k of ['sourceApproved','runtimePublishable','canApply','mayActivate'])if(p[k]!==false)invalid();
 const ms=list(p.materials).map(obj);if(!ms.length||new Set(ms.map(m=>m.path)).size!==ms.length)invalid();
 for(const m of ms)if(typeof m.path!=='string'||typeof materials[m.path]!=='string'||pilotDigestV1(materials[m.path])!==m.sha256)invalid();
}
/** These are the existing mappers and retained primary records, not an issuer or
 * another nutrition engine. A complete source vector is not a food binding. */
export function readPilotBindingSourceDossiersV1(){
 const batch=readPilotBatchEvidenceV1(),foundation=readFoundationReviewEvidenceV1(),owner=readOwnerGrainTunaEvidenceV1(),
  expansion=readSourceExpansionEvidenceV1(),breakfast=readBreakfastMainEvidenceV1(),grain=readGrainMainEvidenceV1(),lentil=readLentilReviewEvidenceV1();
 for(const [raw,materials] of [[batch.reviewRaw,batch.materials],[foundation.policyRaw,foundation.materials],[owner.ownerRaw,owner.materials],
  [expansion.bindingsRaw,expansion.materials],[breakfast.bindingsRaw,breakfast.materials],[grain.reviewRaw,grain.materials],[lentil.reviewRaw,lentil.materials]] as const)pin(raw,materials);
 const base=validatePilotBatchSourcesV1(batch).sources,oats=mapFoundationOatsSourceV1(foundation),choices=inspectOwnerGrainTunaSourcesV1(owner),
  extra=mapExpansionPrimarySourcesV1(expansion),mains=mapBreakfastMainSourcesV1(breakfast),grains=mapGrainMainSourcesV1(grain),lentils=mapDryLentilSourceV1(lentil);
 const srPaths=[root+'pilot-19-source-quantity-20261105/sr28-primary-subset-v1.json',root+'pilot-source-stage-20261104/sr28-ascii-capture-v1.json'];
 const sources=new Map<string,{sourceRecord:string;description:string;retainedPath:string;retainedSha256:string;vector:Vector;basis:string}>();
 for(const [key,vector] of base){if(!key.startsWith('SR28:'))continue;const code=key.slice(5),path=srPaths.find(p=>list(parse(read(p)).records).map(obj).some(r=>r.ndb===code));if(!path)invalid();
  const record=list(parse(read(path)).records).map(obj).find(r=>r.ndb===code)!;
  sources.set(key,{sourceRecord:key,description:String(record.description),retainedPath:path,retainedSha256:pilotDigestV1(read(path)),vector,basis:'PER_100_G_EDIBLE'});
 }
 const add=(key:string,folder:string,id:number,vector:Vector)=>{const path=root+folder+`/fdc-${id}-selected-fields-v1.json`,capture=parse(read(path));
  sources.set(key,{sourceRecord:key,description:String(capture.description),retainedPath:path,retainedSha256:pilotDigestV1(read(path)),vector,basis:id===2346396?'PER_100_G_FOOD':'PER_100_G_EDIBLE'});};
 for(const suffix of ['100G','PER_100_G_FOOD'])add('FDC_FOUNDATION:2346396:2048:2033:'+suffix,'pilot-19-source-quantity-20261105',2346396,oats.vector);
 if(!choices.pasta.vector)invalid();add('FDC_SR_LEGACY:168927:PER_100_G_EDIBLE','foundation-variants-20261105',168927,choices.pasta.vector);
 add('FDC_SR_LEGACY:173709:WATER_DRAINED:100G','owner-grain-tuna-20261105',173709,extra.tuna);
 add('FDC_FOUNDATION:2346393:2048:1079:RAW:100G','source-gaps-expansion-20261105',2346393,extra.almond);
 add('FDC_SR_LEGACY:168411:PREPARED:100G','source-gaps-expansion-20261105',168411,extra.edamame);
 add('FDC_SR_LEGACY:167747:RAW_JUICE:100G','source-gaps-expansion-20261105',167747,extra.lemon);
 for(const [id,key] of [[169986,'cauliflower'],[168448,'pumpkin'],[175154,'trout'],[169961,'beans']] as const)add(`FDC_SR_LEGACY:${id}:RAW:100G`,'breakfast-main-capacity-20261105',id,mains[key]);
 add('FDC_SR_LEGACY:169756:RAW_UNENRICHED:100G','grain-main-week-20261105',169756,grains.whiteRice);
 add('FDC_SR_LEGACY:169703:BROWN_RAW:100G','grain-main-week-20261105',169703,grains.brownRice);
 add('FDC_SR_LEGACY:175167:FARMED_ATLANTIC_RAW:100G','grain-main-week-20261105',175167,grains.salmon);
 add('FDC_SR_LEGACY:172420:DRY_RAW:100G','nonfish-lentil-20261105',172420,lentils);
 return sources;
}
export function preparePilotSourceBindingProposalsV1(candidateRaw:string,models:ReviewInputModelV1[],exactRaw:string,snapshotRaw:string,planRaw:string,freezeRaw=readPilotFreezeRawV1()){
 const freeze=verifyPilotInputFreezeV1(candidateRaw,models,freezeRaw);
 const discovery=reviewPilotDiscoveryV1(exactRaw,snapshotRaw,planRaw),exact=parse(exactRaw),sources=readPilotBindingSourceDossiersV1();
 if(exact.freezeSha256!==pilotDigestV1(pilotCanonicalV1(freeze)))invalid();
 const frozenRows=models.flatMap(m=>m.rows.map(r=>({recipeId:m.recipeId,component:r.component})));
 if(list(exact.rows).length!==frozenRows.length)invalid();
 const decimalKey=(v:string)=>v.includes('.')?v.replace(/0+$/,'').replace(/\.$/,''):v;
 const rows=list(exact.rows).map(obj).map(original=>{
  const key=String(original.sourceRecord),source=sources.get(key);if(!source)invalid();
  const frozen=frozenRows.find(r=>r.component.rowId===original.rowId);
  if(!frozen||original.recipeId!==frozen.recipeId||original.componentKind!==frozen.component.componentKind||key!==frozen.component.sourceRecord
   ||!frozen.component.vector||axes.some(a=>decimalKey(source.vector[a])!==decimalKey(frozen.component.vector![a])))invalid();
  const additional=discovery.rows.find(r=>r.rowId===original.rowId);
  const candidates=[...list(original.candidateObservations).map(obj).map(c=>({candidateFoodId:c.candidateFoodId,observedStableFoodId:c.candidateStableFoodId,name:c.name,
   origin:'EXACT_NAME_OR_ALIAS_OBSERVATION',legacyNutrition:Object.fromEntries(axes.map(a=>[a,obj(obj(c.nutrition)[a]).catalog])),state:c.cookingState})),
   ...(additional?.candidates.filter(c=>c.disposition==='POTENTIAL').flatMap(c=>c.observations.map(o=>({candidateFoodId:o.candidateFoodId,observedStableFoodId:c.stableId,name:o.name,
    origin:'DISCOVERY_OBSERVATION_NOT_RESOLUTION',legacyNutrition:o.nutrition,state:o.catalogState})))??[])];
  const unique=[...new Map(candidates.map(c=>[String(c.candidateFoodId),c])).values()];
  const decimals=Object.fromEntries(axes.map(a=>{try{return [a,{status:'EXACT_THREE_PLACE_REPRESENTATION',value:normalizeFoodEvidenceSourceDecimalV1(source.vector[a])}];}catch{return [a,{status:'BLOCKED_PRECISION_LOSS_NO_ROUNDING',value:null}];}}));
  const blockers=axes.filter(a=>decimals[a].value===null),food=original.componentKind==='FOOD';
  const specific:string[]=[];
  if(key.includes('175154'))specific.push('SOURCE_IS_WILD_RAINBOW_NOT_FARMED');
  if(key.includes('175167'))specific.push('SOURCE_IS_FARMED_ATLANTIC_NOT_GENERIC_SALMON');
  if(key.includes('173709'))specific.push('WATER_PACKED_LIGHT_TUNA_DRAINED_SALTED_OWN_JUICE_EQUIVALENCE_NOT_ESTABLISHED');
  if(key.includes('172420'))specific.push('SOURCE_COLOUR_AND_CULTIVAR_NOT_REPORTED_BROWN_EQUIVALENCE_NOT_APPROVED');
  if(key==='SR28:20009')specific.push('ROASTED_DRY_GROATS_NOT_GREEN');
  if(key==='SR28:20124')specific.push('WHOLE_WHEAT_DRY_NOT_SPELT_OR_GENERIC_PASTA');
  if(['SR28:01174','SR28:01287'].includes(key))specific.push('EXACT_SOURCE_PROFILE_NOT_UNIVERSAL_NOMINAL_TWO_PERCENT_RETAIL_EQUIVALENCE');
  if(key.includes('2346396'))specific.push('ATWATER_SPECIFIC_ENERGY_AND_AOAC_2011_25_FIBER_RETAINED');
  return {recipeId:original.recipeId,rowId:original.rowId,componentKind:original.componentKind,source,
   sourceDecimalMapping:decimals,precisionBlockedAxes:blockers,sourceSpecificApplicability:specific,
   catalogCandidates:unique,remainingIdentityAttributes:additional?.remainingAttributes??['EXACT_SOURCE_IDENTITY_STATE_EDIBLE_PART_APPLICABILITY'],
   excludedDiscoveryVariants:additional?.candidates.filter(c=>c.disposition==='EXCLUDED_VARIANT')??[],
   proposedReviewRoute:!food?'EXISTING_TYPED_NONFOOD_REVIEW_PATH':blockers.length?'PRECISION_DECISION_REQUIRED_BEFORE_EVIDENCE':unique.length?'REVIEW_EXISTING_IDENTITY_BEFORE_SOURCE_BACKED_REVISION':'CATALOG_IDENTITY_PRECHECK_BEFORE_SOURCE_CLASS_DEFINITION',
   prohibitedAction:'NO_LEGACY_VECTOR_OVERWRITE_NO_ALIAS_CREATION_NO_AUTO_BINDING',
   proposedCanonicalFoodId:null,proposedStableFoodId:null,reviewEvent:null,authorityContext:null,...flags};
 });
 return {contract:'potok-pilot-source-binding-proposals-v1',usage:'REVIEW_DRAFT_NOT_FOOD_EVIDENCE_OR_WRITE_REQUEST',
  inputBindings:{exactSha256:pilotDigestV1(exactRaw),discoveryBindings:discovery.inputBindings},
  sourceMaterials:[...new Map(rows.map(r=>[r.source.retainedPath,{path:r.source.retainedPath,sha256:r.source.retainedSha256}])).values()],
  summary:{recipes:new Set(rows.map(r=>r.recipeId)).size,rows:rows.length,foodRows:rows.filter(r=>r.componentKind==='FOOD').length,
   distinctSourceBindings:new Set(rows.map(r=>r.source.sourceRecord)).size,precisionBlockedFoodRows:rows.filter(r=>r.componentKind==='FOOD'&&r.precisionBlockedAxes.length).length,
   reviewRoutes:Object.fromEntries([...new Set(rows.map(r=>r.proposedReviewRoute))].sort().map(k=>[k,rows.filter(r=>r.proposedReviewRoute===k).length])),
   sourceApprovals:0,admittedRecipes:0,appliedBindings:0},rows,
  recipeQuantitiesAndTotals:'NOT_MODIFIED_OR_RECALCULATED',ordinaryAccountAccess:'NOT_VERIFIED',...flags};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==7)throw Error('Usage: ... ORIGINAL_CANDIDATE.json MODEL_PACKET.json EXACT_REVIEW.json DISCOVERY_SNAPSHOT.json DISCOVERY_PLAN.json');
 const inputs=process.argv.slice(2).map(p=>readFileSync(p,'utf8'));
 process.stdout.write(JSON.stringify(preparePilotSourceBindingProposalsV1(inputs[0],list(parse(inputs[1]).expandedInputModels) as ReviewInputModelV1[],inputs[2],inputs[3],inputs[4]),null,2)+'\n');
}
