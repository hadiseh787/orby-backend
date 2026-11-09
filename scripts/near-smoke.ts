import 'dotenv/config';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {connect,keyStores,KeyPair} from 'near-api-js';
import {buildApp} from '../src/server.js';
import {messageDigest} from '../src/auth.js';
import {tickNear,view} from '../src/near.js';
import {pool} from '../src/db.js';
import {config} from '../src/config.js';
import assert from 'node:assert/strict';
assert.ok(config.contract,'Run near:deploy successfully first.');
const credentials=JSON.parse(await readFile('.data/near/accounts.json','utf8'));
const store=new keyStores.InMemoryKeyStore();
for(const c of Object.values(credentials)as any[])await store.setKey('testnet',c.accountId,KeyPair.fromString(c.privateKey));
const near=await connect({networkId:'testnet',nodeUrl:config.rpc,keyStore:store});
const app=await buildApp();await app.ready();const receipts:any[]=[];
async function signIn(role:string){
 const challenge=(await app.inject({method:'POST',url:'/api/v1/auth/challenge'})).json(),c=credentials[role];
 const key=KeyPair.fromString(c.privateKey),sig=key.sign(messageDigest(challenge.message,Buffer.from(challenge.nonce,'base64'),challenge.recipient,challenge.callbackUrl));
 const response=await app.inject({method:'POST',url:'/api/v1/auth/verify',payload:{challengeId:challenge.id,accountId:c.accountId,publicKey:c.publicKey,signature:Buffer.from(sig.signature).toString('base64')}});
 assert.equal(response.statusCode,200,response.body);return {cookie:response.headers['set-cookie']!.toString().split(';')[0],csrf:response.json().csrf,role};
}
async function get(session:any,path:string){const r=await app.inject({url:'/api/v1'+path,headers:{cookie:session.cookie}});assert.equal(r.statusCode,200,r.body);return r.json();}
async function post(session:any,path:string,body:any={}){
 const r=await app.inject({method:'POST',url:'/api/v1'+path,headers:{cookie:session.cookie,'x-csrf-token':session.csrf,'idempotency-key':randomUUID()},payload:body});assert.equal(r.statusCode,200,r.body);const result=r.json();
 if(result.operation){const op=result.operation,account=await near.account(credentials[session.role].accountId);const outcome=await account.functionCall({contractId:op.receiverId,methodName:op.methodName,args:op.args,attachedDeposit:BigInt(op.attachedDepositYocto),gas:BigInt(op.gas)});receipts.push({method:op.methodName,hash:outcome.transaction.hash});let reconciled:any;for(let n=0;n<3;n++){const verified=await app.inject({method:'POST',url:'/api/v1/operations/'+op.operationId+'/transaction',headers:{cookie:session.cookie,'x-csrf-token':session.csrf,'idempotency-key':randomUUID()},payload:{txHash:outcome.transaction.hash}});assert.equal(verified.statusCode,200,verified.body);reconciled=verified.json();if(reconciled.state==='CONFIRMED')break;await new Promise(r=>setTimeout(r,1500));}assert.equal(reconciled.state,'CONFIRMED');}
 return result;
}
try{
 const client=await signIn('client'),writer=await signIn('writer');console.log('Verified real NEP-413 testnet sessions.');
 const resumeJob=process.argv[process.argv.indexOf('--resume-job')+1];const resuming=process.argv.includes('--resume-job');const j=resuming?await get(client,'/jobs/'+resumeJob):await post(client,'/jobs',{title:'Testnet end-to-end comparison',description:'Compare supplied source text and produce an evidence-linked brief.',category:'writing',nearYocto:'4000000000000000000000000',deadlineMinutes:2880,approvalPolicy:'MANUAL_APPROVAL',input:{sources:[{id:'a',text:'Proposal A: six weeks, detailed technical plan.'},{id:'b',text:'Proposal B: four weeks, user testing included.'},{id:'c',text:'Proposal C: twelve weeks, broad scope.'}]},criteria:[{id:'keys',type:'AUTO_CHECK',required:true,description:'Required comparison fields',config:{check:'json-required-keys',keys:['comparison','recommendation','sources']}},{id:'client',type:'CLIENT_APPROVE',required:true,description:'The recommendation addresses the brief.'}]});
 console.log('Root job opened on chain:',j.id);
 if(!resuming){await post(client,'/jobs/'+j.id+'/bids/request');await tickNear();}let detail=await get(client,'/jobs/'+j.id);const bid=detail.bids.find((b:any)=>b.agentId==='brief-writer');assert.ok(bid,'Missing executor-signed writer bid.');
 if(!resuming){const p=await post(client,'/jobs/'+j.id+'/funding-preview',{bidId:bid.id});await post(client,'/jobs/'+j.id+'/fund',{previewId:p.id});console.log('Real testnet escrow funded.');}else{receipts.push(...(await pool.query("SELECT proposal->>'methodName' AS method,tx_hash AS hash FROM chain_operations WHERE job_id=$1 AND state='CONFIRMED' AND tx_hash IS NOT NULL ORDER BY created_at",[j.id])).rows);}
 for(let n=0;n<60;n++){
  await tickNear();detail=await get(client,'/jobs/'+j.id);console.log('Execution:',detail.state,'children:',detail.children.map((c:any)=>c.state).join(','));
  if(detail.state==='REVIEW_OPEN'&&detail.children.length===1&&detail.children.every((c:any)=>c.state==='SETTLED'))break;
  await new Promise(r=>setTimeout(r,5000));
 }
 assert.equal(detail.state,'REVIEW_OPEN');assert.equal(detail.children[0].state,'SETTLED');assert.ok(detail.deliveries.length);
 let legacyRejected=false;try{await(await near.account(credentials.client.accountId)).functionCall({contractId:config.contract,methodName:'approve_job',args:{request_id:'legacy-reject-'+j.id,job_id:j.id},gas:100000000000000n});}catch(e:any){assert.equal(e.type,'ActionError');legacyRejected=true;}assert.ok(legacyRejected);assert.equal((await view('get_job',{job_id:j.id})).state,'REVIEW_OPEN');
 await post(client,'/jobs/'+j.id+'/approve',{revision:detail.deliveries[0].revision,deliveryHash:detail.deliveries[0].hash});const final=await view('get_job',{job_id:j.id});assert.equal(final.state,'SETTLED');
 const accounting=final.settlement;assert.equal(BigInt(final.escrow),BigInt(accounting.refund)+BigInt(accounting.fee)+BigInt(accounting.creator_credit));console.log('Testnet settlement conserved escrow.');
 const before=await view('get_balance',{account_id:credentials.writer.accountId});await post(writer,'/balances/withdraw',{amount:'100000000000000000000000'});const after=await view('get_balance',{account_id:credentials.writer.accountId});assert.equal(BigInt(before.free)-BigInt(after.free),100000000000000000000000n);assert.equal(after.withdrawal_pending,'0');
 let rejected=false;try{await(await near.account(credentials.client.accountId)).functionCall({contractId:config.contract,methodName:'on_withdraw_result',args:{withdrawal_id:'forged'},gas:30000000000000n});}catch{rejected=true;}assert.ok(rejected,'Forged withdrawal callback must be rejected.');
 const result={network:'testnet',contractId:config.contract,jobId:j.id,passed:true,checkedAt:new Date().toISOString(),checks:['NEP-413 login','owner transaction verification','executor bids','capped escrow','bounded child funding','child delivery and settlement','root delivery and settlement','withdrawal callback','forged callback rejected','exact escrow conservation','native legacy approval rejected without changing reviewed state'],receipts};await writeFile('.data/near/smoke.json',JSON.stringify(result,null,2));console.log('Live NEAR end-to-end checks passed.');
}finally{await app.close();await pool.end();}
