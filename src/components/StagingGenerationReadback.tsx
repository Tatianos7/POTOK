import {useState} from 'react';
import {readOwnGenerationOperationV2,type GenerationReadbackV2} from '../services/stagingGenerationReadbackV2';
import {isStagingGenerationProbeEnabled} from '../services/stagingGenerationProbe';

/** Only the server-created operation ID may be read. No generation, activation, or synthetic fallback. */
export default function StagingGenerationReadback({currentUserId}:{currentUserId:string}) {
  const [requestId,setRequestId]=useState('');
  const [result,setResult]=useState<GenerationReadbackV2|null>(null);
  const [loading,setLoading]=useState(false);
  if(!isStagingGenerationProbeEnabled())return null;
  async function check() {
    if(loading)return;
    setLoading(true);setResult(null);
    try {setResult(await readOwnGenerationOperationV2(currentUserId,requestId));}
    finally {setLoading(false);}
  }
  return <section className="mx-auto mt-4 w-full max-w-[560px] rounded-xl border border-sky-200 bg-white p-4" aria-label="Проверка сохранённого плана">
    <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">STAGING · реальный серверный план</p>
    <h2 className="mt-2 text-lg font-semibold text-stone-900">Статус и сохранение</h2>
    <p className="mt-2 text-sm text-stone-700">
      Когда настоящий серверный worker создаст план, здесь можно проверить его статус и подтверждение сохранения.
      Нужен идентификатор операции, выданный сервером. Синтетическая неделя выше к этой проверке не относится.
    </p>
    <label htmlFor="generation-operation-id" className="mt-3 block text-sm font-semibold text-stone-800">ID серверной операции</label>
    <input id="generation-operation-id" type="text" inputMode="text" autoCapitalize="none" spellCheck={false}
      value={requestId} onChange={e=>{setRequestId(e.target.value);setResult(null);}}
      placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx"
      className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-sm text-stone-900" />
    <button type="button" disabled={loading||!requestId.trim()} onClick={()=>{void check();}}
      className="mt-3 w-full rounded-lg border border-sky-700 bg-white px-4 py-3 text-sm font-semibold text-sky-800 disabled:opacity-50">
      {loading?'Проверяем серверный план…':'Прочитать статус операции'}
    </button>
    {result&&<div role="status" className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
      {result.kind==='status'
        ? <><p className="font-semibold">Состояние: {result.status}</p>
          <p className="mt-1">Сервер не подтвердил активный сохранённый план.</p>
          {result.reasonCode&&<p className="mt-1">Код: {result.reasonCode}</p>}</>
        : result.kind==='active'
          ? <><p className="font-semibold">Активный план подтверждён сервером</p>
             <p className="mt-1">Ревизия: <code className="break-all">{result.planRevision}</code></p>
             <p className="mt-1">Хеш графа: <code className="break-all">{result.graphDigest}</code></p>
             <a className="mt-2 inline-block font-semibold text-emerald-800 underline" href="/today">Открыть Premium Today</a></>
          : <p>{result.message}</p>}
    </div>}
    <p className="mt-3 text-xs text-stone-500">Только чтение своего серверного состояния. Проверка не создаёт план и не меняет доступ Premium.</p>
  </section>;
}
