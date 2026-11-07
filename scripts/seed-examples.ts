import {type DB} from '../src/db.js';
import {type Actor} from '../src/auth.js';
import {createJob,requestBids,preview,fund,loadJob,updateJob,settleJob} from '../src/market.js';
import {deterministicBrief} from '../src/runtime.js';
import {hash,evaluate} from '../src/domain.js';
import {randomUUID} from 'node:crypto';

export async function seedExamples(db:DB,sources:any[],criteria:any[]) {
  if((await db.query("SELECT data FROM price_snapshots WHERE id='system-config'")).rows[0]?.data?.paused)return;
  const client:Actor={id:'alex.demo',book:'SIMULATION',roles:['client'],csrf:''};
  for(const state of ['open','settled']){
    const marker=state+'-v1';
    if((await db.query("SELECT 1 FROM jobs WHERE book='SIMULATION' AND data->>'seededExample'=$1",[marker])).rowCount)continue;
    const job=await createJob(db,client,{title:'Example: '+(state==='open'?'compare supplied proposals':'completed proposal review'),description:'Simulation example using supplied source material. No testnet tokens or external wallet actions.',category:'review',nearYocto:'1000000000000000000000000',deadlineMinutes:10080,approvalPolicy:'MANUAL_APPROVAL',input:{sources},criteria,attachmentIds:[],attachments:[],seededExample:marker});
    if(state==='open')continue;
    await requestBids(db,client,job.id);
    const bid=(await db.query("SELECT id FROM bids WHERE job_id=$1 AND agent_id='format-reviewer'",[job.id])).rows[0];
    if(!bid)throw Error('Example reviewer bid is unavailable.');
    const pv=await preview(db,client,job.id,bid.id);await fund(db,client,job.id,pv.id);
    const row=await loadJob(db,job.id),content=deterministicBrief({sources}),checks=evaluate(content,criteria,sources);
    await db.query('INSERT INTO deliveries(id,job_id,revision,content,hash,checks) VALUES($1,$2,0,$3,$4,$5)',[randomUUID(),job.id,content,hash(content),JSON.stringify(checks)]);
    await updateJob(db,row,'REVIEW_OPEN',{executionMode:'DETERMINISTIC',reviewDeadline:Date.now()});
    await settleJob(db,row,client.id);
    await db.query("UPDATE outbox_jobs SET state='DONE' WHERE job_id=$1",[job.id]);
  }
}
