/** Disposable verification only; NOT a POTOK runtime adapter.
 * PostgREST drops native PostgreSQL routine metadata. Do not reconstruct it from
 * localized message text or treat a pre-COMMIT SQL result as an acknowledgement. */
export interface PostgrestErrorV1 { code:string; message:string; details:string|null; hint:string|null }
export type TransportOutcomeV1 =
 | { status:'COMMITTED'; retryAllowed:false }
 | { status:'ABORTED'; retryAllowed:false }
 | { status:'UNKNOWN'; retryAllowed:false };
export function transportOutcomeV1(observation:
 | { kind:'HTTP_SUCCESS'; bodyVerified:boolean; rollbackPreference:boolean }
 | { kind:'HTTP_ERROR'; rollbackConfirmed:boolean; error:PostgrestErrorV1 }
 | { kind:'DISCONNECT' }):TransportOutcomeV1 {
 if(observation.kind==='HTTP_SUCCESS'&&observation.bodyVerified&&!observation.rollbackPreference)return {status:'COMMITTED',retryAllowed:false};
 if(observation.kind==='HTTP_ERROR'&&observation.rollbackConfirmed)return {status:'ABORTED',retryAllowed:false};
 return {status:'UNKNOWN',retryAllowed:false};
}
/** Read-only final-state match is NOT an operation receipt/proof of causality.
 * A stable key/digest match can precede the request, follow another write, or be
 * absent while the original operation is still running. Never authorizes retry. */
export function reconcileFinalStateV1(expected:{foodId:string;stableKey:string|null;digest:string},observed:{foodId:string;stableKey:string|null;digest:string}|null):
 {state:'MATCH'|'ABSENT'|'DIFFERENT';operationStatus:'UNKNOWN';retryAllowed:false} {
 return {state:observed===null?'ABSENT':observed.foodId===expected.foodId&&observed.stableKey===expected.stableKey&&observed.digest===expected.digest?'MATCH':'DIFFERENT',operationStatus:'UNKNOWN',retryAllowed:false};
}
