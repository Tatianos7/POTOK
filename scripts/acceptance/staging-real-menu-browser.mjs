import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve, extname} from 'node:path';
import {chromium} from 'playwright';
import {createStagingRealWeekHandler} from '../../api/staging-real-week.js';

// Real private recipe input + real HTTP handler/search/decoders/UI. Auth is a
// synthetic local fixture; this never contacts hosted Auth or a database.
if (!process.argv[2]) throw Error('Usage: staging-real-menu-browser.mjs PRIVATE_CATALOG.br64');
const account = '11111111-1111-4111-8111-111111111111';
const user = {id:account, aud:'authenticated', role:'authenticated', email:'synthetic@example.test', app_metadata:{}, user_metadata:{}};
const env = {VERCEL_ENV:'preview', VITE_POTOK_STAGING_PREVIEW:'true', VITE_SUPABASE_URL:'https://ozidryfvhkcbtpnulakq.supabase.co',
  VITE_SUPABASE_ANON_KEY:'sb_publishable_synthetic_test_only', POTOK_STAGING_REFERENCE_TEST_ENABLED:'true',
  POTOK_STAGING_REFERENCE_CATALOG_BR64:readFileSync(process.argv[2],'utf8')};
let lastBody = null;
let apiCalls = 0, authCalls = 0, delayResponse = false, denyAuth = false;
const handler = createStagingRealWeekHandler(env, async (url, options) => {
  assert.equal(url,env.VITE_SUPABASE_URL+'/auth/v1/user');assert.equal(options.method,'GET');authCalls++;
  return new Response(JSON.stringify(user),{status:denyAuth?401:200});
});
const root = resolve('dist');
const server = createServer(async (req,res) => {
  if (req.url === '/api/staging-real-week') {
    apiCalls++;
    const chunks=[];for await (const chunk of req) chunks.push(chunk);
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{body=null;}
    if(delayResponse)await new Promise(r=>setTimeout(r,300));
    const response={status(n){res.statusCode=n;return this;},setHeader(k,v){res.setHeader(k,v);return this;},json(v){lastBody=v;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));}};
    await handler({method:req.method,headers:req.headers,body},response);return;
  }
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[extname(file)]??'application/octet-stream');res.end(readFileSync(file));}
  catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const checks=[];
try{
  const unauthorized=await fetch(origin+'/api/staging-real-week',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:1600,weekStart:'2026-11-09'})});
  assert.equal(unauthorized.status,401);
  for(const width of (process.env.POTOK_QUALITY_SCREENSHOT ? [393] : [360,393,430])){
    const context=await browser.newContext({viewport:{width,height:852}}),page=await context.newPage(),errors=[],unexpected=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',async r=>{if(r.url().endsWith('/api/staging-real-week'))console.log('API_RESPONSE',r.status(),r.ok()?'OK':(await r.json()).error);});
    await page.route('https://ozidryfvhkcbtpnulakq.supabase.co/**',route=>{
      if(route.request().url().endsWith('/auth/v1/user'))return route.fulfill({json:user});
      unexpected.push(route.request().url());return route.abort();
    });
    await page.addInitScript(({user})=>{
      const enc=x=>btoa(JSON.stringify(x)).replaceAll('=','').replaceAll('+','-').replaceAll('/','_');
      const token=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})+'.synthetic';
      localStorage.setItem('sb-ozidryfvhkcbtpnulakq-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));
    },{user});
    await page.goto(origin+'/staging-generator-check.html');
    await page.getByRole('button',{name:'Сгенерировать неделю из рецептов',exact:true}).waitFor();
    const target=page.getByLabel('Калорийность тестовой недели',{exact:true});
    for(const n of [1400,1600,1800,2000]){
      await target.selectOption(String(n));assert.equal(await page.locator('article').count(),0);
      await page.getByRole('button',{name:'Сгенерировать неделю из рецептов',exact:true}).click();
      try {await page.getByText('В сборнике 132 рецепта; 122 с полными справочными числами для теста.',{exact:true}).waitFor();}
      catch(error){console.log('VISIBLE_ERRORS',await page.getByRole('alert').allTextContents());throw error;}
      const corridor=await page.getByLabel('Допустимый коридор калорийности',{exact:true}).innerText();
      assert.ok(corridor.includes((n-50).toLocaleString('ru-RU')));assert.ok(corridor.includes((n+50).toLocaleString('ru-RU')));
      if(n===2000){await page.getByText('В этом режиме собрать неделю в выбранном коридоре нельзя:',{exact:false}).waitFor();assert.equal(await page.locator('article').count(),0);}
      else{
        const days=page.getByRole('navigation',{name:'Дни недели'}).getByRole('button');assert.equal(await days.count(),7);
        for(let i=0;i<7;i++){
          await days.nth(i).click();assert.equal(await page.locator('article').count(),4);
          const calorieCard=await page.getByLabel('Цель и калорийность меню',{exact:true}).innerText();
          assert.ok(calorieCard.includes('Цель:'));assert.ok(calorieCard.includes('Меню:'));
          if(n===1800){assert.ok(calorieCard.includes('Ниже цели на'));assert.ok(!calorieCard.includes('Совпадает с целью'));}
          else assert.ok(calorieCard.includes('Совпадает с целью по справочным данным.'));
          await page.getByText('Открыть рецепт',{exact:true}).first().click();assert.ok((await page.locator('article').first().innerText()).includes('Ингредиенты'));
        }
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      checks.push({width,target:n,result:n===2000?'EXPECTED_BOUNDED_EMPTY':'SEVEN_DAYS_FOUR_REAL_RECIPES_DETAILS'});
    }
    // Real private catalog → explicit exclusion → real bounded selector → save → reopen.
    await target.selectOption('1600');
    await page.getByRole('button',{name:'Сгенерировать неделю из рецептов',exact:true}).click();
    await page.locator('article').first().waitFor();
    const unwanted=lastBody.report.days[0].meals[0];
    await page.getByText('Есть блюдо, которое не хочется?',{exact:true}).click();
    await page.getByRole('button',{name:'Не предлагать: '+unwanted.name,exact:true}).click();
    assert.equal(await page.locator('article').count(),0);
    const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/staging-real-week'));
    await page.getByRole('button',{name:'Сгенерировать неделю из рецептов',exact:true}).click();
    const filtered=await (await responsePromise).json();
    assert.equal(filtered.report.days.length,7);assert.deepEqual(filtered.exclusions.recipes.map(r=>r.id),[unwanted.recipeId]);
    assert.ok(!filtered.report.days.some(d=>d.meals.some(m=>m.recipeId===unwanted.recipeId)));
    await page.locator('article').first().waitFor();
    await page.getByRole('button',{name:'Сохранить неделю на устройстве',exact:true}).click();
    await page.getByText('Тестовая неделя сохранена на этом устройстве.',{exact:true}).waitFor();
    const countBefore=apiCalls;await page.reload();
    await page.getByText('Открыта сохранённая тестовая неделя. Повторный подбор не выполнялся.',{exact:true}).waitFor();
    if(process.env.POTOK_QUALITY_SCREENSHOT)await page.screenshot({path:process.env.POTOK_QUALITY_SCREENSHOT,fullPage:true});
    assert.equal(apiCalls,countBefore);assert.ok((await page.getByLabel('Исключённые блюда',{exact:true}).innerText()).includes(unwanted.name));
    await page.getByRole('button',{name:'Снять исключения',exact:true}).click();assert.equal(await page.locator('article').count(),0);
    // Clear this test's own draft before the existing denied/stale checks.
    await page.getByRole('button',{name:'Удалить сохранённый черновик',exact:true}).click();
    await page.getByText('Сохранённый черновик удалён с этого устройства.',{exact:true}).waitFor();
    checks.push({width,result:'EXCLUDE_REAL_RECIPE_REGENERATE_SAVE_REOPEN'});
    // A response from a previous scenario must never reappear after a change.
    await target.selectOption('1600');delayResponse=true;
    await page.getByRole('button',{name:'Сгенерировать неделю из рецептов',exact:true}).click();await target.selectOption('1400');
    await page.waitForTimeout(600);assert.equal(await page.locator('article').count(),0);delayResponse=false;
    denyAuth=true;await page.getByRole('button',{name:'Сгенерировать неделю из рецептов',exact:true}).click();
    await page.getByRole('alert').waitFor();assert.equal(await page.locator('article').count(),0);denyAuth=false;
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);await context.close();
  }
  console.log(JSON.stringify({status:'PASS',auth:'LOCAL_SYNTHETIC_FIXTURE_NOT_HOSTED',databaseWrites:0,checks,apiCalls,authCalls,staleResponse:'PASS',deniedAuth:'PASS',unauthenticated:'401',pageErrors:0},null,2));
}finally{await browser.close();server.close();}
