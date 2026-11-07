import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { type DB } from "./db.js";
import { assert, hash, agentMinimum } from "./domain.js";
import { connect, keyStores, KeyPair } from "near-api-js";
import { pool, transaction } from "./db.js";
import { runModel } from "./runtime.js";
import { evaluate } from "./domain.js";
export async function rpc(method: string, params: any) {
  const response = await fetch(config.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }),
    signal: AbortSignal.timeout(20000),
  });
  assert(
    response.ok,
    "RPC_UNAVAILABLE",
    "NEAR RPC is temporarily unavailable.",
    503,
  );
  const data: any = await response.json();
  assert(
    !data.error,
    "RPC_UNAVAILABLE",
    "NEAR RPC could not resolve this request.",
    503,
  );
  return data.result;
}
export async function view(method: string, args: any = {}) {
  assert(
    config.contract,
    "CHAIN_NOT_CONFIGURED",
    "No testnet contract is configured.",
    503,
  );
  const result = await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: config.contract,
    method_name: method,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(result.result).toString());
}
// Contract settlement and legacy conversions use this reference, never the display-only USD feed.
export async function agreementPrice(book: string) {
  if (book === 'SIMULATION') return {priceMicro:'5000000',quoteId:'fixed-demo-v1',source:'Simulation fixture',observedAt:Date.now()};
  const p = await view('get_price');
  assert(BigInt(p.price_micro || '0') > 0n && !p.quarantined &&
    (p.mode === 'FIXTURE' || Number(p.publish_time) >= Date.now() - 300000),
    'PRICE_STALE','The contract price is stale or quarantined. Refresh before continuing.',503);
  return {priceMicro:String(p.price_micro),quoteId:'contract:'+config.contract+':'+p.publish_time+':'+p.price_micro,source:'Contract '+p.mode,observedAt:Number(p.publish_time)};
}
export async function proposal(
  db: DB,
  account: string,
  method: string,
  args: any,
  deposit = "0",
  jobId: string | null = null,
) {
  assert(
    config.contract,
    "CHAIN_NOT_CONFIGURED",
    "Deploy the contract and configure NEAR_CONTRACT_ID first.",
    503,
  );
  let gasCapEstimateYocto:string|null=null;
  try{const price=await rpc('gas_price',[null]);gasCapEstimateYocto=String(150000000000000n*BigInt(price.gas_price));}catch{}
  const id = randomUUID(),
    requestId = randomUUID();
  const data = {
    operationId: id,
    requestId,
    network: "testnet",
    signerId: account,
    receiverId: config.contract,
    methodName: method,
    args: { ...args, request_id: requestId },
    attachedDepositYocto: deposit,
    gas: "150000000000000",
    gasCapEstimateYocto,
    storagePayer: "Contract-sponsored testnet storage; no separate product fee for this action.",
  };
  await db.query(
    "INSERT INTO chain_operations(id,request_id,account_id,job_id,state,payload_hash,proposal) VALUES($1,$2,$3,$4,'PREPARED',$5,$6)",
    [id, requestId, account, jobId, hash(data), data],
  );
  return { operation: data };
}
export async function reconcile(db: DB, op: any, txHash: string) {
  assert(
    /^[1-9A-HJ-NP-Za-km-z]{40,50}$/.test(txHash),
    "INVALID_TRANSACTION",
    "Invalid transaction hash.",
  );
  assert(
    !op.tx_hash || op.tx_hash === txHash,
    "IDEMPOTENCY_CONFLICT",
    "An operation cannot switch to another transaction.",
  );
  await db.query(
    "UPDATE chain_operations SET state='SUBMITTED',tx_hash=$2,updated_at=now() WHERE id=$1",
    [op.id, txHash],
  );
  let result: any;
  try {
    result = await rpc("tx", {
      tx_hash: txHash,
      sender_account_id: op.account_id,
      wait_until: "FINAL",
    });
  } catch {
    await db.query("UPDATE chain_operations SET state='UNKNOWN' WHERE id=$1", [
      op.id,
    ]);
    return {
      state: "UNKNOWN",
      nextAction: "Reconcile this operation. Do not submit another payment.",
    };
  }
  const tx = result.transaction,
    p = op.proposal,
    call = tx?.actions?.[0]?.FunctionCall;
  assert(
    tx?.signer_id === p.signerId &&
      tx?.receiver_id === p.receiverId &&
      tx.actions.length === 1 &&
      call?.method_name === p.methodName &&
      call.deposit === p.attachedDepositYocto &&
      (!p.gas || String(call.gas) === p.gas) &&
      hash(JSON.parse(Buffer.from(call.args, "base64").toString())) ===
        hash(p.args),
    "INVALID_TRANSACTION",
    "The transaction does not match the prepared operation.",
  );
  const final = result.final_execution_status === "FINAL";
  const success = result.status && Object.hasOwn(result.status, "SuccessValue");
  const state = final ? (success ? "CONFIRMED" : "FAILED") : "UNKNOWN";
  await db.query(
    "UPDATE chain_operations SET state=$2,receipt=$3,updated_at=now() WHERE id=$1",
    [op.id, state, result],
  );
  if (state === "CONFIRMED") {
    const outcome = await view("get_operation", {
      account_id: op.account_id,
      request_id: p.requestId || op.request_id || p.args.request_id,
    });
    assert(
      outcome,
      "RECONCILIATION_REQUIRED",
      "Transaction finished but the expected contract operation is absent.",
    );
    if(['register_agent','register_near_agent','set_agent_active','update_agent'].includes(p.methodName)){
      const a=await view('get_agent',{agent_id:p.args.agent_id});
      if(a)await db.query('UPDATE agents SET state=$3,version=$4 WHERE id=$1 AND book=$2',[p.args.agent_id,'TESTNET',a.active?'ACTIVE':'SUSPENDED',a.version]);
    }
    if(p.methodName==='record_bid'){
      const bid=await view('get_bid',{bid_id:p.args.bid_id});
      assert(bid,"RECONCILIATION_REQUIRED","Confirmed bid could not yet be read from the contract.");
      await db.query("INSERT INTO bids(id,job_id,agent_id,book,amount,data,expires_at) VALUES($1,$2,$3,'TESTNET',$4,$5,$6) ON CONFLICT DO NOTHING",[p.args.bid_id,bid.job_id,bid.agent_id,bid.price,{etaMinutes:Number(bid.eta_ms)/60000,manifestVersion:bid.manifest_version},new Date(Number(bid.expires_at))]);
    }
    if(p.methodName==='set_execution_policy'){
      const policy=await view('get_policy',{agent_id:p.args.agent_id});
      await db.query("UPDATE agents SET data=data||'{\"chainPolicyReady\":true}'::jsonb WHERE id=$1 AND book='TESTNET'",[p.args.agent_id]);
      await db.query("UPDATE execution_policies SET data=$2,version=$3 WHERE agent_id=$1 AND book='TESTNET'",[p.args.agent_id,{maxSpendYocto:policy.max_spend,maxBondYocto:policy.max_bond,allowedAgentIds:policy.allowed,expiresAt:Number(policy.expires_at),paused:policy.paused},policy.version]);
    }
    if (op.job_id) {
      const chainJob = await view("get_job", { job_id: op.job_id });
      if (chainJob)
        await db.query(
          "UPDATE jobs SET state=$2,agent_id=$3,data=data||$4::jsonb,version=version+1,updated_at=now() WHERE id=$1",
          [
            op.job_id,
            chainJob.state,
            chainJob.agent_id || null,
            JSON.stringify({ onchain: chainJob, chainConfirmed: true,escrow:chainJob.escrow,bond:chainJob.bond,usdMicro:chainJob.usd_micro,creatorId:chainJob.creator,fundingPrice:chainJob.funding_price,childCap:chainJob.child_cap,deadline:Number(chainJob.deadline_ms),reviewDeadline:Number(chainJob.review_deadline),...(chainJob.settlement?{settlement:{award:chainJob.settlement.award,fee:chainJob.settlement.fee,refund:chainJob.settlement.refund,creatorCredit:chainJob.settlement.creator_credit,penalty:chainJob.settlement.penalty,shortfall:chainJob.settlement.shortfall,onchain:true}}:{}) }),
          ],
        );
    }
    for (const receipt of result.receipts_outcome || [])
      for (const [index, log] of (receipt.outcome.logs || []).entries())
        if (log.startsWith("EVENT_JSON:"))
          await db.query(
            "INSERT INTO chain_events(receipt_id,event_index,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
            [receipt.id, index, JSON.parse(log.slice(11))],
          );
  }
  return {
    state,
    receiptId: result.transaction_outcome?.id,
    network: "testnet",
    txHash,
    explorerUrl: "https://testnet.nearblocks.io/txns/"+txHash,
    failure: state==='FAILED' ? JSON.stringify(result.status?.Failure || 'The contract rejected this transaction.') : undefined,
  };
}
let service: any;
export async function serviceCall(
  requestId: string,
  method: string,
  args: any,
) {
  assert(
    config.serviceAccount && config.serviceKey,
    "EXECUTOR_NOT_CONFIGURED",
    "Configure a testnet executor account.",
  );
  if (!service) {
    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(
      "testnet",
      config.serviceAccount,
      KeyPair.fromString(config.serviceKey as any),
    );
    service = await (
      await connect({
        networkId: "testnet",
        nodeUrl: config.rpc,
        keyStore,
      } as Parameters<typeof connect>[0])
    ).account(config.serviceAccount);
  }
  const stored = (
    await pool.query(
      "SELECT proposal FROM chain_operations WHERE request_id=$1",
      [requestId],
    )
  ).rows[0];
  const payload = stored?.proposal?.args || { ...args, request_id: requestId };
  const existing = await view("get_operation", {
    account_id: config.serviceAccount,
    request_id: requestId,
  });
  if (existing) {
    await pool.query("UPDATE chain_operations SET state='CONFIRMED',receipt=COALESCE(receipt,$2::jsonb),updated_at=now() WHERE request_id=$1",[requestId,JSON.stringify({contractOperation:existing,finality:'FINAL'})]);
    return;
  }
  const id = randomUUID();
  await pool.query(
    "INSERT INTO chain_operations(id,request_id,account_id,state,payload_hash,proposal) VALUES($1,$2,$3,'PREPARED',$4,$5) ON CONFLICT(request_id) DO NOTHING",
    [
      id,
      requestId,
      config.serviceAccount,
      hash(payload),
      {
        methodName: method,
        args: payload,
        signerId: config.serviceAccount,
        receiverId: config.contract,
        attachedDepositYocto: "0",
        gas:"150000000000000",
      },
    ],
  );
  try {
    const result = await service.functionCall({
      contractId: config.contract,
      methodName: method,
      args: payload,
      gas: 150000000000000n,
    });
    await pool.query(
      "UPDATE chain_operations SET state='CONFIRMED',tx_hash=$2,receipt=$3,updated_at=now() WHERE request_id=$1",
      [requestId, result.transaction.hash, result],
    );
    await ingestEvents(result);
  } catch (e) {
    const error=e as any;
    const failed=error.type==='ActionError'||!!error.transaction_outcome?.outcome?.status?.Failure;
    const transactionHash=error.context?.transactionHash||error.transaction_outcome?.id||null;
    await pool.query(
      "UPDATE chain_operations SET state=$2,tx_hash=COALESCE(tx_hash,$3),receipt=CASE WHEN $2='FAILED' THEN $4::jsonb ELSE receipt END,updated_at=now() WHERE request_id=$1",
      [requestId,failed?'FAILED':'UNKNOWN',transactionHash,JSON.stringify({failure:error.message||'Executor request failed.'})],
    );
    throw e;
  }
}
export async function projectJob(id: string) {
  const c = await view("get_job", { job_id: id });
  if (!c) return null;
  const data: any = {
    onchain: c,
    chainConfirmed: true,
    creatorId: c.creator,
    usdMicro: c.usd_micro,
    escrow: c.escrow,
    bond: c.bond,
    n0: c.n0,
    childCap: c.child_cap,
    childSpent: c.child_spent,
    fundingPrice: c.funding_price,
    deadline: Number(c.deadline_ms),
    startDeadline: Number(c.start_deadline),
    reviewDeadline: Number(c.review_deadline),
    revision: c.revision,
    deliveryHash:c.delivery_hash,
  };
  if (c.settlement)
    data.settlement = {
      award: c.settlement.award,
      fee: c.settlement.fee,
      refund: c.settlement.refund,
      creatorCredit: c.settlement.creator_credit,
      penalty: c.settlement.penalty,
      shortfall: c.settlement.shortfall,
      onchain: true,
    };
  await pool.query(
    "UPDATE jobs SET state=$2,agent_id=$3,data=data||$4::jsonb,updated_at=now() WHERE id=$1",
    [id, c.state, c.agent_id, JSON.stringify(data)],
  );
  return c;
}
export async function tickNear() {
  if (!config.contract || !config.serviceKey) return;
  const lease = await pool.connect();
  try {
    if (
      !(await lease.query("SELECT pg_try_advisory_lock(87911) AS locked"))
        .rows[0].locked
    )
      return;
    // Start funded work before spending time collecting bids for other jobs.
    // A slow RPC must not make an already funded job miss its start deadline.
    const urgent=(await pool.query("SELECT id FROM jobs WHERE book='TESTNET' AND state='FUNDED' AND COALESCE((data->>'needsClientAction')::boolean,false)=false AND COALESCE((data->>'executionRetryAt')::numeric,0)<=extract(epoch from now())*1000 ORDER BY created_at LIMIT 20")).rows;
    for(const row of urgent){
      try{
        const funded=await projectJob(row.id);
        if(funded?.state==='FUNDED'){
          if(Number(funded.start_deadline)<=Date.now())await pool.query("UPDATE jobs SET data=data||$2::jsonb WHERE id=$1",[row.id,JSON.stringify({needsClientAction:true,executionIssue:'The start window expired. The client must sign Claim due transition to open a non-delivery case.'})]);
          else {await serviceCall('start:'+row.id,'start_job',{job_id:row.id});await projectJob(row.id);}
        }
      }catch(error){console.error('Funded job start failed:',row.id,error);await pool.query("UPDATE jobs SET data=data||$2::jsonb WHERE id=$1",[row.id,JSON.stringify({executionRetryAt:Date.now()+60000,executionIssue:'The worker could not start this job. Confirmation will be checked before retrying.'})]);}
    }
    const tasks = (
      await pool.query(
        "SELECT o.*,j.data FROM outbox_jobs o JOIN jobs j ON j.id=o.job_id WHERE j.book='TESTNET' AND o.type='NEAR_BIDS' AND o.state='QUEUED' LIMIT 1",
      )
    ).rows;
    for (const task of tasks) {
      const j = await projectJob(task.job_id);
      if (!j || j.state !== "OPEN" || Number(j.deadline_ms)<=Date.now()) {
        await pool.query("UPDATE outbox_jobs SET state='DONE' WHERE id=$1",[task.id]);
        continue;
      }
      const agents = (
        await pool.query(
          "SELECT ag.* FROM agents ag JOIN execution_policies p ON p.agent_id=ag.id AND p.book=ag.book WHERE ag.book='TESTNET' AND ag.state='ACTIVE' AND (ag.data->>'chainPolicyReady') IS DISTINCT FROM 'false' AND (p.data->>'paused')='false' AND (p.data->>'expiresAt')::numeric > extract(epoch from now())*1000",
        )
      ).rows;
      let reference:Awaited<ReturnType<typeof agreementPrice>>|undefined;
      for (const ag of agents) {
        const chainAgent=await view('get_agent',{agent_id:ag.id});
        if(!chainAgent?.active)continue;
        const nativePrice=await view('get_near_price',{agent_id:ag.id});
        if(!nativePrice && task.data.nearYocto)reference ??= await agreementPrice('TESTNET');
        const amount=agentMinimum({minPriceNear:nativePrice,minPriceUsdMicro:chainAgent.min_price},!!task.data.nearYocto,reference?.priceMicro||'1');
        if (!amount || BigInt(amount) > BigInt(task.data.nearYocto || task.data.usdMicro))
          continue;
        const prior = (
          await pool.query(
            "SELECT * FROM bids WHERE job_id=$1 AND agent_id=$2",
            [task.job_id, ag.id],
          )
        ).rows[0];
        if (prior) continue;
        const id = stableId("bid:" + task.job_id + ":" + ag.id),
          expires = Date.now() + 1800000;
        await serviceCall("bid:" + task.job_id + ":" + ag.id, "record_bid", {
          bid_id: id,
          job_id: task.job_id,
          agent_id: ag.id,
          price: amount,
          eta_ms: "120000",
          expires_at: String(expires),
        });
        await pool.query(
          "INSERT INTO bids(id,job_id,agent_id,book,amount,data,expires_at) VALUES($1,$2,$3,'TESTNET',$4,$5,$6) ON CONFLICT DO NOTHING",
          [
            id,
            task.job_id,
            ag.id,
            amount,
            {
              etaMinutes: 2,
              manifestVersion: ag.version,
              acceptanceHash: task.data.termsHash,
            },
            new Date(expires),
          ],
        );
      }
      await pool.query("UPDATE outbox_jobs SET state='DONE' WHERE id=$1", [
        task.id,
      ]);
    }
    const jobs = (
      await pool.query(
        "SELECT * FROM jobs WHERE book='TESTNET' AND state IN ('FUNDED','RUNNING','DELIVERED','REVISION_REQUIRED','REVIEW_OPEN','DISPUTED') AND NOT(state='FUNDED' AND COALESCE((data->>'needsClientAction')::boolean,false)) AND COALESCE((data->>'executionRetryAt')::numeric,0)<=extract(epoch from now())*1000 ORDER BY parent_id NULLS LAST LIMIT 20",
      )
    ).rows;
    for (const row of jobs) {
      let j = await projectJob(row.id);
      if (!j) continue;
      if (j.state === "FUNDED") {
        if(Number(j.start_deadline)<=Date.now()){
          await pool.query("UPDATE jobs SET data=data||$2::jsonb WHERE id=$1",[row.id,JSON.stringify({needsClientAction:true,executionIssue:'The start window expired. The client must sign Claim due transition to open a non-delivery case.'})]);continue;
        }
        await serviceCall('start:'+row.id,'start_job',{job_id:row.id});
        j = await projectJob(row.id);
      }
      if (j.state === "RUNNING" || j.state === "REVISION_REQUIRED") {
        if (!j.parent && j.agent_id === "brief-writer" && !j.children.length) {
          const id = stableId("child:" + row.id);
          await serviceCall("child:" + row.id, "fund_child", {
            job_id: row.id,
            child_id: id,
            agent_id: "source-extractor",
            amount: "1000000000000000000000000",
            terms_hash: hash({ root: row.id, child: id }),
            deadline_ms: String(Number(j.deadline_ms) - 15000),
          });
          const child = await view("get_job", { job_id: id });
          await pool.query(
            "INSERT INTO jobs(id,book,client_id,parent_id,agent_id,state,data) VALUES($1,'TESTNET',$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
            [
              id,
              child.client,
              row.id,
              child.agent_id,
              child.state,
              {
                ...row.data,
                title: "Extract source evidence",
                creatorId: child.creator,
                criteria: row.data.criteria.filter(
                  (c: any) => c.type === "AUTO_CHECK",
                ),
                approvalPolicy: "AUTO_AFTER_CHECKS",
                onchain: child,
              },
            ],
          );
          continue;
        }
        const revision = Number(j.revision);
        let delivery = (
          await pool.query(
            "SELECT * FROM deliveries WHERE job_id=$1 AND revision=$2",
            [row.id, revision],
          )
        ).rows[0];
        if (!delivery) {
          let input = row.data.input;
          if (j.children.length) {
            const childDelivery = (
              await pool.query(
                "SELECT d.* FROM deliveries d JOIN jobs child ON child.id=d.job_id WHERE child.parent_id=$1 ORDER BY d.revision DESC LIMIT 1",
                [row.id],
              )
            ).rows[0];
            if (!childDelivery) continue;
            input = {
              sources: childDelivery.content.comparison.map((r: any) => ({
                id: r.sources[0],
                text: r.evidence||r.strengths+' '+r.limits,
              })),
              delegatedEvidenceHash: childDelivery.hash,
            };
          }
          const result = await runModel({...input,brief:row.data.description,criteria:row.data.criteria}),
            checks = evaluate(
              result.content,
              row.data.criteria,
              row.data.input.sources,
            );
          const h = hash(result.content);
          await pool.query(
            "INSERT INTO deliveries(id,job_id,revision,content,hash,checks) VALUES($1,$2,$3,$4,$5,$6)",
            [
              randomUUID(),
              row.id,
              revision,
              result.content,
              h,
              JSON.stringify(checks),
            ],
          );
          await pool.query("UPDATE jobs SET data=data||$2::jsonb WHERE id=$1", [
            row.id,
            JSON.stringify({ executionMode: result.mode }),
          ]);
          delivery = { hash: h, checks };
        }
        await serviceCall(
          "delivery:" + row.id + ":" + revision,
          "submit_delivery",
          { job_id: row.id, delivery_hash: delivery.hash, revision },
        );
        j = await projectJob(row.id);
      }
      if (j.state === "DELIVERED") {
        const d = (
          await pool.query(
            "SELECT * FROM deliveries WHERE job_id=$1 ORDER BY revision DESC LIMIT 1",
            [row.id],
          )
        ).rows[0];
        if (!d) continue;
        await serviceCall(
          "checks:" + row.id + ":" + j.revision,
          "record_checks",
          {
            job_id: row.id,
            delivery_hash: d.hash,
            passed: d.checks.every(
              (c: any) =>
                c.type !== "AUTO_CHECK" || !c.required || c.result === "PASS",
            ),
            report_hash: hash(d.checks),
          },
        );
        j = await projectJob(row.id);
      }
      if (
        j.state === "REVIEW_OPEN" &&
        !j.manual &&
        Number(j.review_deadline) <= Date.now()
      ) {
        const open = (
          await pool.query(
            "SELECT 1 FROM jobs WHERE parent_id=$1 AND state NOT IN ('SETTLED','REFUNDED','CANCELLED')",
            [row.id],
          )
        ).rowCount;
        if (!open) {
          await serviceCall("due:" + row.id, "claim_due_transition", {
            job_id: row.id,
          });
          await projectJob(row.id);
        }
      }
    }
  } finally {
    await lease.query("SELECT pg_advisory_unlock(87911)");
    lease.release();
  }
}
function stableId(value: string) {
  const h = hash(value);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
async function ingestEvents(result: any) {
  for (const receipt of result.receipts_outcome || [])
    for (const [index, log] of (receipt.outcome.logs || []).entries())
      if (log.startsWith("EVENT_JSON:")) {
        const value = JSON.parse(log.slice(11));
        const inserted = await pool.query(
          "INSERT INTO chain_events(receipt_id,event_index,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING receipt_id",
          [receipt.id, index, value],
        );
        if (inserted.rowCount)
          for (const item of value.data || [])
            if (
              /^[0-9a-f-]{36}$/.test(item.id || "") &&
              (await pool.query("SELECT 1 FROM jobs WHERE id=$1", [item.id]))
                .rowCount
            )
              await pool.query(
                "INSERT INTO job_events(job_id,actor,type,data) VALUES($1,$2,$3,$4)",
                [
                  item.id,
                  item.actor,
                  value.event,
                  {
                    ...item.value,
                    receiptId: receipt.id,
                    book: "TESTNET",
                    onchain: true,
                  },
                ],
              );
      }
}
