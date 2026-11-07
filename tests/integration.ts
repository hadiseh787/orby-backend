import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {createServer} from 'node:http';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import {hash,Q} from '../src/domain.js';
const name = "af_test_" + Date.now();
const baseUrl=new URL(process.env.DATABASE_URL||'postgresql://agent:agent_local_only@127.0.0.1:5433/orby');
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
const { tick,stopWorker } = await import("../src/worker.js");
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
  await stopWorker();
  await app.close();
  await pool.end();
  // pg.Pool.end can resolve just before PostgreSQL processes the final socket close.
  for(let n=0;n<100;n++){
    const active=Number((await admin.query('SELECT count(*) FROM pg_stat_activity WHERE datname=$1',[name])).rows[0].count);
    if(active===0)break;
    await new Promise(r=>setTimeout(r,25));
  }
  await admin.query("DROP DATABASE " + name);
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
test("native NEAR jobs attach private files, normalize agent IDs and settle exact amounts", async () => {
  const uploaded=await post(client,"/uploads",{name:"evidence.txt",dataBase64:Buffer.from("Actual attachment content").toString("base64")});
  assert.equal(uploaded.statusCode,200);const file=uploaded.json();
  const downloaded=await app.inject({url:"/api/v1/uploads/"+file.id,headers:{cookie:client.cookie}});
  assert.equal(downloaded.body,"Actual attachment content");
  assert.equal((await app.inject({url:"/api/v1/uploads/"+file.id,headers:{cookie:creator.cookie}})).statusCode,403);
  const invalid=await post(client,"/uploads",{name:"bad.pdf",dataBase64:Buffer.from("not a PDF").toString("base64")});assert.equal(invalid.statusCode,400);
  const registration={id:"My New Agent",name:"Native agent",description:"Organizes real supplied source text.",category:"writing",minPriceNear:"1000000000000000000000000",skills:["Writing"],acceptsSubcontracts:false};
  const agent=await post(creator,"/agents",registration);assert.equal(agent.statusCode,200);assert.equal(agent.json().id,"my-new-agent");
  assert.equal((await post(creator,"/agents",registration)).statusCode,409);
  const {usdMicro,...rest}=fixture;
  const created=await post(client,"/jobs",{...rest,nearYocto:"20000000000000000000000000",attachmentIds:[file.id]});assert.equal(created.statusCode,200);const job=created.json();
  await post(client,"/jobs/"+job.id+"/bids/request");
  let detail=(await app.inject({url:"/api/v1/jobs/"+job.id,headers:{cookie:client.cookie}})).json();
  assert.equal(detail.attachments[0].sha256,file.sha256);
  const bid=detail.bids.find((v:any)=>v.agentId==="my-new-agent");assert.ok(bid);
  const pv=(await post(client,"/jobs/"+job.id+"/funding-preview",{bidId:bid.id})).json();assert.equal(pv.escrow,"1100000000000000000000000");
  assert.equal(pv.quoteId,'native-near-v1');assert.equal(pv.priceMicro,Q.toString());
  assert.ok(pv.expiresAt-Date.now()>240000);assert.equal(pv.deadline,job.deadline);
  assert.equal((await post(client,"/jobs/"+job.id+"/fund",{previewId:pv.id})).statusCode,200);
  const funded=(await pool.query('SELECT data FROM jobs WHERE id=$1',[job.id])).rows[0].data;
  assert.ok(funded.startDeadline-funded.fundedAt>=300000);assert.equal(funded.deadline,job.deadline);
  await tick();
  assert.equal((await post(client,"/jobs/"+job.id+"/approve")).statusCode,200);
  detail=(await app.inject({url:"/api/v1/jobs/"+job.id,headers:{cookie:client.cookie}})).json();
  assert.equal(detail.settlement.award,"1000000000000000000000000");
  assert.equal(detail.settlement.refund,"100000000000000000000000");
  assert.equal((await app.inject({url:"/api/v1/uploads/"+file.id,headers:{cookie:creator.cookie}})).statusCode,200);
});
test('legacy manual proposals keep USD units and native-only agents are rejected clearly',async()=>{
  const created=await post(client,'/jobs',fixture),id=created.json().id;
  const bid=await post(creator,'/jobs/'+id+'/bids',{agentId:'brief-writer',amount:'20000000'});
  assert.equal(bid.statusCode,200,bid.body);
  assert.equal((await pool.query('SELECT amount FROM bids WHERE id=$1',[bid.json().id])).rows[0].amount,'20000000');
  const denied=await post(creator,'/jobs/'+id+'/bids',{agentId:'my-new-agent',amount:'20000000'});
  assert.match(denied.json().message,/native-only/i);
});

test('account upload quotas include attached files and serialize concurrent request IDs',async()=>{
  const created=await post(stranger,'/jobs',fixture),id=created.json().id;
  const bytes=Buffer.from('x'),digest=hash('x');
  for(let n=0;n<99;n++)await pool.query("INSERT INTO job_attachments(id,owner_id,book,job_id,name,media_type,bytes,sha256,content_base64) VALUES($1,'reviewer.demo','SIMULATION',$2,'quota.txt','text/plain',1,$3,$4)",[randomUUID(),id,digest,bytes.toString('base64')]);
  const responses=await Promise.all([post(stranger,'/uploads',{name:'a.txt',dataBase64:'eA=='}),post(stranger,'/uploads',{name:'b.txt',dataBase64:'eA=='})]);
  assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,413]);
  assert.equal(Number((await pool.query("SELECT count(*) FROM job_attachments WHERE owner_id='reviewer.demo'")).rows[0].count),100);
  await pool.query("DELETE FROM job_attachments WHERE owner_id='reviewer.demo'");
  // Synthetic quota metadata exercises the 50 MiB bound without a 70 MiB base64 test fixture.
  for(let n=0;n<25;n++)await pool.query("INSERT INTO job_attachments(id,owner_id,book,job_id,name,media_type,bytes,sha256,content_base64) VALUES($1,'reviewer.demo','SIMULATION',$2,'quota.txt','text/plain',2097152,$3,$4)",[randomUUID(),id,digest,'eA==']);
  assert.equal((await post(stranger,'/uploads',{name:'overflow.txt',dataBase64:'eA=='})).statusCode,413);
  await pool.query("DELETE FROM job_attachments WHERE owner_id='reviewer.demo'");
});

test('NEP-413 flow binding and pending registration recovery preserve identity and uncertain transactions',async()=>{
  const {config}=await import('../src/config.js'),{messageDigest}=await import('../src/auth.js');
  const previous={rpc:config.rpc,contract:config.contract};
  const keys=nacl.sign.keyPair(),publicKey='ed25519:'+bs58.encode(keys.publicKey);let chainAgent:any=null;
  const rpc=createServer(async(req,res)=>{
    const parts:Buffer[]=[];for await(const part of req)parts.push(part);
    const body=JSON.parse(Buffer.concat(parts).toString());
    let result:any;
    if(body.method==='gas_price')result={gas_price:'100000000'};
    else if(body.params.request_type==='view_access_key_list')result={keys:[{public_key:publicKey,access_key:{permission:'FullAccess'}}]};
    else result={result:[...Buffer.from(JSON.stringify(chainAgent))]};
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:body.id,result}));
  });
  await new Promise<void>(r=>rpc.listen(0,'127.0.0.1',r));
  config.rpc='http://127.0.0.1:'+(rpc.address() as any).port;config.contract='isolated.testnet';
  try{
    const challenge=async(flow:string)=> (await app.inject({method:'POST',url:'/api/v1/auth/challenge',payload:{flow}})).json();
    const verify=async(c:any,callback:boolean,flow='DIRECT')=>app.inject({method:'POST',url:'/api/v1/auth/verify',payload:{accountId:'recovery.testnet',publicKey,challengeId:c.id,flow,signature:Buffer.from(nacl.sign.detached(messageDigest(c.message,Buffer.from(c.nonce,'base64'),c.recipient,callback?c.callbackUrl:undefined),keys.secretKey)).toString('base64')}});
    const direct=await challenge('DIRECT');assert.equal((await verify(direct,false)).statusCode,401);assert.equal((await verify(direct,false,'REDIRECT')).statusCode,401);
    const login=await verify(direct,true);assert.equal(login.statusCode,200,login.body);assert.equal((await verify(direct,true)).statusCode,401);
    const redirect=await challenge('REDIRECT');assert.equal((await verify(redirect,false,'REDIRECT')).statusCode,200);
    const owner={cookie:login.headers['set-cookie']!.toString().split(';')[0],csrf:login.json().csrf};
    const manifest={id:'recoverable-id',name:'Recoverable agent',description:'An isolated pending registration fixture.',category:'writing',minPriceNear:Q.toString(),skills:[],acceptsSubcontracts:false};
    const first=await post(owner,'/agents',manifest);assert.equal(first.statusCode,200,first.body);
    const op=first.json().operation;
    const same=await post(owner,'/agents/recoverable-id/retry-registration');assert.equal(same.json().operation.operationId,op.operationId);
    await pool.query("UPDATE chain_operations SET state='FAILED' WHERE id=$1",[op.operationId]);
    const retried=await post(owner,'/agents',manifest);assert.equal(retried.statusCode,200,retried.body);assert.notEqual(retried.json().operation.operationId,op.operationId);
    const newId=retried.json().operation.operationId;
    await pool.query("UPDATE chain_operations SET state='UNKNOWN' WHERE id=$1",[newId]);
    assert.equal((await post(owner,'/agents/recoverable-id/retry-registration')).json().code,'RECONCILIATION_REQUIRED');
    await pool.query("UPDATE chain_operations SET state='FAILED' WHERE id=$1",[newId]);
    chainAgent={owner:'recovery.testnet',active:true,version:1,manifest_hash:hash((await pool.query("SELECT data FROM agents WHERE id='recoverable-id' AND book='TESTNET'")).rows[0].data)};
    assert.equal((await post(owner,'/agents/recoverable-id/retry-registration')).json().recovered,true);
    assert.equal((await pool.query("SELECT state FROM agents WHERE id='recoverable-id' AND book='TESTNET'")).rows[0].state,'ACTIVE');
    assert.equal(Number((await pool.query("SELECT count(*) FROM agents WHERE id='recoverable-id' AND book='TESTNET'")).rows[0].count),1);
  }finally{Object.assign(config,previous);await new Promise<void>((resolve,reject)=>rpc.close(e=>e?reject(e):resolve()));}
});
test("SPA requests preserve the API budget and API requests remain rate limited", async () => {
  const remoteAddress = "198.51.100.77";
  for (let i = 0; i < 245; i++) {
    const response = await app.inject({ url: "/", remoteAddress });
    assert.notEqual(response.statusCode, 429);
    assert.equal(response.headers["x-ratelimit-limit"], undefined);
  }
  for (let i = 0; i < 600; i++) {
    const response = await app.inject({ url: "/api/v1/health", remoteAddress });
    assert.equal(response.statusCode, 200);
  }
  const limited = await app.inject({ url: "/api/v1/health", remoteAddress });
  assert.equal(limited.statusCode, 429);
  assert.ok(limited.headers["retry-after"]);
  assert.equal((await app.inject({method:"POST",url:"/api/v1/auth/challenge",remoteAddress})).statusCode,200);
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
