import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const name = "af_test_" + Date.now();
const baseUrl=new URL(process.env.DATABASE_URL||'postgresql://agent:agent_local_only@127.0.0.1:5433/agent_freelancer');
const adminUrl=new URL(baseUrl);adminUrl.pathname='/postgres';
const admin = new pg.Client({
  connectionString:adminUrl.href,
});
await admin.connect();
await admin.query("CREATE DATABASE " + name);
baseUrl.pathname='/'+name;process.env.DATABASE_URL=baseUrl.href;
for (const file of ["scripts/migrate.ts", "scripts/seed.ts"]) {
  const r = spawnSync(process.execPath, ["--import", "tsx", file], {
    env: process.env,
    encoding: "utf8",
  });
  if (r.status !== 0) throw Error(r.stderr);
}
const { buildApp } = await import("../src/server.js");
const { pool } = await import("../src/db.js");
const { tick } = await import("../src/worker.js");
const app = await buildApp();
await app.ready();
type Session = { cookie: string; csrf: string };
async function login(account: string): Promise<Session> {
  const r = await app.inject({
    method: "POST",
    url: "/api/v1/auth/demo",
    payload: { account },
  });
  assert.equal(r.statusCode, 200);
  return {
    cookie: r.headers["set-cookie"]!.toString().split(";")[0],
    csrf: r.json().csrf,
  };
}
async function post(
  s: Session,
  path: string,
  body: any = {},
  key = randomUUID(),
) {
  return app.inject({
    method: "POST",
    url: "/api/v1" + path,
    headers: {
      cookie: s.cookie,
      "x-csrf-token": s.csrf,
      "idempotency-key": key,
    },
    payload: body,
  });
}
const client = await login("alex.demo"),
  creator = await login("writer.demo"),
  operator = await login("operator.demo"),
  stranger = await login("reviewer.demo");
const fixture = {
  title: "Integration comparison brief",
  description: "Compare three project proposals against the supplied sources.",
  category: "writing",
  usdMicro: "20000000",
  deadlineMinutes: 120,
  approvalPolicy: "MANUAL_APPROVAL",
  input: {
    sources: [
      { id: "a", text: "Proposal A has clear scope." },
      { id: "b", text: "Proposal B has a lower budget." },
      { id: "c", text: "Proposal C has a longer timeline." },
    ],
  },
  criteria: [
    {
      id: "keys",
      type: "AUTO_CHECK",
      required: true,
      description: "Required output fields",
      config: {
        check: "json-required-keys",
        keys: ["comparison", "recommendation", "sources"],
      },
    },
    {
      id: "human",
      type: "CLIENT_APPROVE",
      required: true,
      description: "Approve manually",
    },
  ],
};
async function job() {
  const created = await post(client, "/jobs", fixture);
  assert.equal(created.statusCode, 200, created.body);
  const id = created.json().id;
  assert.equal(
    (await post(client, "/jobs/" + id + "/bids/request")).statusCode,
    200,
  );
  const bids = (
    await app.inject({
      url: "/api/v1/jobs/" + id,
      headers: { cookie: client.cookie },
    })
  ).json().bids;
  const bid = bids.find((b: any) => b.agentId === "brief-writer");
  const p = await post(client, "/jobs/" + id + "/funding-preview", {
    bidId: bid.id,
  });
  assert.equal(p.statusCode, 200, p.body);
  return { id, preview: p.json() };
}
after(async () => {
  await app.close();
  await pool.end();
  await admin.query("DROP DATABASE " + name + " WITH (FORCE)");
  await admin.end();
});
test("full workflow funds, delegates, delivers, settles and balances the ledger", async () => {
  const { id, preview } = await job();
  const r = await post(client, "/jobs/" + id + "/fund", {
    previewId: preview.id,
  });
  assert.equal(r.statusCode, 200, r.body);
  await tick();
  const detail = (
    await app.inject({
      url: "/api/v1/jobs/" + id,
      headers: { cookie: client.cookie },
    })
  ).json();
  assert.equal(detail.state, "REVIEW_OPEN");
  assert.equal(detail.children.length, 1);
  assert.equal(detail.children[0].state, "SETTLED");
  assert.equal(detail.deliveries.length, 1);
  const settled = await post(client, "/jobs/" + id + "/approve");
  assert.equal(settled.statusCode, 200, settled.body);
  assert.equal(settled.json().state, "SETTLED");
  assert.equal(
    (await post(client, "/jobs/" + id + "/approve")).statusCode,
    400,
  );
  const imbalanced = await pool.query(
    "SELECT transfer_id FROM ledger_entries GROUP BY transfer_id HAVING sum(delta)<>0",
  );
  assert.equal(imbalanced.rowCount, 0);
  assert.equal(
    (await pool.query("SELECT * FROM balances WHERE amount<0")).rowCount,
    0,
  );
});
test("concurrent funding commits once and stable request IDs reject changed payload", async () => {
  const { id, preview } = await job();
  const results = await Promise.all([
    post(client, "/jobs/" + id + "/fund", { previewId: preview.id }),
    post(client, "/jobs/" + id + "/fund", { previewId: preview.id }),
  ]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 400]);
  const key = randomUUID(),
    r = await post(
      client,
      "/credit/preview",
      { principal: "1000000000000000000000000" },
      key,
    );
  assert.equal(r.statusCode, 200);
  assert.equal(
    (
      await post(
        client,
        "/credit/preview",
        { principal: "2000000000000000000000000" },
        key,
      )
    ).statusCode,
    409,
  );
  const escrow = await pool.query(
    "SELECT count(*)::int AS count FROM ledger_entries WHERE job_id=$1 AND reason='fund_escrow'",
    [id],
  );
  assert.equal(escrow.rows[0].count, 2);
  await tick();
});
test("ownership, CSRF and role checks reject unauthorized access", async () => {
  const { id } = await job();
  assert.equal(
    (
      await app.inject({
        url: "/api/v1/jobs/" + id,
        headers: { cookie: stranger.cookie },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/jobs",
        headers: { cookie: client.cookie },
        payload: fixture,
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/v1/admin/system",
        headers: { cookie: client.cookie },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/demo",
        headers: { origin: "https://evil.example" },
        payload: { account: "operator.demo" },
      })
    ).statusCode,
    403,
  );
});
test("stale preview does not reserve funds or performance bond", async () => {
  const { id, preview } = await job();
  await pool.query(
    "UPDATE funding_previews SET expires_at=now()-interval '1 second' WHERE id=$1",
    [preview.id],
  );
  const r = await post(client, "/jobs/" + id + "/fund", {
    previewId: preview.id,
  });
  assert.equal(r.json().code, "PREVIEW_STALE");
  assert.equal(
    (await pool.query("SELECT 1 FROM ledger_entries WHERE job_id=$1", [id]))
      .rowCount,
    0,
  );
});
test("dispute pauses settlement; trusted decision allocates escrow once", async () => {
  const { id, preview } = await job();
  await post(client, "/jobs/" + id + "/fund", { previewId: preview.id });
  await tick();
  const d = await post(client, "/jobs/" + id + "/disputes", {
    reason: "The report requires a corrected comparison of delivery dates.",
  });
  assert.equal(d.statusCode, 200, d.body);
  assert.equal(
    (await post(client, "/jobs/" + id + "/approve")).statusCode,
    400,
  );
  const decision = await post(
    operator,
    "/admin/disputes/" + d.json().id + "/decision",
    {
      awardBps: 5000,
      penaltyBps: 0,
      category: "NO_PENALTY",
      reason: "The evidence supports half of the agreed result.",
    },
  );
  assert.equal(decision.statusCode, 200, decision.body);
  assert.equal(decision.json().settlement.refund, "2400000000000000000000000");
  assert.equal(
    (
      await post(operator, "/admin/disputes/" + d.json().id + "/decision", {
        awardBps: 10000,
        penaltyBps: 0,
        category: "NO_PENALTY",
        reason: "Repeated decision must be rejected.",
      })
    ).statusCode,
    400,
  );
});
test("pause blocks new obligations but permits existing simulation withdrawals", async () => {
  await post(operator, "/admin/pause", { paused: true });
  const r = await post(client, "/jobs", fixture);
  assert.equal(r.json().code, "SYSTEM_PAUSED");
  assert.equal(
    (
      await post(creator, "/balances/withdraw", {
        amount: "1000000000000000000000",
      })
    ).statusCode,
    200,
  );
  await post(operator, "/admin/pause", { paused: false });
});
test("pool rejects deposits during lending and returns exact share assets", async () => {
  const credit = (
    await app.inject({
      url: "/api/v1/credit",
      headers: { cookie: client.cookie },
    })
  ).json();
  const epoch = credit.epochs[0];
  assert.equal(
    (
      await post(client, "/pool/deposit", {
        epochId: epoch.id,
        amount: "1000000000000000000000000",
      })
    ).statusCode,
    200,
  );
  await post(operator, "/pool/" + epoch.id + "/advance");
  assert.equal(
    (await post(client, "/pool/deposit", { epochId: epoch.id, amount: "1000" }))
      .statusCode,
    400,
  );
  assert.equal(
    (await post(client, "/pool/" + epoch.id + "/redeem")).statusCode,
    400,
  );
  await post(operator, "/pool/" + epoch.id + "/advance");
  const redeemed = await post(client, "/pool/" + epoch.id + "/redeem");
  assert.equal(redeemed.json().amount, "1000000000000000000000000");
  assert.equal(
    (await post(client, "/pool/" + epoch.id + "/redeem")).statusCode,
    400,
  );
});
