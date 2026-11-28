/** Shared deterministic traversal only. It issues no validation or authority. */
export function* boundedCartesianIndexesV1(counts:readonly number[],budget:number):Generator<readonly number[]>{
  const owned=[...counts];
  if(!owned.length||owned.length>7||owned.some(n=>!Number.isSafeInteger(n)||n<1||n>16)
    ||!Number.isSafeInteger(budget)||budget<1||budget>1024)throw Error('INVALID_CARTESIAN_SEARCH_BOUNDS');
  const indexes=owned.map(()=>0),limit=Math.min(budget,owned.reduce((a,b)=>a*b,1));
  for(let n=0;n<limit;n++){
    yield Object.freeze([...indexes]);
    for(let axis=owned.length-1;axis>=0;axis--){indexes[axis]++;if(indexes[axis]<owned[axis])break;indexes[axis]=0;}
  }
}
