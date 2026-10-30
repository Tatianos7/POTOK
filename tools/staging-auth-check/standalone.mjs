import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
export async function makeStandalone(source,destination){
 let html=await readFile(source,'utf8');
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
 const styles=[...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)];
 if(scripts.length!==1||styles.length!==1)throw Error('SINGLE_BUNDLE_REQUIRED');
 const base=dirname(resolve(source));
 const local=p=>{const x=resolve(base,p);if(!x.startsWith(base+'/assets/'))throw Error('LOCAL_ASSET_REQUIRED');return x;};
 const js=(await readFile(local(scripts[0][1]),'utf8')).replace(/<\/script/gi,'<\\/script');
 const css=await readFile(local(styles[0][1]),'utf8');
 const hash=s=>createHash('sha256').update(s).digest('base64');
 html=html.replace(scripts[0][0],'<script type="module">'+js+'</script>');
 html=html.replace(styles[0][0],'<style>'+css+'</style>');
 html=html.replace("script-src 'self'; style-src 'self'",`script-src 'sha256-${hash(js)}'; style-src 'sha256-${hash(css)}'`);
 if(/<script\b[^>]*\bsrc=|<link\b[^>]*\brel="stylesheet"/i.test(html))throw Error('EXTERNAL_ASSET_REMAINS');
 await writeFile(destination,html);
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 if(process.argv.length!==4)throw Error('Usage: standalone.mjs INPUT_HTML OUTPUT_HTML');
 await makeStandalone(process.argv[2],process.argv[3]);
}
