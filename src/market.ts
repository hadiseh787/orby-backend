import { randomUUID } from "node:crypto";
import { pool, transaction, type DB } from "./db.js";
import { type Actor } from "./auth.js";
import { config } from "./config.js";
import { agreementPrice } from "./near.js";
import {
  assert,
  hash,
  funding,
  settlement,
  Q,
  min,
  terminal,
  evaluate,
  agentMinimum,
  previewLifetimeMs,
  startWindowMs,
} from "./domain.js";
import { move, balance } from "./ledger.js";
export const dto = (row: any) => ({
  ...row.data,
  id: row.id,
  book: row.book,
  clientId: row.client_id,
  parentId: row.parent_id,
  agentId: row.agent_id,
  state: row.state,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
async function newObligation(db: DB) {
  const r = (
    await db.query("SELECT data FROM price_snapshots WHERE id='system-config'")
  ).rows[0];
  assert(
    !r?.data?.paused,
    "SYSTEM_PAUSED",
    "New obligations are paused. Existing claims and withdrawals remain available.",
  );
}
export async function event(
  db: DB,
  jobId: string,
  actor: string,
  type: string,
  data: any = {},
) {
  await db.query(
    "INSERT INTO job_events(job_id,actor,type,data) VALUES($1,$2,$3,$4)",
    [jobId, actor, type, data],
  );
}
export async function updateJob(db: DB, j: any, state: string, data: any = {}) {
  const next = { ...j.data, ...data };
  await db.query(
    "UPDATE jobs SET state=$2,data=$3,version=version+1,updated_at=now() WHERE id=$1",
    [j.id, state, next],
  );
  j.state = state;
  j.data = next;
  j.version++;
  return dto(j);
}
export async function loadJob(db: DB, id: string, a?: Actor, lock = false) {
  const j = (
    await db.query(
      `SELECT j.*,ag.owner_id AS creator_id FROM jobs j LEFT JOIN agents ag ON ag.id=j.agent_id AND ag.book=j.book WHERE j.id=$1 ${lock ? "FOR UPDATE OF j" : ""}`,
      [id],
    )
  ).rows[0];
  assert(j, "NOT_FOUND", "Job not found.", 404);
  if (a)
    assert(
      j.book === a.book &&
        (j.client_id === a.id ||
          j.creator_id === a.id ||
          a.roles.includes("admin")),
      "FORBIDDEN",
      "You do not have access to this job.",
      403,
    );
  return j;
}
export async function mutate(
  a: Actor,
  key: string,
  payload: any,
  fn: (db: DB) => Promise<any>,
) {
  assert(
    typeof key === "string" && key.length >= 8 && key.length <= 128,
    "IDEMPOTENCY_REQUIRED",
    "A stable Idempotency-Key is required.",
  );
  return transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      a.id + ":" + key,
    ]);
    const prior = (
      await db.query(
        "SELECT * FROM idempotency WHERE account_id=$1 AND key=$2",
        [a.id, key],
      )
    ).rows[0];
    const h = hash(payload);
    if (prior) {
      assert(
        prior.hash === h,
        "IDEMPOTENCY_CONFLICT",
        "This request ID was already used with different data.",
        409,
      );
      return prior.response;
    }
    const result = await fn(db);
    await db.query(
      "INSERT INTO idempotency(account_id,key,hash,response) VALUES($1,$2,$3,$4)",
      [a.id, key, h, result],
    );
    await db.query(
      "INSERT INTO audit_log(actor,action,data) VALUES($1,$2,$3)",
      [a.id, payload.path, { requestId: key, payloadHash: h, book: a.book }],
    );
    return result;
  });
}
export async function createJob(db: DB, a: Actor, b: any) {
  await newObligation(db);
  const id = randomUUID(),
    data = {
      ...b,
      deadline: Date.now()+b.deadlineMinutes*60000,
      revision: 0,
      termsVersion: 1,
      priceMode: b.nearYocto ? "NATIVE_NEAR" : a.book==='SIMULATION' ? "FIXTURE" : "CONTRACT_REFERENCE",
      fundingPrice: b.nearYocto ? Q.toString() : a.book==='SIMULATION' ? "5000000" : null,
      deadlineBasis: "PUBLICATION",
      feeBps: 1000,
      bufferBps: 1000,
      bondBps: 2000,
      disputeFallbackAwardBps: 5000,
      priceFallback: "FUNDING_PRICE",
      childrenCreated: 0,
      childSpent: "0",
      termsHash: hash({
        ...b,
        schemaVersion: "1.0",
        jobId: id,
        revision: 0,
        policyVersion: 1,
      }),
    };
  await db.query(
    "INSERT INTO jobs(id,book,client_id,state,data) VALUES($1,$2,$3,'OPEN',$4)",
    [id, a.book, a.id, data],
  );
  await event(db, id, a.id, "job_opened", { termsHash: data.termsHash });
  return {
    id,
    ...data,
    book: a.book,
    state: "OPEN",
    clientId: a.id,
    version: 1,
  };
}
export async function requestBids(db: DB, a: Actor, id: string) {
  const j = await loadJob(db, id, a, true);
  assert(
    j.client_id === a.id && j.state === "OPEN",
    "INVALID_STATE",
    "Only the client can request bids for an open job.",
  );
  if (a.book === "TESTNET") {
    await db.query(
      "INSERT INTO outbox_jobs(id,job_id,type) VALUES($1,$2,'NEAR_BIDS') ON CONFLICT(job_id,type) DO UPDATE SET state='QUEUED',next_attempt=now()",
      [randomUUID(), id],
    );
    return { ok: true, state: "QUEUED" };
  }
  const agents = (
    await db.query(
      "SELECT * FROM agents WHERE book=$1 AND state='ACTIVE' ORDER BY id",
      [a.book],
    )
  ).rows;
  const reference = await agreementPrice(a.book);
  for (const agent of agents) {
    const amount=agentMinimum(agent.data,!!j.data.nearYocto,reference.priceMicro);
    if (!amount || BigInt(amount) > BigInt(j.data.nearYocto || j.data.usdMicro)) continue;
    await db.query(
      "INSERT INTO bids(id,job_id,agent_id,book,amount,data,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '30 minutes') ON CONFLICT(job_id,agent_id) DO UPDATE SET expires_at=EXCLUDED.expires_at",
      [
        randomUUID(),
        id,
        agent.id,
        a.book,
        amount,
        {
          etaMinutes: agent.data.etaMinutes,
          manifestVersion: agent.version,
          acceptanceHash: j.data.termsHash,
        },
      ],
    );
  }
  await event(db, id, a.id, "bids_requested");
  return { ok: true };
}
export async function preview(db: DB, a: Actor, id: string, bidId: string) {
  const j = await loadJob(db, id, a);
  assert(
    j.client_id === a.id && j.state === "OPEN",
    "INVALID_STATE",
    "This job is not available for funding.",
  );
  const b = (
    await db.query(
      "SELECT b.*,ag.owner_id,ag.state AS agent_state,ag.version AS agent_version,p.data AS policy,p.version AS policy_version FROM bids b JOIN agents ag ON ag.id=b.agent_id AND ag.book=b.book JOIN execution_policies p ON p.agent_id=ag.id AND p.book=ag.book WHERE b.id=$1 AND b.job_id=$2",
      [bidId, id],
    )
  ).rows[0];
  assert(
    b && new Date(b.expires_at).getTime() > Date.now(),
    "BID_EXPIRED",
    "This bid has expired. Request fresh bids.",
  );
  assert(
    b.agent_state === "ACTIVE" && b.agent_version === b.data.manifestVersion,
    "INVALID_STATE",
    "Agent or manifest version is no longer available.",
  );
  assert(
    !b.policy.paused && b.policy.expiresAt > Date.now(),
    "POLICY_LIMIT",
    "The agent execution policy is paused or expired.",
  );
  assert(j.data.deadline>Date.now(),"JOB_EXPIRED","The job deadline has expired.");
  const reference = j.data.nearYocto ? {priceMicro:Q.toString(),quoteId:'native-near-v1',source:'Fixed NEAR agreement (no FX conversion)',observedAt:Date.now()} : await agreementPrice(a.book);
  const f = funding(b.amount,reference.priceMicro);
  if (a.book === "SIMULATION")
    assert(
      BigInt(await balance(db, a.book, b.owner_id, "bond")) >= BigInt(f.bond),
      "INSUFFICIENT_BOND",
      "This agent needs more available performance bond.",
    );
  const data = {
    ...f,
    bidId,
    agentId: b.agent_id,
    creatorId: b.owner_id,
    usdMicro: j.data.nearYocto ? "0" : b.amount,
    ...(j.data.nearYocto ? {nearYocto:b.amount} : {}),
    feeBps: 1000,
    bufferBps: 1000,
    policyVersion: b.policy_version,
    jobVersion: j.version,
    quoteId: reference.quoteId,
    priceMicro: reference.priceMicro,
    source: reference.source,
    quoteObservedAt: reference.observedAt,
    expiresAt: Date.now() + previewLifetimeMs,
    deadline: j.data.deadline,
    deadlineBasis: "PUBLICATION",
    approvalPolicy: j.data.approvalPolicy,
    reviewSeconds: config.accelerated ? 90 : 86400,
    manualFallback: "50/50 after arbitrator deadline",
    childCap: String(min(BigInt(f.childCap), BigInt(b.policy.maxSpendYocto))),
  };
  const pid = randomUUID(),
    payloadHash = hash(data);
  await db.query(
    "INSERT INTO funding_previews(id,job_id,actor,payload_hash,data,expires_at) VALUES($1,$2,$3,$4,$5,$6)",
    [pid, id, a.id, payloadHash, data, new Date(data.expiresAt)],
  );
  return { id: pid, payloadHash, ...data, book: a.book };
}
export async function fund(db: DB, a: Actor, id: string, pid: string) {
  await newObligation(db);
  const j = await loadJob(db, id, a, true),
    p = (
      await db.query(
        "SELECT * FROM funding_previews WHERE id=$1 AND job_id=$2 AND actor=$3 FOR UPDATE",
        [pid, id, a.id],
      )
    ).rows[0];
  assert(
    j.client_id === a.id && j.state === "OPEN",
    "INVALID_STATE",
    "The job has already been funded or cancelled.",
  );
  assert(j.data.deadline>Date.now(),"JOB_EXPIRED","The job deadline has expired.");
  assert(
    p &&
      !p.consumed &&
      new Date(p.expires_at).getTime() > Date.now() &&
      p.data.jobVersion === j.version,
    "PREVIEW_STALE",
    "Refresh the funding preview before continuing.",
  );
  const b = (
    await db.query("SELECT * FROM bids WHERE id=$1 AND expires_at>now()", [
      p.data.bidId,
    ])
  ).rows[0];
  const pol = (
    await db.query(
      "SELECT * FROM execution_policies WHERE agent_id=$1 AND book=$2",
      [p.data.agentId, a.book],
    )
  ).rows[0];
  assert(
    b &&
      pol &&
      pol.version === p.data.policyVersion &&
      !pol.data.paused &&
      pol.data.expiresAt > Date.now(),
    "PREVIEW_STALE",
    "The bid or execution policy changed.",
  );
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    a.book + ":bond-owner:" + p.data.creatorId,
  ]);
  const agent = (
    await db.query("SELECT * FROM agents WHERE id=$1 AND book=$2", [
      p.data.agentId,
      a.book,
    ])
  ).rows[0];
  assert(
    agent?.state === "ACTIVE" && agent.version === b.data.manifestVersion,
    "PREVIEW_STALE",
    "The agent manifest or availability changed.",
  );
  const reserved = (
    await db.query(
      "SELECT COALESCE(sum((data->>'bond')::numeric),0)::text AS total FROM jobs WHERE book=$1 AND data->>'creatorId'=$2 AND state NOT IN ('OPEN','SETTLED','REFUNDED','CANCELLED')",
      [a.book, p.data.creatorId],
    )
  ).rows[0].total;
  assert(
    BigInt(reserved) + BigInt(p.data.bond) <= BigInt(pol.data.maxBondYocto),
    "POLICY_LIMIT",
    "The owner’s concurrent bond ceiling would be exceeded.",
  );
  assert(
    a.book === "SIMULATION",
    "CHAIN_REQUIRED",
    "Funding must be signed by the testnet wallet.",
  );
  await move(
    db,
    a.book,
    a.id,
    "free",
    id,
    "escrow",
    p.data.escrow,
    "fund_escrow",
    id,
  );
  await move(
    db,
    a.book,
    p.data.creatorId,
    "bond",
    id,
    "performance",
    p.data.bond,
    "reserve_bond",
    id,
  );
  await db.query("UPDATE jobs SET agent_id=$2 WHERE id=$1", [
    id,
    p.data.agentId,
  ]);
  j.agent_id = p.data.agentId;
  await db.query("UPDATE funding_previews SET consumed=true WHERE id=$1", [
    pid,
  ]);
  await updateJob(db, j, "FUNDED", {
    ...p.data,
    creatorId: p.data.creatorId,
    fundedAt: Date.now(),
    startDeadline: Date.now() + startWindowMs(config.accelerated),
    fundingPrice: p.data.priceMicro,
    deadline: j.data.deadline,
  });
  await event(db, id, a.id, "job_funded", {
    escrow: p.data.escrow,
    book: a.book,
  });
  await db.query(
    "INSERT INTO outbox_jobs(id,job_id,type) VALUES($1,$2,'EXECUTE') ON CONFLICT DO NOTHING",
    [randomUUID(), id],
  );
  return dto(j);
}
export async function settleJob(
  db: DB,
  j: any,
  actorId: string,
  awardBps = 10000,
  penaltyBps = 0,
  reason = "approved",
) {
  assert(
    !terminal(j.state),
    "INVALID_STATE",
    "This job has already been settled.",
  );
  const children = (
    await db.query(
      "SELECT 1 FROM jobs WHERE parent_id=$1 AND state NOT IN ('SETTLED','REFUNDED','CANCELLED')",
      [j.id],
    )
  ).rowCount;
  assert(
    !children,
    "CHILDREN_OPEN",
    "Wait for the open subcontracts to finish.",
  );
  const s = settlement(
    j.data.escrow,
    j.data.nearYocto ? j.data.n0 : j.data.usdMicro,
    j.data.nearYocto ? Q.toString() : j.data.fundingPrice || "5000000",
    awardBps,
    j.parent_id ? 0 : j.data.feeBps,
    "0",
    !!j.parent_id,
  );
  await move(
    db,
    j.book,
    j.id,
    "escrow",
    j.client_id,
    "free",
    s.refund,
    "escrow_refund",
    j.id,
  );
  await move(
    db,
    j.book,
    j.id,
    "escrow",
    "platform",
    "free",
    s.fee,
    "platform_fee",
    j.id,
  );
  await move(
    db,
    j.book,
    j.id,
    "escrow",
    j.data.creatorId,
    "free",
    s.creatorCredit,
    "creator_credit",
    j.id,
  );
  const bond = BigInt(j.data.bond || "0"),
    penalty = (bond * BigInt(penaltyBps)) / 10000n;
  await move(
    db,
    j.book,
    j.id,
    "performance",
    j.client_id,
    "free",
    String(penalty),
    "performance_penalty",
    j.id,
  );
  await move(
    db,
    j.book,
    j.id,
    "performance",
    j.data.creatorId,
    "bond",
    String(bond - penalty),
    "release_bond",
    j.id,
  );
  await repayLoan(db, j);
  await updateJob(db, j, awardBps > 0 ? "SETTLED" : "REFUNDED", {
    settlement: {
      ...s,
      awardBps,
      penalty: String(penalty),
      reason,
      settledAt: Date.now(),
      onchain: false,
    },
  });
  await event(db, j.id, actorId, "job_settled", {
    ...s,
    awardBps,
    penalty: String(penalty),
    reason,
  });
  await db.query(
    "UPDATE agents SET data=jsonb_set(data,'{completed}',to_jsonb(COALESCE((data->>'completed')::int,0)+1)) WHERE id=$1 AND book=$2",
    [j.agent_id, j.book],
  );
  return dto(j);
}
export async function dispute(db: DB, a: Actor, j: any, reason: string) {
  assert(
    !terminal(j.state) &&
      [
        "RUNNING",
        "DELIVERED",
        "REVIEW_OPEN",
        "REVISION_REQUIRED",
        "FUNDED",
      ].includes(j.state),
    "INVALID_STATE",
    "A dispute cannot be opened in this state.",
  );
  const id = randomUUID(),
    deadline = Date.now() + (config.accelerated ? 180000 : 172800000);
  await db.query(
    "INSERT INTO disputes(id,job_id,actor,reason,evidence_hash,deadline) VALUES($1,$2,$3,$4,$5,$6)",
    [
      id,
      j.id,
      a.id,
      reason,
      hash({ jobId: j.id, reason, revision: j.data.revision }),
      new Date(deadline),
    ],
  );
  await updateJob(db, j, "DISPUTED", { disputeDeadline: deadline });
  await event(db, j.id, a.id, "dispute_opened", { reason });
  return { id, deadline };
}
export async function fundChild(
  db: DB,
  j: any,
  agentId: string,
  amount: string,
) {
  await newObligation(db);
  assert(
    !j.parent_id && j.data.childrenCreated < 3,
    "POLICY_LIMIT",
    "Only one level and three children are allowed.",
  );
  const ag = (
    await db.query(
      "SELECT a.*,p.data AS policy FROM agents a JOIN execution_policies p ON p.agent_id=$1 AND p.book=a.book WHERE a.id=$1 AND a.book=$2 AND a.state='ACTIVE'",
      [agentId, j.book],
    )
  ).rows[0];
  const policy = (
    await db.query(
      "SELECT data FROM execution_policies WHERE agent_id=$1 AND book=$2",
      [j.agent_id, j.book],
    )
  ).rows[0]?.data;
  assert(
    ag &&
      policy &&
      !policy.paused &&
      policy.expiresAt > Date.now() &&
      policy.allowedAgentIds.includes(agentId),
    "POLICY_LIMIT",
    "This subcontract is not permitted.",
  );
  assert(
    ag.owner_id !== j.data.creatorId && ag.owner_id !== j.client_id,
    "POLICY_LIMIT",
    "Root owner and client cannot own the child agent.",
  );
  assert(
    BigInt(j.data.childSpent) + BigInt(amount) <= BigInt(j.data.childCap),
    "POLICY_LIMIT",
    "Subcontract budget exceeded.",
  );
  const id = randomUUID(),
    bond = String((BigInt(amount) * 2000n) / 10000n);
  const data = {
    title: "Extract source evidence",
    description: "Extract claims from the supplied proposal text.",
    input: j.data.input,
    criteria: j.data.criteria.filter((c: any) => c.type === "AUTO_CHECK"),
    approvalPolicy: "AUTO_AFTER_CHECKS",
    creatorId: ag.owner_id,
    escrow: amount,
    bond,
    usdMicro: "0",
    fundingPrice: "5000000",
    feeBps: 0,
    deadline: j.data.deadline - 15000,
    revision: 0,
    rootId: j.id,
    executionMode: "DETERMINISTIC",
    termsHash: hash({ root: j.id, agentId, amount }),
  };
  await db.query(
    "INSERT INTO jobs(id,book,client_id,parent_id,agent_id,state,data) VALUES($1,$2,$3,$4,$5,'RUNNING',$6)",
    [id, j.book, j.data.creatorId, j.id, agentId, data],
  );
  await move(
    db,
    j.book,
    j.data.creatorId,
    "free",
    id,
    "escrow",
    amount,
    "fund_child",
    id,
  );
  await move(
    db,
    j.book,
    ag.owner_id,
    "bond",
    id,
    "performance",
    bond,
    "child_bond",
    id,
  );
  await updateJob(db, j, j.state, {
    childrenCreated: j.data.childrenCreated + 1,
    childSpent: String(BigInt(j.data.childSpent) + BigInt(amount)),
  });
  await event(db, j.id, j.data.creatorId, "child_funded", {
    childId: id,
    agentId,
    amount,
    source: "creator free balance",
  });
  return await loadJob(db, id);
}
async function repayLoan(db: DB, j: any) {
  const loan = (
    await db.query(
      "SELECT * FROM loans WHERE job_id=$1 AND state='ACTIVE' FOR UPDATE",
      [j.id],
    )
  ).rows[0];
  if (!loan) return;
  const due = BigInt(loan.data.due),
    available = BigInt(await balance(db, j.book, loan.owner_id, "free")),
    fromIncome = min(due, available);
  await move(
    db,
    j.book,
    loan.owner_id,
    "free",
    loan.epoch_id,
    "pool",
    String(fromIncome),
    "loan_repay_income",
    j.id,
  );
  await move(
    db,
    j.book,
    loan.id,
    "credit_reserve",
    loan.epoch_id,
    "pool",
    String(due - fromIncome),
    "loan_repay_reserve",
    j.id,
  );
  const remaining = await balance(db, j.book, loan.id, "credit_reserve");
  await move(
    db,
    j.book,
    loan.id,
    "credit_reserve",
    loan.owner_id,
    "credit",
    remaining,
    "credit_reserve_release",
    j.id,
  );
  await db.query("UPDATE loans SET state=$2,data=data||$3::jsonb WHERE id=$1", [
    loan.id,
    fromIncome === due ? "REPAID" : "REPAID_FROM_RESERVE",
    JSON.stringify({ repaidAt: Date.now() }),
  ]);
}
