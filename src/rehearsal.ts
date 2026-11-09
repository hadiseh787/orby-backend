import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {type FastifyInstance} from 'fastify';
import {actor,type Actor} from './auth.js';
import {pool,type DB} from './db.js';
import {loadJob,mutate} from './market.js';
import {assert,funding,hash,Q,min,agentMinimum} from './domain.js';
import {balance} from './ledger.js';
import {agreementPrice,view,rpc} from './near.js';
import {config} from './config.js';
import {requireWorkspaceRole} from './workspace-access.js';

export const rehearsalRules='orby-plan-1.3.0';
export async function executionPlan(db:DB,a:Actor,jobId:string,bidId:string){
 const j=await loadJob(db,jobId,a),b=(await db.query('SELECT b.*,ag.owner_id,ag.version AS agent_version,ag.state AS agent_state,ag.data AS agent_data,p.version AS policy_version,p.data AS policy FROM bids b JOIN agents ag ON ag.id=b.agent_id AND ag.book=b.book JOIN execution_policies p ON p.agent_id=ag.id AND p.book=ag.book WHERE b.id=$1 AND b.job_id=$2',[bidId,jobId])).rows[0];assert(b,'NOT_FOUND','Select an existing proposal for this job.',404);
 const checks:any[]=[],add=(id:string,pass:boolean|null,detail:string,source='RULES')=>checks.push({id,result:pass===null?'UNAVAILABLE':pass?'PASS':'FAIL',detail,source});
 let chainObservation:any=null,storageObservation:any=null;
 if(a.book==='TESTNET'){try{const [agent,policy,bid,job]=await Promise.all([view('get_agent',{agent_id:b.agent_id}),view('get_policy',{agent_id:b.agent_id}),view('get_bid',{bid_id:b.id}),view('get_job',{job_id:j.id})]);chainObservation={agent,policy,bid,job};}catch{}add('final-chain-terms',chainObservation?!!chainObservation.agent?.active&&Number(chainObservation.agent.version)===Number(b.agent_version)&&!!chainObservation.policy&&!chainObservation.policy.paused&&Number(chainObservation.policy.version)===Number(b.policy_version)&&Number(chainObservation.policy.expires_at)>Date.now()&&chainObservation.bid?.price===b.amount&&chainObservation.job?.terms_hash===j.data.termsHash&&chainObservation.job?.state==='OPEN':null,'Final contract observations must match the recorded agent, policy, proposal and open agreement.','FINAL_TESTNET_VIEW');}
 const reference=j.data.nearYocto?Q.toString():await agreementPrice(a.book).then(p=>p.priceMicro).catch(()=>null),money=reference?funding(b.amount,reference):null;
 add('job-open',j.state==='OPEN','Funding is available only for an open job.');add('bid-live',new Date(b.expires_at).getTime()>Date.now(),'Proposal expiry is checked again before real funding.');
 add('agent-version',b.agent_state==='ACTIVE'&&b.data.manifestVersion===b.agent_version,'The proposal must match the current active manifest.');
 add('policy',!b.policy.paused&&b.policy.expiresAt>Date.now(),'Execution policy must be active and unexpired.');add('deadline',j.data.deadline>Date.now(),'The publication-based deadline must allow execution.');
 const floor=reference?agentMinimum(b.agent_data,!!j.data.nearYocto,reference):null;
 add('price-floor',floor===null?null:BigInt(b.amount)>=BigInt(floor),'The offer must meet the registered agent price floor.');add('budget',BigInt(b.amount)<=BigInt(j.data.nearYocto||j.data.usdMicro),'The agreed price cannot exceed the job budget.');
 for(const c of j.data.criteria||[]){const cfg=c.config||{};add('criterion:'+c.id,!(cfg.min!==undefined&&cfg.max!==undefined&&cfg.min>cfg.max)&&(cfg.check!=='source-ids'||j.data.input.sources.length>0),'Acceptance criterion: '+c.description);}
 let wallet:string|null=null,bond:string|null=null,creatorFree:string|null=null,source=a.book==='SIMULATION'?'SIMULATION_LEDGER':'FINAL_TESTNET_VIEW';
 try{if(a.book==='SIMULATION'){wallet=await balance(db,a.book,j.client_id);bond=await balance(db,a.book,b.owner_id,'bond');creatorFree=await balance(db,a.book,b.owner_id);}else{const [account,creator,protocol]=await Promise.all([rpc('query',{request_type:'view_account',finality:'final',account_id:j.client_id}),view('get_balance',{account_id:b.owner_id}),rpc('EXPERIMENTAL_protocol_config',{finality:'final'})]);const available=BigInt(account.amount)-BigInt(account.storage_usage)*BigInt(protocol.runtime_config.storage_amount_per_byte);wallet=String(available>0n?available:0n);bond=String(creator.bond);creatorFree=String(creator.free);}}catch{}
 add('client-funds',wallet===null||!money?null:BigInt(wallet)>=BigInt(money.escrow)+(a.book==='TESTNET'?Q/100n:0n),'Available client funds must cover escrow; the testnet estimate also reserves 0.01 NEAR for gas.',source);
 add('creator-bond',bond===null||!money?null:BigInt(bond)>=BigInt(money.bond),'Available creator performance bond must cover this job.',source);
 if(a.book==='TESTNET'){try{storageObservation=await view('get_storage_status');}catch{}add('contract-storage-sponsorship',storageObservation?BigInt(storageObservation.storage_budget)>BigInt(storageObservation.protected_exit_reserve)+3n*Q/10n:null,'The contract must preserve exit reserves and sponsor storage for the new obligation.','FINAL_TESTNET_VIEW');}
 const delegates=b.agent_id==='brief-writer',childAmount=Q.toString(),childCap=money?String(min(BigInt(money.childCap),BigInt(b.policy.maxSpendYocto))):'0',children:any[]=[];
 if(delegates){const child=(await db.query("SELECT a.*,p.data AS policy FROM agents a JOIN execution_policies p ON p.agent_id=a.id AND p.book=a.book WHERE a.id='source-extractor' AND a.book=$1",[a.book])).rows[0];
  add('delegation-permission',!!child&&b.policy.allowedAgentIds.includes('source-extractor')&&BigInt(childCap)>=Q,'The creator authorizes a source-extractor child within its spending ceiling.');
  add('creator-free-funds',creatorFree===null?null:BigInt(creatorFree)>=Q,'The child is paid from the creator free balance, independently of client escrow.',source);
  let childBond:string|null=null;try{if(child)childBond=a.book==='SIMULATION'?await balance(db,a.book,child.owner_id,'bond'):String((await view('get_balance',{account_id:child.owner_id})).bond);}catch{}
  add('child-bond',childBond===null?null:BigInt(childBond)>=Q/5n,'The specialist needs its own available performance collateral.',source);
  add('child-policy',!!child&&child.state==='ACTIVE'&&!child.policy.paused&&child.policy.expiresAt>Date.now(),'The specialist and its execution policy must be active.');
  children.push({agentId:'source-extractor',amount:childAmount,fundingSource:'CREATOR_FREE_BALANCE',knowledgeIds:j.data.input.knowledgeAccess?.children?.['source-extractor']||[],bondObserved:childBond});
 }
 const grants=(await db.query('SELECT snapshot_id,recipient,active FROM knowledge_grants WHERE job_id=$1 ORDER BY snapshot_id,recipient',[j.id])).rows;
 add('knowledge-access',grants.every(g=>g.active),'All selected execution grants must remain active. Revocation stops future execution.');
 const snapshot=JSON.parse(JSON.stringify({jobId:j.id,jobVersion:j.version,termsHash:j.data.termsHash,bidId:b.id,bidAmount:b.amount,bidExpiresAt:b.expires_at,agentId:b.agent_id,agentVersion:b.agent_version,policyVersion:b.policy_version,policy:b.policy,inputHash:hash(j.data.input),criteria:j.data.criteria,money,children,grants,walletObserved:wallet,bondObserved:bond,creatorFreeObserved:creatorFree,chainObservation,storageObservation,reference,rulesVersion:rehearsalRules}));
 return {fingerprint:hash(snapshot),snapshot,checks,ready:checks.every(c=>c.result==='PASS'),limits:{maximumDepth:1,maximumChildren:3},notice:'Read-only rule rehearsal, not a NEAR VM dry-run or a guarantee. Real funding revalidates all terms and requires payment-owner approval.'};
}
export function rehearsePlan(plan:any,scenario:string){
 const steps:any[]=[{step:'Validate plan',result:plan.ready?'PASS':'BLOCKED',checks:plan.checks}];
 if(!plan.ready)return {scenario,result:'BLOCKED',steps,financialEffects:[],notice:plan.notice};
 steps.push({step:'Plan funding',result:'SIMULATED',amount:plan.snapshot.money.escrow});
 if(scenario==='PAYMENT_RESULT_LOST'){steps.push({step:'Observe payment result',result:'UNKNOWN',nextAction:'Reconcile the same payment request. Do not send a second payment.'});return {scenario,result:'UNKNOWN',steps,financialEffects:[],notice:plan.notice};}
 for(const child of plan.snapshot.children){steps.push({step:'Run '+child.agentId,result:'SIMULATED',fundingSource:child.fundingSource});if(scenario==='CHILD_FAILED'){steps.push({step:'Evaluate child acceptance',result:'FAIL',nextAction:'Stop child payment; request one revision, then open a dispute if still invalid.'});return {scenario,result:'REVISION_REQUIRED',steps,financialEffects:[],notice:plan.notice};}steps.push({step:'Evaluate child acceptance',result:'PASS',simulatedPayment:child.amount});}
 if(scenario==='CHILD_FAILED'&&!plan.snapshot.children.length)return {scenario,result:'NOT_APPLICABLE',steps,financialEffects:[],notice:'The selected agent has no child stage in the execution plan.'};
 steps.push({step:'Review exact delivery version',result:'REQUIRES_CLIENT_DECISION'},{step:'Settle after valid acceptance',result:'SIMULATED'});return {scenario,result:'SIMULATED_SUCCESS',steps,financialEffects:[],notice:plan.notice};
}
export async function rehearsalRoutes(app:FastifyInstance){
 app.get('/api/v1/jobs/:id/execution-plan',async(req:any)=>{const a=await actor(req);return executionPlan(pool,a,z.uuid().parse(req.params.id),z.uuid().parse(req.query.bidId));});
 app.post('/api/v1/jobs/:id/rehearsals',async(req:any)=>{const a=await actor(req);requireWorkspaceRole(a,'OWNER');return mutate(a,req.headers['idempotency-key'],{path:'rehearsal',jobId:req.params.id,body:req.body,workspace:a.workspaceId},async db=>{const id=randomUUID(),job=await loadJob(db,z.uuid().parse(req.params.id),a),plan=await executionPlan(db,a,job.id,z.uuid().parse(req.body.bidId)),scenario=z.enum(['SUCCESS','CHILD_FAILED','PAYMENT_RESULT_LOST']).parse(req.body.scenario),data={...rehearsePlan(plan,scenario),plan};await db.query('INSERT INTO rehearsal_runs(id,workspace_id,job_id,created_by,fingerprint,rules_version,scenario,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,job.workspace_id,job.id,a.id,plan.fingerprint,rehearsalRules,scenario,data]);return {id,...data};});});
 app.get('/api/v1/jobs/:id/rehearsals',async(req:any)=>{const a=await actor(req),job=await loadJob(pool,z.uuid().parse(req.params.id),a),rows=(await pool.query('SELECT * FROM rehearsal_runs WHERE job_id=$1 ORDER BY created_at DESC LIMIT 10',[job.id])).rows;for(const row of rows){try{const current=await executionPlan(pool,a,job.id,row.data.plan.snapshot.bidId);row.stale=current.fingerprint!==row.fingerprint;}catch{row.stale=true;}}return rows;});
}
