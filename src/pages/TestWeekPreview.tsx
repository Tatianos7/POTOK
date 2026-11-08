import {useState} from 'react';

type Meal={slot:string;recipeId:string;recipeName:string;sourceCategory:string;referenceOnly:true};
type Day={date:string;referenceCalories:string;meals:Meal[]};
type Packet={contract:string;status:string;weekStart:string;days:Day[];sourceApproved:false;runtimePublishable:false;canApply:false;mayActivate:false};
function valid(raw:unknown):raw is Packet {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const p=raw as Record<string,unknown>;
 if(p.contract!=='potok-reference-test-week-display-v1'||p.status!=='REFERENCE_ONLY_TEST_WEEK'
  ||p.sourceApproved!==false||p.runtimePublishable!==false||p.canApply!==false||p.mayActivate!==false
  ||typeof p.weekStart!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.weekStart)
  ||!Array.isArray(p.days)||p.days.length!==7)return false;
 const seen=new Set<string>();
 return p.days.every(d=>{
  if(!d||typeof d!=='object'||typeof d.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||seen.has(d.date)
   ||typeof d.referenceCalories!=='string'||!/^\d+(?:\.\d+)?$/.test(d.referenceCalories)
   ||!Array.isArray(d.meals)||d.meals.length!==4)return false;
  seen.add(d.date);
  return d.meals.every((m:unknown)=>{if(!m||typeof m!=='object')return false;
   const v=m as Record<string,unknown>;
   return typeof v.slot==='string'&&typeof v.recipeId==='string'&&typeof v.recipeName==='string'
    &&typeof v.sourceCategory==='string'&&v.referenceOnly===true;});
 });
}
export default function TestWeekPreview(){
 const [packet,setPacket]=useState<Packet|null>(null);
 const [error,setError]=useState('');
 const [selected,setSelected]=useState(0);
 async function open(file:File|undefined){
  setPacket(null);setSelected(0);setError('');
  if(!file)return;
  if(file.size>300_000){setError('Файл слишком большой');return;}
  try{
   const raw=JSON.parse(await file.text()) as unknown;
   if(!valid(raw))throw Error('INVALID');
   setPacket(raw);
  }catch{setError('Неверный формат тестовой недели. Данные не загружены.');}
 }
 return <main className="mx-auto max-w-xl p-5 space-y-5">
  <header className="space-y-2"><h1 className="text-2xl font-semibold">Тест недели питания</h1>
   <p className="text-sm text-amber-700">Только предварительный просмотр. КБЖУ не проверены, аллергены не оценены. Не является планом питания и не сохраняется в дневник.</p></header>
  <label className="block rounded-xl border p-4 space-y-2"><span className="block font-medium">Открыть тестовую неделю (JSON)</span>
   <input aria-label="Открыть тестовую неделю" type="file" accept=".json,application/json" onChange={e=>void open(e.target.files?.[0])}/></label>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {packet&&<section className="space-y-4">
   <p className="text-sm">Неделя с {packet.weekStart}. Данные только для проверки интерфейса.</p>
   <div className="flex gap-2 overflow-x-auto" aria-label="Выбор дня">{packet.days.map((day,i)=>
    <button key={day.date} type="button" aria-pressed={selected===i} onClick={()=>setSelected(i)}
     className={`rounded-lg border px-3 py-2 text-sm ${selected===i?'bg-emerald-100 border-emerald-600':'bg-white'}`}>
     {new Date(day.date+'T12:00:00Z').toLocaleDateString('ru-RU',{weekday:'short',day:'numeric'})}</button>)}</div>
   <h2 className="font-semibold">{packet.days[selected].date} · ~{packet.days[selected].referenceCalories} ккал (справочно)</h2>
   <div className="space-y-3">{packet.days[selected].meals.map((meal,i)=>
    <article key={meal.slot+'-'+i} className="rounded-xl border p-4">
     <p className="text-xs uppercase opacity-70">{meal.slot}</p>
     <h3 className="font-medium">{meal.recipeName}</h3>
     <p className="text-xs opacity-70">Рецепт: {meal.recipeId} · порция не проверена</p>
    </article>)}</div>
  </section>}
 </main>;
}
