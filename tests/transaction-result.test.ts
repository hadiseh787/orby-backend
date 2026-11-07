import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transactionResult} from '../src/transaction-result.js';
import {nextWeekly,localParts} from '../src/programs.js';
import {deterministicBrief} from '../src/runtime.js';
test('a targeted demo revision adds exact supporting evidence without changing another row',()=>{
 const input={sources:[{id:'a',text:'Proposal A includes testing and maintenance.'},{id:'b',text:'Proposal B has uncertain support.'}]};
 const before=deterministicBrief(input),after=deterministicBrief({...input,revisionFeedback:{section:'comparison:0',sourceId:'a',reason:'State the supporting claim.'}});
 assert.notEqual(after.comparison[0].strengths,before.comparison[0].strengths);assert.deepEqual(after.comparison[1],before.comparison[1]);assert.ok(after.comparison[0].strengths.includes(input.sources[0].text));
});

test('transaction finality and withdrawal callback are required for payment success',()=>{
 const p={methodName:'withdraw',signerId:'client.testnet',receiverId:'market.testnet',args:{request_id:'withdraw-1'}};
 const result:any={final_execution_status:'EXECUTED_OPTIMISTIC',status:{SuccessValue:''},receipts_outcome:[]};
 assert.equal(transactionResult(result,p).state,'UNKNOWN');result.final_execution_status='FINAL';assert.equal(transactionResult(result,p).state,'UNKNOWN');
 const receipt=(success:boolean,executor='market.testnet')=>({id:'r',outcome:{executor_id:executor,logs:['EVENT_JSON:'+JSON.stringify({event:'withdrawal_completed',data:[{id:'client.testnet:withdraw-1',value:{success}}]})]}});
 result.receipts_outcome=[receipt(true,'other.testnet')];assert.equal(transactionResult(result,p).state,'UNKNOWN');
 result.receipts_outcome=[receipt(false)];assert.equal(transactionResult(result,p).state,'FAILED');
 result.receipts_outcome=[receipt(true)];assert.equal(transactionResult(result,p).state,'CONFIRMED');
 result.status={Failure:{error:'rejected'}};assert.equal(transactionResult(result,p).state,'FAILED');
});
test('weekly programs resolve local calendar time and always advance',()=>{
 const now=Date.parse('2026-11-07T10:00:00Z');
 const next=nextWeekly(now,1,9,0,'UTC');assert.equal(new Date(next).toISOString(),'2026-11-09T09:00:00.000Z');
 const tehran=nextWeekly(now,1,9,0,'Asia/Tehran');assert.equal(localParts(tehran,'Asia/Tehran').hour,9);assert.ok(tehran>now);
 assert.ok(nextWeekly(tehran,1,9,0,'Asia/Tehran')>tehran);
});
