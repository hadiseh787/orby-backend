import {config} from './config.js';
import {modelStatus} from './runtime.js';
export async function testnetHealth(fetcher:typeof fetch=fetch){
 const base={network:'testnet',contractId:config.contract||null,executorConfigured:!!(config.serviceAccount&&config.serviceKey)};
 if(!config.contract)return {...base,state:'NOT_CONFIGURED',message:'No testnet contract is configured in this backend installation.',action:'Set NEAR_NETWORK=testnet, NEAR_CONTRACT_ID and the deployment owner executor settings in backend .env, then restart npm run local. Source-only installs intentionally contain no private keys.'};
 try{
  const call=async(url:string,method:string,params:any)=>{const r=await fetcher(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'orby-readiness',method,params}),signal:AbortSignal.timeout(5000)});const data:any=await r.json();if(!r.ok||data.error)throw Error('RPC_OR_CONTRACT_UNAVAILABLE');return data.result;};
  const [server,wallet]=await Promise.all([call(config.rpc,'status',[]),config.walletRpc===config.rpc?Promise.resolve(null):call(config.walletRpc,'status',[])]);
  if(server.chain_id!=='testnet'||wallet&&wallet.chain_id!=='testnet')return {...base,state:'NETWORK_MISMATCH',message:'The server or wallet RPC is connected to a different network.',action:'Use NEAR testnet RPC endpoints for both server and wallet. No payment can be reported as ready.'};
  const account=await call(config.rpc,'query',{request_type:'view_account',account_id:config.contract,finality:'final'});
  if(!account.code_hash||account.code_hash==='11111111111111111111111111111111')throw Error('CONTRACT_NOT_DEPLOYED');
  const version=await call(config.rpc,'query',{request_type:'call_function',account_id:config.contract,method_name:'get_version',args_base64:'e30=',finality:'final'});
  if(JSON.parse(Buffer.from(version.result).toString())!==3)throw Error('CONTRACT_VERSION_MISMATCH');
  return {...base,state:'CONNECTED',message:'Server RPC, wallet RPC and deployed V3 contract verified on testnet.',action:base.executorConfigured?'Connect a testnet wallet to sign in.':'Configure the limited executor signer before running a mission.'};
 }catch(e:any){return {...base,state:'UNAVAILABLE',message:e.message==='CONTRACT_NOT_DEPLOYED'?'The configured account has no deployed contract.':e.message==='CONTRACT_VERSION_MISMATCH'?'The deployed contract version is incompatible.':'Cannot verify the RPC response and deployed testnet contract.',action:'Check testnet RPC connectivity and contract deployment, then retry readiness. No confirmed payment is inferred.'};}
}
export async function readiness(){return {version:'1.4.1',checkedAt:new Date().toISOString(),testnet:await testnetHealth(),model:await modelStatus()};}
