import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decimalAtomic,safeQuoteBody,fetchDryQuote,intentTokens} from '../src/intents.js';
const tokens=[{assetId:'usdc',blockchain:'eth',decimals:6},{assetId:'wnear',blockchain:'near',decimals:24}];
const input={originAsset:'usdc',destinationAsset:'wnear',amountDecimal:'10',recipient:'a'.repeat(64),refundTo:'0x'+'1'.repeat(40)};
test('Safe Mode converts decimals on the server and validates network addresses before calling the provider',()=>{
 assert.equal(safeQuoteBody(input,tokens).amount,'10000000');assert.equal(decimalAtomic('0.000001',6),'1');
 for(const amountDecimal of ['0','-1','NaN','1e3','0.0000001'])assert.throws(()=>safeQuoteBody({...input,amountDecimal},tokens));
 assert.throws(()=>safeQuoteBody({...input,refundTo:'sample-address'},tokens),/0x address/);
 assert.throws(()=>safeQuoteBody({...input,recipient:'client.testnet'},tokens),/Testnet/);
 assert.throws(()=>safeQuoteBody({...input,dry:false},tokens));
});
test('provider calls force dry true even for internal callers and expose no deposit destination',async()=>{
 const body=safeQuoteBody(input,tokens);const result=await fetchDryQuote({...body,dry:false},(async(_url:any,init:any)=>{assert.equal(JSON.parse(init.body).dry,true);return Response.json({quote:{amountOut:'123',deadline:body.deadline,minAmountOut:'120'}});}) as typeof fetch);assert.equal(result.dry,true);assert.equal(result.balanceEffect,'NONE');assert.equal((result as any).depositAddress,undefined);
 await assert.rejects(fetchDryQuote(body,(async()=>Response.json({quote:{depositAddress:'forbidden',amountOut:'123'}})) as typeof fetch),{code:'SAFE_MODE_VIOLATION'});
});
test('quote failures have distinct safe errors for low amount, no route, bad address, timeout and unavailable provider',async()=>{
 const body=safeQuoteBody(input,tokens);
 for(const [status,message,code] of [[400,'amount too low','QUOTE_AMOUNT_TOO_LOW'],[400,'no route','QUOTE_NO_ROUTE'],[422,'No possible route for current params','QUOTE_NO_ROUTE'],[401,'unauthorized','QUOTE_AUTH_REQUIRED'],[403,'forbidden','QUOTE_AUTH_REQUIRED'],[429,'rate limit','QUOTE_RATE_LIMITED'],[400,'invalid request','QUOTE_INPUT_REJECTED'],[400,'invalid refund address','INVALID_ADDRESS'],[503,'upstream secret=do-not-expose','QUOTE_SERVICE_UNAVAILABLE']] as const){await assert.rejects(fetchDryQuote(body,(async()=>Response.json({message},{status})) as typeof fetch),(e:any)=>e.code===code&&!e.message.includes('do-not-expose'));}
 await assert.rejects(fetchDryQuote(body,(async()=>{throw new DOMException('secret upstream','TimeoutError');}) as typeof fetch),{code:'QUOTE_TIMEOUT'});
 await assert.rejects(fetchDryQuote(body,(async()=>{throw new TypeError('fetch failed');}) as typeof fetch),{code:'QUOTE_CONNECTION_FAILED'});
 await assert.rejects(fetchDryQuote(body,(async()=>new Response('<html>proxy failure</html>',{status:502})) as typeof fetch),{code:'QUOTE_RESPONSE_INVALID'});
 await assert.rejects(intentTokens((async()=>{throw new TypeError('fetch failed');}) as typeof fetch),{code:'QUOTE_CONNECTION_FAILED'});
});
