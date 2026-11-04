import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {buildAuthoringReferenceReviewDraftsV1} from './authoring-reference-review-drafts-v1';
import {readPinnedProposalSourcesV1, type ProposalSourcesRawV1} from './authoring-reference-proposals-v1';

const policyVersion='potok-source-total-including-fiber-to-available-v1';
const selectedCases={FROZEN_STRAWBERRY:'09318',WALNUT:'12155',BLUEBERRY:'09050'} as const;
const axes=['calories','protein','fat','totalCarbohydrate','fiber'] as const;
type Facts=Record<typeof axes[number],string>;
type Obj=Record<string,unknown>;
function invalid():never{throw Error('INVALID_THREE_FOOD_SOURCE_CANDIDATE');}
const hash=(raw:string)=>createHash('sha256').update(raw).digest('hex');
function object(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function array(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>1000)invalid();return v;}
function parse(raw:string):Obj{if(Buffer.byteLength(raw)>2_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return object(JSON.parse(raw));}
function exactKeys(v:Obj,keys:string[]){if(Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))invalid();}
function minor(v:unknown):bigint{
  if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,5})(\.[0-9]{1,3})?$/.test(v))invalid();
  const [n,f='']=v.split('.');return BigInt(n)*1000n+BigInt(f.padEnd(3,'0'));
}
function decimal3(n:bigint){return(n/1000n)+'.'+String(n%1000n).padStart(3,'0');}
function facts(v:unknown):Facts{const r=object(v);exactKeys(r,[...axes]);for(const a of axes)minor(r[a]);return r as Facts;}

/** Candidate arithmetic only. Identity/state/basis/units and inclusion semantics must be explicit. */
export function deriveAvailableCarbohydrateCandidateV1(raw:string){
  const r=parse(raw);exactKeys(r,['sourceTotalCarbohydrateG','sourceDietaryFiberG','sourceDefinition','carbohydrateBinding','fiberBinding','carbohydrateUnit','fiberUnit','basis']);
  if(r.sourceDefinition!=='TOTAL_CARBOHYDRATE_BY_DIFFERENCE_INCLUDING_FIBER'
    ||typeof r.carbohydrateBinding!=='string'||!r.carbohydrateBinding||r.carbohydrateBinding!==r.fiberBinding
    ||r.carbohydrateUnit!=='g'||r.fiberUnit!=='g'||r.basis!=='PER_100_G_EDIBLE')invalid();
  const result=minor(r.sourceTotalCarbohydrateG)-minor(r.sourceDietaryFiberG);if(result<0n)invalid();
  return {availableCarbohydrateG:decimal3(result),policyVersion,status:'CALCULATED_SOURCE_CANDIDATE_NOT_ADMITTED',sourceApproved:false,canApply:false};
}

export interface PrimaryRecheckRawV1 {manifestRaw:string;walnutApiRaw:string;blueberryApiRaw:string;summaryRaw:string;parentPolicyRaw:string}
export function readPrimaryRecheckRawV1():PrimaryRecheckRawV1{
  const base=new URL('../../docs/premium/retained-sources/three-food-primary-recheck-20261104/',import.meta.url);
  return {manifestRaw:readFileSync(new URL('source-recheck-v1.json',base),'utf8'),
    walnutApiRaw:readFileSync(new URL('fdc-170187-primary-response.json',base),'utf8'),
    blueberryApiRaw:readFileSync(new URL('fdc-171711-primary-response.json',base),'utf8'),
    summaryRaw:readFileSync(new URL('sr28-carbohydrate-recheck-summary.txt',base),'utf8'),
    parentPolicyRaw:readFileSync(new URL('../p5-03/source-review-package-v1.json',base),'utf8')};
}

/** The seam is for trusted offline tests/composition. Byte bindings never confer source authority. */
export function validateThreeFoodPrimaryRecheckV1(raw:PrimaryRecheckRawV1,captureRaw:string){
  const m=parse(raw.manifestRaw),capture=parse(captureRaw),archive=object(m.archiveRecheck),semantics=object(m.semanticsRecheck),parent=object(m.parentPolicy);
  const policy=object(parse(raw.parentPolicyRaw).carbsMappingPolicy);
  if(m.contract!=='potok-three-food-primary-recheck-v1'||m.status!=='PRIMARY_BYTES_RECHECKED_NOT_SOURCE_ADMISSION'
    ||m.sourceApproved!==false||m.runtimePublishable!==false||m.mayActivate!==false
    ||m.parentCaptureSha256!==hash(captureRaw)||archive.archiveSha256!==capture.archiveSha256||archive.patchApplied!==false
    ||parent.sha256!==hash(raw.parentPolicyRaw)||parent.version!==policyVersion||policy.version!==policyVersion
    ||policy.formula!=='sourceTotalCarbohydrateG - sourceDietaryFiberG'||policy.calories!=='PRESERVE_SOURCE_NO_4_9_4'
    ||semantics.retainedSummarySha256!==hash(raw.summaryRaw)||semantics.pdfPageOneBased!==20
    ||semantics.sourceDefinition!=='TOTAL_CARBOHYDRATE_BY_DIFFERENCE_INCLUDING_FIBER'
    ||semantics.units!=='g'||semantics.basis!=='PER_100_G_EDIBLE')invalid();
  const expectedHashes=object(capture.fileHashes),observedHashes=object(archive.fileHashes);
  for(const file of ['FOOD_DES.txt','NUT_DATA.txt','NUTR_DEF.txt'])if(observedHashes[file]!==expectedHashes[file])invalid();
  const records=new Map<string,{caseId:string;ndb:string;description:string;facts:Facts;apiCorroboration:number|null}>();
  for(const value of array(m.records)){
    const r=object(value),caseId=String(r.caseId);
    if(!Object.hasOwn(selectedCases,caseId)||records.has(caseId)||r.ndb!==selectedCases[caseId as keyof typeof selectedCases])invalid();
    const source=array(capture.records).map(object).find(c=>c.ndb===r.ndb);if(!source)invalid();
    if(r.captureRecordSha256!==hash(JSON.stringify(source))||r.description!==source.description
      ||JSON.stringify(r.factsPer100GEdible)!==JSON.stringify(source.factsPer100GEdible)
      ||r.lineRecheck!=='ALL_RETAINED_FOOD_AND_FIVE_NUTRIENT_LINES_MATCH_REDOWNLOADED_ARCHIVE')invalid();
    records.set(caseId,{caseId,ndb:String(r.ndb),description:String(r.description),facts:facts(r.factsPer100GEdible),apiCorroboration:null});
  }
  if(records.size!==3)invalid();
  const apiCaptures=array(m.independentApiCaptures);if(apiCaptures.length!==2)invalid();
  const seen=new Set<number>();
  for(const value of apiCaptures){
    const meta=object(value),id=meta.fdcId;
    if(typeof id!=='number'||![170187,171711].includes(id)||seen.has(id))invalid();seen.add(id);
    const bytes=id===170187?raw.walnutApiRaw:raw.blueberryApiRaw,api=parse(bytes);
    const row=records.get(id===170187?'WALNUT':'BLUEBERRY');if(!row)invalid();
    if(meta.sha256!==hash(bytes)||api.fdcId!==id||api.dataType!=='SR Legacy'||meta.dataType!==api.dataType
      ||meta.publicationDate!==api.publicationDate||String(api.ndbNumber).padStart(5,'0')!==row.ndb||meta.ndb!==row.ndb
      ||api.description!==row.description)invalid();
    const codes={calories:'208',protein:'203',fat:'204',totalCarbohydrate:'205',fiber:'291'};
    const nutrients=array(api.foodNutrients).map(object);
    for(const axis of axes){
      const ns=nutrients.filter(n=>object(n.nutrient).number===codes[axis]);if(ns.length!==1)invalid();
      const n=ns[0],definition=object(n.nutrient);
      if(definition.unitName!==(axis==='calories'?'kcal':'g')||typeof n.amount!=='number'||minor(String(n.amount))!==minor(row.facts[axis]))invalid();
    }
    row.apiCorroboration=id;
  }
  return {records,manifestSha256:hash(raw.manifestRaw),parentPolicySha256:hash(raw.parentPolicyRaw),semantics};
}

export function buildThreeFoodSourceCandidatesV1(inputRaw:string,sources:ProposalSourcesRawV1,primaryRaw:PrimaryRecheckRawV1){
  const prior=buildAuthoringReferenceReviewDraftsV1(inputRaw,sources),primary=validateThreeFoodPrimaryRecheckV1(primaryRaw,sources.captureRaw);
  const candidates=[...primary.records.values()].map(source=>{
    const matching=prior.recommendations.filter(r=>r.caseId===source.caseId);if(matching.length!==1)invalid();
    const row=matching[0];if(row.recommendedOptionId!=='COMPARE_SR28_'+source.ndb)invalid();
    const binding='HISTORICAL_SR28:'+source.ndb+':'+source.description+':PER_100_G_EDIBLE';
    const mapped=deriveAvailableCarbohydrateCandidateV1(JSON.stringify({sourceTotalCarbohydrateG:source.facts.totalCarbohydrate,
      sourceDietaryFiberG:source.facts.fiber,sourceDefinition:primary.semantics.sourceDefinition,
      carbohydrateBinding:binding,fiberBinding:binding,carbohydrateUnit:'g',fiberUnit:'g',basis:'PER_100_G_EDIBLE'}));
    const f=source.facts;
    return {caseId:source.caseId,ingredientRowId:row.ingredientRowId,recipeId:row.recipeId,
      sourceAuthoringRowSha256:row.sourceAuthoringRowSha256,sourceRecord:{ndb:source.ndb,description:source.description,
        dataset:'HISTORICAL_SR28_BASE_ARCHIVE_NO_PATCH',independentFdcCorroboration:source.apiCorroboration},
      sourceFactsPer100GEdible:f,
      completeMappedCandidatePer100GEdible:{calories:f.calories,protein:f.protein,fat:f.fat,carbs:mapped.availableCarbohydrateG,fiber:f.fiber},
      mapping:mapped,beforeReference:row.beforeReference,beforeReferenceStatus:'MANUAL_UNVERIFIED_TRANSCRIPTION',
      beforeAvailableCarbohydrateG:null,carbohydrateDelta:null,carbohydrateDeltaReason:'ORIGINAL_REFERENCE_SEMANTICS_NOT_ADMITTED',
      priorLiteralReferenceImpact:row.conditionalImpact,quantity:row.quantity,
      requiredEvidence:row.requiredEvidence,reviewGates:row.reviewGates,existingBlockStatus:row.existingBlockStatus,
      selectedOption:null,ownerDecision:null,sourceApproved:false,foodSpecificMappingApproved:false,canApply:false,runtimePublishable:false};
  });
  return {contract:'potok-three-food-complete-source-candidates-v1',status:'COMPLETE_SOURCE_VECTORS_PENDING_FOOD_SPECIFIC_REVIEW',
    provenance:{...prior.provenance,priorDraftSha256:hash(JSON.stringify(prior)),primaryRecheckSha256:primary.manifestSha256,
      parentPolicySha256:primary.parentPolicySha256,hashesAreNotAuthority:true},
    summary:{inspectedRows:prior.summary.rows,completeSourceCandidates:candidates.length,sourceApprovals:0,selectedChanges:0,appliedChanges:0},
    candidates,recipeImpacts:prior.recipeImpacts,
    canApply:false,sourceApproved:false,runtimePublishable:false,mayActivate:false,recipeTotalsRecomputed:false,originalDataModified:false,physicalCookingBlocksDevelopment:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==3)throw Error('Usage: node --import tsx scripts/contracts/three-food-source-candidates-v1.ts PRIVATE_INPUT.json');
  process.stdout.write(JSON.stringify(buildThreeFoodSourceCandidatesV1(readFileSync(process.argv[2],'utf8'),readPinnedProposalSourcesV1(),readPrimaryRecheckRawV1()),null,2)+'\n');
}
