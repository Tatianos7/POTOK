/** Fail closed before building any externally accessible staging preview.
 * The browser key is PUBLIC; never pass a service role, secret or DB credential.
 */
export const STAGING_SUPABASE_ORIGIN='https://ozidryfvhkcbtpnulakq.supabase.co';
function invalid(){throw Error('POTOK_STAGING_PREVIEW_CONFIG_INVALID');}
export function validateStagingPreviewEnv(env){
 if(!env||env.VITE_POTOK_STAGING_PREVIEW!=='true'||env.VITE_SUPABASE_URL!==STAGING_SUPABASE_ORIGIN)invalid();
 const key=env.VITE_SUPABASE_ANON_KEY;
 if(typeof key!=='string'||key.length<20||key.trim()!==key||/[\s]/.test(key))invalid();
 if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))return true;
 if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key))invalid();
 let payload;
 try{
  const part=key.split('.')[1];
  payload=JSON.parse(Buffer.from(part,'base64url').toString('utf8'));
 }catch{invalid();}
 if(!payload||payload.role!=='anon'||typeof payload.ref!=='string'||payload.ref!=='ozidryfvhkcbtpnulakq')invalid();
 return true;
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 validateStagingPreviewEnv(process.env);
 process.stdout.write('STAGING_PREVIEW_CONFIG_OK: isolated project and public key type (no credentials printed)\n');
}
