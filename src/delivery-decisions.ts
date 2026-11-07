import {randomUUID} from 'node:crypto';
import {type DB} from './db.js';
import {assert} from './domain.js';

export async function latestDelivery(db:DB,job:any,revision?:number,deliveryHash?:string) {
  const d=(await db.query('SELECT * FROM deliveries WHERE job_id=$1 ORDER BY revision DESC LIMIT 1 FOR UPDATE',[job.id])).rows[0];
  assert(d,'INVALID_STATE','No delivery is available for this decision.');
  assert((revision===undefined||d.revision===revision)&&(!deliveryHash||d.hash===deliveryHash),'DELIVERY_CHANGED','The delivery changed. Review the current version before deciding.',409);
  return d;
}
export async function recordDecision(db:DB,job:any,actor:string,kind:string,delivery:any,details:any={}) {
  assert(actor===job.client_id,'FORBIDDEN','Only the client can decide on this delivery.',403);
  const result=await db.query('INSERT INTO delivery_decisions(id,job_id,revision,delivery_hash,actor,kind,section,reason,tx_hash,basis) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING *',[randomUUID(),job.id,delivery.revision,delivery.hash,actor,kind,details.section||'',details.reason||'',details.txHash||null,details.basis||'EXPLICIT_ACTION']);
  if(result.rowCount)await db.query('INSERT INTO job_events(job_id,actor,type,data) VALUES($1,$2,$3,$4)',[job.id,actor,kind==='APPROVE'?'client_approved':kind==='REVISION_REQUEST'?'revision_requested':'evidence_flagged',{revision:delivery.revision,deliveryHash:delivery.hash,...details}]);
  else if(details.txHash)await db.query('UPDATE delivery_decisions SET tx_hash=COALESCE(tx_hash,$7) WHERE job_id=$1 AND revision=$2 AND kind=$3 AND actor=$4 AND section=$5 AND delivery_hash=$6',[job.id,delivery.revision,kind,actor,details.section||'',delivery.hash,details.txHash]);
}
export function decisionChecks(delivery:any,decisions:any[],isTerminal=false) {
  const approval=decisions.find(d=>d.kind==='APPROVE'&&d.revision===delivery.revision&&d.delivery_hash===delivery.hash);
  return (delivery.checks||[]).map((c:any)=>c.type==='CLIENT_APPROVE'?(approval?{...c,result:'PASS',evidence:'Approved by '+approval.actor+' on '+new Date(approval.created_at).toISOString(),decision:approval}:isTerminal?{...c,result:'NOT_APPROVED',evidence:'No client approval was recorded for this version. The job is already closed under another contract outcome.'}:c):c);
}
