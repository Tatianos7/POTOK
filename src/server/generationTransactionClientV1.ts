/** Trusted backend pool integration only. A pool must lease an exclusive,
 * already authenticated connection and implement bounded acquire/query/close.
 * discard=true must destroy the connection, never return it to the idle pool.
 * This port does not prove role identity/TLS or create a driver/credential.
 */
export interface GenerationTransactionConnectionV1<Row> {
  query(statement:string,parameters:readonly string[]):Promise<{rows:Row[]}>;
  release(discard:boolean):Promise<void>;
}
export interface GenerationTransactionPoolV1<Row> {
  acquire():Promise<GenerationTransactionConnectionV1<Row>>;
}
/** One normal short transaction per fixed adapter query. Do not share the
 * verifier's read-only session: admitted source functions lock current rows.
 * SQL and pool are trusted server dependencies, never request-controlled.
 */
export function createGenerationTransactionClientV1<Row>(
  pool:GenerationTransactionPoolV1<Row>,enabled:()=>boolean=()=>false,
):{query(statement:string,parameters:readonly string[]):Promise<{rows:Row[]}>}{
  const assertEnabled=()=>{if(enabled()!==true)throw Error('GENERATION_SQL_DISABLED');};
  return Object.freeze({async query(statement:string,parameters:readonly string[]){
    assertEnabled();
    // Snapshot parameters before any acquisition await.
    const values=Object.freeze([...parameters]);
    let connection:GenerationTransactionConnectionV1<Row>|undefined;
    let begun=false,commitAttempted=false,committed=false;
    let result:{rows:Row[]}|undefined;
    let failure:string|undefined;
    try{
      connection=await pool.acquire();
      assertEnabled();
      await connection.query('BEGIN',[]);
      begun=true;
      assertEnabled();
      result=await connection.query(statement,values);
      assertEnabled();
      commitAttempted=true;
      await connection.query('COMMIT',[]);
      committed=true;
      assertEnabled();
    }catch{
      failure=commitAttempted&&!committed?'GENERATION_SQL_COMMIT_UNKNOWN':'GENERATION_SQL_UNAVAILABLE';
      if(connection&&begun&&!commitAttempted){
        try{await connection.query('ROLLBACK',[]);}catch{/* Discard below, never retry SQL. */}
      }
    }finally{
      if(connection){
        try{await connection.release(failure!==undefined);}
        catch{failure=committed?'GENERATION_SQL_COMMITTED_RELEASE_FAILED':failure??'GENERATION_SQL_UNAVAILABLE';}
      }
    }
    if(failure)throw Error(failure);
    // Gate may close while release awaits; a committed write then needs status
    // recovery, not a repeat of record/activate.
    assertEnabled();
    return result!;
  }});
}
