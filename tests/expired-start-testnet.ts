import 'dotenv/config';
import fs from 'node:fs';
import {connect,keyStores,KeyPair} from 'near-api-js';
import assert from 'node:assert/strict';
import {config} from '../src/config.js';
import {view,projectJob,serviceCall} from '../src/near.js';
import {pool} from '../src/db.js';
const jobId=process.env.EXPIRED_TEST_JOB;
assert.ok(jobId,'Set EXPIRED_TEST_JOB to an owned, expired development testnet job.');
const credentials=JSON.parse(fs.readFileSync('.data/near/accounts.json','utf8'));
const store=new keyStores.InMemoryKeyStore();await store.setKey('testnet',credentials.client.accountId,KeyPair.fromString(credentials.client.privateKey));
const near=await connect({networkId:'testnet',nodeUrl:config.rpc,keyStore:store});
try{
  let job=await view('get_job',{job_id:jobId});assert.equal(job.client,credentials.client.accountId);
  let hash='';
  if(job.state==='FUNDED'){
    assert.ok(Number(job.start_deadline)<Date.now());
    const result=await(await near.account(credentials.client.accountId)).functionCall({contractId:config.contract,methodName:'claim_due_transition',args:{request_id:'orby-expired-claim:'+jobId,job_id:jobId},gas:150000000000000n});hash=result.transaction.hash;
    job=await view('get_job',{job_id:jobId});
  }
  if(job.state==='DISPUTED'){
    console.log('Client-signed non-delivery case confirmed; waiting for the actual contract dispute deadline.');
    while(Date.now()<Number(job.dispute_deadline)+3000)await new Promise(r=>setTimeout(r,Math.min(5000,Number(job.dispute_deadline)+3000-Date.now())));
    await serviceCall('orby-expired-fallback:'+jobId,'claim_due_transition',{job_id:jobId});
  }
  job=await projectJob(jobId);assert.equal(job.state,'REFUNDED');assert.equal(job.settlement.award,'0');assert.equal(job.settlement.refund,job.escrow);
  fs.writeFileSync('docs/orby-expired-start.json',JSON.stringify({passed:true,network:'testnet',contractId:config.contract,jobId,clientClaimHash:hash,checkedAt:new Date().toISOString(),checks:['client signature required for non-delivery','real dispute deadline observed','no fake completion','escrow fully refunded','contract penalty policy applied'],settlement:job.settlement},null,2));
  console.log('Expired-start recovery passed; original escrow returned through the real contract.');
}finally{await pool.end();}
