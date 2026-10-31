import {useEffect,useMemo,useState} from 'react';
import {GenerationRequestFlowV2,type GenerationFlowStateV2} from '../services/generationRequestFlowV2';
import {GenerationPlanMenuViewV2} from './GenerationPlanMenuV2';

export function GenerationFlowViewV2({state,onStart,onRefresh}:{
  state:GenerationFlowStateV2;onStart:()=>void;onRefresh:()=>void;
}) {
  if(state.phase==='ready' && state.entry.phase==='ready')return <GenerationPlanMenuViewV2 state={state.entry}/>;
  const busy=['requesting','checking','opening'].includes(state.phase);
  const message=state.phase==='idle'?'Составим меню на неделю с учётом твоей цели.'
    :state.phase==='requesting'?'Отправляем запрос на подготовку меню…'
    :state.phase==='pending'?'Меню готовится. Можно проверить результат чуть позже.'
    :state.phase==='checking'?'Проверяем состояние запроса…'
    :state.phase==='opening'?'Загружаем подтверждённое меню…'
    :state.phase==='unknown'?'Ответ сервера не получен. Проверим тот же запрос, чтобы не создавать повторный план.'
    :state.phase==='rejected'?'Сервер не смог подготовить меню по текущим данным.'
    :state.phase==='conflict'?'Исходные данные изменились. Это меню не было включено.'
    :state.phase==='denied'?'Доступ к меню сейчас не подтверждён.'
    :'Подтверждённое меню сейчас недоступно.';
  const canRefresh=state.phase==='pending'||state.phase==='unknown'||(state.phase==='unavailable'&&state.requestOperationId!==null);
  return <section className="mx-auto max-w-xl space-y-4 p-5 text-stone-950 dark:text-stone-100" aria-label="Подготовка меню">
    <h1 className="text-2xl font-semibold">Моё меню</h1>
    <p role="status">{message}</p>
    {state.phase==='idle' && <button type="button" onClick={onStart} className="rounded-xl bg-emerald-700 px-5 py-3 font-medium text-white">Составить меню</button>}
    {(canRefresh||busy) && <button type="button" disabled={busy} onClick={onRefresh} className="rounded-xl bg-emerald-700 px-5 py-3 font-medium text-white disabled:opacity-50">{busy?'Подождите…':'Проверить результат'}</button>}
  </section>;
}
/** Prepared explicit-action flow. Importing/mounting does not itself request a plan; default transport is disabled. */
export function GenerationRequestFlowEntryV2({accountId,today,timeZone,controller}:{
  accountId:string;today:string;timeZone:string;controller?:GenerationRequestFlowV2;
}) {
  const active=useMemo(()=>controller??new GenerationRequestFlowV2(),[controller]);
  const scope=JSON.stringify([accountId,today,timeZone]);
  const [bound,setBound]=useState<{scope:string;state:GenerationFlowStateV2}|null>(null);
  useEffect(()=>{
    active.attach(accountId,today,timeZone);
    const unsubscribe=active.subscribe(state=>setBound({scope,state}));
    return ()=>{unsubscribe();active.stop();};
  },[active,accountId,today,timeZone,scope]);
  const state:GenerationFlowStateV2=bound?.scope===scope?bound.state:{phase:'checking',requestOperationId:null,entry:{phase:'idle',model:null,slots:[]}};
  return <GenerationFlowViewV2 state={state} onStart={()=>{void active.start();}} onRefresh={()=>{void active.refresh();}}/>;
}
