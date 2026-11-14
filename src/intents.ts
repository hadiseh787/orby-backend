import {z} from 'zod';
import {type FastifyInstance} from 'fastify';
import {actor} from './auth.js';
import {mutate} from './market.js';
import {assert,AppError} from './domain.js';
import {requireWorkspaceRole} from './workspace-access.js';
const origin='https://1click.chaindefuser.com/v0';
let cache:{expires:number;tokens:any[]}|null=null;
const evm=new Set(['eth','base','arb','arbitrum','optimism','op','polygon','bsc','avax','gnosis','aurora','bera']);
export const supportedOrigin=(network:string)=>network==='near'||evm.has(network);
export function validQuoteAddress(address:string,network:string){
 if(network==='near')return !address.endsWith('.testnet')&&address.length>=2&&address.length<=64&&/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(address);
 return evm.has(network)&&/^0x[0-9a-fA-F]{40}$/.test(address);
}
export function decimalAtomic(value:string,decimals:number){
 assert(Number.isInteger(decimals)&&decimals>=0&&decimals<=36,'INVALID_TOKEN','Unsupported token precision.');
 assert(/^\d+(?:\.\d+)?$/.test(value),'INVALID_AMOUNT','Enter a positive decimal token amount.');
 const [whole,fraction='']=value.split('.');assert(fraction.length<=decimals,'INVALID_AMOUNT','The amount has more decimal places than the selected token permits.');
 const amount=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
 assert(amount>0n&&amount<10n**36n,'INVALID_AMOUNT','Enter an amount greater than zero within the supported token range.');return String(amount);
}
function unavailable(error:any):never{
 if(error instanceof AppError)throw error;
 if(error?.name==='TimeoutError'||error?.name==='AbortError')throw new AppError('QUOTE_TIMEOUT','The quote service timed out. No transfer or balance change occurred. Retry the preview.',504);
 throw new AppError('QUOTE_CONNECTION_FAILED','Cannot reach the quote service. Check the server internet connection and retry the preview.',503);
}
async function providerJson(response:Response){try{return await response.json();}catch{throw new AppError('QUOTE_RESPONSE_INVALID','The quote service returned an unreadable response. Retry later; no funds were moved.',502);}}
export async function intentTokens(fetcher:typeof fetch=fetch){
 if(fetcher===fetch&&cache&&cache.expires>Date.now())return cache.tokens;
 try{const r=await fetcher(origin+'/tokens',{signal:AbortSignal.timeout(15000)});assert(r.ok,'QUOTE_SERVICE_UNAVAILABLE','Token discovery is unavailable. Retry when the provider recovers.',503);const data:any=await providerJson(r);assert(Array.isArray(data),'QUOTE_RESPONSE_INVALID','Invalid provider token catalog.',502);const tokens=data.filter((t:any)=>supportedOrigin(t.blockchain)).map((t:any)=>({assetId:t.assetId,blockchain:t.blockchain,symbol:t.symbol,decimals:t.decimals}));if(fetcher===fetch)cache={expires:Date.now()+120000,tokens};return tokens;}catch(e){return unavailable(e);}
}
export function safeQuoteBody(b:any,tokens:any[]){
 const v=z.object({originAsset:z.string().max(200),destinationAsset:z.string().max(200),amount:z.string().regex(/^[1-9]\d{0,35}$/).optional(),amountDecimal:z.string().max(80).optional(),recipient:z.string().trim().min(2).max(128),refundTo:z.string().trim().min(2).max(128),dry:z.literal(true).optional()}).strict().parse(b);
 const from=tokens.find(t=>t.assetId===v.originAsset),to=tokens.find(t=>t.assetId===v.destinationAsset);assert(from&&to&&to.blockchain==='near'&&from.assetId!==to.assetId,'INVALID_ROUTE','Select a supported origin token and a different NEAR mainnet destination token.');
 assert(!v.recipient.endsWith('.testnet')&&!v.refundTo.endsWith('.testnet'),'NETWORK_MISMATCH','Testnet accounts cannot receive mainnet quotes.');
 assert(validQuoteAddress(v.recipient,'near'),'INVALID_ADDRESS','Enter a valid NEAR mainnet recipient: an account name or 64 lowercase hexadecimal characters.');
 assert(validQuoteAddress(v.refundTo,from.blockchain),'INVALID_ADDRESS',evm.has(from.blockchain)?'Origin refund address must be a 0x address with 40 hexadecimal characters.':'Enter a valid refund address for the selected origin network.');
 assert(!!v.amount!==!!v.amountDecimal,'INVALID_AMOUNT','Provide one decimal amount or one atomic amount.');const amount=v.amountDecimal?decimalAtomic(v.amountDecimal,from.decimals):v.amount!;
 return {dry:true,swapType:'EXACT_INPUT',slippageTolerance:100,originAsset:from.assetId,destinationAsset:to.assetId,amount,recipient:v.recipient,refundTo:v.refundTo,depositType:'ORIGIN_CHAIN',recipientType:'DESTINATION_CHAIN',refundType:'ORIGIN_CHAIN',deadline:new Date(Date.now()+180000).toISOString()};
}
export async function fetchDryQuote(body:any,fetcher:typeof fetch=fetch){
 try{
  const response=await fetcher(origin+'/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,dry:true}),signal:AbortSignal.timeout(30000)});const result:any=await providerJson(response);
  if(!response.ok){const message=JSON.stringify(result).toLowerCase();if(response.status===429)throw new AppError('QUOTE_RATE_LIMITED','The quote provider is busy. Wait briefly before requesting another preview.',503);if(response.status>=500)throw new AppError('QUOTE_SERVICE_UNAVAILABLE','The quote provider is temporarily unavailable. Retry later.',503);if(/min(?:imum)?|too (?:low|small)|insufficient.*amount/.test(message))throw new AppError('QUOTE_AMOUNT_TOO_LOW','The amount is below the route minimum. Increase it or choose another token.',422);if(/address|recipient|refund/.test(message))throw new AppError('INVALID_ADDRESS','The provider rejected an address. Check recipient and refund addresses against their networks.',422);throw new AppError('QUOTE_NO_ROUTE','No route is available for this token and amount. Change the amount or origin token.',422);}
  const q=result.quote;assert(q&&!q.depositAddress&&!q.depositMemo&&!result.depositAddress&&!result.depositMemo,'SAFE_MODE_VIOLATION','An executable deposit destination was rejected. Nothing was credited.',502);
  assert(/^\d+$/.test(String(q.amountOut))&&Number.isFinite(Date.parse(q.deadline||body.deadline))&&Date.parse(q.deadline||body.deadline)>Date.now(),'QUOTE_RESPONSE_INVALID','The provider returned an incomplete or expired quote. Request a new preview.',502);
  return {dry:true,network:'MAINNET_PREVIEW_ONLY',receivedAt:new Date().toISOString(),expiresAt:q.deadline||body.deadline,originAsset:body.originAsset,destinationAsset:body.destinationAsset,amountIn:q.amountIn,amountInFormatted:q.amountInFormatted,estimatedReceived:q.amountOut,estimatedReceivedFormatted:q.amountOutFormatted,minimumReceived:q.minAmountOut,amountInUsd:q.amountInUsd,amountOutUsd:q.amountOutUsd,fees:q.fees||null,feeNotice:q.fees?'Provider-reported fees.':'Provider has not itemized route fees; do not interpret this as zero fees. Estimated/minimum received amounts are net quote observations.',platformSurchargeEstimate:{basis:'PUBLISHED_UNAUTHENTICATED_RATE_ESTIMATE_NOT_TOTAL_FEES',basisPoints:25,amountAtomic:String((BigInt(body.amount)*25n+9999n)/10000n),assetId:body.originAsset,source:'https://docs.agentsonintents.com/resources/fees',asOf:'2026-11-14'},timeEstimate:q.timeEstimate,balanceEffect:'NONE',notice:'Safe Mode: no deposit address, signature, transfer, execution or balance credit.'};
 }catch(e){return unavailable(e);}
}
export async function intentsRoutes(app:FastifyInstance){
 app.get('/api/v1/intents/tokens',async req=>{await actor(req);return {network:'MAINNET_PREVIEW_ONLY',tokens:await intentTokens()};});
 app.post('/api/v1/intents/quote',async(req:any)=>{const a=await actor(req);requireWorkspaceRole(a,'OWNER');try{return await mutate(a,req.headers['idempotency-key'],{path:'intents-dry-quote',body:req.body},async()=>fetchDryQuote(safeQuoteBody(req.body,await intentTokens())));}catch(e:any){req.log.warn({code:e.code||'QUOTE_VALIDATION',status:e.status||400},'Safe Mode quote rejected; no financial operation');throw e;}});
}
