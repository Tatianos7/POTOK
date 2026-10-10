/** TEST HARNESS ONLY. Loopback proxy to this process's private Unix PG socket.
 * Fixed PostgreSQL protocol fault modes, no RPC/SQL execution surface. Never logs
 * auth packets, JWTs, startup credentials or BackendKeyData cancellation secret. */
import net from 'node:net';
import assert from 'node:assert/strict';
export type FaultMode='HOLD_COMMIT'|'BEFORE_COMMIT'|'COMMIT_IN_FLIGHT'|'AFTER_SQL_RESULT';
export interface WireFault {
 mode:FaultMode; marker:string; events:string[]; backendPid:number|null;
 reached:Promise<void>; release:()=>void;
}
export async function pgWireFaultProxy(socketPath:string) {
 const sockets=new Set<net.Socket>();let armed:WireFault|null=null;
 let errorSequence=0;
 const nativeErrors:{sequence:number;code:string;routine:string;business:boolean;pid:number|null}[]=[];
 const server=net.createServer(front=>{
  const back=net.createConnection(socketPath);sockets.add(front);sockets.add(back);
  front.on('error',()=>{});back.on('error',()=>{front.destroy();});
  front.on('close',()=>{back.destroy();sockets.delete(front);});
  back.on('close',()=>{front.destroy();sockets.delete(back);});
  let startup=true,fb=Buffer.alloc(0),bb=Buffer.alloc(0),pid:number|null=null;
  let active:WireFault|null=null,sqlResult=false,executed='';
  const statements=new Map<string,string>(),portals=new Map<string,{query:string;target:boolean}>();
  const cstring=(b:Buffer,offset=0)=>{const end=b.indexOf(0,offset);assert.ok(end>=offset);return {text:b.subarray(offset,end).toString('utf8'),next:end+1};};
  const drop=()=>{active?.events.push('disconnect');front.destroy();back.destroy();};
  const writeFront=(frame:Buffer)=>{if(!front.destroyed)front.write(frame);};
  front.on('data',(part:Buffer)=>{
   fb=Buffer.concat([fb,part]);
   while(fb.length>=(startup?4:5)){
    const size=fb.readInt32BE(startup?0:1)+(startup?0:1);
    if(size<4||size>16*1024*1024){drop();return;}if(fb.length<size)return;
    const frame=fb.subarray(0,size);fb=fb.subarray(size);
    if(startup){
     // libpq may negotiate SSL/GSS before StartupMessage. Our OWN loopback
     // fixture has no encryption; reject negotiation explicitly rather than
     // misparse PostgreSQL's single-byte N as a framed backend message.
     if(size===8&&[80877103,80877104].includes(frame.readInt32BE(4))){front.write('N');continue;}
     startup=false;back.write(frame);continue;
    }
    const type=String.fromCharCode(frame[0]),body=frame.subarray(5);let query='',target=false;
    if(type==='Q')query=cstring(body).text;
    if(type==='P'){const name=cstring(body);const sql=cstring(body,name.next).text;statements.set(name.text,sql);}
    if(type==='B'){const portal=cstring(body),statement=cstring(body,portal.next);portals.set(portal.text,{query:statements.get(statement.text)??'',target:armed!==null&&body.includes(Buffer.from(armed.marker))});}
    if(type==='E'){const portal=portals.get(cstring(body).text);query=portal?.query??'';target=portal?.target??false;}
    if(type==='Q')target=armed!==null&&query.includes(armed.marker);
    if(query){executed=query;if(/"?catalog_(private_food|import_batch)_v1"?\s*\(/.test(query)&&armed&&target&&!active){active=armed;armed=null;sqlResult=false;active.backendPid=pid;active.events.push('rpc_started');}}
    if(active&&sqlResult&&/^(COMMIT|END)\s*;?\s*$/i.test(query.trim())){
     active.events.push('commit_requested');
     if(active.mode==='BEFORE_COMMIT'){active.release();drop();return;}
     if(active.mode==='HOLD_COMMIT'){active.release=()=>{if(!back.destroyed){active?.events.push('commit_forwarded');back.write(frame);}};active.events.push('commit_held');(active as WireFault&{signal:()=>void}).signal();continue;}
     active.events.push('commit_forwarded');
    }
    back.write(frame);
   }
  });
  back.on('data',(part:Buffer)=>{
   bb=Buffer.concat([bb,part]);while(bb.length>=5){const size=bb.readInt32BE(1)+1;if(size<5||size>16*1024*1024){drop();return;}if(bb.length<size)return;
    const frame=bb.subarray(0,size);bb=bb.subarray(size);const type=String.fromCharCode(frame[0]);
    if(type==='K'){pid=frame.readInt32BE(5);if(active)active.backendPid=pid;}
    if(type==='E'){
     const fields=new Map<string,string>();const body=frame.subarray(5);let offset=0;
     while(offset<body.length&&body[offset]!==0){const key=String.fromCharCode(body[offset++]);const value=cstring(body,offset);offset=value.next;fields.set(key,value.text);}
     // Only protocol-native discriminators; no messages/context/keys/JWTs retained.
     nativeErrors.push({sequence:++errorSequence,code:fields.get('C')??'',routine:fields.get('R')??'',business:fields.get('D')==='POTOK_BUSINESS_CONFLICT_V1',pid});
     if(nativeErrors.length>256)nativeErrors.shift();
    }
    if(active&&type==='C'){
     const tag=cstring(frame.subarray(5)).text;
     if(/"?catalog_(private_food|import_batch)_v1"?\s*\(/.test(executed)&&!sqlResult){sqlResult=true;active.events.push('sql_result');
      if(active.mode==='AFTER_SQL_RESULT'){(active as WireFault&{signal:()=>void}).signal();drop();return;}}
     if(tag==='COMMIT'){
      active.events.push('commit_completed');
      if(active.mode==='COMMIT_IN_FLIGHT'){(active as WireFault&{signal:()=>void}).signal();drop();return;}
      active=null;
     }
    }
    writeFront(frame);
   }
  });
 });
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const address=server.address();assert.ok(address&&typeof address==='object');
 return {port:address.port,nativeErrors:()=>nativeErrors.map(e=>({...e})),arm:(mode:FaultMode,marker:string):WireFault=>{
  assert.equal(armed,null,'one armed fault at a time');let signal!:()=>void;
  const fault:WireFault&{signal:()=>void}={mode,marker,events:[],backendPid:null,reached:new Promise<void>(r=>{signal=r;}),release:()=>signal(),signal:()=>signal()};armed=fault;return fault;
 },close:async()=>{for(const socket of sockets)socket.destroy();await new Promise<void>(r=>server.close(()=>r()));}};
}
