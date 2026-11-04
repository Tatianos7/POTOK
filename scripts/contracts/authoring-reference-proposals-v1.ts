import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';

type Row=Record<string,unknown>;
const axes=['calories','protein','fat','totalCarbohydrate','fiber'] as const;
type Vector=Record<typeof axes[number],string|null>;
interface Case {caseId:string;rowIds:string[];sourceRecordIds:string[];requiredEvidence:string;status:string}
interface Inventory {ingredientRowId:string;recipeId:string;sourceAuthoringRowSha256:string;reviewOrigin:string}
export interface ProposalSourcesRawV1 {ledgerRaw:string;auditRaw:string;captureRaw:string}
function fail():never{throw Error('INVALID_AUTHORING_REFERENCE_PROPOSAL_INPUT');}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function obj(v:unknown):Row{if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)fail();return v as Row;}
function keys(v:Row,k:string[]){if(Object.keys(v).length!==k.length||k.some(x=>!Object.hasOwn(v,x)))fail();}
function parse(raw:string):Row{if(typeof raw!=='string'||Buffer.byteLength(raw)>10_000_000)fail();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function text(v:unknown):string{if(typeof v!=='string'||!v.trim()||v.length>1000)fail();return v as string;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>512)fail();return v as unknown[];}
function canonical(v:unknown):string{
  if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
  if(typeof v==='number'){if(!Number.isFinite(v))fail();return JSON.stringify(v);}
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  const r=obj(v);return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';
}
function minor(v:unknown):bigint{
  if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,5})(\.[0-9]{1,3})?$/.test(v))fail();
  const [n,f='']=(v as string).split('.');return BigInt(n)*1000n+BigInt(f.padEnd(3,'0'));
}
function vector(v:unknown):Vector{const r=obj(v);keys(r,[...axes]);for(const a of axes)if(r[a]!==null)minor(r[a]);return r as Vector;}
function signed8(n:bigint){const a=n<0n?-n:n;return(n<0n?'-':'')+(a/100000000n)+'.'+String(a%100000000n).padStart(8,'0');}
function impact(unit:string,grams:unknown,before:Vector,after:Vector,excluded:boolean){
  const blocked=(status:string)=>({status,delta:null,scope:'UNVERIFIED_RAW_REFERENCE_COMPARISON_ONLY' as const});
  if(excluded)return blocked('EXCLUDED_SOURCE_STATE');
  if(unit==='ML')return blocked('BLOCKED_UNREVIEWED_VOLUME_TO_MASS');
  if(unit!=='G')return blocked('BLOCKED_DISCRETE_OR_OTHER_MASS_BASIS');
  if(typeof grams!=='number'||!Number.isFinite(grams)||grams<=0)return blocked('BLOCKED_RECORDED_GRAMS_MISSING');
  const mass=minor(String(grams));
  if(axes.some(a=>before[a]===null||after[a]===null))return blocked('BLOCKED_REFERENCE_NUTRIENT_MISSING');
  return {status:'CONDITIONAL_LITERAL_REFERENCE_DIFFERENCE',scope:'UNVERIFIED_RAW_REFERENCE_COMPARISON_ONLY' as const,
    delta:Object.fromEntries(['calories','protein','fat','fiber'].map(a=>[a,signed8((minor(after[a as keyof Vector])-minor(before[a as keyof Vector]))*mass)])),
    carbohydrateDelta:null,carbohydrateReason:'REFERENCE_CARBOHYDRATE_SEMANTICS_NOT_ADMITTED',
    gramBasis:'RECORDED_AUTHORING_GRAMS_NOT_MEASURED_COOKED_YIELD'};
}

/** Offline proposal only. No apply/approval API, app import, database, secret or network capability. */
export function buildAuthoringReferenceProposalsV1(inputRaw:string,sources:ProposalSourcesRawV1){
  const input=parse(inputRaw),ledger=parse(sources.ledgerRaw),audit=parse(sources.auditRaw),capture=parse(sources.captureRaw);
  keys(input,['contract','privatePilotPacketSha256','ledgerSha256','auditSha256','captureSha256','rows']);
  if(input.contract!=='potok-authoring-reference-proposal-input-v1'
    ||ledger.contract!=='potok-pilot-120-row-stage-review-v1'||audit.contract!=='potok-pilot-remaining-42-review-v1'
    ||capture.contract!=='potok-sr28-ascii-source-capture-v1'||[ledger,audit,capture].some(r=>r.runtimePublishable!==false||r.mayActivate!==false)
    ||input.ledgerSha256!==hash(sources.ledgerRaw)||input.auditSha256!==hash(sources.auditRaw)||input.captureSha256!==hash(sources.captureRaw)
    ||audit.asciiCaptureSha256!==hash(sources.captureRaw)||input.privatePilotPacketSha256!==ledger.privatePilotPacketSha256
    ||input.privatePilotPacketSha256!==audit.privatePilotPacketSha256)fail();
  const inventory=new Map<string,Inventory>();
  for(const v of list(ledger.rows)){const r=obj(v),id=text(r.ingredientRowId);if(inventory.has(id))fail();
    inventory.set(id,{ingredientRowId:id,recipeId:text(r.recipeId),sourceAuthoringRowSha256:text(r.sourceAuthoringRowSha256),reviewOrigin:text(r.reviewOrigin)});}
  const cases=new Map<string,Case>();
  for(const v of list(audit.cases)){const r=obj(v),c:Case={caseId:text(r.caseId),rowIds:list(r.rowIds).map(text),sourceRecordIds:list(r.sourceRecordIds).map(text),requiredEvidence:text(r.requiredEvidence),status:text(r.status)};
    if(new Set(c.sourceRecordIds).size!==c.sourceRecordIds.length)fail();
    for(const id of c.rowIds){if(cases.has(id)||inventory.get(id)?.reviewOrigin!=='THIS_STAGE_REVIEW')fail();cases.set(id,c);}}
  const stageIds=[...inventory.values()].filter(r=>r.reviewOrigin==='THIS_STAGE_REVIEW').map(r=>r.ingredientRowId);
  if(inventory.size!==obj(ledger.counts).rows||cases.size!==audit.reviewedRows||cases.size===0
    ||stageIds.length!==cases.size||stageIds.some(id=>!cases.has(id)))fail();
  const records=new Map<string,{ndb:string;description:string;facts:Vector}>();
  for(const v of list(capture.records)){const r=obj(v),id=text(r.ndb);if(records.has(id)||!/^\d{5}$/.test(id))fail();
    records.set(id,{ndb:id,description:text(r.description),facts:vector(r.factsPer100GEdible)});}
  const seen=new Set<string>();
  const proposals=list(input.rows).map(v=>{
    const r=obj(v);keys(r,['rawAuthoringRow','reference','referenceStatus']);
    if(r.referenceStatus!=='MANUAL_UNVERIFIED_TRANSCRIPTION')fail();
    const raw=obj(r.rawAuthoringRow),id=text(raw.ingredient_row_id),entry=inventory.get(id),c=cases.get(id);
    if(!entry||!c||seen.has(id)||entry.recipeId!==raw.recipe_id||hash(canonical(raw))!==entry.sourceAuthoringRowSha256)fail();
    seen.add(id);const before=vector(r.reference),unit=text(raw.unit);
    const options=c.sourceRecordIds.map(ndb=>{
      const source=records.get(ndb);if(!source)fail();
      const excluded=(c.caseId==='FROZEN_STRAWBERRY'&&ndb==='09316')||(c.caseId==='FROZEN_CURRANT'&&ndb==='09083')||(c.caseId==='POLLOCK'&&ndb==='15266');
      return {optionId:'COMPARE_SR28_'+ndb,sourceRecord:ndb,sourceDescription:source.description,
        status:excluded?'EXCLUDED_FOR_RECORDED_STATE':'CONDITIONAL_SOURCE_VARIANT_COMPARISON',afterReference:structuredClone(source.facts),
        sourceClassReviewRequired:true,canApply:false,impact:impact(unit,raw.weight_g,before,source.facts,excluded)};
    });
    return {ingredientRowId:id,recipeId:entry.recipeId,caseId:c.caseId,sourceAuthoringRowSha256:entry.sourceAuthoringRowSha256,
      beforeReference:structuredClone(before),beforeReferenceStatus:'MANUAL_UNVERIFIED_TRANSCRIPTION',recordedUnit:unit,
      recordedGramsReference:raw.weight_g??null,selectedOption:null,
      retainOption:{optionId:'RETAIN_REFERENCE_PENDING_ORIGINAL_SOURCE',canApply:false,admissionUnchanged:true},
      options,requiredEvidence:c.requiredEvidence,existingBlockStatus:c.status,
      decisionNeeded:options.length?'REVIEW_SOURCE_VARIANT_OR_RETAIN_ORIGINAL':'ORIGINAL_SOURCE_CLASS_OR_FORMULATION_REQUIRED',
      runtimePublishable:false,canApply:false};
  });
  if(seen.size!==cases.size||[...cases.keys()].some(id=>!seen.has(id)))fail();
  proposals.sort((a,b)=>a.ingredientRowId<b.ingredientRowId?-1:1);
  const recipeIds=[...new Set(proposals.map(p=>p.recipeId))].sort();
  return {contract:'potok-authoring-reference-change-proposals-v1',status:'PENDING_REVIEW_NO_SELECTION_OR_APPLY',
    provenance:{privatePilotPacketSha256:input.privatePilotPacketSha256,ledgerSha256:input.ledgerSha256,auditSha256:input.auditSha256,captureSha256:input.captureSha256,inputBytesSha256:hash(inputRaw),hashesDoNotProveAuthority:true},
    summary:{rows:proposals.length,recipesAffected:recipeIds.length,sourceComparisons:proposals.reduce((n,p)=>n+p.options.length,0),selectedChanges:0},
    proposals,recipeImpacts:recipeIds.map(recipeId=>({recipeId,ingredientRowIds:proposals.filter(p=>p.recipeId===recipeId).map(p=>p.ingredientRowId),
      status:'NO_VERIFIED_RECIPE_TOTAL_OR_WEEK_TARGET_CHANGE_COMPUTED',referenceRecipeTotalsRetained:true})),
    canApply:false,runtimePublishable:false,mayActivate:false,recipeTotalsRecomputed:false,originalDataModified:false,physicalCookingBlocksDevelopment:false};
}

export function readPinnedProposalSourcesV1():ProposalSourcesRawV1{
  const base=new URL('../../docs/premium/retained-sources/pilot-source-stage-20261104/',import.meta.url);
  return {ledgerRaw:readFileSync(new URL('120-row-review-v1.json',base),'utf8'),auditRaw:readFileSync(new URL('remaining-42-review-v1.json',base),'utf8'),captureRaw:readFileSync(new URL('sr28-ascii-capture-v1.json',base),'utf8')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==3)throw Error('Usage: node --import tsx scripts/contracts/authoring-reference-proposals-v1.ts PRIVATE_INPUT.json');
  process.stdout.write(JSON.stringify(buildAuthoringReferenceProposalsV1(readFileSync(process.argv[2],'utf8'),readPinnedProposalSourcesV1()),null,2)+'\n');
}
