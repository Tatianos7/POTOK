import {createClient} from '@supabase/supabase-js';
import {STAGING_ORIGIN,validPublicKey,createAcceptanceFlow} from './flow.mjs';
import './style.css';
const key=__POTOK_STAGING_PUBLIC_KEY__;
const $=id=>document.getElementById(id);
const messages={BUSY:'Проверка уже выполняется.',COOLDOWN:'Подожди минуту перед повторной отправкой.',EMAIL_REQUIRED:'Укажи отдельный тестовый email и подтверди создание аккаунта.',DELIVERY_UNAVAILABLE:'Письмо отправить не удалось. Настройки доставки ещё нужно проверить.',RATE_LIMIT:'Сервис ограничил отправку. Подожди перед новой попыткой.',CODE_INVALID:'Введи цифровой код из письма.',CODE_REJECTED:'Код не принят. Проверь код или запроси новый после паузы.',SESSION_UNVERIFIED:'Подтвердить сессию на сервере не удалось.',RIGHTS_UNVERIFIED:'Права обычного аккаунта не подтверждены. Проверка остановлена.',RPC_UNVERIFIED:'Закрытый доступ не подтверждён. Ничего включать не будем.',SIGNOUT_UNCONFIRMED:'Завершение сессии не подтверждено. Закрой вкладку и сообщи об этом.',STATE_INVALID:'Сначала начни проверку заново в новой вкладке.'};
let flow;
function render(){
 const s=flow.summary();
 $('email-step').hidden=!['email','code'].includes(s.phase);
 $('code-step').hidden=s.phase!=='code';
 $('result').hidden=!s.report;
 $('finish').hidden=!['checks','done'].includes(s.phase);
 $('send').disabled=s.busy||s.resendIn>0||!$('consent').checked;
 $('send').textContent=s.resendIn>0?`Повторить через ${s.resendIn} с`:(s.phase==='code'?'Отправить ещё раз':'Получить код');
 $('email').disabled=s.busy||s.phase==='code';
 $('verify').disabled=s.busy;
 $('finish').disabled=s.busy;
 if(s.report){
  $('session-result').textContent=s.report.sessionVerified?'Сессия подтверждена сервером':'Сессия не подтверждена';
  $('rights-result').textContent=s.report.normalRights?'Admin и Premium не выданы':'Права ещё не проверены';
  $('rpc-result').textContent=`Закрытые серверные вызовы: ${s.report.closedRpcCount} из 7`;
  $('server-result').textContent='Запись состояния аккаунта отдельно проверит разработчик в Staging.';
 }
 $('done').hidden=s.phase!=='closed';
}
async function act(fn){
 $('message').textContent='';
 try{const p=fn();render();await p;}catch(error){$('message').textContent=messages[error?.message]??'Проверку завершить не удалось. Подробности с секретами не сохраняются.';}
 finally{$('code').value='';render();}
}
if(!validPublicKey(key)){
 $('message').textContent='Тестовый экран ещё не настроен. Запросы не отправляются.';
 $('email-step').hidden=true;
}else if(!window.isSecureContext){
 $('message').textContent='Для проверки нужен защищённый HTTPS-адрес.';
 $('email-step').hidden=true;
}else{
 const client=createClient(STAGING_ORIGIN,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'potok-staging-auth-check-v1'}});
 flow=createAcceptanceFlow({client});
 $('send').addEventListener('click',()=>act(()=>flow.send($('email').value,$('consent').checked)));
 $('verify').addEventListener('click',()=>act(()=>flow.verify($('code').value)));
 $('finish').addEventListener('click',()=>act(()=>flow.finish()));
 $('consent').addEventListener('change',render);
 setInterval(render,1000);render();
}
