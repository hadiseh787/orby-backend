import {test} from 'node:test';
import assert from 'node:assert/strict';
import {config} from '../src/config.js';
import {testnetHealth} from '../src/readiness.js';
test('readiness distinguishes missing contract, wrong RPC network and deployed contract failure',async()=>{
 const previous={contract:config.contract,rpc:config.rpc,walletRpc:config.walletRpc};try{
  config.contract='';assert.equal((await testnetHealth()).state,'NOT_CONFIGURED');config.contract='fixture.testnet';config.walletRpc=config.rpc;
  assert.equal((await testnetHealth((async()=>Response.json({result:{chain_id:'mainnet'}})) as typeof fetch)).state,'NETWORK_MISMATCH');
  const ok=(async(_url:any,request:any)=>{const b=JSON.parse(request.body);return Response.json({result:b.method==='status'?{chain_id:'testnet'}:b.params.request_type==='view_account'?{code_hash:'deployed-code'}:{result:Array.from(Buffer.from('3'))}});}) as typeof fetch;
  assert.equal((await testnetHealth(ok)).state,'CONNECTED');
  const noCode=(async(_url:any,request:any)=>{const b=JSON.parse(request.body);return Response.json({result:b.method==='status'?{chain_id:'testnet'}:{code_hash:'11111111111111111111111111111111'}});}) as typeof fetch;
  assert.equal((await testnetHealth(noCode)).state,'UNAVAILABLE');
 }finally{Object.assign(config,previous);}
});

test('readiness retries a transient RPC response before reporting actual connectivity',async()=>{const previous={contract:config.contract,serviceAccount:config.serviceAccount,serviceKey:config.serviceKey,rpc:config.rpc,walletRpc:config.walletRpc};try{config.contract='fixture.testnet';config.serviceAccount='';config.serviceKey='';config.walletRpc=config.rpc;let calls=0;const flaky=(async(_url:any,request:any)=>{calls++;if(calls===1)return Response.json({message:'Temporary provider failure'},{status:503});const b=JSON.parse(request.body);return Response.json({result:b.method==='status'?{chain_id:'testnet'}:b.params.request_type==='view_account'?{code_hash:'deployed-code'}:{result:Array.from(Buffer.from('3'))}});}) as typeof fetch;assert.equal((await testnetHealth(flaky)).state,'CONNECTED');assert.equal(calls,4);}finally{Object.assign(config,previous)}});
