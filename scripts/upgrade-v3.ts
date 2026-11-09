import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {view,rpc} from '../src/near.js';
import {config} from '../src/config.js';
import {hash,Q} from '../src/domain.js';
import {pool} from '../src/db.js';
import {connect,keyStores,KeyPair} from 'near-api-js';
const snapshotPath='.data/near/v3-upgrade-before.json';
// Exact deployed V2 Borsh layout. Decoding is read-only and must consume every byte.
function decodeV2(bytes:Buffer){let at=0;const u8=()=>bytes.readUInt8(at++),u32=()=>{const n=bytes.readUInt32LE(at);at+=4;return n;},u64=()=>{const n=bytes.readBigUInt64LE(at);at+=8;return String(n);},u128=()=>{const n=bytes.readBigUInt64LE(at)+(bytes.readBigUInt64LE(at+8)<<64n);at+=16;return String(n);},str=()=>{const n=u32();assert.ok(n<=bytes.length-at);const s=bytes.subarray(at,at+n).toString();at+=n;return s;},bool=()=>{const n=u8();assert.ok(n<2);return n===1;};
 const option=(fn:()=>any)=>{const flag=u8();assert.ok(flag<2);return flag?fn():null;},vec=(fn:()=>any)=>Array.from({length:u32()},fn),map=(fn:()=>any)=>Object.fromEntries(vec(()=>[str(),fn()]));
 const agent=()=>({owner:str(),manifest_hash:str(),min_price:u128(),active:bool(),version:Number(u64())});
 const policy=()=>({executor:str(),max_spend:u128(),max_bond:u128(),allowed:vec(str),expires_at:u64(),paused:bool(),version:Number(u64())});
 const settlement=()=>({award:u128(),fee:u128(),refund:u128(),creator_credit:u128(),penalty:u128(),shortfall:bool(),fallback_used:bool()});
 const job=()=>({client:str(),agent_id:option(str),creator:option(str),terms_hash:str(),usd_micro:u128(),deadline_ms:u64(),manual:bool(),state:str(),version:Number(u64()),escrow:u128(),bond:u128(),n0:u128(),funding_price:u128(),child_cap:u128(),child_spent:u128(),children:vec(str),parent:option(str),start_deadline:u64(),review_deadline:u64(),dispute_deadline:u64(),revision:u8(),delivery_hash:str(),checks_pass:bool(),no_delivery:bool(),settlement:option(settlement)});
 const bid=()=>({job_id:str(),agent_id:str(),price:u128(),eta_ms:u64(),expires_at:u64(),manifest_version:Number(u64()),policy_version:Number(u64())});
 const balance=()=>({free:u128(),bond:u128(),reserved_bond:u128(),withdrawal_pending:u128()});
 const state={admin:str(),evaluator:str(),updater:str(),agents:map(agent),policies:map(policy),jobs:map(job),bids:map(bid),balances:map(balance),operations:map(()=>({payload_hash:str(),outcome:str()})),withdrawals:map(()=>({owner:str(),amount:u128(),done:bool()})),price:u128(),price_time:u64(),price_mode:str(),quarantined:bool(),paused:bool(),accelerated:bool(),native_jobs:map(u128),native_agents:map(u128)};
 assert.equal(at,bytes.length,'The deployed state must match the complete V2 layout.');return state;
}
try{
 assert.ok(config.contract);assert.equal(process.env.NEAR_NETWORK||'testnet','testnet');
 if(['pause','resume'].includes(process.argv[2])){
  const file='.data/near/v3-maintenance.json',current=await view('get_config');let record=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
  if(process.argv[2]==='pause'&&(!record?.active||record.contractId!==config.contract)){record={contractId:config.contract,previouslyPaused:current.paused,active:true};fs.writeFileSync(file,JSON.stringify(record));}
  assert.ok(record&&record.contractId===config.contract,'A matching maintenance record is required.');const paused=process.argv[2]==='pause'?true:record.previouslyPaused;
  if(current.paused!==paused){const credentials=JSON.parse(fs.readFileSync('.data/near/accounts.json','utf8')).admin;assert.equal(credentials.accountId,current.admin);const store=new keyStores.InMemoryKeyStore();await store.setKey('testnet',credentials.accountId,KeyPair.fromString(credentials.privateKey));const near=await connect({networkId:'testnet',nodeUrl:config.rpc,keyStore:store});const result=await(await near.account(credentials.accountId)).functionCall({contractId:config.contract,methodName:'pause_new',args:{request_id:'v3-maintenance-'+process.argv[2]+'-'+Date.now(),paused},gas:150000000000000n});console.log('Maintenance state set:',paused,'transaction:',result.transaction.hash);}
  if(process.argv[2]==='resume'){record.active=false;fs.writeFileSync(file,JSON.stringify(record));}
 }else if(process.argv[2]==='snapshot'){
  assert.equal(await view('get_version'),2);const state=await rpc('query',{request_type:'view_state',finality:'final',account_id:config.contract,prefix_base64:''});const record=state.values.find((v:any)=>Buffer.from(v.key,'base64').toString()==='STATE');assert.ok(record);const bytes=Buffer.from(record.value,'base64'),decoded=decodeV2(bytes);
  for(const [id,j] of Object.entries(decoded.jobs) as [string,any][])assert.ok(id.length<=80,'An old long identifier requires a separate compatibility migration before this upgrade.');
  const liability=Object.values(decoded.balances).reduce((sum:bigint,b:any)=>sum+BigInt(b.free)+BigInt(b.bond)+BigInt(b.reserved_bond)+BigInt(b.withdrawal_pending),0n)+Object.values(decoded.jobs).reduce((sum:bigint,j:any)=>sum+(!['SETTLED','REFUNDED','CANCELLED'].includes(j.state)?BigInt(j.escrow):0n),0n);
  const account=await rpc('query',{request_type:'view_account',finality:'final',account_id:config.contract}),live=Object.values(decoded.balances).filter((b:any)=>Object.values(b).some(v=>BigInt(v as string)>0n)).length,escrows=Object.values(decoded.jobs).filter((j:any)=>!['SETTLED','REFUNDED','CANCELLED'].includes(j.state)&&BigInt(j.escrow)>0n).length;
  const file={contractId:config.contract,recordedAt:new Date().toISOString(),stateSha256:hash(bytes.toString('base64')),liability:String(liability),liveBalances:live,openEscrows:escrows,account,decoded};fs.writeFileSync(snapshotPath,JSON.stringify(file,null,2));console.log(JSON.stringify({snapshotSaved:true,counts:Object.fromEntries(['agents','policies','jobs','bids','balances','operations','withdrawals','native_jobs','native_agents'].map(k=>[k,Object.keys((decoded as any)[k]).length])),liability:String(liability),protectedExitReserve:String(BigInt(live)*Q/10n+BigInt(escrows)*3n*Q/10n),accountAmount:account.amount}));
 }else if(process.argv[2]==='verify'){
  const before=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));assert.equal(before.contractId,config.contract);assert.equal(await view('get_version'),3);const status=await view('get_storage_status'),checked:Record<string,number>={};
  const methods:Record<string,(key:string)=>[string,any]>={agents:key=>['get_agent',{agent_id:key}],policies:key=>['get_policy',{agent_id:key}],jobs:key=>['get_job',{job_id:key}],bids:key=>['get_bid',{bid_id:key}],balances:key=>['get_balance',{account_id:key}],operations:key=>['get_operation',{account_id:key.slice(0,key.indexOf(':')),request_id:key.slice(key.indexOf(':')+1)}],withdrawals:key=>['get_withdrawal',{withdrawal_id:key}],native_jobs:key=>['get_near_budget',{job_id:key}],native_agents:key=>['get_near_price',{agent_id:key}]};
  for(const [kind,args] of Object.entries(methods)){const entries=Object.entries(before.decoded[kind]);assert.equal(status.counts[kind],entries.length,kind+' count changed');for(let offset=0;offset<entries.length;offset+=3)await Promise.all(entries.slice(offset,offset+3).map(async([key,expected])=>{const [method,input]=args(key);assert.deepEqual(await view(method,input),expected,kind+': '+key+' changed');}));checked[kind]=entries.length;console.log('Preserved '+kind+': '+entries.length);}
  assert.equal(status.user_liabilities,before.liability);assert.equal(status.live_balances,before.liveBalances);assert.equal(status.open_escrows,before.openEscrows);const report={passed:true,network:'testnet',contractId:config.contract,checkedAt:new Date().toISOString(),sourceVersion:2,targetVersion:3,allDeployedV2MapsDecoded:true,preserved:checked,userLiabilities:status.user_liabilities,protectedExitReserve:status.protected_exit_reserve,storageStatus:status,notice:'All entries in every decoded V2 map were compared with final V3 public views. No operation or withdrawal tombstone was pruned.'};fs.writeFileSync('docs/orby-v3-upgrade.json',JSON.stringify(report,null,2)+'\n');console.log('All V2 records and liabilities preserved exactly.');
 }else throw Error('Use snapshot before deployment, then verify immediately after --upgrade-only --migrate-v2.');
}finally{await pool.end();}
