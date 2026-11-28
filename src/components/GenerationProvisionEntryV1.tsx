import {useEffect, useRef, useState} from 'react';
import {supabase} from '../lib/supabaseClient';
import type {AdaptiveNutritionReadOnlyEntryController} from '../services/adaptiveNutritionReadOnlyEntry';

type Phase = 'idle' | 'working' | 'unknown' | 'missing_goal' | 'denied' | 'conflict';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Provision the owned week only after a deliberate tap. A lost response reuses the same key. */
export function GenerationProvisionEntryV1({accountId,today,timeZone,controller}: {
  accountId:string;today:string;timeZone:string;controller:AdaptiveNutritionReadOnlyEntryController;
}) {
  const [phase,setPhase]=useState<Phase>('idle');
  const scope=JSON.stringify([accountId,today,timeZone]);
  const live=useRef(scope);
  live.current=scope;
  useEffect(()=>{live.current=scope;setPhase('idle');return ()=>{live.current='';};},[scope]);
  async function provision():Promise<void> {
    if (phase==='working') return;
    const client=supabase;
    if (!client) {setPhase('unknown');return;}
    setPhase('working');
    try {
      const {data:auth,error:authError}=await client.auth.getUser();
      if (live.current!==scope) return;
      if (authError || auth.user?.id!==accountId) {setPhase('denied');return;}
      const storageKey='potok.generation.provision.v1.'+scope;
      let key=window.sessionStorage.getItem(storageKey);
      if (key!==null && !uuid.test(key)) {setPhase('conflict');return;}
      if (key===null) {
        key=crypto.randomUUID();
        window.sessionStorage.setItem(storageKey,key);
      }
      const {data,error}=await client.rpc('adaptive_nutrition_provision_current_week_v1',{
        p_timezone:timeZone,p_idempotency_key:key,
      });
      if (live.current!==scope) return;
      if (error) {setPhase('unknown');return;}
      if (data?.kind==='missing_goal') {setPhase('missing_goal');return;}
      if (data?.kind==='denied') {setPhase('denied');return;}
      if (data?.kind==='conflict' || data?.kind==='invalid_request') {setPhase('conflict');return;}
      if (!['existing','provisioned'].includes(data?.kind)
        || data?.contract!=='adaptive-nutrition-plan-provision-v1'
        || data?.outcome!=='accepted' || !uuid.test(data?.selection_id)
        || data?.timezone!==timeZone || !['active','pending_generation'].includes(data?.status)) {
        setPhase('unknown');return;
      }
      const recheck=await client.auth.getUser();
      if (live.current!==scope) return;
      if (recheck.error || recheck.data.user?.id!==accountId) {setPhase('denied');return;}
      window.sessionStorage.removeItem(storageKey);
      await controller.start(accountId,today,timeZone);
      setPhase('idle');
    } catch {if (live.current===scope) setPhase('unknown');}
  }
  const label=phase==='working'?'Создаём неделю…'
    :phase==='unknown'?'Ответ не получен. Повторить тот же запрос'
    :'Составить меню';
  return <main className="mx-auto w-full max-w-[560px] px-5 py-10">
    <h1 className="text-xl font-semibold text-stone-950 dark:text-stone-100">Моё меню</h1>
    <p role="status" className="mt-3 text-sm text-stone-700 dark:text-stone-200">
      {phase==='missing_goal'?'Сначала установите цель питания в профиле.'
        :phase==='denied'?'Premium-доступ к меню сейчас не подтверждён.'
        :phase==='conflict'?'Параметры текущей недели изменились. Обновите экран.'
        :phase==='unknown'?'Сохранили исходный запрос, чтобы не создавать вторую неделю.'
        :'Создайте меню на текущую неделю.'}
    </p>
    {['idle','unknown'].includes(phase) && <button type="button" onClick={()=>{void provision();}}
      className="mt-4 rounded-xl bg-emerald-700 px-5 py-3 font-medium text-white">{label}</button>}
  </main>;
}
