// Explicit opt-in: isolated testnet fixture. Never spends the marketplace's customer backing.
import 'dotenv/config';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {connect,keyStores,KeyPair,transactions} from 'near-api-js';
import bs58 from 'bs58';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {enableLargeUploadTransport} from '../scripts/rpc-transport.js';
assert.equal(process.env.NEAR_NETWORK||'testnet','testnet');
assert.ok(process.argv.includes('--run'),'Pass --run to create an isolated, temporary testnet fixture.');
enableLargeUploadTransport();
const cleanupWasm='contracts/test-cleanup/target/wasm32-unknown-unknown/release/orby_test_cleanup.wasm';
if(!existsSync(cleanupWasm)){const cargo=process.platform==='win32'?(process.env.USERPROFILE+'/.cargo/bin/cargo.exe'):'cargo';const built=spawnSync(cargo,['build','--locked','--manifest-path','contracts/test-cleanup/Cargo.toml','--target','wasm32-unknown-unknown','--release'],{stdio:'inherit',windowsHide:true});assert.equal(built.status,0,'Build the fixture cleanup helper before funding any account.');}
for(const file of ['.data/near/orby_market.wasm','.data/near/uploader.wasm',cleanupWasm])await fs.access(file);
const credentials=JSON.parse(await fs.readFile('.data/near/accounts.json','utf8')),resume=process.argv.includes('--resume'),fixture=resume?JSON.parse(await fs.readFile('.data/near/load-fixture.json','utf8')):null,key=fixture?KeyPair.fromString(fixture.privateKey):KeyPair.fromRandom('ed25519');
const accountId=fixture?.accountId||'load-'+Date.now()+'.'+credentials.admin.accountId;
if(!resume)await fs.writeFile('.data/near/load-fixture.json',JSON.stringify({accountId,privateKey:key.toString()}));
const store=new keyStores.InMemoryKeyStore();await store.setKey('testnet',credentials.admin.accountId,KeyPair.fromString(credentials.admin.privateKey));await store.setKey('testnet',accountId,key);
const near=await connect({networkId:'testnet',nodeUrl:process.env.NEAR_RPC_URL||'https://test.rpc.fastnear.com',keyStore:store}),admin=await near.account(credentials.admin.accountId);
const Q=10n**24n;if(!resume){assert.ok(BigInt((await admin.state()).amount)>8n*Q,'Admin sponsor needs 8 testNEAR; no customer funds are used.');await admin.createAccount(accountId,key.getPublicKey(),7n*Q);}const account=await near.account(accountId);
const call=(methodName:string,args:any,attachedDeposit=0n,signer=account)=>signer.functionCall({contractId:accountId,methodName,args,gas:150000000000000n,attachedDeposit});
const view=(methodName:string,args={})=>account.viewFunction({contractId:accountId,methodName,args});
const wasm=await fs.readFile('.data/near/orby_market.wasm'),sha256=createHash('sha256').update(wasm).digest('hex');
if((await account.state()).code_hash!==bs58.encode(createHash('sha256').update(wasm).digest())){await account.deployContract(await fs.readFile('.data/near/uploader.wasm'));
const size=12288,count=Math.ceil(wasm.length/size);for(let i=0;i<count;i+=4){await account.signAndSendTransaction({receiverId:accountId,actions:Array.from({length:Math.min(4,count-i)},(_,n)=>transactions.functionCall('stage',{index:i+n,data:wasm.subarray((i+n)*size,(i+n+1)*size).toString('base64')},20000000000000n,0n))});console.log('Staged fixture:',Math.min(i+4,count),count);}
await call('commit',{count,sha256});assert.equal((await account.state()).code_hash,bs58.encode(createHash('sha256').update(wasm).digest()));
}
if(await view('get_version').catch(()=>null)!==3)await call('new',{admin:credentials.admin.accountId,evaluator:credentials.admin.accountId,updater:credentials.admin.accountId,accelerated:true});
for(let i=Number((await view('get_storage_status') as any).counts.jobs);i<100;i+=5){await account.signAndSendTransaction({receiverId:accountId,actions:Array.from({length:5},(_,n)=>transactions.functionCall('open_near_job',{request_id:'load-open-'+(i+n),job_id:'load-job-'+(i+n),terms_hash:'a'.repeat(64),budget:String(Q),deadline_ms:String(Date.now()+86400000),manual:true},50000000000000n,0n))});console.log('Created isolated jobs:',i+5);}
const probe='load-probe-'+Date.now(),balance:any=await view('get_balance',{account_id:credentials.admin.accountId});assert.equal(balance.withdrawal_pending,'0','Reconcile the prior withdrawal before resuming.');if(BigInt(balance.free)<Q/5n)await call('deposit_funds',{request_id:probe+'-deposit'},Q/5n,admin);
const outcome=await call('withdraw',{request_id:probe+'-withdraw',amount:String(Q/5n)},1n,admin);
const callback=outcome.receipts_outcome.filter(r=>r.outcome.executor_id===accountId).at(-1);assert.ok(callback);assert.ok('SuccessValue' in callback.outcome.status);const gas=BigInt(callback.outcome.gas_burnt);assert.ok(gas<50000000000000n);
const withdrawal:any=await view('get_withdrawal',{withdrawal_id:credentials.admin.accountId+':'+probe+'-withdraw'}),storage:any=await view('get_storage_status');assert.equal(storage.counts.jobs,100);assert.equal(storage.user_liabilities,'0');assert.equal(storage.open_escrows,0);
const state:any=await near.connection.provider.query({request_type:'view_state',account_id:accountId,prefix_base64:Buffer.from('STATE').toString('base64'),finality:'final'});const headerBytes=Buffer.from(state.values.find((v:any)=>Buffer.from(v.key,'base64').toString()==='STATE').value,'base64').length;assert.ok(headerBytes<2000);
const record={passed:true,checkedAt:new Date().toISOString(),network:'testnet',temporaryContract:accountId,wasmSha256:sha256,targetJobs:100,callbackGasBurnt:String(gas),callbackGasLimit:'50000000000000',callbackMarginPercent:Number((50000000000000n-gas)*10000n/50000000000000n)/100,stateHeaderBytes:headerBytes,storageStatus:storage,withdrawal,transactionHash:outcome.transaction.hash,notice:'Actual WASM/RPC at 100 indexed jobs; separate native mock-host suite covers 500 jobs. This is a bounded load target, not an unlimited-scale claim.'};
// Only fixture-owned data is deleted, after all customer claims have exited successfully.
await fs.writeFile('.data/near/load-proof-pending.json',JSON.stringify(record,null,2));
const allState:any=await near.connection.provider.query({request_type:'view_state',account_id:accountId,prefix_base64:'',finality:'final'});
await account.deployContract(await fs.readFile(cleanupWasm));
for(let i=0;i<allState.values.length;i+=100)await call('clear_fixture',{keys:allState.values.slice(i,i+100).map((v:any)=>v.key)});
await account.deleteAccount(credentials.admin.accountId);
let deleted=false;try{await account.state();}catch(e:any){if(e.type==='AccountDoesNotExist'||/not exist|does not exist|doesn.t exist|UNKNOWN_ACCOUNT/i.test(e.message))deleted=true;else throw e;}assert.ok(deleted,'The fixture account must be confirmed deleted.');
await fs.writeFile('docs/orby-v3-load.json',JSON.stringify({...record,fixtureDeletedAfterZeroLiabilities:true},null,2)+'\n');console.log('Actual testnet callback gas proof passed:',String(gas),headerBytes);
