import {config} from '../src/config.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildAgent} from '../src/agent-server.js';
import {signRuntime} from '../src/runtime.js';
test('HTTP runtime accepts signed asynchronous runs once and rejects nonce replay',async()=>{
 const previousModel=config.model;config.model='';
 const app=await buildAgent('brief-writer','test-runtime-secret');await app.ready();
 const body={runId:'http-test:'+randomUUID(),input:{sources:[{id:'source-one',text:'A source supplied by the client.'}]}};
 const signed=(method:string,path:string,data:any)=>{const timestamp=String(Date.now()),nonce=randomUUID();return {'x-runtime-timestamp':timestamp,'x-runtime-nonce':nonce,'x-runtime-signature':signRuntime('test-runtime-secret',method,path,timestamp,nonce,data)};};
 try{
  assert.equal((await app.inject({url:'/health'})).statusCode,200);
  const headers=signed('POST','/runs',body);const accepted=await app.inject({method:'POST',url:'/runs',headers,payload:body});assert.equal(accepted.statusCode,202);
  assert.equal((await app.inject({method:'POST',url:'/runs',headers,payload:body})).statusCode,401);
  const duplicate=await app.inject({method:'POST',url:'/runs',headers:signed('POST','/runs',body),payload:body});assert.equal(duplicate.statusCode,202);
  let status:any;const path='/runs/'+encodeURIComponent(body.runId);for(let i=0;i<20;i++){const r=await app.inject({url:path,headers:signed('GET',path,{})});status=r.json();if(status.status==='SUCCEEDED')break;await new Promise(r=>setTimeout(r,20));}assert.equal(status.status,'SUCCEEDED');assert.equal(status.content.sources[0],'source-one');assert.ok(status.artifactHash);
  const changed={...body,input:{sources:[{id:'altered',text:'Changed payload.'}]}};const conflict=await app.inject({method:'POST',url:'/runs',headers:signed('POST','/runs',changed),payload:changed});assert.equal(conflict.json().code,'IDEMPOTENCY_CONFLICT');
 }finally{config.model=previousModel;await app.close();}
});
