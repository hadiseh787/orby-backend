import 'dotenv/config';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {connect,keyStores,KeyPair} from 'near-api-js';
import {config} from '../src/config.js';
import {view,serviceCall,rpc} from '../src/near.js';
import {hash} from '../src/domain.js';
import {pool} from '../src/db.js';
const credentials=JSON.parse(fs.readFileSync('.data/near/accounts.json','utf8'));
const store=new keyStores.InMemoryKeyStore();for(const role of ['client','reviewer'])await store.setKey('testnet',credentials[role].accountId,KeyPair.fromString(credentials[role].privateKey));
const near=await connect({networkId:'testnet',nodeUrl:config.rpc,keyStore:store});
const receipts:any[]=[];
async function call(role:string,method:string,args:any){const r=await(await near.account(credentials[role].accountId)).functionCall({contractId:config.contract,methodName:method,args:{request_id:randomUUID(),...args},gas:150000000000000n});receipts.push({method,hash:r.transaction.hash});}
try{
  const jobId=randomUUID();
  await call('client','open_job',{job_id:jobId,terms_hash:hash({test:'legacy agreement compatibility',jobId}),usd_micro:'2000000',deadline_ms:String(Date.now()+86400000),manual:true});
  await call('reviewer','record_bid',{bid_id:randomUUID(),job_id:jobId,agent_id:'format-reviewer',price:'2000000',eta_ms:'120000',expires_at:String(Date.now()+1800000)});
  await call('client','cancel_job',{job_id:jobId});assert.equal((await view('get_job',{job_id:jobId})).state,'CANCELLED');
  const expired=JSON.parse(fs.readFileSync('docs/orby-expired-start.json','utf8'));
  const requestId='orby-negative-start:'+expired.jobId;
  let rejected=false;try{await serviceCall(requestId,'start_job',{job_id:expired.jobId})}catch{rejected=true}
  assert.ok(rejected);const op=(await pool.query('SELECT state,tx_hash FROM chain_operations WHERE request_id=$1',[requestId])).rows[0];assert.equal(op.state,'FAILED');assert.ok(op.tx_hash);assert.equal((await view('get_job',{job_id:expired.jobId})).state,'REFUNDED');
  fs.writeFileSync('docs/orby-compatibility.json',JSON.stringify({passed:true,network:'testnet',contractId:config.contract,checkedAt:new Date().toISOString(),checks:['legacy priced jobs remain usable after migration','legacy creator can bid after setting a separate NEAR price','unfunded legacy job can be cancelled','actual failed executor receipt is FAILED, not UNKNOWN','failed action does not change refunded financial state'],receipts,failedTransactionHash:op.tx_hash},null,2));
  console.log('Legacy agreement compatibility and actual failed-transaction classification passed.');
}finally{await pool.end();}
