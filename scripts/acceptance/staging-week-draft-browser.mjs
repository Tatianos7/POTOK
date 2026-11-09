import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {referenceWeekFixture} from '../../src/services/__tests__/stagingWeekDraft.fixture.ts';
// Synthetic API/Auth fixtures; real built UI, browser storage and restore logic.
// No hosted request, database write or runtime activation.
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const user=id=>({id,aud:'authenticated',role:'authenticated',email:'synthetic@example.test',app_metadata:{},user_metadata:{}});
const session=id=>{
  const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  return {access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})+'.synthetic',refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:user(id)};
};
let apiCalls=0;
const root=resolve('dist');
const server=createServer(async(req,res)=>{
  if(req.url==='/api/staging-real-week'){
    apiCalls++;const chunks=[];for await(const c of req)chunks.push(c);const input=JSON.parse(Buffer.concat(chunks));
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(referenceWeekFixture(input.target)));return;
  }
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[extname(file)]??'application/octet-stream');res.end(readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const checks=[];
try{
  for(const width of [360,393,430]){
    const context=await browser.newContext({viewport:{width,height:852}});let actor=a;const errors=[],unexpected=[];
    context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
    await context.route('https://ozidryfvhkcbtpnulakq.supabase.co/**',route=>{
      if(route.request().method()==='GET'&&route.request().url().endsWith('/auth/v1/user'))return route.fulfill({json:user(actor)});
      unexpected.push(route.request().method()+' '+route.request().url());return route.abort();
    });
    await context.addInitScript(s=>{
      // Seed auth once; later pages preserve real browser storage, including sign-out.
      if(!localStorage.getItem('synthetic-auth-initialized')){
        localStorage.setItem('sb-ozidryfvhkcbtpnulakq-auth-token',JSON.stringify(s));localStorage.setItem('synthetic-auth-initialized','true');
      }
    },session(a));
    let page=await context.newPage();await page.goto(origin+'/staging-generator-check.html');
    const generate=()=>page.getByRole('button',{name:'Сгенерировать неделю из рецептов',exact:true});
    await generate().waitFor();await generate().click();await page.locator('article').first().waitFor();
    await page.getByRole('button',{name:'Сохранить неделю на устройстве',exact:true}).click();
    await page.getByText('Тестовая неделя сохранена на этом устройстве.',{exact:true}).waitFor();
    const draftKey='potok:staging-reference-week-draft:v1:'+a;
    const saved=await page.evaluate(k=>localStorage.getItem(k),draftKey);assert.ok(saved);
    await page.getByRole('button',{name:'Заменить сохранённую неделю',exact:true}).click();
    await page.waitForFunction(k=>localStorage.getItem(k)!==null,draftKey);
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),draftKey),saved);
    const calls=apiCalls;await page.close();page=await context.newPage();await page.goto(origin+'/staging-generator-check.html');
    await page.getByText('Открыта сохранённая тестовая неделя. Повторный подбор не выполнялся.',{exact:true}).waitFor();assert.equal(apiCalls,calls);
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),draftKey),saved);
    if(width===393 && process.env.POTOK_DRAFT_SCREENSHOT) await page.screenshot({path:process.env.POTOK_DRAFT_SCREENSHOT,fullPage:true});
    const days=page.getByRole('navigation',{name:'Дни недели'}).getByRole('button');assert.equal(await days.count(),7);
    for(let i=0;i<7;i++){
      await days.nth(i).click();assert.equal(await page.locator('article').count(),4);
      await page.getByText('Открыть рецепт',{exact:true}).first().click();
      assert.ok((await page.locator('article').first().innerText()).includes('Тестовый ингредиент'));
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    // Selection changes clear current candidate, but preserve the explicitly saved week.
    await page.getByLabel('Калорийность тестовой недели',{exact:true}).selectOption('1800');assert.equal(await page.locator('article').count(),0);
    await page.getByRole('button',{name:'Открыть сохранённую неделю',exact:true}).click();await page.locator('article').first().waitFor();
    assert.equal(await page.getByLabel('Калорийность тестовой недели',{exact:true}).inputValue(),'1600');
    // Failed generation must not destroy saved state; reopening uses no generation API.
    await page.route('**/api/staging-real-week',route=>route.abort());await generate().click();await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('article').count(),0);assert.equal(await page.evaluate(k=>localStorage.getItem(k),draftKey),saved);
    await page.getByRole('button',{name:'Открыть сохранённую неделю',exact:true}).click();await page.locator('article').first().waitFor();
    await page.unroute('**/api/staging-real-week');
    // Quota failure keeps previous data, and does not show success.
    await page.getByLabel('Калорийность тестовой недели',{exact:true}).selectOption('1800');await generate().click();await page.locator('article').first().waitFor();
    await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError');};});
    await page.getByRole('button',{name:'Заменить сохранённую неделю',exact:true}).click();await page.getByRole('alert').waitFor();
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),draftKey),saved);await page.reload();
    await page.getByText('Открыта сохранённая тестовая неделя. Повторный подбор не выполнялся.',{exact:true}).waitFor();
    // A verified different user cannot load A's draft, even in the same browser profile.
    actor=b;await page.evaluate(s=>localStorage.setItem('sb-ozidryfvhkcbtpnulakq-auth-token',JSON.stringify(s)),session(b));await page.reload();
    await generate().waitFor();await page.waitForFunction(()=>!document.querySelector('button:disabled')?.textContent?.includes('Подожди'));
    assert.equal(await page.locator('article').count(),0);
    // Restore A, then sign out in a second tab; currently open recipes must disappear.
    actor=a;await page.evaluate(s=>localStorage.setItem('sb-ozidryfvhkcbtpnulakq-auth-token',JSON.stringify(s)),session(a));await page.reload();
    await page.locator('article').first().waitFor();const other=await context.newPage();await other.goto(origin+'/staging-generator-check.html');
    await other.evaluate(()=>localStorage.removeItem('sb-ozidryfvhkcbtpnulakq-auth-token'));
    await page.getByText('Для проверки открой POTOK по ссылке выше и войди в тестовый аккаунт на этом же сайте.',{exact:true}).waitFor();
    assert.equal(await page.locator('article').count(),0);await other.close();
    // Corruption is visible and cannot become an active plan or fallback menu.
    await page.evaluate(({s,k})=>{localStorage.setItem('sb-ozidryfvhkcbtpnulakq-auth-token',JSON.stringify(s));localStorage.setItem(k,'broken');},{s:session(a),k:draftKey});
    await page.reload();await page.getByRole('alert').waitFor();assert.equal(await page.locator('article').count(),0);
    await page.getByRole('button',{name:'Удалить сохранённый черновик',exact:true}).click();
    await page.getByText('Сохранённый черновик удалён с этого устройства.',{exact:true}).waitFor();
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),draftKey),null);
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);checks.push({width,reopenSevenDays:true,duplicateSave:'NO_OP',generationFailure:'RETAINED',quotaFailure:'RETAINED',foreignAccount:'HIDDEN',crossTabLogout:'HIDDEN',corruptDraft:'REJECTED',delete:'PASS'});
    await context.close();
  }
  console.log(JSON.stringify({status:'PASS',fixtures:'SYNTHETIC_AUTH_AND_RECIPE_API_NOT_HOSTED',databaseWrites:0,checks,apiCalls,pageErrors:0},null,2));
}finally{await browser.close();server.close();}
