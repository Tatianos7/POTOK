import {useState} from 'react';
import {supabase} from '../lib/supabaseClient';
import {isStagingGenerationProbeEnabled} from '../services/stagingGenerationProbe';

interface SyntheticMeal {slot:string;syntheticId:string;label:string;referenceCalories:number}
interface SyntheticDay {date:string;referenceCalories:number;meals:SyntheticMeal[]}
interface SyntheticWeek {
  contract:'potok-staging-synthetic-week-v1';
  mode:'SYNTHETIC_TEST_ONLY';
  engine:string;
  noDatabaseWrites:true;verifiedNutrition:false;realRecipes:false;mayActivate:false;notPersonalized:true;
  days:SyntheticDay[];
}
function isWeek(raw:unknown):raw is SyntheticWeek {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
  const w=raw as Partial<SyntheticWeek>;
  return w.contract==='potok-staging-synthetic-week-v1'&&w.mode==='SYNTHETIC_TEST_ONLY'&&
    w.noDatabaseWrites===true&&w.verifiedNutrition===false&&w.realRecipes===false&&
    w.mayActivate===false&&w.notPersonalized===true&&Array.isArray(w.days)&&w.days.length===7&&
    w.days.every(d=>typeof d.date==='string'&&/^\d{4}-\d\d-\d\d$/.test(d.date)&&
      typeof d.referenceCalories==='number'&&Number.isFinite(d.referenceCalories)&&
      Array.isArray(d.meals)&&d.meals.length===4&&d.meals.every(m=>typeof m.slot==='string'&&
        typeof m.syntheticId==='string'&&m.syntheticId.startsWith('SYNTH_')&&
        typeof m.label==='string'&&typeof m.referenceCalories==='number'));
}
export default function StagingSyntheticWeekDemo({currentUserId}:{currentUserId:string}) {
  const [loading,setLoading]=useState(false);
  const [week,setWeek]=useState<SyntheticWeek|null>(null);
  const [error,setError]=useState('');
  const [dayIndex,setDayIndex]=useState(0);
  if(!isStagingGenerationProbeEnabled())return null;
  async function generate() {
    if(loading)return;
    setLoading(true);setError('');setWeek(null);
    try {
      if(!supabase)throw Error('SUPABASE_NOT_CONFIGURED');
      const user=await supabase.auth.getUser();
      if(user.error||user.data.user?.id!==currentUserId)throw Error('SESSION_NOT_VERIFIED');
      const session=await supabase.auth.getSession();
      const token=session.data.session?.access_token;
      if(session.error||!token)throw Error('SESSION_NOT_VERIFIED');
      const response=await fetch('/api/staging-synthetic-week',{
        method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:'{}'
      });
      const body:unknown=await response.json().catch(()=>null);
      if(!response.ok||!isWeek(body))throw Error('SYNTHETIC_PREVIEW_FAILED');
      setWeek(body);setDayIndex(0);
    }catch{
      setError('Тестовый подбор пока недоступен. Серверный алгоритм не вернул подтверждённую демонстрационную неделю.');
    }finally{setLoading(false);}
  }
  return <section className="mx-auto mt-4 w-full max-w-[560px] rounded-xl border border-sky-200 bg-white p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">STAGING · самостоятельный тест</p>
    <h2 className="mt-2 text-lg font-semibold text-stone-900">Собрать 7 дней тестового меню</h2>
    <p className="mt-2 text-sm text-stone-700">
      Работает настоящий алгоритм подбора недельных сочетаний. Однако все 36 вариантов
      искусственные: это не блюда, не проверенные КБЖУ и не персональный рацион.
    </p>
    <button type="button" disabled={loading} onClick={()=>{void generate();}}
      className="mt-3 w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-50">
      {loading?'Подбираем 7 дней…':'Сгенерировать тестовую неделю'}
    </button>
    {error&&<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
    {week&&<div className="mt-4">
      <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">
        Синтетический результат · 7 дней · НЕ для питания · КБЖУ не подтверждены.
        В дневник и базу ничего не записано.
      </p>
      <div className="mt-3 grid grid-cols-7 gap-1" aria-label="Дни тестовой недели">
        {week.days.map((day,index)=><button key={day.date} type="button" onClick={()=>setDayIndex(index)}
          aria-pressed={dayIndex===index} className={`rounded-lg px-1 py-3 text-center text-xs font-semibold ${dayIndex===index?'bg-emerald-800 text-white':'bg-stone-100 text-stone-700'}`}>
          {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][index]}<span className="mt-1 block">{day.date.slice(8)}</span>
        </button>)}
      </div>
      <h3 className="mt-4 text-base font-semibold">Тестовый план на {week.days[dayIndex].date.split('-').reverse().join('.')}</h3>
      <p className="mt-1 text-xs text-stone-500">Условная сумма: {week.days[dayIndex].referenceCalories} ккал · только арифметический ориентир</p>
      <div className="mt-3 space-y-2">
        {week.days[dayIndex].meals.map(meal=><div key={meal.syntheticId} className="rounded-xl border border-stone-200 p-3">
          <p className="text-xs text-stone-500">{meal.slot}</p>
          <p className="mt-1 text-sm font-medium text-stone-900">{meal.label}</p>
          <p className="mt-1 text-xs text-stone-600">{meal.referenceCalories} условных ккал · {meal.syntheticId}</p>
        </div>)}
      </div>
    </div>}
    <p className="mt-3 text-xs text-stone-500">
      Это изолированный серверный тест алгоритма подбора, не запуск основного Node-worker.
      Данные пользователя и действующее Premium не изменяются.
    </p>
  </section>;
}
