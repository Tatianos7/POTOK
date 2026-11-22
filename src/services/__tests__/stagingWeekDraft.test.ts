import test from 'node:test';
import assert from 'node:assert/strict';
import {loadStagingWeekDraft, saveStagingWeekDraft, saveStagingWeekSideDishes, removeStagingWeekDraft} from '../stagingWeekDraft';
import {projectStagingSideDishes} from '../stagingWeekSideDishes';
import {referenceWeekFixture} from './stagingWeekDraft.fixture';
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
const raw=()=>JSON.stringify(referenceWeekFixture());
const now=new Date('2026-11-09T11:00:00Z');
function store() {
  const data=new Map<string,string>();let writes=0;
  return {data,get writes(){return writes;},getItem(k:string){return data.get(k)??null;},setItem(k:string,v:string){writes++;data.set(k,v);},removeItem(k:string){data.delete(k);}};
}
test('save/readback preserves every day, recipe detail, source snapshot and unknown mass; replay has one slot',()=>{
  const s=store(), saved=saveStagingWeekDraft(s,a,raw(),'Europe/Moscow',now);
  const replay=saveStagingWeekDraft(s,a,raw(),'Europe/Moscow',new Date(now.getTime()+1000));
  assert.deepEqual(replay,saved);assert.equal(s.writes,1);assert.equal(s.data.size,1);
  const loaded=loadStagingWeekDraft(s,a)!;assert.deepEqual(loaded,saved);assert.equal(loaded.view.report.days.length,7);
  assert.equal(loaded.view.catalog.recipes.size,28);assert.equal(loaded.view.report.days[0].meals[0].measuredGrams,null);
  assert.equal(loaded.view.catalog.recipes.get('synthetic-0')!.ingredients[0].weightG,null);
  assert.equal(loaded.view.snapshot,raw());assert.equal(loaded.target,1600);assert.equal(loaded.timeZone,'Europe/Moscow');
});
test('account separation and envelope ownership; deletion is limited to own draft',()=>{
  const s=store();saveStagingWeekDraft(s,a,raw(),'UTC',now);assert.equal(loadStagingWeekDraft(s,b),null);
  const [key,value]=[...s.data][0];s.data.set(key.replace(a,b),value);assert.throws(()=>loadStagingWeekDraft(s,b));
  removeStagingWeekDraft(s,a);assert.equal(loadStagingWeekDraft(s,a),null);assert.equal(s.data.size,1);
  assert.throws(()=>loadStagingWeekDraft(s,''));
});
type Envelope={contract:string;scope:string;timeZone:string;target:number;weekStart:string;savedAt:string;payload:string};
test('tampered flags, corridor, totals, recipe linkage, version and metadata fail closed',()=>{
  for(const mutate of [
    (e:Envelope)=>{e.contract='graph-v2';}, (e:Envelope)=>{e.scope='ACTIVE';}, (e:Envelope)=>{e.timeZone='invalid/timezone';},
    (e:Envelope)=>{e.target=1800;},(e:Envelope)=>{e.weekStart='2026-11-10';},(e:Envelope)=>{e.savedAt='broken';},
    (e:Envelope)=>{e.payload=JSON.stringify({...JSON.parse(e.payload),mayActivate:true});},
    (e:Envelope)=>{const p=JSON.parse(e.payload);p.report.calorieCorridor.maximumKcal=1700;e.payload=JSON.stringify(p);},
    (e:Envelope)=>{const p=JSON.parse(e.payload);p.report.days[0].referenceNutrition.calories='1601.000';e.payload=JSON.stringify(p);},
    (e:Envelope)=>{const p=JSON.parse(e.payload);p.catalog.recipes[0].referenceNutrition.values.calories=999;e.payload=JSON.stringify(p);},
    (e:Envelope)=>{const p=JSON.parse(e.payload);p.catalog.source.sha256='b'.repeat(64);e.payload=JSON.stringify(p);},
  ]) {
    const s=store();saveStagingWeekDraft(s,a,raw(),'UTC',now);const [k,v]=[...s.data][0],envelope=JSON.parse(v);
    mutate(envelope);s.data.set(k,JSON.stringify(envelope));assert.throws(()=>loadStagingWeekDraft(s,a));
  }
});
test('invalid/incomplete/oversized input never overwrites a saved week; quota and unavailable storage fail visibly',()=>{
  const s=store();saveStagingWeekDraft(s,a,raw(),'UTC',now);const before=[...s.data];
  const p=referenceWeekFixture();p.report.days=[];
  for(const payload of [JSON.stringify(p),'not json',' '.repeat(2_000_001)])assert.throws(()=>saveStagingWeekDraft(s,a,payload,'UTC',now));
  assert.deepEqual([...s.data],before);
  const next=JSON.stringify(referenceWeekFixture(1800));
  assert.throws(()=>saveStagingWeekDraft({...s,setItem(){throw Error('quota');}},a,next,'UTC',now),/quota/);
  assert.deepEqual([...s.data],before);
  assert.throws(()=>loadStagingWeekDraft({...s,getItem(){throw Error('unavailable');}},a),/unavailable/);
});

test('a reviewed side-dish replacement is scoped to its account, week and day on readback', () => {
  const fixture = referenceWeekFixture(1703);
  fixture.catalog.source.sha256 = '9986a8212872acd9c55849cdc8b6a8904ae508e3a815f85531b5ad16a59ec8f5';
  Object.assign(fixture.report.scenario, {enforceDailyStapleVariety: true});
  const recipeId = 'chicken_bulgur_zucchini';
  const day = fixture.report.days[0];
  const base = fixture.catalog.recipes[0];
  const original = {calories: 489.1, protein: 44.168, fat: 10.341, carbs: 57.774, fiber: 10.25};
  const rest = {calories: 389.266667, protein: 28.866667, fat: 17.466667, carbs: 31.633333, fiber: 6.2};
  const withMeal = {...base, recipeId, name: 'Курица с булгуром и кабачком',
    sourceRecipe: {...base.sourceRecipe, recipe_id: recipeId},
    referenceNutrition: {...base.referenceNutrition, values: original},
    ingredients: [
      {...base.ingredients[0], recipe_id: recipeId, ingredient_row_id: recipeId + '_ing_02', ingredient_name_ru: 'Булгур medium/coarse', weight_g: 140},
      {...base.ingredients[0], recipe_id: recipeId, ingredient_row_id: recipeId + '_ing_05', ingredient_name_ru: 'Вода', weight_g: 280, sort_order: 2},
    ],
    steps: []};
  day.meals[0] = {...day.meals[0], recipeId, name: withMeal.name, referenceNutrition: original};
  const round = (n: number) => Math.round(n * 1000) / 1000;
  for (const [i, meal] of day.meals.slice(1).entries()) {
    const values = Object.fromEntries(Object.entries(rest).map(([axis, n]) => [axis, round(n)])) as typeof original;
    meal.referenceNutrition = values;
    fixture.catalog.recipes[i+1].referenceNutrition.values = values;
  }
  day.referenceNutrition = Object.fromEntries((Object.keys(original) as (keyof typeof original)[]).map(axis =>
    [axis, day.meals.reduce((sum, meal) => sum + meal.referenceNutrition[axis], 0).toFixed(3)]));
  const savedGoal = {scope:'SAVED_POINT_TARGETS_NOT_ADMITTED_POLICY', accountId:a, calories:1703,
    protein:145, fat:65, carbs:134, updatedAt:now.toISOString(), goalRevision:null};
  const payload = JSON.stringify({...fixture, savedGoal,
    catalog: {...fixture.catalog, recipes: [withMeal, ...fixture.catalog.recipes.slice(1)]}});
  const s = store();
  const saved = saveStagingWeekDraft(s, a, payload, 'UTC', now);
  const edit = {date:day.date, recipeId, id:'quinoa', dryGrams:65} as const;
  assert.throws(() => saveStagingWeekSideDishes(s, a, saved, [{...edit,dryGrams:60}]), /TARGET/);
  assert.throws(() => saveStagingWeekSideDishes(s, a, saved, [edit,edit]), /INVALID_STAGING_SIDE_DISH/);
  assert.equal(s.writes, 1);
  const applied = saveStagingWeekSideDishes(s, a, saved, [edit], new Date(now.getTime() + 1000));
  const opened = loadStagingWeekDraft(s, a)!;
  assert.deepEqual(opened.sideDishes, [edit]);
  assert.equal(opened.view.snapshot, payload);
  const projected = projectStagingSideDishes(opened.view, opened.sideDishes);
  assert.equal(projected.days[0].referenceNutrition.calories, 1656.701);
  assert.deepEqual(projected.days.slice(1), opened.view.report.days.slice(1));
  assert.equal(loadStagingWeekDraft(s, b), null);
  assert.throws(() => saveStagingWeekSideDishes(s, a, saved, []), /STAGING_DRAFT_CHANGED/);
  assert.deepEqual(saveStagingWeekSideDishes(s, a, applied, [edit]), applied);
  assert.equal(s.writes, 2);
  assert.deepEqual(saveStagingWeekDraft(s,a,payload,'Europe/Moscow',now).sideDishes, [edit]);
  assert.deepEqual(saveStagingWeekDraft(s,a,raw(),'Europe/Moscow',now).sideDishes, []);
  assert.equal(s.data.size, 1);
});
