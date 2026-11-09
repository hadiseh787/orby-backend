import {randomUUID} from 'node:crypto';
import {hash,assert} from './domain.js';
import {type DB} from './db.js';

export const inputSchemaVersion=2;
export function childCriteria(criteria:any[]){return criteria.filter(c=>c.type==='AUTO_CHECK'&&c.config?.check!=='word-count');}
export function scopedChildInput(input:any,agentId:string){
 const grants=input?.knowledgeAccess?.children||{};
 return {schemaVersion:inputSchemaVersion,sources:input?.sources||[],...(input?.sheetRows?{sheetRows:input.sheetRows,sheetHeaders:input.sheetHeaders||[]}:{}),knowledge:(input?.knowledge||[]).filter((k:any)=>(grants[agentId]||[]).includes(k.id)),knowledgeAccess:{main:grants[agentId]||[],children:{}}};
}
export function executionInput(job:any,derived?:any){
 const original=job.data?.input||job.input||{},data=job.data||job;
 return {...original,...derived,schemaVersion:inputSchemaVersion,knowledge:original.knowledge||[],brief:data.description,criteria:data.criteria||[],...(data.revisionFeedback?{revisionFeedback:data.revisionFeedback}:{})};
}
export async function recordInputManifest(db:DB,job:any,input:any,runKey:string){
 const granted=(await db.query('SELECT snapshot_id,active FROM knowledge_grants WHERE job_id=$1 AND recipient=$2',[job.parent_id||job.id,job.parent_id?job.agent_id:'MAIN'])).rows;
 const inactive=new Set(granted.filter(r=>!r.active).map(r=>r.snapshot_id));
 assert(!(input.knowledge||[]).some((k:any)=>inactive.has(k.id)),'KNOWLEDGE_ACCESS_REVOKED','A required knowledge grant was revoked. Future execution has stopped. Previously delivered data cannot be recalled.');
 const manifest={schemaVersion:inputSchemaVersion,mode:'INPUT_PREPARED_FOR_RUNTIME',sourceIds:input.sources.map((s:any)=>s.id),knowledge:(input.knowledge||[]).map((k:any)=>({id:k.id,name:k.name,sha256:k.sha256})),runtimeInputHash:hash(input)};
 await db.query('INSERT INTO run_input_manifests(id,job_id,run_key,agent_id,revision,input_hash,manifest) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(job_id,run_key) DO NOTHING',[randomUUID(),job.id,runKey,job.agent_id,job.data.revision,manifest.runtimeInputHash,manifest]);return manifest;
}
