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
process.env.OLLAMA_MODEL='';process.env.LLM_PROVIDER='OLLAMA';
const { buildApp } = await import("../src/server.js");
const { pool } = await import("../src/db.js");
const { tick,stopWorker } = await import("../src/worker.js");
const app = await buildApp();
await app.ready();
type Session = { cookie: string; csrf: string;remoteAddress?:string;workspace?:string };
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
    remoteAddress:s.remoteAddress,
    headers: {
      cookie: s.cookie,
      ...(s.workspace?{"x-orby-workspace":s.workspace}:{}),
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
  for(let attempt=0;attempt<12;attempt++)await tick();
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
  const settled = await post(client, "/jobs/" + id + "/approve",{revision:detail.deliveries[0].revision,deliveryHash:detail.deliveries[0].hash});
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
  for(let attempt=0;attempt<20;attempt++){await tick();detail=(await app.inject({url:"/api/v1/jobs/"+job.id,headers:{cookie:client.cookie}})).json();if(detail.state==='REVIEW_OPEN')break;}
  assert.equal((await post(client,"/jobs/"+job.id+"/approve",{revision:detail.deliveries[0].revision,deliveryHash:detail.deliveries[0].hash})).statusCode,200);
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

const workspaceClient={...client,remoteAddress:'198.51.100.101'},workspaceCreator={...creator,remoteAddress:'198.51.100.102'};
async function nativeJob(session:Session=workspaceClient,extra:any={}){
  const {usdMicro,...base}=fixture;
  const r=await post(session,'/jobs',{...base,title:'Workspace workflow '+randomUUID(),category:'review',nearYocto:Q.toString(),...extra});assert.equal(r.statusCode,200,r.body);return r.json();
}
async function readyNative(extra:any={}){
  const j=await nativeJob(workspaceClient,extra);await post(workspaceClient,'/jobs/'+j.id+'/bids/request');
  const row=(await pool.query("SELECT id FROM bids WHERE job_id=$1 AND agent_id='format-reviewer'",[j.id])).rows[0];
  const pv=await post(workspaceClient,'/jobs/'+j.id+'/funding-preview',{bidId:row.id});assert.equal(pv.statusCode,200,pv.body);
  const funded=await post(workspaceClient,'/jobs/'+j.id+'/fund',{previewId:pv.json().id});assert.equal(funded.statusCode,200,funded.body);
  for(let i=0;i<30;i++){await tick();const detail=(await app.inject({url:'/api/v1/jobs/'+j.id,headers:{cookie:workspaceClient.cookie}})).json();if(detail.state==='REVIEW_OPEN')return detail;}
  throw Error('The fixture job did not deliver.');
}
async function approveNative(j:any){const d=j.deliveries[0];const r=await post(workspaceClient,'/jobs/'+j.id+'/approve',{revision:d.revision,deliveryHash:d.hash});assert.equal(r.statusCode,200,r.body);return r.json();}
test('client approval is version-bound, visible in checks and separate from settlement',async()=>{
 const j=await readyNative(),d=j.deliveries[0];assert.equal(d.checks.find((c:any)=>c.type==='CLIENT_APPROVE').result,'PENDING');
 assert.equal((await post(workspaceClient,'/jobs/'+j.id+'/approve',{revision:99,deliveryHash:d.hash})).statusCode,409);
 await approveNative(j);const detail=(await app.inject({url:'/api/v1/jobs/'+j.id,headers:{cookie:workspaceClient.cookie}})).json();
 assert.equal(detail.state,'SETTLED');assert.equal(detail.deliveries[0].checks.find((c:any)=>c.type==='CLIENT_APPROVE').result,'PASS');
 assert.equal(detail.events.filter((e:any)=>e.type==='client_approved').length,1);assert.equal(detail.decisions[0].delivery_hash,d.hash);
});
test('specific evidence feedback creates one revision and an old version cannot approve the new delivery',async()=>{
 let j=await readyNative(),d=j.deliveries[0];
 const r=await post(workspaceClient,'/jobs/'+j.id+'/revisions',{revision:d.revision,deliveryHash:d.hash,section:'comparison:0',sourceId:'a',reason:'Explain which supplied claim supports the first comparison.'});assert.equal(r.statusCode,200,r.body);
 for(let i=0;i<30;i++){await tick();j=(await app.inject({url:'/api/v1/jobs/'+j.id,headers:{cookie:workspaceClient.cookie}})).json();if(j.state==='REVIEW_OPEN')break;}
 assert.equal(j.deliveries.length,2);assert.equal(j.deliveries[0].revision,1);assert.notEqual(j.deliveries[0].hash,d.hash);assert.ok(j.deliveries[0].content.revisionNote);
 assert.equal((await post(workspaceClient,'/jobs/'+j.id+'/approve',{revision:d.revision,deliveryHash:d.hash})).statusCode,409);
 assert.equal(j.decisions.filter((d:any)=>d.kind==='EVIDENCE_FLAG').length,1);await approveNative(j);
 const final=(await app.inject({url:'/api/v1/jobs/'+j.id,headers:{cookie:workspaceClient.cookie}})).json();
 assert.equal(final.deliveries[0].checks.find((c:any)=>c.type==='CLIENT_APPROVE').result,'PASS');assert.equal(final.deliveries[1].checks.find((c:any)=>c.type==='CLIENT_APPROVE').result,'NOT_APPROVED');
});
test('knowledge is owner-scoped and job snapshots survive edits; templates exclude old sources and files',async()=>{
 const k=await post(workspaceClient,'/knowledge',{name:'Approved product facts',content:'The approved product name is Orby. Use a direct factual tone.'});assert.equal(k.statusCode,200,k.body);
 const j=await readyNative({knowledgeIds:[k.json().id]});assert.equal(j.input.knowledge.length,1);const before=j.input.knowledge[0].text;
 assert.equal((await nativeJob(workspaceClient)).state,'OPEN');
 const denied=await post(workspaceCreator,'/jobs',{...fixture,knowledgeIds:[k.json().id]});assert.equal(denied.statusCode,403);
 await post(workspaceClient,'/knowledge',{id:k.json().id,name:'Updated product facts',content:'The approved tone is concise and clear. This is new content.'});
 const snapshot=(await app.inject({url:'/api/v1/jobs/'+j.id,headers:{cookie:workspaceClient.cookie}})).json();assert.equal(snapshot.input.knowledge[0].text,before);
 await approveNative(j);const saved=await post(workspaceClient,'/templates/from-job/'+j.id,{name:'Reusable completed job'});assert.equal(saved.statusCode,200,saved.body);
 assert.ok(saved.json().blueprint.criteria);assert.equal(saved.json().blueprint.input,undefined);assert.equal(saved.json().blueprint.attachmentIds,undefined);assert.equal(saved.json().blueprint.nearYocto,undefined);
 assert.equal((await post(workspaceCreator,'/templates/from-job/'+j.id)).statusCode,403);
});
function programBody(kind:string){const {usdMicro,...base}=fixture;return {name:'Verified '+kind+' program',kind,agentIds:['format-reviewer'],autoFundSimulation:true,monthlyCapYocto:String(11n*Q/10n),timeZone:'UTC',weekday:1,hour:9,minute:0,blueprint:{...base,nearYocto:Q.toString()},stages:[{title:'Gather supplied evidence',budget:Q.toString()},{title:'Deliver final analysis',budget:Q.toString()}]};}
test('recurring programs enforce monthly reservations and pause failed schedules without spending',async()=>{
 const created=await post(workspaceClient,'/programs',programBody('RECURRING'));assert.equal(created.statusCode,200,created.body);const id=created.json().id;
 const first=await post(workspaceClient,'/programs/'+id+'/launch');assert.equal(first.statusCode,200,first.body);assert.equal(first.json().runs.length,1);
 const second=await post(workspaceClient,'/programs/'+id+'/launch');assert.equal(second.json().code,'MONTHLY_CAP');
 assert.equal((await post(workspaceCreator,'/programs/'+id+'/state',{state:'PAUSED'})).statusCode,404);
 await pool.query("UPDATE workspace_programs SET next_run_at=now()-interval '1 minute' WHERE id=$1",[id]);const {tickPrograms}=await import('../src/programs.js');await tickPrograms();
 const state=(await pool.query('SELECT state FROM workspace_programs WHERE id=$1',[id])).rows[0].state;assert.equal(state,'PAUSED');assert.equal(Number((await pool.query('SELECT count(*) FROM program_runs WHERE program_id=$1',[id])).rows[0].count),1);
});
test('milestone projects open the next paid job only after approval and can stop between stages',async()=>{
 const body=programBody('MILESTONES');body.stages[0]={...body.stages[0],description:'Gather exact supporting evidence for the first milestone.',criteria:[...fixture.criteria,{id:'first-stage-only',type:'AUTO_CHECK',required:true,description:'First milestone recommendation limit',config:{check:'word-count',min:1,max:500}}],approvalPolicy:'MANUAL_APPROVAL'};const created=await post(workspaceClient,'/programs',body),id=created.json().id;assert.equal(created.statusCode,200,created.body);
 const first=await post(workspaceClient,'/programs/'+id+'/launch');assert.equal(first.statusCode,200,first.body);const jobId=first.json().runs[0].id;const firstTerms=(await pool.query('SELECT data FROM jobs WHERE id=$1',[jobId])).rows[0].data;assert.equal(firstTerms.description,body.stages[0].description);assert.ok(firstTerms.criteria.some((c:any)=>c.id==='first-stage-only'));
 assert.equal((await post(workspaceClient,'/programs/'+id+'/launch')).json().code,'MILESTONE_WAITING');
 let job:any;for(let i=0;i<30;i++){await tick();job=(await app.inject({url:'/api/v1/jobs/'+jobId,headers:{cookie:workspaceClient.cookie}})).json();if(job.state==='REVIEW_OPEN')break;}await approveNative(job);
 await post(workspaceClient,'/programs/'+id+'/state',{state:'PAUSED'});assert.equal((await post(workspaceClient,'/programs/'+id+'/launch')).statusCode,400);
 await post(workspaceClient,'/programs/'+id+'/state',{state:'ACTIVE'});const next=await post(workspaceClient,'/programs/'+id+'/launch');assert.equal(next.statusCode,200,next.body);assert.notEqual(next.json().runs[0].id,jobId);const secondTerms=(await pool.query('SELECT data FROM jobs WHERE id=$1',[next.json().runs[0].id])).rows[0].data;assert.equal(secondTerms.criteria.some((c:any)=>c.id==='first-stage-only'),false);
});
test('paid trials create independent escrows and pay every successful participant',async()=>{
 const created=await post(workspaceClient,'/programs',{...programBody('TRIALS'),agentIds:['format-reviewer','source-extractor']});assert.equal(created.statusCode,200,created.body);
 const id=created.json().id,result=await post(workspaceClient,'/programs/'+id+'/launch');assert.equal(result.statusCode,200,result.body);assert.equal(result.json().runs.length,2);
 for(const run of result.json().runs){let job:any;for(let i=0;i<30;i++){await tick();job=(await app.inject({url:'/api/v1/jobs/'+run.id,headers:{cookie:workspaceClient.cookie}})).json();if(job.state==='REVIEW_OPEN')break;}assert.equal(job.bids.length,1);await approveNative(job);const settled=(await pool.query('SELECT state,data FROM jobs WHERE id=$1',[run.id])).rows[0];assert.equal(settled.state,'SETTLED');assert.ok(BigInt(settled.data.settlement.creatorCredit)>0n);}
 assert.equal((await post(workspaceClient,'/programs/'+id+'/launch')).json().code,'PROGRAM_COMPLETE');
});
test('available bond can be released without touching reserved performance collateral',async()=>{
 const before=(await pool.query("SELECT bucket,amount::text FROM balances WHERE book='SIMULATION' AND account_id='writer.demo'")).rows;
 const amount='1000000000000000000000',result=await post(workspaceCreator,'/balances/release-bond',{amount});assert.equal(result.statusCode,200,result.body);
 const after=(await pool.query("SELECT bucket,amount::text FROM balances WHERE book='SIMULATION' AND account_id='writer.demo'")).rows;
 assert.equal(BigInt(after.find(r=>r.bucket==='bond').amount),BigInt(before.find(r=>r.bucket==='bond').amount)-BigInt(amount));
 assert.equal(BigInt(after.find(r=>r.bucket==='free').amount),BigInt(before.find(r=>r.bucket==='free').amount)+BigInt(amount));
 assert.equal((await post(workspaceCreator,'/balances/release-bond',{amount:String(100n*Q)})).statusCode,400);
});

test('the action inbox reflects current obligations and removes a settled delivery',async()=>{
 const j=await nativeJob();
 const inbox=async(session:Session)=>(await app.inject({url:'/api/v1/notifications',remoteAddress:session.remoteAddress,headers:{cookie:session.cookie}})).json();
 assert.equal((await inbox(workspaceClient)).some((n:any)=>n.id===j.id),false);
 await post(workspaceClient,'/jobs/'+j.id+'/bids/request');
 assert.ok((await inbox(workspaceClient)).some((n:any)=>n.id===j.id&&n.proposals>0));
 assert.equal((await inbox(stranger)).some((n:any)=>n.id===j.id),false);
 const bid=(await pool.query("SELECT id FROM bids WHERE job_id=$1 AND agent_id='format-reviewer'",[j.id])).rows[0];
 const pv=await post(workspaceClient,'/jobs/'+j.id+'/funding-preview',{bidId:bid.id});
 await post(workspaceClient,'/jobs/'+j.id+'/fund',{previewId:pv.json().id});
 let detail:any;for(let i=0;i<30;i++){await tick();detail=(await app.inject({url:'/api/v1/jobs/'+j.id,headers:{cookie:workspaceClient.cookie}})).json();if(detail.state==='REVIEW_OPEN')break;}
 assert.ok((await inbox(workspaceClient)).some((n:any)=>n.id===j.id&&n.state==='REVIEW_OPEN'));
 await approveNative(detail);assert.equal((await inbox(workspaceClient)).some((n:any)=>n.id===j.id),false);
});

test('the simulation worker never leases or consumes testnet outbox work',async()=>{
 const id=randomUUID(),task=randomUUID();
 await pool.query("INSERT INTO jobs(id,book,client_id,state,data) VALUES($1,'TESTNET','alex.demo','OPEN',$2)",[id,{title:'Separate chain queue'}]);
 await pool.query("INSERT INTO outbox_jobs(id,job_id,type,next_attempt) VALUES($1,$2,'EXECUTE',now()-interval '1 day')",[task,id]);
 await tick();
 const row=(await pool.query('SELECT state,attempts,lease_until FROM outbox_jobs WHERE id=$1',[task])).rows[0];
 assert.equal(row.state,'QUEUED');assert.equal(row.attempts,0);assert.equal(row.lease_until,null);
});
test('an unverified transaction candidate cannot poison recovery with the correct receipt',async()=>{
 const {config}=await import('../src/config.js'),previous={contract:config.contract,rpc:config.rpc};
 const token=randomUUID(),csrf=randomUUID(),account='receipt.testnet',operationId=randomUUID(),requestId=randomUUID();
 await pool.query('INSERT INTO accounts(id) VALUES($1)',[account]);await pool.query("INSERT INTO sessions VALUES($1,$2,'TESTNET',$3,now()+interval '1 hour')",[hash(token),account,csrf]);
 const owner={cookie:'af_session='+token,csrf,remoteAddress:'198.51.100.109'},proposal={operationId,requestId,network:'testnet',signerId:account,receiverId:'receipt-market.testnet',methodName:'deposit_funds',args:{request_id:requestId},attachedDepositYocto:'1',gas:'150000000000000'};
 await pool.query("INSERT INTO chain_operations(id,request_id,account_id,state,payload_hash,proposal) VALUES($1,$2,$3,'PREPARED',$4,$5)",[operationId,requestId,account,hash(proposal),proposal]);
 let mode='missing';const server=createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const c of req)chunks.push(c);const b=JSON.parse(Buffer.concat(chunks).toString());let payload:any;
 if(b.method==='tx')payload=mode==='missing'?{error:{message:'unknown hash'}}:{result:{final_execution_status:'FINAL',status:{SuccessValue:''},transaction:{signer_id:mode==='wrong'?'attacker.testnet':account,receiver_id:proposal.receiverId,actions:[{FunctionCall:{method_name:proposal.methodName,deposit:'1',gas:proposal.gas,args:Buffer.from(JSON.stringify(proposal.args)).toString('base64')}}]},receipts_outcome:[]}};
 else payload={result:{result:[...Buffer.from(JSON.stringify({outcome:'deposited'}))]}};
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:b.id,...payload}));});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));config.contract=proposal.receiverId;config.rpc='http://127.0.0.1:'+(server.address() as any).port;
 try{
  const unknown=await post(owner,'/operations/'+operationId+'/transaction',{txHash:'A'.repeat(44)});assert.equal(unknown.json().state,'UNKNOWN');
  let row=(await pool.query('SELECT tx_hash,candidate_tx_hash,state FROM chain_operations WHERE id=$1',[operationId])).rows[0];assert.equal(row.tx_hash,null);assert.equal(row.candidate_tx_hash,'A'.repeat(44));
  mode='wrong';assert.equal((await post(owner,'/operations/'+operationId+'/transaction',{txHash:'B'.repeat(44)})).statusCode,400);
  mode='valid';assert.equal((await post(owner,'/operations/'+operationId+'/transaction',{txHash:'B'.repeat(44)})).json().state,'CONFIRMED');
  row=(await pool.query('SELECT tx_hash FROM chain_operations WHERE id=$1',[operationId])).rows[0];assert.equal(row.tx_hash,'B'.repeat(44));
 }finally{Object.assign(config,previous);await new Promise<void>(r=>server.close(()=>r()));}
});
test('Google OAuth is browser-bound and sheet writes require a preview, preserve rows and reconcile uncertain appends',async()=>{
 const previous={client:process.env.GOOGLE_CLIENT_ID,secret:process.env.GOOGLE_CLIENT_SECRET,key:process.env.INTEGRATION_ENCRYPTION_KEY},nativeFetch=globalThis.fetch;
 process.env.GOOGLE_CLIENT_ID='fixture-google-client';process.env.GOOGLE_CLIENT_SECRET='fixture-google-secret';process.env.INTEGRATION_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
 let appended=0,failAfterWrite=false,rows:any[][]=[['Existing data','keep this row']];
 globalThis.fetch=(async(input:any,init:any)=>{
   const url=String(input);
   if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'fixture-access-token',refresh_token:'fixture-refresh-token',expires_in:3600,scope:'https://www.googleapis.com/auth/spreadsheets'});
   if(url.startsWith('https://sheets.googleapis.com/')){assert.equal(init.headers.Authorization,'Bearer fixture-access-token');if(init.method==='POST'){appended++;const body=JSON.parse(init.body);rows.push(...body.values);if(failAfterWrite)throw Error('Fixture network dropped after the append');return Response.json({updates:{updatedRange:'Results!A2:G6',updatedRows:body.values.length}});}return Response.json({values:rows});}
   return nativeFetch(input,init);
 }) as typeof fetch;
 try{
   const auth=await post(workspaceClient,'/integrations/google/connect');assert.equal(auth.statusCode,200,auth.body);
   const state=new URL(auth.json().url).searchParams.get('state'),binding=auth.headers['set-cookie']!.toString().split(';')[0];
   assert.equal((await app.inject({url:'/api/v1/integrations/google/callback?state='+state+'&code=fixture'})).statusCode,403);
   const callback=await app.inject({url:'/api/v1/integrations/google/callback?state='+state+'&code=fixture',headers:{cookie:workspaceClient.cookie+'; '+binding}});assert.equal(callback.statusCode,302,callback.body);
   assert.equal((await app.inject({url:'/api/v1/integrations/google/callback?state='+state+'&code=fixture',headers:{cookie:workspaceClient.cookie+'; '+binding}})).statusCode,401);
   const encrypted=(await pool.query("SELECT encrypted_tokens FROM google_connections WHERE owner_id='alex.demo' AND book='SIMULATION'")).rows[0].encrypted_tokens;assert.ok(!encrypted.includes('fixture-access-token'));
   const read=await post(workspaceClient,'/integrations/google/read',{spreadsheetId:'fixture-sheet-id',range:'Results!A:G'});assert.equal(read.statusCode,200,read.body);assert.equal(read.json().rows[0][1],'keep this row');
   const job=await readyNative(),d=job.deliveries[0],target={spreadsheetId:'fixture-sheet-id',range:'Results!A:G',revision:d.revision,deliveryHash:d.hash};
   let prepared=await post(workspaceClient,'/jobs/'+job.id+'/sheets/preview',target);assert.equal(prepared.statusCode,200,prepared.body);assert.equal(appended,0);
   const id=prepared.json().id;assert.equal((await post(workspaceCreator,'/sheets/exports/'+id+'/commit')).statusCode,404);
   assert.equal((await post(workspaceClient,'/sheets/exports/'+id+'/commit')).json().state,'CONFIRMED');assert.equal(appended,1);assert.deepEqual(rows[0],['Existing data','keep this row']);
   assert.equal((await post(workspaceClient,'/sheets/exports/'+id+'/commit')).json().state,'CONFIRMED');assert.equal(appended,1);
   prepared=await post(workspaceClient,'/jobs/'+job.id+'/sheets/preview',target);const uncertain=prepared.json().id;failAfterWrite=true;
   assert.equal((await post(workspaceClient,'/sheets/exports/'+uncertain+'/commit')).json().state,'UNKNOWN');assert.equal(appended,2);
   assert.equal((await post(workspaceClient,'/jobs/'+job.id+'/sheets/preview',target)).json().code,'EXPORT_UNKNOWN');
   assert.equal((await post(workspaceClient,'/sheets/exports/'+uncertain+'/reconcile')).json().state,'CONFIRMED');assert.equal(appended,2);
 }finally{globalThis.fetch=nativeFetch;for(const [key,value]of Object.entries({GOOGLE_CLIENT_ID:previous.client,GOOGLE_CLIENT_SECRET:previous.secret,INTEGRATION_ENCRYPTION_KEY:previous.key}))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
