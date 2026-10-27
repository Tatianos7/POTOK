import {createServer as tcpServer} from 'node:net';
import {createServer as httpServer} from 'node:http';
export function createMailCapture(allowed){
 if(allowed.length!==2||new Set(allowed).size!==2||!allowed.every(s=>/^potok-ab-[a-f0-9]+-[ab]@example\.test$/.test(s)))throw Error('Invalid synthetic recipients');
 const codes=new Map(),counts=new Map(),sockets=new Set();let rejected=0;
 const smtp=tcpServer(socket=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.setEncoding('utf8');socket.setTimeout(30000,()=>socket.destroy());let buffer='',data=false,lines=[],bytes=0,to=[];
  const reply=s=>socket.write(s+'\r\n');reply('220 potok-private ESMTP');
  socket.on('error',()=>{});socket.on('data',chunk=>{
   buffer+=chunk;if(buffer.length>65536){socket.destroy();return;}
   for(let i;(i=buffer.indexOf('\n'))>=0;){const line=buffer.slice(0,i).replace(/\r$/,'');buffer=buffer.slice(i+1);
    if(data){
     if(line==='.'){
      const message=lines.join('\r\n').replace(/=\r?\n/g,'').replace(/=([A-Fa-f0-9]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
      const match=message.match(/POTOK_OTP_BEGIN([0-9]{6})POTOK_OTP_END/);data=false;lines=[];bytes=0;
      if(to.length!==1||!match){reply('554 Invalid test message');}else{const recipient=to[0];codes.set(recipient,match[1]);counts.set(recipient,(counts.get(recipient)??0)+1);reply('250 Captured locally');}to=[];
     }else{bytes+=line.length;if(bytes>65536){socket.destroy();return;}lines.push(line.startsWith('..')?line.slice(1):line);}continue;
    }
    if(/^(EHLO|HELO)\b/i.test(line)){reply('250-potok-private');reply('250 SIZE 65536');}
    else if(/^MAIL FROM:/i.test(line)){to=[];reply('250 OK');}
    else if(/^RCPT TO:/i.test(line)){const address=line.match(/^RCPT TO:\s*<([^>]+)>/i)?.[1]?.toLowerCase();if(!allowed.includes(address)||to.length){rejected++;reply('550 Synthetic recipients only');}else{to.push(address);reply('250 OK');}}
    else if(/^DATA$/i.test(line)){if(to.length===1){data=true;reply('354 End with dot');}else reply('503 Recipient required');}
    else if(/^RSET$/i.test(line)){to=[];data=false;lines=[];bytes=0;reply('250 OK');}
    else if(/^NOOP$/i.test(line))reply('250 OK');
    else if(/^QUIT$/i.test(line)){reply('221 Bye');socket.end();}
    else reply('502 Unsupported');
   }
  });
 });
 const http=httpServer((req,res)=>{
  if(req.method==='GET'&&req.url==='/template'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<p>POTOK_OTP_BEGIN{{ .Token }}POTOK_OTP_END</p>');}
  else{res.statusCode=404;res.end();}
 });
 return {smtp,http,codes,counts,get rejected(){return rejected;},async start(){await Promise.all([new Promise((r,j)=>{smtp.once('error',j);smtp.listen(11025,'127.0.0.1',r);}),new Promise((r,j)=>{http.once('error',j);http.listen(13003,'127.0.0.1',r);})]);},async close(){for(const s of sockets)s.destroy();http.closeAllConnections();await Promise.all([new Promise(r=>smtp.close(r)),new Promise(r=>http.close(r))]);}};
}
export async function runABWorker(){
 const emails=[process.env.TEST_EMAIL_A,process.env.TEST_EMAIL_B],capture=createMailCapture(emails),users=[];let stage='capture-start';
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const check=(v)=>{if(!v)throw Error('Check failed');};
 async function auth(route,body,token){const r=await fetch('http://127.0.0.1:13002/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(10000)});return {status:r.status,body:await r.json()};}
 async function api(route,user,method='GET',body){const r=await fetch('http://127.0.0.1:33001/'+route,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+user.token,Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(10000)});const t=await r.text();return{status:r.status,body:t?JSON.parse(t):null};}
 try{
  await capture.start();console.log('PRIVATE_AB_CAPTURE_READY');stage='auth-ready';let ready=false;
  for(let i=0;i<40;i++){try{const r=await auth('health');if(r.status===200&&r.body.version==='v2.197.0'){ready=true;break;}}catch{}await sleep(500);}check(ready);
  for(let i=0;i<emails.length;i++){
   stage='otp-request-'+i;const r=await auth('otp',{email:emails[i],create_user:true});check(r.status===200);
   stage='otp-delivery-'+i;for(let n=0;!capture.codes.has(emails[i])&&n<40;n++)await sleep(100);const code=capture.codes.get(emails[i]);check(/^[0-9]{6}$/.test(code??''));capture.codes.delete(emails[i]);
   stage='otp-verify-'+i;const verified=await auth('verify',{email:emails[i],token:code,type:'email'});check(verified.status===200&&typeof verified.body.access_token==='string');const id=verified.body.user?.id;check(/^[a-f0-9-]{36}$/.test(id??''));check(verified.body.user.email===emails[i]);
   const user={id,token:verified.body.access_token};users.push(user);const current=await auth('user',undefined,user.token);check(current.status===200&&current.body.id===id);
  }
  check(users[0].id!==users[1].id);console.log('PRIVATE_AB_OTP_OK');
  for(let i=0;i<users.length;i++){
   const u=users[i];stage='profile-create-'+i;check((await api('user_profiles',u,'POST',{id_user:u.id})).status===201);
   stage='profile-update-'+i;const changed=await api('user_profiles?id_user=eq.'+u.id,u,'PATCH',{first_name:'POTOK synthetic '+i});check(changed.status===200&&changed.body.length===1);
   stage='own-profile-'+i;const own=await api('user_profiles?select=id_user,first_name,is_admin,has_premium',u);check(own.status===200&&own.body.length===1&&own.body[0].id_user===u.id&&own.body[0].first_name==='POTOK synthetic '+i&&own.body[0].is_admin===false&&own.body[0].has_premium===false);
   const other=users[1-i];stage='foreign-read-'+i;const read=await api('user_profiles?id_user=eq.'+other.id,u);check(read.status===200&&read.body.length===0);
   stage='foreign-update-'+i;const update=await api('user_profiles?id_user=eq.'+other.id,u,'PATCH',{first_name:'must-not-save'});check(update.status===200&&update.body.length===0);
   for(const [field,value] of [['is_admin',true],['has_premium',true],['created_at','2026-01-01T00:00:00Z'],['updated_at','2026-01-01T00:00:00Z']]){stage='protected-'+field+'-'+i;const denied=await api('user_profiles?id_user=eq.'+u.id,u,'PATCH',{[field]:value});check([401,403].includes(denied.status)&&denied.body?.code==='42501');}
   for(const capability of ['admin','premium']){stage='authority-'+capability+'-'+i;const r=await api('rpc/has_verified_entitlement_v1',u,'POST',{p_capability:capability});check(r.status===200&&r.body===false);}
  }
  stage='final-own-state';for(let i=0;i<users.length;i++){const r=await api('user_profiles?id_user=eq.'+users[i].id,users[i]);check(r.status===200&&r.body.length===1&&r.body[0].first_name==='POTOK synthetic '+i&&!r.body[0].is_admin&&!r.body[0].has_premium);}
  stage='mail-scope';check(capture.rejected===0&&emails.every(e=>capture.counts.get(e)===1));
  console.log('PRIVATE_AUTH_AB_HTTP_OK');console.log(JSON.stringify({users:users.map((u,i)=>({id:u.id,email:emails[i]})),mailCount:2}));
 }catch{console.error('PRIVATE_AUTH_AB_HTTP_FAILED: stage='+stage);process.exitCode=1;}
 finally{capture.codes.clear();await capture.close();}
}
