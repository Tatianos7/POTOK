import {GenerationEdgeErrorV2,type GenerationProposalProviderV2,type TrustedGenerationValidatorV2} from '../../supabase/functions/adaptive-nutrition-generate-v2/contracts';
import {createValidatedGenerationProposalV1,createSelectionBoundGenerationProposalV1,
  type GenerationDecisionTracePortV1,type GenerationSelectionDecisionPortV1} from './generationPlanProposalV1';
import type {GenerationPreparationWarningPortV1} from './generationDayOptionsV1';
import type {GenerationMenuCandidateSourcePortV1} from './generationMenuCandidatesV1';
import {createGenerationValidationAdapterV1,type GenerationValidationAuthorityPortV1} from './generationValidationAdapterV1';
import {decodeTrustedGenerationInputRawV1,decodeGeneratedWeekPlanRawV1} from '../utils/adaptiveNutritionGraphV2';
import {decodeAdaptiveNutritionCandidateManifestV2,adaptiveNutritionCandidateManifestCanonicalBytesV2} from '../utils/adaptiveNutritionAuthoritiesV1';
import {assertRawJsonWithoutDuplicateKeysV1,canonicalJsonV1} from '../utils/adaptiveNutritionWireV1';

const hex=/^[0-9a-f]+$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hexPairs=Array.from({length:256},(_,i)=>i.toString(16).padStart(2,'0'));
function toHex(bytes:Uint8Array):string{
  const chunks:string[]=[];
  for(let start=0;start<bytes.length;start+=8192){
    const chunk:string[]=[];for(let i=start;i<Math.min(start+8192,bytes.length);i++)chunk.push(hexPairs[bytes[i]]);
    chunks.push(chunk.join(''));
  }
  return chunks.join('');
}
function parse(raw:string):Record<string,unknown>{
  if(typeof raw!=='string'||raw.length>8_000_000)throw new GenerationEdgeErrorV2('INVALID_WORKER_RAW',502);
  assertRawJsonWithoutDuplicateKeysV1(raw);const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw new GenerationEdgeErrorV2('INVALID_WORKER_FIELDS',502);
  return value as Record<string,unknown>;
}
function canonicalRawFromHex(value:string):string{
  if(typeof value!=='string'||value.length>16_000_000||value.length%2!==0||!hex.test(value))throw new GenerationEdgeErrorV2('INVALID_WORKER_CANONICAL_HEX',502);
  const bytes=new Uint8Array(value.length/2);
  for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(value.slice(i*2,i*2+2),16);
  let raw:string;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new GenerationEdgeErrorV2('INVALID_WORKER_UTF8',502);}
  const data=parse(raw);
  if(toHex(new TextEncoder().encode(raw))!==value||canonicalJsonV1(data,'SAFE_INTEGER')!==raw)throw new GenerationEdgeErrorV2('NONCANONICAL_WORKER_BYTES',502);
  return raw;
}
type Binding=Parameters<GenerationProposalProviderV2['generate']>[0];
function ownBinding(value:Binding){
  const {requestOperationId,generationInputCanonicalHex,candidateManifestCanonicalHex}=value;
  if(typeof requestOperationId!=='string'||!uuid.test(requestOperationId))throw new GenerationEdgeErrorV2('INVALID_WORKER_REQUEST',400);
  const inputRaw=canonicalRawFromHex(generationInputCanonicalHex);
  canonicalRawFromHex(candidateManifestCanonicalHex);
  const input=decodeTrustedGenerationInputRawV1(inputRaw);
  if(input.operation.requestId!==requestOperationId)throw new GenerationEdgeErrorV2('WORKER_REQUEST_INPUT_MISMATCH',409);
  return Object.freeze({requestOperationId,generationInputCanonicalHex,candidateManifestCanonicalHex,inputRaw,input});
}
async function bindContext(contextRaw:string,pinned:ReturnType<typeof ownBinding>):Promise<void>{
  const context=parse(contextRaw);
  if(typeof context.trustedGenerationInputRaw!=='string'||typeof context.candidateManifestRaw!=='string')throw new GenerationEdgeErrorV2('INVALID_WORKER_CONTEXT',502);
  const input=decodeTrustedGenerationInputRawV1(context.trustedGenerationInputRaw);
  const manifest=await decodeAdaptiveNutritionCandidateManifestV2(parse(context.candidateManifestRaw));
  if(canonicalJsonV1(input,'SAFE_INTEGER')!==pinned.inputRaw||manifest.manifestRevision!==input.candidateManifestRevision
    ||manifest.digest!==input.candidateManifestDigest)throw new GenerationEdgeErrorV2('WORKER_INPUT_SNAPSHOT_MISMATCH',409);
  // Stored manifest canonical bytes omit the separately carried digest. Reuse that exact existing encoder.
  if(toHex(await adaptiveNutritionCandidateManifestCanonicalBytesV2(manifest))!==pinned.candidateManifestCanonicalHex)throw new GenerationEdgeErrorV2('WORKER_MANIFEST_SNAPSHOT_MISMATCH',409);
}
function scopedAuthority(port:GenerationValidationAuthorityPortV1,pinned:ReturnType<typeof ownBinding>):GenerationValidationAuthorityPortV1{
  return {async loadForProposalRaw(request,digest){
    if(request!==pinned.requestOperationId)throw new GenerationEdgeErrorV2('WORKER_REQUEST_INPUT_MISMATCH',409);
    const raw=await port.loadForProposalRaw(request,digest);
    if(raw===null)return null;
    const value=parse(raw);
    if(typeof value.trustedContextRaw!=='string')throw new GenerationEdgeErrorV2('INVALID_WORKER_CONTEXT',502);
    await bindContext(value.trustedContextRaw,pinned);return raw;
  }};
}

/** Inactive backend bindings for the existing worker; no credentials, HTTP route or live activation. */
function workerBindings(sourcePort:GenerationMenuCandidateSourcePortV1,
  authorityPort:GenerationValidationAuthorityPortV1,
  pipelineFor:(source:GenerationMenuCandidateSourcePortV1,authority:GenerationValidationAuthorityPortV1)=>ReturnType<typeof createValidatedGenerationProposalV1>,
  limitsRaw?:string):Readonly<{
    generator:GenerationProposalProviderV2;validator:TrustedGenerationValidatorV2;
  }>{
  const generator:GenerationProposalProviderV2={async generate(value){
    const pinned=ownBinding(value);
    const pipeline=pipelineFor({async loadPreparationRaw(request){
      if(request!==pinned.requestOperationId)throw new GenerationEdgeErrorV2('WORKER_REQUEST_INPUT_MISMATCH',409);
      const raw=await sourcePort.loadPreparationRaw(request);if(raw===null)return null;
      const source=parse(raw);if(typeof source.contextRaw!=='string')throw new GenerationEdgeErrorV2('INVALID_WORKER_CONTEXT',502);
      await bindContext(source.contextRaw,pinned);return raw;
    }},scopedAuthority(authorityPort,pinned));
    const result=await pipeline.generate(pinned.requestOperationId,limitsRaw);
    if(result.status!=='VALIDATED_PROPOSAL')throw new GenerationEdgeErrorV2(`GENERATION_PROPOSAL_${result.status}`,409);
    await decodeGeneratedWeekPlanRawV1(result.generatedPlanRaw,pinned.input);
    const bytes=toHex(new TextEncoder().encode(result.generatedPlanRaw));
    canonicalRawFromHex(bytes); // Assert, never rewrite already validated proposal bytes.
    return Object.freeze({generatedWeekPlanCanonicalHex:bytes});
  }};
  const validator:TrustedGenerationValidatorV2={async validate(value){
    const pinned=ownBinding(value);
    // Own original bytes before awaiting sources; never cache the generator-side acceptance.
    const proposalHex=value.generatedWeekPlanCanonicalHex;
    const proposalRaw=canonicalRawFromHex(proposalHex);
    await decodeGeneratedWeekPlanRawV1(proposalRaw,pinned.input);
    const result=await createGenerationValidationAdapterV1(scopedAuthority(authorityPort,pinned)).validate(pinned.requestOperationId,proposalRaw);
    if(result.status!=='ACCEPTED')throw new GenerationEdgeErrorV2(`GENERATION_VALIDATION_${result.status}`,409);
    return Object.freeze({generatedWeekPlanCanonicalHex:proposalHex});
  }};
  return Object.freeze({generator:Object.freeze(generator),validator:Object.freeze(validator)});
}

/** Legacy bindings remain unchanged and inactive. */
export function createGenerationWorkerBindingsV1(source:GenerationMenuCandidateSourcePortV1,
  warnings:GenerationPreparationWarningPortV1,decisions:GenerationDecisionTracePortV1,
  authority:GenerationValidationAuthorityPortV1,limitsRaw?:string){
  return workerBindings(source,authority,(scopedSource,scopedAuthority)=>
    createValidatedGenerationProposalV1(scopedSource,warnings,decisions,scopedAuthority),limitsRaw);
}
/** Same canonical request binding and fresh pre-record validator, with actual selection provenance.
 * No gateway, connection, role switch, route or enabled runtime is created here.
 */
export function createSelectionBoundGenerationWorkerBindingsV1(source:GenerationMenuCandidateSourcePortV1,
  warnings:GenerationPreparationWarningPortV1,decisions:GenerationSelectionDecisionPortV1,
  authority:GenerationValidationAuthorityPortV1,limitsRaw?:string){
  return workerBindings(source,authority,(scopedSource,scopedAuthority)=>
    createSelectionBoundGenerationProposalV1(scopedSource,warnings,decisions,scopedAuthority),limitsRaw);
}
