import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {validPublicKey} from './flow.mjs';
export default defineConfig(()=>{
 const key=process.env.POTOK_STAGING_PUBLIC_KEY??'';
 if(!validPublicKey(key))throw Error('STAGING_PUBLIC_KEY_REQUIRED');
 return {root:fileURLToPath(new URL('.',import.meta.url)),base:'./',
  define:{__POTOK_STAGING_PUBLIC_KEY__:JSON.stringify(key)},
  build:{outDir:fileURLToPath(new URL('../../reports/staging-auth-check-dist',import.meta.url)),emptyOutDir:true,sourcemap:false,cssCodeSplit:false,rollupOptions:{output:{inlineDynamicImports:true}}},
 };
});
