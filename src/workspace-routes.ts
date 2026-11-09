import {randomUUID} from 'node:crypto';
import {type FastifyInstance} from 'fastify';
import {z} from 'zod';
import {actor} from './auth.js';
import {pool} from './db.js';
import {mutate,loadJob,updateJob} from './market.js';
import {assert,hash} from './domain.js';
import {latestDelivery,recordDecision} from './delivery-decisions.js';
import {proposal} from './near.js';
import {requireWorkspaceRole} from './workspace-access.js';
import {config} from './config.js';

export async function workspaceRoutes(app:FastifyInstance) {
  const post=(path:string,handler:(db:any,a:any,b:any,p:any)=>Promise<any>)=>app.post('/api/v1'+path,async(req:any)=>{
    const a=await actor(req);requireWorkspaceRole(a,'OWNER');return mutate(a,req.headers['idempotency-key'],{path,params:req.params,body:req.body||{},workspace:a.workspaceId},db=>handler(db,a,req.body||{},req.params));
  });
  app.get('/api/v1/templates/personal',async req=>{const a=await actor(req);return (await pool.query('SELECT * FROM job_templates WHERE workspace_id=$1 AND book=$2 ORDER BY created_at DESC LIMIT 50',[a.workspaceId,a.book])).rows;});
  post('/templates/from-job/:id',async(db,a,b,p)=>{
    const j=await loadJob(db,z.uuid().parse(p.id),a);
    assert(j.client_id===a.id&&j.state==='SETTLED','INVALID_STATE','Create a personal template from your own completed job.');
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['templates:'+a.id]);
    const count=Number((await db.query('SELECT count(*) FROM job_templates WHERE owner_id=$1 AND book=$2',[a.id,a.book])).rows[0].count);
    assert(count<50,'TEMPLATE_LIMIT','Keep up to 50 personal templates.');
    const id=randomUUID(),name=z.string().trim().min(3).max(120).parse(b.name||j.data.title);
    const blueprint={title:j.data.title,description:j.data.description,category:j.data.category,deadlineDays:Math.max(1,Math.ceil(j.data.deadlineMinutes/1440)),approvalPolicy:j.data.approvalPolicy,criteria:j.data.criteria};
    await db.query('INSERT INTO job_templates(id,owner_id,book,name,blueprint,workspace_id) VALUES($1,$2,$3,$4,$5,$6)',[id,a.id,a.book,name,blueprint,a.workspaceId]);return {id,name,blueprint};
  });
  post('/templates/:id/remove',async(db,a,b,p)=>{const r=await db.query('DELETE FROM job_templates WHERE id=$1 AND workspace_id=$2 AND book=$3 RETURNING id',[z.uuid().parse(p.id),a.workspaceId,a.book]);assert(r.rowCount,'NOT_FOUND','Template not found.',404);return {ok:true};});
  post('/jobs/:id/revisions',async(db,a,b,p)=>{
    const j=await loadJob(db,z.uuid().parse(p.id),a,true);
    assert(j.client_id===a.id&&j.state==='REVIEW_OPEN'&&j.data.revision===0,'INVALID_STATE','One revision can be requested while the first delivery is awaiting your review.');
    assert(j.data.deadline>Date.now(),'JOB_EXPIRED','The delivery deadline has elapsed.');
    const reason=z.string().trim().min(10).max(2000).parse(b.reason),section=z.string().max(120).parse(b.section||'Entire delivery');
    const d=await latestDelivery(db,j,z.number().int().parse(b.revision),z.string().length(64).parse(b.deliveryHash));
    const sourceId=b.sourceId?z.string().max(80).parse(b.sourceId):undefined;
    if(sourceId)assert(j.data.input.sources.some((s:any)=>s.id===sourceId),'INVALID_SOURCE','This source does not belong to the job.');
    const feedback={reason,section,revision:d.revision,deliveryHash:d.hash,...(sourceId?{sourceId}:{})};
    if(a.book==='TESTNET'){
      const result=await proposal(db,a.id,'request_revision',{job_id:j.id,revision:d.revision,delivery_hash:d.hash,feedback_hash:hash(feedback)},'0',j.id);
      await db.query('UPDATE chain_operations SET context=$2 WHERE id=$1',[result.operation.operationId,{feedback}]);return result;
    }
    if(sourceId)await recordDecision(db,j,a.id,'EVIDENCE_FLAG',d,feedback);
    await recordDecision(db,j,a.id,'REVISION_REQUEST',d,feedback);
    await updateJob(db,j,'REVISION_REQUIRED',{revision:1,revisionFeedback:feedback,revisionDeadline:j.data.deadline});
    await db.query("INSERT INTO outbox_jobs(id,job_id,type) VALUES($1,$2,'EXECUTE') ON CONFLICT(job_id,type) DO UPDATE SET state='QUEUED',attempts=0,next_attempt=now(),error=null",[randomUUID(),j.id]);
    return {ok:true};
  });
  post('/jobs/:id/evidence-feedback',async(db,a,b,p)=>{
    const j=await loadJob(db,z.uuid().parse(p.id),a,true),d=await latestDelivery(db,j,z.number().int().parse(b.revision),z.string().length(64).parse(b.deliveryHash));
    const section=z.string().min(1).max(120).parse(b.section),reason=z.string().trim().min(10).max(2000).parse(b.reason);
    await recordDecision(db,j,a.id,'EVIDENCE_FLAG',d,{section,reason});return {ok:true};
  });
  app.get('/api/v1/notifications',async req=>{
    const a=await actor(req);
    const rows=(await pool.query(`SELECT j.id,j.state,j.data->>'title' AS title,j.data->>'deadline' AS deadline,j.data->>'needsClientAction' AS needs_action,
      (SELECT count(*)::int FROM bids b WHERE b.job_id=j.id AND b.expires_at>now()) AS proposals,j.data->>'revision' AS revision,
      (SELECT jsonb_build_object('id',o.id,'proposal',o.proposal) FROM chain_operations o WHERE o.job_id=j.id AND o.account_id=$2 AND o.state='PREPARED' AND o.proposal->>'receiverId'=$3 ORDER BY o.created_at DESC LIMIT 1) AS pending_operation
      FROM jobs j LEFT JOIN agents ag ON ag.id=j.agent_id AND ag.book=j.book WHERE j.book=$1 AND j.parent_id IS NULL
      AND ((j.workspace_id=$4 AND j.state IN ('OPEN','REVIEW_OPEN','DISPUTED','FUNDED','RUNNING')) OR (ag.owner_id=$2 AND j.state='REVISION_REQUIRED')) ORDER BY j.updated_at DESC LIMIT 50`,[a.book,a.id,config.contract,a.workspaceId])).rows;
    return rows.filter(r=>r.pending_operation||(r.state==='OPEN'?r.proposals>0:['FUNDED','RUNNING'].includes(r.state)?r.needs_action==='true'||Number(r.deadline)-Date.now()<86400000:true)).map(r=>({...r,key:r.id+':'+r.state+':'+r.revision+':'+r.proposals,url:'/client/jobs/'+r.id}));
  });
}
