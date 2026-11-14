import {randomUUID} from 'node:crypto';
import {type DB} from '../src/db.js';
import {type Actor} from '../src/auth.js';
import {createJob,requestBids,preview,fund,loadJob,updateJob,settleJob,event,dispute} from '../src/market.js';
import {hash,evaluate,Q} from '../src/domain.js';
import {deterministicBrief} from '../src/runtime.js';
import {recordDecision} from '../src/delivery-decisions.js';
import {buildReceipt} from '../src/evidence.js';
export const sampleScenarios=[
 {name:'Project proposals',category:'writing',sources:[{id:'project-a',text:'Proposal A: eight week scope with testing milestones and a maintenance plan.'},{id:'project-b',text:'Proposal B: low fixed price, but uncertain support and no testing plan.'},{id:'project-c',text:'Proposal C: broad integration scope with clear delivery milestones and a complex migration.'}],recommendation:'For this fabricated project sample, proposal A offers explicit testing and maintenance. Proposal B requires support clarification; proposal C needs migration risk review. Verify the supplied claims before approval.'},
 {name:'Marketing plan review',category:'review',sources:[{id:'marketing-a',text:'Plan A: small email pilot with opt-in consent, weekly conversion testing and clear spend limits.'},{id:'marketing-b',text:'Plan B: broad influencer campaign with uncertain attribution and no documented consent process.'},{id:'marketing-c',text:'Plan C: organic product tutorials with maintenance ownership and monthly audience interviews.'}],recommendation:'For this fabricated marketing sample, begin with plan A to test conversion inside a clear spending ceiling. Plan C provides educational material. Plan B needs attribution and consent evidence before approval.'},
 {name:'Product specification evidence',category:'research',sources:[{id:'product-a',text:'Spec A states USB-C charging and 12 hour runtime, but no independent battery testing.'},{id:'product-b',text:'Spec B documents an IP54 testing report and a two year maintenance commitment.'},{id:'product-c',text:'Spec C claims broad compatibility with an uncertain operating system support list.'}],recommendation:'For this fabricated product sample, spec B includes the clearest evidence and maintenance commitment. Treat the battery claim in spec A as unverified. Request the compatibility matrix for spec C before accepting the product comparison.'}
];
const cases=['OPEN','OPEN','OPEN','FUNDED','RUNNING','RUNNING','REVIEW_OPEN','REVIEW_OPEN','SETTLED','REVISED','CANCELLED','REFUNDED','EXHAUSTED','TIMEOUT_RECOVERED','FAILED_CHECK'] as const;
export async function seedRichSamples(db:DB){
 const client:Actor={id:'samples.demo',book:'SIMULATION',roles:['client'],csrf:''};
 const criteria=[{id:'structure',type:'AUTO_CHECK',required:true,description:'Demo / Sample structured comparison',config:{check:'json-required-keys',keys:['comparison','recommendation','sources']}},{id:'sources',type:'AUTO_CHECK',required:true,description:'Demo / Sample citations',config:{check:'source-ids'}},{id:'approval',type:'CLIENT_APPROVE',required:true,description:'Demo / Sample approval record'}];
 for(const [index,state] of cases.entries()){
  const marker='rich-v1-'+index;if((await db.query("SELECT 1 FROM jobs WHERE book='SIMULATION' AND data->>'seededExample'=$1",[marker])).rowCount)continue;
  const scenario=sampleScenarios[index%3],agent=['brief-writer','format-reviewer','source-extractor'][index%3];
  const blueprint={title:'Demo / Sample: '+scenario.name+' - '+state.toLowerCase().replaceAll('_',' '),description:'Fabricated, frozen simulation snapshot for demonstration only. '+scenario.name+'. Copy to a fresh job for a real execution. No model or blockchain execution is claimed.',category:scenario.category,nearYocto:String(4n*Q),deadlineMinutes:10080,approvalPolicy:'MANUAL_APPROVAL',runtimeMode:'DETERMINISTIC',preferredAgentId:agent,input:{sources:scenario.sources},criteria,seededExample:marker,sampleScenario:scenario.name,attachments:[],attachmentIds:[]};
  const job=await createJob(db,client,blueprint);await requestBids(db,client,job.id);let row=await loadJob(db,job.id);
  await event(db,job.id,client.id,'sample_snapshot_created',{notice:'Demo / Sample fixture; not a live execution or real user decision.',scenario:scenario.name});
  if(state==='CANCELLED')await updateJob(db,row,'CANCELLED');
  else if(state!=='OPEN'){
   const bid=(await db.query('SELECT id FROM bids WHERE job_id=$1 AND agent_id=$2',[job.id,agent])).rows[0];if(!bid)throw Error('Sample agent proposal is unavailable.');
   const pv=await preview(db,client,job.id,bid.id);await fund(db,client,job.id,pv.id);row=await loadJob(db,job.id);
   if(state!=='FUNDED')await updateJob(db,row,'RUNNING',{startedAt:Date.now(),executionMode:'DETERMINISTIC'});
   const delivered=!['FUNDED','RUNNING'].includes(state);
   if(delivered){
    const content={...deterministicBrief({sources:scenario.sources}),recommendation:scenario.recommendation};
    const bad=structuredClone(content);bad.comparison[0].sources=['missing-sample-evidence'];
    const revised=['REVISED','EXHAUSTED','TIMEOUT_RECOVERED'].includes(state),failed=['FAILED_CHECK','EXHAUSTED'].includes(state);
    const save=async(revision:number,output:any)=>{const checks=evaluate(output,criteria,scenario.sources);await db.query('INSERT INTO deliveries(id,job_id,revision,content,hash,checks) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),job.id,revision,output,hash(output),JSON.stringify(checks)]);await event(db,job.id,agent,'sample_delivery_checked',{revision,checks,fixture:true});return {revision,hash:hash(output)};};
    let delivery=await save(0,revised||failed?bad:content);
    if(revised){await event(db,job.id,agent,state==='TIMEOUT_RECOVERED'?'sample_timeout':'sample_check_failed',{attempt:1,escrowReused:true,fixture:true});await event(db,job.id,agent,'sample_single_recovery',{reason:'Demo / Sample recovery snapshot',attempt:2,additionalSpecialistPayment:'0',fixture:true});delivery=await save(1,failed?bad:{...content,recommendation:'Audit revision: '+content.recommendation});}
    await updateJob(db,row,'REVIEW_OPEN',{revision:delivery.revision,deliveryHash:delivery.hash,reviewDeadline:Date.now()+86400000,executionMode:'DETERMINISTIC',...(revised?{revisionFeedback:{section:'recommendation',reason:'Start Recommendation with Audit revision:'}}:{})});
    if(state==='EXHAUSTED'||state==='FAILED_CHECK'){await dispute(db,client,row,'Demo / Sample: checks failed; no additional recovery or award is authorized.');await updateJob(db,row,'DISPUTED',{needsClientAction:true,executionIssue:'Demo / Sample stopped after '+(revised?'two attempts':'a failed acceptance check')+'.'});}
    else if(state==='REFUNDED')await settleJob(db,row,client.id,0,0,'Demo / Sample full refund');
    else if(['SETTLED','REVISED','TIMEOUT_RECOVERED'].includes(state)){await recordDecision(db,row,client.id,'APPROVE',delivery,{basis:'DEMO_SAMPLE_FIXTURE_NOT_REAL_USER_ACTION'});await settleJob(db,row,client.id);}
   }
  }
  row=await loadJob(db,job.id);await updateJob(db,row,row.state,{sampleFrozen:true,sampleNotice:'Demo / Sample fixture. No real AI, testnet hash or live performance claim.'});
  await db.query("UPDATE outbox_jobs SET state='DONE',lease_until=null WHERE job_id=$1",[job.id]);
  await buildReceipt(db,client,job.id,'PRIVATE');
 }
 // PostgreSQL now() is fixed at transaction start; normalize fixture delivery clocks after fundedAt once.
 const timelines=(await db.query("SELECT id,data FROM jobs WHERE client_id='samples.demo' AND data->>'seededExample' LIKE 'rich-v1-%' AND NOT(data ? 'sampleTimelineVersion')")).rows;
 for(const row of timelines){if(row.data.fundedAt)await db.query("UPDATE deliveries SET created_at=GREATEST(created_at,to_timestamp($2::numeric/1000))+revision*interval '1 millisecond' WHERE job_id=$1",[row.id,row.data.fundedAt]);await db.query("UPDATE jobs SET updated_at=GREATEST(updated_at,COALESCE((SELECT max(created_at) FROM deliveries WHERE job_id=$1),updated_at)),data=data||'{\"sampleTimelineVersion\":1}'::jsonb WHERE id=$1",[row.id]);}
 const insert=async(table:string,name:string,sql:string,values:any[])=>{if(!(await db.query(`SELECT 1 FROM ${table} WHERE owner_id='samples.demo' AND book='SIMULATION' AND name=$1`,[name])).rowCount)await db.query(sql,values);};
 for(const [index,scenario] of sampleScenarios.slice(0,2).entries()){
  const knowledgeName='Demo / Sample: '+scenario.name+' guidance';await insert('knowledge_collections',knowledgeName,"INSERT INTO knowledge_collections(id,owner_id,book,name,content) VALUES($1,'samples.demo','SIMULATION',$2,$3)",[randomUUID(),knowledgeName,'Fabricated guidance: cite provided evidence, identify unverified claims and preserve the spending ceiling. Scenario '+(index+1)]);
  const name='Demo / Sample: '+scenario.name+' template';await insert('job_templates',name,"INSERT INTO job_templates(id,owner_id,book,name,blueprint) VALUES($1,'samples.demo','SIMULATION',$2,$3)",[randomUUID(),name,{title:scenario.name+' comparison',description:'Compare the fabricated sample sources and explain the tradeoffs.',category:scenario.category,nearYocto:String(4n*Q),deadlineMinutes:10080,approvalPolicy:'MANUAL_APPROVAL',runtimeMode:'DETERMINISTIC',input:{sources:scenario.sources},criteria}]);
 }
 const program='Demo / Sample: paused weekly review';await insert('workspace_programs',program,"INSERT INTO workspace_programs(id,owner_id,book,kind,state,name,data,next_run_at) VALUES($1,'samples.demo','SIMULATION','RECURRING','PAUSED',$2,$3,null)",[randomUUID(),program,{sample:true,autoFundSimulation:false,agentIds:['format-reviewer'],weekday:1,hour:9,minute:0,timeZone:'UTC',monthlyCapYocto:String(8n*Q),blueprint:{title:'Demo / Sample weekly review',description:'A paused fabricated program; no scheduled execution or automatic funding.',category:'review',nearYocto:String(Q),deadlineMinutes:10080,approvalPolicy:'MANUAL_APPROVAL',runtimeMode:'DETERMINISTIC',input:{sources:sampleScenarios[0].sources},criteria}}]);
 return (await db.query("SELECT count(*)::int AS count FROM jobs WHERE client_id='samples.demo' AND data->>'seededExample' LIKE 'rich-v1-%'")).rows[0].count;
}
