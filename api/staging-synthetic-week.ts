/** Vercel Node API: auth-bound, bounded, synthetic-only preview.
 * Does not call Supabase RPC, write databases, or invoke the private generator.
 * Exact Staging environment required. No user-controlled optimization input.
 */
import {buildSyntheticStagingWeekV1} from '../src/dev/stagingSyntheticWeekServiceV1';

type Req={method?:string;headers:Record<string,string|string[]|undefined>;body?:unknown};
type Res={status:(code:number)=>Res;setHeader:(name:string,value:string)=>Res;json:(value:unknown)=>void};
const STAGING='https://ozidryfvhkcbtpnulakq.supabase.co';
const noWriteHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};

export default async function handler(req:Req,res:Res):Promise<void>{
  for(const [key,value] of Object.entries(noWriteHeaders))res.setHeader(key,value);
  if(process.env.VITE_POTOK_STAGING_PREVIEW!=='true'||process.env.VITE_SUPABASE_URL!==STAGING){
    res.status(503).json({error:'STAGING_ENVIRONMENT_REQUIRED'});return;
  }
  if(req.method!=='POST'){res.setHeader('Allow','POST');res.status(405).json({error:'METHOD_NOT_ALLOWED'});return;}
  if(req.body!==undefined && req.body!==null && (
    typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body as object).length!==0
  )){res.status(400).json({error:'UNSUPPORTED_INPUT'});return;}
  const bearer=req.headers.authorization;
  const auth=typeof bearer==='string'&&/^Bearer [^\\s,]+$/i.test(bearer)?bearer:null;
  if(!auth){res.status(401).json({error:'AUTH_REQUIRED'});return;}
  const publicKey=process.env.VITE_SUPABASE_ANON_KEY;
  if(!publicKey || !(publicKey.startsWith('sb_publishable_') || publicKey.split('.').length===3)){
    res.status(503).json({error:'STAGING_PUBLIC_KEY_MISSING'});return;
  }
  try {
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),5000);
    let remote:Response;
    try {
      remote=await fetch(STAGING+'/auth/v1/user',{
        method:'GET',signal:controller.signal,cache:'no-store',
        headers:{Authorization:auth,apikey:publicKey,Accept:'application/json'}
      });
    }finally{clearTimeout(timeout);}
    if(!remote.ok){res.status(remote.status===401||remote.status===403?401:503).json({error:'AUTH_UNAVAILABLE_OR_DENIED'});return;}
    const user=await remote.json() as {id?:unknown};
    if(typeof user.id!=='string'||!/^[-0-9a-f]{36}$/i.test(user.id)){
      res.status(401).json({error:'AUTH_INVALID_USER'});return;
    }
    res.status(200).json(buildSyntheticStagingWeekV1());
  }catch{
    res.status(503).json({error:'SYNTHETIC_PREVIEW_TEMPORARILY_UNAVAILABLE'});
  }
}
