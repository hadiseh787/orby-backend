import { randomUUID } from "node:crypto";
import { pool, transaction } from "./db.js";
import { loadJob, updateJob, event, fundChild, settleJob } from "./market.js";
import { hash, evaluate, terminal } from "./domain.js";
import { runModel, deterministicBrief } from "./runtime.js";
import { config } from "./config.js";
import { tickNear } from "./near.js";
import {executionInput,recordInputManifest} from './execution-input.js';
import {tickBenchmarks} from './quality.js';
import {tickNegotiations} from './negotiations.js';
import {tickPrograms} from './programs.js';
import {executeModel,executionChecks} from './model-execution.js';
let stopping = false;
const activeTicks=new Set<Promise<void>>();
export async function stopWorker() {
  stopping=true;
  await Promise.all([...activeTicks]);
}
export function tick() {
  if(stopping)return Promise.resolve();
  const running=tickOnce();activeTicks.add(running);
  return running.finally(()=>activeTicks.delete(running));
}
async function tickOnce() {
  const task = await transaction(async (db) => {
    const t = (
      await db.query(
        "SELECT o.* FROM outbox_jobs o JOIN jobs j ON j.id=o.job_id WHERE j.book='SIMULATION' AND o.type='EXECUTE' AND (o.state='QUEUED' OR (o.state='RUNNING' AND o.lease_until<now())) AND o.next_attempt<=now() ORDER BY o.next_attempt FOR UPDATE OF o SKIP LOCKED LIMIT 1",
      )
    ).rows[0];
    if (!t) return null;
    await db.query(
      "UPDATE outbox_jobs SET state='RUNNING',attempts=attempts+1,lease_until=now()+interval '3 minutes' WHERE id=$1",
      [t.id],
    );
    const j = await loadJob(db, t.job_id, undefined, true);
    if (
      j.book !== "SIMULATION" ||
      !["FUNDED", "RUNNING", "REVISION_REQUIRED"].includes(j.state)
    ) {
      await db.query("UPDATE outbox_jobs SET state='DONE' WHERE id=$1", [t.id]);
      return null;
    }
    if (j.state === "FUNDED") {
      if (j.data.startDeadline < Date.now()) {
        await db.query(
          "UPDATE outbox_jobs SET state='FAILED',error='Start deadline elapsed' WHERE id=$1",
          [t.id],
        );
        return null;
      }
      await updateJob(db, j, "RUNNING", { startedAt: Date.now() });
      await event(db, j.id, j.data.creatorId, "execution_started");
    }
    const runId = j.id + ":revision:" + j.data.revision;
    await db.query(
      "INSERT INTO runs(id,job_id,agent_id,state) VALUES($1,$2,$3,'RUNNING') ON CONFLICT(id) DO NOTHING",
      [runId, j.id, j.agent_id],
    );
    if (
      !j.parent_id &&
      j.agent_id === "brief-writer" &&
      j.data.childrenCreated === 0
    ) {
      const child = await fundChild(
        db,
        j,
        j.data.missionPlan?.specialist?.agentId||'source-extractor',
        j.data.missionPlan?.specialist?.amount||String(10n ** 24n),
      );
      await db.query("INSERT INTO outbox_jobs(id,job_id,type) VALUES($1,$2,'EXECUTE') ON CONFLICT DO NOTHING",[randomUUID(),child.id]);
    }
    if(!j.parent_id&&j.data.childrenCreated>0){
      const children=(await db.query('SELECT * FROM jobs WHERE parent_id=$1 ORDER BY created_at',[j.id])).rows;
      if(children.some(child=>!terminal(child.state))){await db.query("UPDATE outbox_jobs SET state='QUEUED',next_attempt=now(),lease_until=null WHERE id=$1",[t.id]);return null;}
      if(children.some(child=>child.state!=='SETTLED')){await updateJob(db,j,'DISPUTED');await db.query("UPDATE outbox_jobs SET state='DONE' WHERE id=$1",[t.id]);return null;}
      const deliveries=(await db.query('SELECT DISTINCT ON(d.job_id) d.* FROM deliveries d JOIN jobs child ON child.id=d.job_id WHERE child.parent_id=$1 ORDER BY d.job_id,d.revision DESC',[j.id])).rows;
      if(deliveries.length!==children.length||deliveries.some(d=>d.checks.some((c:any)=>c.required&&c.result!=='PASS'))){await updateJob(db,j,'DISPUTED');await db.query("UPDATE outbox_jobs SET state='DONE' WHERE id=$1",[t.id]);return null;}
      j.data.runtimeInput=executionInput(j,{sources:deliveries.flatMap(d=>d.content.comparison.map((row:any)=>({id:row.sources[0],text:row.evidence||row.strengths+' '+row.limits}))),delegatedEvidenceHashes:deliveries.map(d=>d.hash)});
    }
    return { ...t, job: j, runId };
  });
  if (task) {
    try {
      const input=executionInput(task.job,task.job.data.runtimeInput);await recordInputManifest(pool,task.job,input,task.runId);
      const result=await executeModel(task.job,input,task.job.data.revision);
      await pool.query('UPDATE run_input_manifests SET manifest=manifest||$3::jsonb WHERE job_id=$1 AND run_key=$2',[task.job.id,task.runId,{runtimeAccepted:true,executionMode:result.mode}]);
      await transaction(async (db) => {
        const j = await loadJob(db, task.job_id, undefined, true);
        if (j.state !== "RUNNING" && j.state !== "REVISION_REQUIRED") {
          await db.query("UPDATE outbox_jobs SET state='DONE' WHERE id=$1", [
            task.id,
          ]);
          return;
        }
        if (Date.now() > j.data.deadline) {
          await db.query(
            "UPDATE outbox_jobs SET state='FAILED',error='Delivery deadline elapsed' WHERE id=$1",
            [task.id],
          );
          return;
        }
        const deliveredRevision=j.data.revision;
        const checks = executionChecks(j,deliveredRevision,result,evaluate(
            result.content,
            j.data.criteria,
            j.data.input.sources || [],
          )),
          failed = checks.some(
            (c: any) =>
              c.required && c.type === "AUTO_CHECK" && c.result === "FAIL",
          );
        await db.query(
          "INSERT INTO deliveries(id,job_id,revision,content,hash,checks) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(job_id,revision) DO NOTHING",
          [
            randomUUID(),
            j.id,
            j.data.revision,
            result.content,
            hash(result.content),
            JSON.stringify(checks),
          ],
        );
        const state = failed
          ? j.data.revision === 0
            ? "REVISION_REQUIRED"
            : "DISPUTED"
          : "REVIEW_OPEN";
        await updateJob(db, j, state, {
          executionMode: result.mode,
          modelUsage:result.usage,
          deliveryHash: hash(result.content),
          reviewDeadline: Date.now() + (config.accelerated ? 90000 : 86400000),
          revisionDeadline: Math.min(j.data.deadline, Date.now() + 43200000),
          ...(state==='REVISION_REQUIRED'&&j.parent_id?{revision:1}:{}),
        });
        await event(db, j.id, j.data.creatorId, "delivery_recorded", {
          hash: hash(result.content),
          mode: result.mode,
          revision: deliveredRevision,
        });
        await event(db, j.id, "evaluator", "checks_recorded", { failed });
        if(j.parent_id&&state==='REVIEW_OPEN'){await settleJob(db,j,'evaluator',10000,0,'Required child acceptance checks passed');}
        if(state==='REVISION_REQUIRED'&&j.parent_id){await db.query("UPDATE outbox_jobs SET state='QUEUED',attempts=0,next_attempt=now(),lease_until=null WHERE id=$1",[task.id]);}
        if (state === "DISPUTED")
          await db.query(
            "INSERT INTO disputes(id,job_id,actor,reason,evidence_hash,deadline) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(job_id) DO NOTHING",
            [
              randomUUID(),
              j.id,
              "evaluator",
              "Required checks failed after one revision.",
              hash(checks),
              new Date(Date.now() + (config.accelerated ? 180000 : 172800000)),
            ],
          );
        await db.query(
          "UPDATE runs SET state='SUCCEEDED',data=$2,updated_at=now() WHERE id=$1",
          [task.runId, { hash: hash(result.content), mode: result.mode }],
        );
        await db.query(
          "UPDATE outbox_jobs SET state='DONE',lease_until=null WHERE id=$1",
          [task.id],
        );
        if(state==='REVISION_REQUIRED'&&j.parent_id)await db.query("UPDATE outbox_jobs SET state='QUEUED',next_attempt=now() WHERE id=$1",[task.id]);
      });
    } catch (e: any) {
      await pool.query(
        "UPDATE outbox_jobs SET state=CASE WHEN attempts>=3 THEN 'FAILED' ELSE 'QUEUED' END,error=$2,next_attempt=now()+interval '10 seconds',lease_until=null WHERE id=$1",
        [task.id, String(e.message).slice(0, 500)],
      );
      await pool.query("UPDATE runs SET state='FAILED',data=$2 WHERE id=$1", [
        task.runId,
        {
          code: "RUNTIME_UNAVAILABLE",
          message: "Runtime unavailable. Retry the same run after recovery.",
        },
      ]);
    }
  }
  const due = (
    await pool.query(
      "SELECT id FROM jobs WHERE book='SIMULATION' AND state='REVIEW_OPEN' AND data->>'approvalPolicy'='AUTO_AFTER_CHECKS' AND (data->>'reviewDeadline')::bigint<$1 LIMIT 20",
      [Date.now()],
    )
  ).rows;
  for (const row of due)
    await transaction(async (db) => {
      const j = await loadJob(db, row.id, undefined, true);
      if (j.state !== "REVIEW_OPEN") return;
      const d = (
        await db.query(
          "SELECT checks FROM deliveries WHERE job_id=$1 ORDER BY revision DESC LIMIT 1",
          [j.id],
        )
      ).rows[0];
      if (
        d &&
        d.checks.every(
          (c: any) =>
            !c.required || (c.type === "AUTO_CHECK" && c.result === "PASS"),
        )
      )
        await settleJob(db, j, "scheduler");
    });
}
export async function runQueues(queues:{name:string;task:()=>Promise<void>;interval:number}[],shouldStop=()=>stopping){
 await Promise.all(queues.map(async q=>{while(!shouldStop()){try{await q.task();}catch(e:any){console.error(q.name+':',e.message);}if(!shouldStop())await new Promise(r=>setTimeout(r,q.interval));}}));
}
if (process.argv[1]?.replaceAll("\\", "/").match(/worker\.(ts|js)$/)) {
  console.log("Worker ready. PostgreSQL leases protect concurrent consumers.");
  process.on("SIGTERM", () => {
    stopping = true;
  });
  process.on("SIGINT", () => {
    stopping = true;
  });
  // A slow RPC or model suite must not starve the independent simulation queue.
  await runQueues([
    {name:'Simulation',task:tick,interval:500},
    {name:'Testnet',task:async()=>{await tickNear();if(!stopping)await tickNegotiations();},interval:1000},
    {name:'Programs',task:tickPrograms,interval:2000},
    {name:'Quality lab',task:tickBenchmarks,interval:2000},
  ]);
  await pool.end();
}
