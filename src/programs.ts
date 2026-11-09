import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {pool,transaction,type DB} from './db.js';
import {type Actor,actor} from './auth.js';
import {assert,hash,Q,ceil} from './domain.js';
import {createJob,requestBids,preview,fund,mutate} from './market.js';
import {jobSchema,criterionSchema} from './job-schema.js';
import {requireWorkspaceRole} from './workspace-access.js';
import {config} from './config.js';
import {proposal} from './near.js';
import {type FastifyInstance} from 'fastify';

export function localParts(time:number,zone:string) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(time).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)])) as Record<string,number>;
}
export function nextWeekly(after:number,weekday:number,hour:number,minute:number,zone:string) {
  const p=localParts(after,zone),base=Date.UTC(p.year,p.month-1,p.day);
  // Skip nonexistent spring times; ambiguous autumn times use the first occurrence once.
  for(let d=0;d<16;d++){
    const day=new Date(base+d*86400000);if(day.getUTCDay()!==weekday)continue;
    const target=Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate(),hour,minute);let utc=target;
    for(let i=0;i<3;i++){const q=localParts(utc,zone);utc=target-(Date.UTC(q.year,q.month-1,q.day,q.hour,q.minute)-utc);}
    const matches:number[]=[];for(let delta=-7200000;delta<=7200000;delta+=900000){const candidate=utc+delta,q=localParts(candidate,zone);if(q.year===day.getUTCFullYear()&&q.month===day.getUTCMonth()+1&&q.day===day.getUTCDate()&&q.hour===hour&&q.minute===minute)matches.push(candidate);}
    const first=matches.sort((a,b)=>a-b)[0];if(first!==undefined&&first>after)return first;
  }
  throw Error('The selected weekly time could not be resolved.');
}
const near=z.string().regex(/^[1-9]\d{0,26}$/).refine(v=>BigInt(v)<=100n*Q);
const timeZone=z.string().max(80).refine(zone=>{try{new Intl.DateTimeFormat('en-US',{timeZone:zone});return true;}catch{return false;}},'Use a valid IANA time zone, for example Asia/Tehran.').default('UTC');
const programSchema=z.object({name:z.string().trim().min(3).max(100),kind:z.enum(['RECURRING','MILESTONES','TRIALS']),blueprint:jobSchema,agentIds:z.array(z.string().regex(/^[a-z0-9-]{3,48}$/)).min(1).max(3),autoFundSimulation:z.boolean().default(false),monthlyCapYocto:near.optional(),weekday:z.number().int().min(0).max(6).default(1),hour:z.number().int().min(0).max(23).default(9),minute:z.number().int().min(0).max(59).default(0),timeZone,stages:z.array(z.object({title:z.string().min(5).max(100),budget:near,description:z.string().min(10).max(8000).optional(),criteria:z.array(criterionSchema).min(1).max(20).optional(),approvalPolicy:z.enum(['MANUAL_APPROVAL','AUTO_AFTER_CHECKS']).optional()})).max(10).default([])});
function runBlueprint(data:any,stage:any){
  const {usdMicro,...blueprint}=data.blueprint;
  return jobSchema.parse({...blueprint,title:stage.title.slice(0,120),nearYocto:stage.budget,attachmentIds:[],description:stage.description||blueprint.description,criteria:stage.criteria||blueprint.criteria,approvalPolicy:stage.approvalPolicy||blueprint.approvalPolicy});
}

export async function knowledgeSnapshot(db:DB,a:Actor,ids:string[]) {
  if(!ids.length)return [];
  const rows=(await db.query('SELECT id,name,content FROM knowledge_collections WHERE id=ANY($1::uuid[]) AND workspace_id=$2 AND book=$3 ORDER BY id',[ids,a.workspaceId,a.book])).rows;
  assert(rows.length===ids.length,'FORBIDDEN','A knowledge collection is missing or belongs to another account.',403);
  return rows.map(r=>({id:r.id,name:r.name,text:r.content,sha256:hash(r.content)}));
}
async function ownedProgram(db:DB,a:Actor,id:string) {
  const row=(await db.query('SELECT * FROM workspace_programs WHERE id=$1 AND workspace_id=$2 AND book=$3 FOR UPDATE',[z.uuid().parse(id),a.workspaceId,a.book])).rows[0];
  assert(row,'NOT_FOUND','Program not found.',404);return row;
}
export async function launchProgram(db:DB,a:Actor,program:any,time=Date.now(),scheduled=false) {
  assert(program.state==='ACTIVE','INVALID_STATE','This program is paused or complete.');
  const data=program.data,runs=(await db.query('SELECT r.*,j.state FROM program_runs r JOIN jobs j ON j.id=r.job_id WHERE program_id=$1 ORDER BY r.created_at,r.slot',[program.id])).rows;
  const p=localParts(time,data.timeZone),period=p.year+'-'+String(p.month).padStart(2,'0');
  const existingTotal=runs.filter(r=>r.period===period&&r.state!=='CANCELLED').reduce((n,r)=>n+BigInt(r.reserved_yocto),0n);
  let stages:any[];
  if(program.kind==='MILESTONES'){
    assert(runs.length<data.stages.length,'PROGRAM_COMPLETE','All milestones have been created.');
    assert(!runs.length||runs[runs.length-1].state==='SETTLED','MILESTONE_WAITING','Approve and settle the current milestone before opening the next.');
    stages=[{...data.stages[runs.length],slot:'stage:'+runs.length,agentId:data.agentIds[0]}];
  }else if(program.kind==='TRIALS'){
    assert(!runs.length,'PROGRAM_COMPLETE','Trial jobs have already been created.');
    stages=data.agentIds.map((agentId:string,i:number)=>({title:'Trial '+(i+1)+': '+program.name,budget:data.blueprint.nearYocto,slot:'trial:'+agentId,agentId}));
  }else stages=[{title:program.name,budget:data.blueprint.nearYocto,slot:scheduled?'scheduled:'+new Date(program.next_run_at).toISOString():'manual:'+randomUUID(),agentId:data.agentIds[0]}];
  let total=existingTotal;const result=[];
  for(const stage of stages){
    const reserved=ceil(BigInt(stage.budget)*11000n,10000n);total+=reserved;
    if(program.kind==='RECURRING')assert(total<=BigInt(data.monthlyCapYocto),'MONTHLY_CAP','This run would exceed the monthly escrow commitment ceiling.');
    const parsed=runBlueprint(data,stage);
    const knowledge=await knowledgeSnapshot(db,a,parsed.knowledgeIds);
    assert(Buffer.byteLength(JSON.stringify({...parsed.input,knowledge}))<=262144,'INPUT_TOO_LARGE','Combined sources and knowledge exceed 256 KiB.');
    const job=await createJob(db,a,{...parsed,input:{...parsed.input,knowledge,knowledgeAccess:{main:parsed.knowledgeIds,children:parsed.knowledgeChildGrants}},attachments:[],program:{id:program.id,kind:program.kind,slot:stage.slot,policyHash:hash(data)},preferredAgentId:stage.agentId});
    await db.query('INSERT INTO program_runs(id,program_id,job_id,slot,reserved_yocto,period) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),program.id,job.id,stage.slot,String(reserved),period]);
    let operation:any=null;
    if(a.book==='TESTNET')operation=(await proposal(db,a.id,'open_near_job',{job_id:job.id,terms_hash:job.termsHash,budget:job.nearYocto,deadline_ms:String(job.deadline),manual:job.approvalPolicy==='MANUAL_APPROVAL'},'0',job.id)).operation;
    else{
      await requestBids(db,a,job.id);
      if(data.autoFundSimulation){
        const bid=(await db.query('SELECT id FROM bids WHERE job_id=$1 AND agent_id=$2',[job.id,stage.agentId])).rows[0];
        assert(bid,'AGENT_UNAVAILABLE','The selected agent cannot meet this run budget.');
        const pv=await preview(db,a,job.id,bid.id);await fund(db,a,job.id,pv.id);
      }
    }
    result.push({id:job.id,title:job.title,operation,reservedYocto:String(reserved)});
  }
  if(program.kind==='RECURRING')await db.query('UPDATE workspace_programs SET next_run_at=$2 WHERE id=$1',[program.id,new Date(nextWeekly(time,data.weekday,data.hour,data.minute,data.timeZone))]);
  return {runs:result};
}

export async function tickPrograms(time=Date.now()) {
  const due=(await pool.query("SELECT id,owner_id,book,workspace_id FROM workspace_programs WHERE state='ACTIVE' AND kind='RECURRING' AND next_run_at<=$1 ORDER BY next_run_at LIMIT 5",[new Date(time)])).rows;
  for(const row of due)await transaction(async db=>{
    const a:Actor={id:row.owner_id,book:row.book,roles:['client'],csrf:'',workspaceId:row.workspace_id,workspaceRole:'OWNER'},p=await ownedProgram(db,a,row.id);
    if(p.state!=='ACTIVE'||new Date(p.next_run_at).getTime()>time)return;
    try{await db.query('SAVEPOINT scheduled_run');await launchProgram(db,a,p,time,true);await db.query('RELEASE SAVEPOINT scheduled_run');await db.query("UPDATE workspace_programs SET data=data-'lastError' WHERE id=$1",[p.id]);}
    catch(error:any){await db.query('ROLLBACK TO SAVEPOINT scheduled_run');await db.query("UPDATE workspace_programs SET state='PAUSED',data=data||$2::jsonb WHERE id=$1",[p.id,JSON.stringify({lastError:error.message})]);}
  });
}
export async function programRoutes(app:FastifyInstance) {
  const post=(path:string,fn:any)=>app.post('/api/v1'+path,async(req:any)=>{const a=await actor(req);requireWorkspaceRole(a,'OWNER');return mutate(a,req.headers['idempotency-key'],{path,params:req.params,body:req.body||{},workspace:a.workspaceId},db=>fn(db,a,req.body||{},req.params));});
  app.get('/api/v1/knowledge',async req=>{const a=await actor(req);return (await pool.query('SELECT id,name,content,updated_at FROM knowledge_collections WHERE workspace_id=$1 AND book=$2 ORDER BY name',[a.workspaceId,a.book])).rows;});
  post('/knowledge',async(db:DB,a:Actor,b:any)=>{
    const value=z.object({name:z.string().trim().min(3).max(100),content:z.string().trim().min(10).max(80000),id:z.uuid().optional()}).parse(b);
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['knowledge:'+a.id]);
    const usage=(await db.query('SELECT count(*)::int AS count,COALESCE(sum(octet_length(content)),0)::int AS bytes FROM knowledge_collections WHERE owner_id=$1',[a.id])).rows[0];
    assert(usage.count<25||value.id,'KNOWLEDGE_LIMIT','Keep up to 25 knowledge collections.');
    const oldBytes=value.id?Number((await db.query('SELECT octet_length(content) AS bytes FROM knowledge_collections WHERE id=$1 AND workspace_id=$2 AND book=$3',[value.id,a.workspaceId,a.book])).rows[0]?.bytes||0):0;
    assert(usage.bytes-oldBytes+Buffer.byteLength(value.content)<=2097152,'KNOWLEDGE_LIMIT','Knowledge storage is limited to 2 MiB per account.');
    const id=value.id||randomUUID();if(value.id){const r=await db.query('UPDATE knowledge_collections SET name=$4,content=$5,updated_at=now() WHERE id=$1 AND workspace_id=$2 AND book=$3 RETURNING id',[id,a.workspaceId,a.book,value.name,value.content]);assert(r.rowCount,'NOT_FOUND','Collection not found.',404);}else await db.query('INSERT INTO knowledge_collections(id,owner_id,book,name,content,workspace_id) VALUES($1,$2,$3,$4,$5,$6)',[id,a.id,a.book,value.name,value.content,a.workspaceId]);return {id};
  });
  post('/knowledge/:id/remove',async(db:DB,a:Actor,b:any,p:any)=>{const r=await db.query('DELETE FROM knowledge_collections WHERE id=$1 AND workspace_id=$2 AND book=$3 RETURNING id',[z.uuid().parse(p.id),a.workspaceId,a.book]);assert(r.rowCount,'NOT_FOUND','Collection not found.',404);return {ok:true};});
  app.get('/api/v1/programs',async req=>{const a=await actor(req);const programs=(await pool.query('SELECT * FROM workspace_programs WHERE workspace_id=$1 AND book=$2 ORDER BY created_at DESC LIMIT 50',[a.workspaceId,a.book])).rows;for(const p of programs)p.runs=(await pool.query("SELECT r.*,j.state,j.data->>'title' AS title,(SELECT proposal FROM chain_operations o WHERE o.job_id=j.id AND o.account_id=$2 AND o.state='PREPARED' AND o.proposal->>'receiverId'=$3 AND o.proposal->>'methodName'='open_near_job' ORDER BY o.created_at DESC LIMIT 1) AS operation FROM program_runs r JOIN jobs j ON j.id=r.job_id WHERE r.program_id=$1 ORDER BY r.created_at,r.slot",[p.id,a.id,config.contract])).rows;return programs;});
  post('/programs',async(db:DB,a:Actor,b:any)=>{
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['programs:'+a.id]);
    assert(Number((await db.query('SELECT count(*) FROM workspace_programs WHERE owner_id=$1',[a.id])).rows[0].count)<50,'PROGRAM_LIMIT','Keep up to 50 programs per account.');
    const data=programSchema.parse(b);assert(data.blueprint.nearYocto,'NATIVE_ONLY','Programs use native NEAR budgets.');assert(!data.blueprint.attachmentIds.length,'FILES_NOT_COPIED','Add files to each run separately.');
    localParts(Date.now(),data.timeZone);
    if(data.kind==='RECURRING')assert(data.monthlyCapYocto,'MONTHLY_CAP','Set a monthly escrow commitment ceiling.');
    if(data.kind==='MILESTONES'){assert(data.stages.length>=2,'INVALID_STAGES','Add at least two milestones.');for(const stage of data.stages)runBlueprint(data,stage);}
    if(data.kind==='TRIALS')assert(data.agentIds.length>=2&&new Set(data.agentIds).size===data.agentIds.length,'INVALID_AGENTS','Choose two or three different agents. Each successful trial is paid separately.');
    for(const id of data.agentIds)assert((await db.query("SELECT 1 FROM agents WHERE id=$1 AND book=$2 AND state='ACTIVE'",[id,a.book])).rowCount,'AGENT_UNAVAILABLE','A selected agent is unavailable.');
    const id=randomUUID(),next=data.kind==='RECURRING'?new Date(nextWeekly(Date.now(),data.weekday,data.hour,data.minute,data.timeZone)):null;
    await db.query('INSERT INTO workspace_programs(id,owner_id,book,kind,name,data,next_run_at,workspace_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,a.id,a.book,data.kind,data.name,data,next,a.workspaceId]);return {id};
  });
  post('/programs/:id/launch',async(db:DB,a:Actor,b:any,p:any)=>launchProgram(db,a,await ownedProgram(db,a,p.id)));
  post('/programs/:id/state',async(db:DB,a:Actor,b:any,p:any)=>{const program=await ownedProgram(db,a,p.id),state=z.enum(['ACTIVE','PAUSED','COMPLETED']).parse(b.state),next=state==='ACTIVE'&&program.kind==='RECURRING'?new Date(nextWeekly(Date.now(),program.data.weekday,program.data.hour,program.data.minute,program.data.timeZone)):program.next_run_at;await db.query("UPDATE workspace_programs SET state=$2,next_run_at=$3,data=data-'lastError' WHERE id=$1",[p.id,state,next]);return {ok:true};});
}
