import {z} from 'zod';
import {type FastifyInstance} from 'fastify';
import {actor} from './auth.js';
import {pool} from './db.js';
import {loadJob,mutate} from './market.js';
import {assert} from './domain.js';
import {requireWorkspaceRole} from './workspace-access.js';
export async function knowledgeAccessRoutes(app:FastifyInstance){
 app.get('/api/v1/jobs/:id/knowledge-access',async(req:any)=>{const a=await actor(req),j=await loadJob(pool,z.uuid().parse(req.params.id),a);const [grants,manifests]=await Promise.all([pool.query('SELECT id,snapshot_id,recipient,scope,active,created_at FROM knowledge_grants WHERE job_id=$1 AND ($2::text IS NULL OR recipient=$2) ORDER BY created_at',[j.parent_id||j.id,j.parent_id?j.agent_id:null]),pool.query('SELECT m.* FROM run_input_manifests m JOIN jobs run_job ON run_job.id=m.job_id WHERE run_job.id=$1 OR run_job.parent_id=$1 ORDER BY m.created_at',[j.id])]);return {snapshots:(j.data.input?.knowledge||[]).map((k:any)=>({id:k.id,name:k.name,sha256:k.sha256})),grants:grants.rows,manifests:manifests.rows,notice:'Revocation stops future runs. It cannot recall information already delivered. Server administrators are trusted; this is not a TEE.'};});
 app.post('/api/v1/jobs/:id/knowledge-grants/:grantId/revoke',async(req:any)=>{const a=await actor(req);requireWorkspaceRole(a,'OWNER');return mutate(a,req.headers['idempotency-key'],{path:'revoke-knowledge',params:req.params,workspace:a.workspaceId},async db=>{const j=await loadJob(db,z.uuid().parse(req.params.id),a,true);assert(j.client_id===a.id,'FORBIDDEN','Only the client can revoke future execution access.',403);const r=await db.query('UPDATE knowledge_grants SET active=false WHERE id=$1 AND job_id=$2 RETURNING id',[z.uuid().parse(req.params.grantId),j.id]);assert(r.rowCount,'NOT_FOUND','Grant not found.',404);return {ok:true};});});
}
