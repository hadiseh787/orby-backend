import {catalogAgent,scenarios} from './catalog.js';
import {readiness,testnetHealth} from './readiness.js';
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config } from "./config.js";
import { pool } from "./db.js";
import { authRoutes, actor, type Actor } from "./auth.js";
import { AppError, assert, hash, Q, terminal, min, agentMinimum } from "./domain.js";
import {
  dto,
  loadJob,
  mutate,
  createJob,
  requestBids,
  preview,
  fund,
  settleJob,
  dispute,
  event,
  updateJob,
} from "./market.js";
import { move, balance } from "./ledger.js";
import { proposal, reconcile, view, agreementPrice } from "./near.js";
import {recoverRegistration} from './agent-registration.js';
import {registerSecurity} from './security.js';
import { nearUsdQuote } from "./price.js";
import {qualityRoutes} from './quality.js';
import {negotiationRoutes} from './negotiations.js';
import {knowledgeAccessRoutes} from './knowledge-access.js';
import {evidenceRoutes} from './evidence.js';
import {rehearsalRoutes} from './rehearsal.js';
import {workspaceTeamRoutes} from './workspaces.js';
import {canReadWorkspace,requireWorkspaceRole} from './workspace-access.js';
import {workspaceRoutes} from './workspace-routes.js';
import {latestDelivery,recordDecision,decisionChecks} from './delivery-decisions.js';
import {deterministicBrief,modelStatus} from './runtime.js';
import {missionRoutes,requireMissionApproval} from './mission.js';
import {intentsRoutes} from './intents.js';
import {walletRegistry} from './wallet-registry.js';
import {programRoutes,knowledgeSnapshot} from './programs.js';
import {googleRoutes} from './google-sheets.js';
import { uploadAttachment, claimAttachments } from "./attachments.js";
import {jobSchema,criterionSchema} from "./job-schema.js";
export {jobSchema,criterionSchema} from "./job-schema.js";
const amountSchema = z.string().regex(/^[1-9]\d{0,37}$/);
const idSchema = z.uuid();
export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL || "warn" },
    bodyLimit: 600000,
    requestTimeout: 30000,
  });
  await app.register(cookie);
  app.get('/api/v1/wallet-registry',async(_req,reply)=>{reply.header('cache-control','no-store');try{return await walletRegistry();}catch{reply.code(503);return {code:'WALLET_REGISTRY_UNAVAILABLE',message:'The official wallet registry is unavailable. Retry when connectivity is restored.'};}});
  await app.register(cors, { origin: config.origin, credentials: true });
  const serveSpa=await registerSecurity(app);
  await app.register(rateLimit, {
    max: req => ["GET","HEAD","OPTIONS"].includes(req.method) ? 600 : 120,
    timeWindow: 60000,
    keyGenerator: req => req.ip+(["GET","HEAD","OPTIONS"].includes(req.method)?":read":":write"),
    // SPA navigation and assets must not consume the API request budget.
    allowList: (req) => !req.url.startsWith("/api/"),
  });
  app.addHook("onRequest", async (req) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin)
        assert(
          origin === config.origin,
          "FORBIDDEN",
          "Request origin is not allowed.",
          403,
        );
    }
  });
  app.setErrorHandler((e: any, req, reply) => {
    if(e.code==='23505'){reply.code(409).send({code:'CONFLICT',message:'This identifier is already in use.',requestId:req.id,retryable:false});return;}
    const status =
      e instanceof AppError
        ? e.status
        : e instanceof z.ZodError
          ? 400
          : e.statusCode || 500;
    reply
      .code(status)
      .send({
        code:
          e.code ||
          (e instanceof z.ZodError ? "VALIDATION_ERROR" : "INTERNAL_ERROR"),
        message: e instanceof z.ZodError ? e.issues.map((i:any)=>`${i.path.join('.') || 'Input'}: ${i.message}`).join("; ") :
          status === 500
            ? "An internal error occurred. See the server log."
            : e.message,
        requestId: req.id,
        retryable: e.retryable || false,
        details: e instanceof z.ZodError ? e.issues : undefined,
      });
    if (status >= 500) req.log.error(e);
  });
  app.get('/api/v1/readiness',async()=>readiness());
  await authRoutes(app);
  await workspaceRoutes(app);
  await workspaceTeamRoutes(app);
  await evidenceRoutes(app);
  await rehearsalRoutes(app);
  await qualityRoutes(app);
  await negotiationRoutes(app);
  await knowledgeAccessRoutes(app);
  await programRoutes(app);
  await googleRoutes(app);
  await missionRoutes(app);
  await intentsRoutes(app);
  if(process.env.LOCAL_SHUTDOWN_TOKEN&&process.send){
    app.post('/api/v1/local/shutdown',{config:{rateLimit:false}},async(req,reply)=>{
      assert(req.headers['x-local-shutdown']===process.env.LOCAL_SHUTDOWN_TOKEN,'FORBIDDEN','Invalid local launcher token.',403);
      setTimeout(()=>process.send?.({type:'local-shutdown',token:process.env.LOCAL_SHUTDOWN_TOKEN}),100).unref();
      return {ok:true};
    });
  }
  app.get('/api/v1/explorer',async(req:any)=>{
    const book=req.query.book==='TESTNET'?'TESTNET':'SIMULATION';
    return (await pool.query("SELECT j.id,j.book,j.agent_id AS \"agentId\",j.state,j.created_at AS \"createdAt\",j.data->>'deliveryHash' AS \"deliveryHash\",j.data->'settlement' AS settlement,(SELECT tx_hash FROM chain_operations o WHERE o.job_id=j.id AND o.state='CONFIRMED' ORDER BY o.created_at DESC LIMIT 1) AS \"transactionHash\" FROM jobs j WHERE j.book=$1 AND j.state IN ('SETTLED','REFUNDED') AND j.parent_id IS NULL ORDER BY j.created_at DESC LIMIT 50",[book])).rows;
  });
  const mutation = (
    path: string,
    fn: (db: any, a: Actor, b: any, p: any) => Promise<any>,
  ) =>
    app.post("/api/v1" + path, async (req: any) => {
      const a = await actor(req);
      requireWorkspaceRole(a,...(path==='/uploads/:id/remove'?['OWNER','MEMBER']:['OWNER']));
      return mutate(
        a,
        req.headers["idempotency-key"],
        { path, params: req.params, body: req.body || {}, workspace:a.workspaceId },
        (db) => fn(db, a, req.body || {}, req.params || {}),
      );
    });
  app.get("/api/v1/config", async () => ({
    name: "Orby",
    demoLogin: config.demo,
    network: "testnet",
    walletRpcUrls:[config.walletRpc],
    contractId: config.contract,
    chainConfigured: !!config.contract,
    accelerated: config.accelerated,
    modelConfigured: !!config.model,
    googleSheetsConfigured:!!process.env.GOOGLE_CLIENT_ID&&!!process.env.GOOGLE_CLIENT_SECRET,
    modelName:config.model,
    modelProvider:config.modelProvider,
    books: ["SIMULATION", "TESTNET"],
    priceMode: "NATIVE_NEAR",
    primaryAsset: "NEAR",
    contractVersionRequired: 3,
    attachmentLimits: {maxFiles:5,maxBytes:2097152,extensions:["pdf","txt","md","json","png","jpg","jpeg"]},
    ipfsAvailable:!!process.env.IPFS_API_URL,
    referenceOnly: true,
  }));
  app.get("/api/v1/price", async () => nearUsdQuote());
  app.post("/api/v1/uploads", {bodyLimit:3000000}, async(req:any)=> {
    const a=await actor(req);requireWorkspaceRole(a,'OWNER','MEMBER');
    return mutate(a,req.headers["idempotency-key"],{path:"/uploads",body:req.body},db=>uploadAttachment(db,a,req.body||{}));
  });
  mutation("/uploads/:id/remove",async(db,a,b,p)=>{
    const result=await db.query("DELETE FROM job_attachments WHERE id=$1 AND (owner_id=$2 OR $5::boolean) AND book=$3 AND workspace_id=$4 AND job_id IS NULL RETURNING id",[idSchema.parse(p.id),a.id,a.book,a.workspaceId,a.workspaceRole==='OWNER']);
    assert(result.rowCount,"NOT_FOUND","Unused attachment not found.",404);return {ok:true};
  });
  app.get("/api/v1/uploads/:id",async(req:any,reply)=>{
    const a=await actor(req), id=idSchema.parse(req.params.id);
    const f=(await pool.query("SELECT * FROM job_attachments WHERE id=$1",[id])).rows[0];
    assert(f&&f.book===a.book,"NOT_FOUND","Attachment not found.",404);
    if(f.workspace_id===a.workspaceId){assert(await canReadWorkspace(pool,a,f.workspace_id),"FORBIDDEN","Workspace membership is required.",403);}else{assert(f.job_id,"FORBIDDEN","Attachment is private.",403);await loadJob(pool,f.job_id,a);}
    reply.header("Content-Disposition",`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`).header("Cache-Control","private, no-store").header("X-Content-Type-Options","nosniff");
    return reply.type(f.media_type).send(Buffer.from(f.content_base64,"base64"));
  });
  app.get("/api/v1/health", async () => {
    await pool.query("SELECT 1");
    return { status: "ok", database: "postgresql", version: "1.5.0" };
  });
  app.get("/api/v1/templates", async () => ({
    templates: [
      {
        id: "comparison",
        name: "Comparison brief",
        description: "Compare three proposals with source citations.",
        category: "writing",
      },
      {
        id: "evidence",
        name: "Source evidence",
        description: "Organize claims from supplied source text.",
        category: "research",
      },
      {
        id: "review",
        name: "Structured review",
        description: "Review the structure and completeness of a brief.",
        category: "review",
      },
    ],
  }));
  app.get('/api/v1/scenarios',async()=>({scenarios:scenarios.map(s=>({...s,preview:deterministicBrief(s.input),executionNotice:'Demo / Sample preview. Deterministic illustration, not a live model run or paid result.'}))}));
  app.get("/api/v1/agents", async (req: any) => {
    const book = req.query.book === "TESTNET" ? "TESTNET" : "SIMULATION";
    const rows = (
      await pool.query(
        "SELECT a.*,p.data AS policy,p.version AS policy_version FROM agents a LEFT JOIN execution_policies p ON p.agent_id=a.id AND p.book=a.book WHERE a.book=$1 ORDER BY a.created_at,a.id LIMIT 50",
        [book],
      )
    ).rows;
    const reference=rows.some(r=>!r.data.minPriceNear)?await agreementPrice(book).catch(()=>null):null;
    const counts=(await pool.query("SELECT agent_id,count(*) FILTER(WHERE state='SETTLED')::int AS completed,count(*) FILTER(WHERE state IN ('SETTLED','REFUNDED'))::int AS total FROM jobs WHERE book=$1 AND parent_id IS NULL AND NOT(data ? 'seededExample') GROUP BY agent_id",[book])).rows;
    return rows.map((r) => ({
      ...r.data,
      id: r.id,
      book: r.book,
      name: r.name,
      category: r.category,
      state: r.state,
      ownerId: r.owner_id,
      version: r.version,
      policy: r.policy,
      policyVersion: r.policy_version,
      displayMinPriceNear:r.data.minPriceNear||(reference?agentMinimum(r.data,true,reference.priceMicro):null),
      completed:counts.find(c=>c.agent_id===r.id)?.completed||0,
      outcomes:counts.find(c=>c.agent_id===r.id)?.total||0,
    }));
  });
  app.get("/api/v1/agents/:id", async (req: any) => {
    const book = req.query.book === "TESTNET" ? "TESTNET" : "SIMULATION";
    const r = (
      await pool.query("SELECT * FROM agents WHERE id=$1 AND book=$2", [
        req.params.id,
        book,
      ])
    ).rows[0];
    assert(r, "NOT_FOUND", "Agent not found.", 404);
    let viewer:any=null;try{viewer=await actor(req);}catch{}
    const records = (
      await pool.query(
        "SELECT j.id,j.state,j.data->'settlement' AS settlement,j.created_at,j.data->>'title' AS title,j.data->>'category' AS category,j.client_id FROM jobs j WHERE j.agent_id=$1 AND j.book=$2 AND j.state IN ('SETTLED','REFUNDED') AND NOT(j.data ? 'seededExample') ORDER BY j.created_at DESC LIMIT 20",
        [r.id, book],
      )
    ).rows;
    return {
      ...r.data,
      id: r.id,
      ownerId: r.owner_id,
      state: r.state,
      displayMinPriceNear:r.data.minPriceNear||await agreementPrice(book).then(p=>agentMinimum(r.data,true,p.priceMicro)).catch(()=>null),
      records:records.map(x=>{const allowed=viewer?.book===book&&(viewer.id===x.client_id||viewer.id===r.owner_id||viewer.roles.includes('admin'));return {id:x.id,state:x.state,created_at:x.created_at,title:allowed?x.title:'Completed '+(x.category||'agent')+' work',url:allowed?'/client/jobs/'+x.id:null};}),
      sampleRecords:book==='SIMULATION'?(await pool.query("SELECT id,state,data->>'title' AS title FROM jobs WHERE agent_id=$1 AND book='SIMULATION' AND data->>'seededExample' LIKE 'rich-v1-%' ORDER BY created_at DESC",[r.id])).rows.map(x=>({...x,url:viewer?.book===book&&(viewer.id==='samples.demo'||viewer.id===r.owner_id||viewer.roles.includes('admin'))?'/client/jobs/'+x.id:null})):[],
      example:catalogAgent(r.id)?.example||{sources:[{id:'sample-a',text:'Proposal A has a clear scope and testing milestones.'},{id:'sample-b',text:'Proposal B has a lower budget but an uncertain support plan.'}]},
      sampleOutput:deterministicBrief(catalogAgent(r.id)?.example||{sources:[{id:'sample-a',text:'Proposal A has a clear scope and testing milestones.'},{id:'sample-b',text:'Proposal B has a lower budget but an uncertain support plan.'}]}),
    };
  });
  mutation("/agents", async (db, a, b) => {
    const m = z
      .object({
        id: z.string().trim().toLowerCase().transform(s=>s.replace(/\s+/g,"-")).pipe(z.string().regex(/^[a-z0-9-]{3,48}$/, "Use 3–48 lowercase letters, numbers or hyphens for Agent ID.")),
        name: z.string().min(3).max(80),
        description: z.string().min(10).max(1000),
        category: z.enum(["writing", "research", "review"]),
        minPriceUsdMicro: z.string().regex(/^[1-9]\d{0,8}$/).optional(),
        minPriceNear: z.string().regex(/^[1-9]\d{0,26}$/, "Enter a positive minimum price in NEAR.").refine(v=>BigInt(v)<=100n*Q,"Minimum price cannot exceed 100 NEAR.").optional(),
        skills: z.array(z.string().min(1).max(40)).max(8),
        acceptsSubcontracts: z.boolean(),
      })
      .parse(b);
    assert(m.minPriceNear || m.minPriceUsdMicro,"VALIDATION_ERROR","A positive minimum price in NEAR is required.");
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['agent-registration:'+a.book+':'+m.id]);
    const existing=(await db.query("SELECT owner_id,state FROM agents WHERE id=$1 AND book=$2",[m.id,a.book])).rows[0];
    if(existing?.owner_id===a.id && existing.state==='PENDING' && a.book==='TESTNET')return recoverRegistration(db,a,m.id);
    assert(!existing,"AGENT_EXISTS","This Agent ID is already registered. Use another ID or resume its pending wallet operation.",409);
    const data = {
      ...m,
      initials: m.name
        .split(" ")
        .map((x) => x[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
      manifestVersion: 1,
      health: "DETERMINISTIC",
      completed: 0,
      etaMinutes: 2,
      seeded: false,
      endpointMode: "LOCAL_DEMO_ALLOWLIST_ONLY",
      chainPolicyReady:a.book==='SIMULATION',
      maxInputBytes: 262144,
    };
    await db.query(
      "INSERT INTO agents(id,book,owner_id,name,category,data,state) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [m.id, a.book, a.id, m.name, m.category, data,a.book==='TESTNET'?'PENDING':'ACTIVE'],
    );
    await db.query(
      "INSERT INTO agent_versions(agent_id,book,version,manifest,hash) VALUES($1,$2,1,$3,$4)",
      [m.id, a.book, data, hash(data)],
    );
    await db.query(
      "INSERT INTO execution_policies(agent_id,book,owner_id,data) VALUES($1,$2,$3,$4)",
      [
        m.id,
        a.book,
        a.id,
        {
          maxSpendYocto: "0",
          maxBondYocto: String(10n * Q),
          allowedAgentIds: [],
          expiresAt: Date.now() + 86400000 * 30,
          paused: false,
        },
      ],
    );
    return a.book === "TESTNET"
      ? {
          id: m.id,
          ...(await proposal(
            db,
            a.id,
            m.minPriceNear ? "register_near_agent" : "register_agent",
            {
              agent_id: m.id,
              manifest_hash: hash(data),
              min_price: m.minPriceNear || m.minPriceUsdMicro,
            },
            "0",
          )),
        }
      : { id: m.id };
  });
  mutation('/agents/:id/retry-registration',async(db,a,b,p)=>recoverRegistration(db,a,p.id));
  mutation("/agents/:id/test", async (db, a, b, p) => {
    const r = (
      await db.query(
        "SELECT * FROM agents WHERE id=$1 AND book=$2 AND owner_id=$3",
        [p.id, a.book, a.id],
      )
    ).rows[0];
    assert(r, "FORBIDDEN", "Only the agent owner can run this test.", 403);
    const { deterministicBrief } = await import("./runtime.js");
    return {
      status: "SUCCEEDED",
      mode: "DETERMINISTIC",
      content: deterministicBrief(
        b.input || {
          sources: [
            { id: "sample", text: "Sample input for a local agent test." },
          ],
        },
      ),
    };
  });
  mutation("/agents/:id/policy", async (db, a, b, p) => {
    const data = z
      .object({
        maxSpendYocto: z.string().regex(/^\d{1,38}$/),
        maxBondYocto: z.string().regex(/^\d{1,38}$/),
        allowedAgentIds: z.array(z.string().max(48)).max(10),
        expiresAt: z
          .number()
          .int()
          .refine((v) => v > Date.now()),
        paused: z.boolean(),
      })
      .parse(b);
    const r = (
      await db.query(
        "SELECT * FROM execution_policies WHERE agent_id=$1 AND book=$2 AND owner_id=$3 FOR UPDATE",
        [p.id, a.book, a.id],
      )
    ).rows[0];
    assert(r, "FORBIDDEN", "Only the policy owner can change it.", 403);
    if (a.book === "TESTNET")
      return proposal(db, a.id, "set_execution_policy", {
        agent_id: p.id,
        executor: config.serviceAccount || a.id,
        max_spend: data.maxSpendYocto,
        max_bond: data.maxBondYocto,
        allowed: data.allowedAgentIds,
        expires_at: String(data.expiresAt),
        paused: data.paused,
      });
    await db.query(
      "UPDATE execution_policies SET data=$3,version=version+1 WHERE agent_id=$1 AND book=$2",
      [p.id, a.book, data],
    );
    return { ok: true };
  });
  app.get("/api/v1/jobs", async (req: any) => {
    const a = await actor(req);
    const rows = (
      await pool.query(
        "SELECT j.* FROM jobs j LEFT JOIN agents ag ON ag.id=j.agent_id AND ag.book=j.book WHERE j.book=$1 AND (j.workspace_id=$4 OR ag.owner_id=$2 OR $3) AND j.parent_id IS NULL ORDER BY j.created_at DESC LIMIT 50",
        [a.book, a.id, a.roles.includes("admin"),a.workspaceId],
      )
    ).rows;
    return rows.map(dto);
  });
  mutation("/jobs", async (db, a, b) => {
    const parsed = jobSchema.parse(b);
    if(parsed.missionPlanRequired)assert(parsed.preferredAgentId==='brief-writer'&&parsed.runtimeMode==='REAL_AI','INVALID_MISSION','A mission uses Brief Writer and explicit real AI.');
    if(b.workspaceDraftId){const draft=(await db.query('SELECT * FROM workspace_drafts WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[z.uuid().parse(b.workspaceDraftId),a.workspaceId])).rows[0];assert(draft&&!draft.published_job_id&&draft.revision===b.expectedDraftRevision&&hash(jobSchema.parse(draft.data))===hash(parsed),'DRAFT_CHANGED','The team draft changed or was published. Review its current version.',409);}
    if(parsed.preferredAgentId)assert((await db.query("SELECT 1 FROM agents WHERE id=$1 AND book=$2 AND state='ACTIVE'",[parsed.preferredAgentId,a.book])).rowCount,'AGENT_UNAVAILABLE','The selected agent is unavailable.');
    const knowledge=await knowledgeSnapshot(db,a,parsed.knowledgeIds);
    assert(Buffer.byteLength(JSON.stringify({...parsed.input,knowledge}))<=262144,'INPUT_TOO_LARGE','Combined source material and knowledge exceeds 256 KiB.');
    const attachments=await claimAttachments(db,a,parsed.attachmentIds);
    if (!config.accelerated)
      assert(
        parsed.deadlineMinutes >= 60,
        "VALIDATION_ERROR",
        "Deadline must be at least one hour.",
      );
    const j = await createJob(db, a, {...parsed,input:{...parsed.input,knowledge,knowledgeAccess:{main:parsed.knowledgeIds,children:parsed.knowledgeChildGrants}},attachments});
    if(b.workspaceDraftId)await db.query('UPDATE workspace_drafts SET published_job_id=$2 WHERE id=$1',[b.workspaceDraftId,j.id]);
    if(attachments.length)await db.query("UPDATE job_attachments SET job_id=$1 WHERE id=ANY($2::uuid[])",[j.id,parsed.attachmentIds]);
    return a.book === "TESTNET"
      ? {
          ...j,
          ...(await proposal(
            db,
            a.id,
            j.nearYocto ? "open_near_job" : "open_job",
            {
              job_id: j.id,
              terms_hash: j.termsHash,
              ...(j.nearYocto ? {budget:j.nearYocto} : {usd_micro:j.usdMicro}),
              deadline_ms: String(j.deadline),
              manual: j.approvalPolicy === "MANUAL_APPROVAL",
            },
            "0",
            j.id,
          )),
        }
      : j;
  });
  app.get("/api/v1/jobs/open", async(req:any)=>{
    const a=await actor(req);
    return (await pool.query("SELECT id,data->>'title' AS title,data->>'nearYocto' AS near_budget,data->>'usdMicro' AS usd_micro,data->>'category' AS category,data->>'deadline' AS deadline FROM jobs WHERE book=$1 AND state='OPEN' AND client_id<>$2 AND (data->>'deadline')::numeric>extract(epoch from now())*1000 AND (book='SIMULATION' OR data->>'chainConfirmed'='true') ORDER BY created_at DESC LIMIT 50",[a.book,a.id])).rows;
  });
  mutation("/jobs/:id/bids",async(db,a,b,p)=>{
    const j=await loadJob(db,idSchema.parse(p.id),undefined,true);
    assert(j.book===a.book&&j.state==='OPEN'&&j.client_id!==a.id,"INVALID_STATE","Only another account can bid on an open job.");
    const ag=(await db.query("SELECT * FROM agents WHERE id=$1 AND book=$2 AND owner_id=$3 AND state='ACTIVE'",[b.agentId,a.book,a.id])).rows[0];
    assert(ag,"FORBIDDEN","Choose an active agent owned by your account.",403);
    assert(!j.data.preferredAgentId||j.data.preferredAgentId===ag.id,'ASSIGNED_AGENT','This job is assigned to another agent.');
    const amount=amountSchema.parse(b.amount),native=!!j.data.nearYocto;
    let data=ag.data;
    if(a.book==='TESTNET') {
      const chainAgent=await view('get_agent',{agent_id:ag.id});
      assert(chainAgent?.active && chainAgent.owner===a.id,'INVALID_STATE','The agent is not active on the contract.');
      data={minPriceUsdMicro:chainAgent.min_price,minPriceNear:await view('get_near_price',{agent_id:ag.id})};
    }
    const reference = native && data.minPriceNear ? {priceMicro:Q.toString()} : await agreementPrice(a.book);
    const minimum=agentMinimum(data,native,reference.priceMicro);
    assert(minimum,'INVALID_AMOUNT','A native-only agent cannot bid on a legacy USD job.');
    assert(BigInt(amount)<=BigInt(j.data.nearYocto||j.data.usdMicro)&&BigInt(amount)>=BigInt(minimum),"INVALID_AMOUNT","The proposal must be between the agent minimum and the job budget, in the job currency.");
    assert(j.data.deadline>Date.now(),"JOB_EXPIRED","This job deadline has expired.");
    const id=randomUUID(),expires=Date.now()+Math.min(1800000,j.data.deadline-Date.now());
    const prior=(await db.query("SELECT id FROM bids WHERE job_id=$1 AND agent_id=$2",[j.id,ag.id])).rows[0];
    assert(!prior,"BID_EXISTS","This agent has already submitted a proposal for this job.",409);
    if(a.book==='TESTNET')return proposal(db,a.id,"record_bid",{bid_id:id,job_id:j.id,agent_id:ag.id,price:amount,eta_ms:"120000",expires_at:String(expires)},"0",j.id);
    await db.query("INSERT INTO bids(id,job_id,agent_id,book,amount,data,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)",[id,j.id,ag.id,a.book,amount,{etaMinutes:2,manifestVersion:ag.version,acceptanceHash:j.data.termsHash},new Date(expires)]);
    return {id};
  });
  app.get("/api/v1/jobs/:id", async (req: any) => {
    const a = await actor(req),
      id = idSchema.parse(req.params.id),
      j = await loadJob(pool, id, a);
    const [bids, deliveries, events, children, d,decisions] = await Promise.all([
      pool.query(
        "SELECT b.*,ag.name,ag.owner_id,ag.data AS agent_data FROM bids b JOIN agents ag ON ag.id=b.agent_id AND ag.book=b.book WHERE b.job_id=$1 ORDER BY b.amount::numeric,b.id",
        [id],
      ),
      pool.query(
        "SELECT * FROM deliveries WHERE job_id=$1 ORDER BY revision DESC",
        [id],
      ),
      pool.query("SELECT * FROM job_events WHERE job_id=$1 OR job_id IN (SELECT id FROM jobs WHERE parent_id=$1) ORDER BY id", [id]),
      pool.query("SELECT * FROM jobs WHERE parent_id=$1 ORDER BY created_at", [
        id,
      ]),
      pool.query("SELECT * FROM disputes WHERE job_id=$1", [id]),
      pool.query('SELECT * FROM delivery_decisions WHERE job_id=$1 ORDER BY created_at',[id]),
    ]);
    return {
      ...dto(j),
      bids: bids.rows.map((b) => ({
        ...b.data,
        id: b.id,
        agentId: b.agent_id,
        agentName: b.name,
        ownerId: b.owner_id,
        amount: b.amount,
        counterofferOf:b.data.counterofferOf||null,
        expiresAt: b.expires_at,
      })),
      deliveries: deliveries.rows.map(d=>({...d,checks:decisionChecks(d,decisions.rows,terminal(j.state))})),
      decisions:decisions.rows,
      events: events.rows.map(e=>({...e,stage:e.job_id===id?'MAIN':'SPECIALIST'})),
      runtimeAttempts:(await pool.query("SELECT m.run_key AS \"runKey\",m.job_id AS \"jobId\",m.state,m.data->'usage' AS usage,m.data->>'forcedFailure' AS failure,(SELECT d.checks FROM deliveries d WHERE d.job_id=m.job_id AND m.run_key=m.job_id::text||':delivery:'||d.revision::text) AS checks FROM model_runs m WHERE m.job_id=ANY($1::uuid[]) ORDER BY m.created_at",[[id,...children.rows.map(c=>c.id)]])).rows,
      children: children.rows.map(dto),
      dispute: d.rows[0] || null,
    };
  });
  mutation("/jobs/:id/bids/request", async (db, a, b, p) =>
    requestBids(db, a, idSchema.parse(p.id)),
  );
  mutation("/jobs/:id/funding-preview", async (db, a, b, p) =>
    preview(db, a, idSchema.parse(p.id), idSchema.parse(b.bidId)),
  );
  mutation("/jobs/:id/fund", async (db, a, b, p) => {
    if (a.book === 'SIMULATION'){const job=await loadJob(db,p.id,a,true);const saved=(await db.query('SELECT data FROM funding_previews WHERE id=$1',[b.previewId])).rows[0];requireMissionApproval(job,saved?.data?.bidId);return fund(db,a,idSchema.parse(p.id),idSchema.parse(b.previewId));}
    const j = await loadJob(db, p.id, a, true);
    assert(j.client_id===a.id && j.state==='OPEN','INVALID_STATE','Only the client can fund an open job.');
    assert(j.data.deadline>Date.now(),'JOB_EXPIRED','This job deadline has expired.');
    requireMissionApproval(j,b.previewId?(await db.query("SELECT data->>'bidId' AS bid_id FROM funding_previews WHERE id=$1",[b.previewId])).rows[0]?.bid_id:b.bidId);
    const pv = (
      await db.query(
        "SELECT * FROM funding_previews WHERE id=$1 AND job_id=$2 AND actor=$3 AND expires_at>now() AND consumed=false",
        [b.previewId, p.id, a.id],
      )
    ).rows[0];
    assert(
      pv && pv.data.jobVersion === j.version,
      "PREVIEW_STALE",
      "Refresh the funding preview.",
    );
    if(!j.data.nearYocto)assert((await agreementPrice(a.book)).priceMicro===pv.data.priceMicro,'PREVIEW_STALE','The contract price changed. Refresh the funding preview.');
    return proposal(
      db,
      a.id,
      "award_and_fund",
      {
        job_id: p.id,
        bid_id: pv.data.bidId,
        expected_version: j.data.onchain?.version || 1,
        preview_expires_at: String(pv.data.expiresAt),
      },
      pv.data.escrow,
      p.id,
    );
  });
  mutation("/jobs/:id/approve", async (db, a, b, p) => {
    const j = await loadJob(db, idSchema.parse(p.id), a, true);
    assert(
      j.client_id === a.id && j.state === "REVIEW_OPEN",
      "INVALID_STATE",
      "Only the client can approve a delivery ready for review.",
    );
    const delivery=await latestDelivery(db,j,z.number().int().nonnegative().parse(b.revision),z.string().regex(/^[a-f0-9]{64}$/).parse(b.deliveryHash));
    assert(delivery.checks.every((c:any)=>!c.required||c.type!=='AUTO_CHECK'||c.result==='PASS'),'CHECKS_FAILED','Required checks have not passed. Request a revision or open a dispute.');
    if(a.book==='TESTNET')return proposal(db,a.id,'approve_delivery',{job_id:j.id,revision:delivery.revision,delivery_hash:delivery.hash},'0',j.id);
    await recordDecision(db,j,a.id,'APPROVE',delivery);
    return settleJob(db,j,a.id);
  });
  mutation("/jobs/:id/disputes", async (db, a, b, p) => {
    const reason = z.string().min(10).max(2000).parse(b.reason),
      j = await loadJob(db, idSchema.parse(p.id), a, true);
    if (a.book === "TESTNET"){
      const result=await proposal(
        db,
        a.id,
        "open_dispute",
        { job_id: j.id, reason_hash: hash(reason) },
        "0",
        j.id,
      );
    await db.query('UPDATE chain_operations SET context=$2 WHERE id=$1',[result.operation.operationId,{reason}]);return result;
    }
    return dispute(db, a, j, reason);
  });
  mutation("/jobs/:id/cancel", async (db, a, b, p) => {
    const j = await loadJob(db, p.id, a, true);
    assert(
      j.client_id === a.id && j.state === "OPEN",
      "INVALID_STATE",
      "Only an unfunded job can be cancelled.",
    );
    if (a.book === "TESTNET")
      return proposal(db, a.id, "cancel_job", { job_id: j.id }, "0", j.id);
    await event(db, j.id, a.id, "job_cancelled");
    return updateJob(db, j, "CANCELLED");
  });
  mutation("/jobs/:id/retry", async (db, a, b, p) => {
    const j = await loadJob(db, p.id, a, true);
    assert(
      a.book === "SIMULATION",
      "CHAIN_REQUIRED",
      "Use the testnet executor to resume this run.",
    );
    assert(
      j.client_id === a.id || j.creator_id === a.id,
      "FORBIDDEN",
      "Not allowed.",
      403,
    );
    const failed = (
      await db.query(
        "SELECT * FROM outbox_jobs WHERE job_id=$1 AND state='FAILED'",
        [j.id],
      )
    ).rows[0];
    assert(
      failed || j.state === "REVISION_REQUIRED",
      "INVALID_STATE",
      "No recoverable run is waiting.",
    );
    if (j.state === "REVISION_REQUIRED") {
      assert(
        j.data.revision === 0 && Date.now() < j.data.revisionDeadline,
        "INVALID_STATE",
        "The revision window has ended.",
      );
      await updateJob(db, j, "RUNNING", { revision: 1 });
    }
    await db.query(
      "UPDATE outbox_jobs SET state='QUEUED',attempts=0,next_attempt=now(),error=null WHERE job_id=$1",
      [j.id],
    );
    return { ok: true };
  });
  mutation("/jobs/:id/claim-due", async (db, a, b, p) => {
    const j = await loadJob(db, p.id, a, true);
    if (a.book === "TESTNET")
      return proposal(
        db,
        a.id,
        "claim_due_transition",
        { job_id: j.id },
        "0",
        j.id,
      );
    if (j.state === "DISPUTED") {
      const d = (
        await db.query("SELECT * FROM disputes WHERE job_id=$1 FOR UPDATE", [
          j.id,
        ])
      ).rows[0];
      assert(
        d && new Date(d.deadline).getTime() <= Date.now(),
        "DEADLINE_NOT_REACHED",
        "The arbitrator deadline has not elapsed.",
      );
      const noDelivery = j.data.noDeliveryClaim;
      return settleJob(
        db,
        j,
        a.id,
        noDelivery ? 0 : 5000,
        noDelivery ? 2500 : 0,
        noDelivery
          ? "no delivery after objection window"
          : "agreed dispute fallback",
      );
    }
    const startMissed =
      j.state === "FUNDED" && Date.now() > j.data.startDeadline;
    const missed =
      ["RUNNING", "REVISION_REQUIRED"].includes(j.state) &&
      Date.now() > j.data.deadline;
    if (startMissed || missed) {
      assert(
        j.client_id === a.id,
        "FORBIDDEN",
        "Only the client may claim non-delivery.",
        403,
      );
      const result = await dispute(
        db,
        a,
        j,
        "No delivery was recorded before the agreed deadline.",
      );
      await db.query("UPDATE disputes SET deadline=$2 WHERE job_id=$1", [
        j.id,
        new Date(Date.now() + (config.accelerated ? 60000 : 43200000)),
      ]);
      await updateJob(db, j, "DISPUTED", { noDeliveryClaim: true });
      return result;
    }
    assert(
      j.state === "REVIEW_OPEN" &&
        j.data.approvalPolicy === "MANUAL_APPROVAL" &&
        j.creator_id === a.id &&
        Date.now() > j.data.reviewDeadline,
      "DEADLINE_NOT_REACHED",
      "No transition is due.",
    );
    return dispute(
      db,
      a,
      j,
      "The client did not respond within the agreed review window.",
    );
  });
  app.get("/api/v1/jobs/:id/evidence", async (req: any, reply) => {
    const a = await actor(req),
      j = await loadJob(pool, req.params.id, a);
    const d = (
      await pool.query(
        "SELECT content,hash,checks,revision,created_at FROM deliveries WHERE job_id=$1",
        [j.id],
      )
    ).rows;
    const e = (
      await pool.query(
        "SELECT actor,type,data,created_at FROM job_events WHERE job_id=$1 ORDER BY id",
        [j.id],
      )
    ).rows;
    reply.header(
      "content-disposition",
      `attachment; filename="evidence-${j.id}.json"`,
    );
    return {
      schemaVersion: "1.0",
      book: a.book,
      job: dto(j),
      deliveries: d,
      events: e,
      exportedAt: new Date().toISOString(),
    };
  });
  app.get("/api/v1/balances", async (req: any) => {
    const a = await actor(req);
    if (a.book === "TESTNET")
      return {
        book: a.book,
        chain: await view("get_balance", { account_id: a.id }),
        balances: [],
      };
    return {
      book: a.book,
      balances: (
        await pool.query(
          "SELECT bucket,amount::text FROM balances WHERE book=$1 AND account_id=$2 ORDER BY bucket",
          [a.book, a.id],
        )
      ).rows,
      ledger: (
        await pool.query(
          "SELECT delta::text,bucket,reason,created_at,job_id FROM ledger_entries WHERE book=$1 AND account_id=$2 ORDER BY id DESC LIMIT 50",
          [a.book, a.id],
        )
      ).rows,
    };
  });
  mutation("/balances/deposit", async (db, a, b) => {
    const amount = amountSchema.parse(b.amount);
    assert(a.book!=='TESTNET'||b.bucket!=='credit','SIMULATION_ONLY','Credit reserves are simulated in this version.');
    assert(
      ["bond", "credit", "free"].includes(b.bucket),
      "INVALID_BUCKET",
      "Choose a valid balance bucket.",
    );
    if (a.book === "TESTNET")
      return proposal(
        db,
        a.id,
        b.bucket === "bond" ? "deposit_bond" : "deposit_funds",
        {},
        amount,
      );
    assert(
      b.bucket !== "free",
      "INVALID_BUCKET",
      "Simulation free balance is supplied only by the seed.",
    );
    await move(
      db,
      a.book,
      a.id,
      "free",
      a.id,
      b.bucket,
      amount,
      "deposit_" + b.bucket,
    );
    return { ok: true };
  });
  mutation("/balances/withdraw", async (db, a, b) => {
    const amount = amountSchema.parse(b.amount);
    if (a.book === "TESTNET")
      return proposal(db, a.id, "withdraw", { amount }, "1");
    await move(
      db,
      a.book,
      a.id,
      "free",
      a.id,
      "simulation_withdrawn",
      amount,
      "simulation_withdrawal",
    );
    return {
      state: "SIMULATED",
      message: "Simulation recorded. No token transfer was sent.",
    };
  });
  mutation('/balances/release-bond',async(db,a,b)=>{const amount=amountSchema.parse(b.amount);if(a.book==='TESTNET')return proposal(db,a.id,'release_unused_bond',{amount});await move(db,a.book,a.id,'bond',a.id,'free',amount,'release_unused_bond');return {ok:true};});
  app.get("/api/v1/creator/runs", async (req: any) => {
    const a = await actor(req);
    return (
      await pool.query(
        "SELECT r.*,j.data->>'title' AS title FROM runs r JOIN jobs j ON j.id=r.job_id JOIN agents ag ON ag.id=j.agent_id AND ag.book=j.book WHERE ag.owner_id=$1 AND j.book=$2 ORDER BY r.updated_at DESC LIMIT 50",
        [a.id, a.book],
      )
    ).rows;
  });
  app.get("/api/v1/operations/:id", async (req: any) => {
    const a = await actor(req);
    assert(a.book==='TESTNET','FORBIDDEN','Use the matching testnet account for transaction history.',403);
    const op = (
      await pool.query(
        "SELECT id,state,proposal,tx_hash,candidate_tx_hash,updated_at FROM chain_operations WHERE id=$1 AND account_id=$2 AND proposal->>'receiverId'=$3",
        [req.params.id, a.id,config.contract],
      )
    ).rows[0];
    assert(op, "NOT_FOUND", "Operation not found.", 404);
    return op;
  });
  app.get("/api/v1/operations",async(req)=>{
    const a=await actor(req);
    assert(a.book==='TESTNET','FORBIDDEN','Use a testnet session for transaction history.',403);
    return (await pool.query("SELECT id,state,proposal,tx_hash,candidate_tx_hash,updated_at FROM chain_operations WHERE account_id=$1 AND proposal->>'receiverId'=$2 ORDER BY created_at DESC LIMIT 50",[a.id,config.contract])).rows;
  });
  mutation("/operations/:id/transaction", async (db, a, b, p) => {
    const op = (
      await db.query(
        "SELECT * FROM chain_operations WHERE id=$1 AND account_id=$2 AND proposal->>'receiverId'=$3 FOR UPDATE",
        [p.id, a.id,config.contract],
      )
    ).rows[0];
    assert(op, "NOT_FOUND", "Operation not found.", 404);
    assert(a.book==='TESTNET','FORBIDDEN','Use the matching testnet account for this transaction.',403);
    return reconcile(db, op, b.txHash || op.tx_hash || op.candidate_tx_hash);
  });
  const admin = async (req: any) => {
    const a = await actor(req);
    assert(
      a.roles.includes("admin"),
      "FORBIDDEN",
      "An administrator session is required.",
      403,
    );
    return a;
  };
  app.get("/api/v1/admin/system", async (req) => {
    const a = await admin(req);
    const [states, queue, unknown, disputes] = await Promise.all([
      pool.query(
        "SELECT state,count(*)::int FROM jobs WHERE book=$1 GROUP BY state",
        [a.book],
      ),
      pool.query("SELECT state,count(*)::int FROM outbox_jobs GROUP BY state"),
      pool.query(
        "SELECT count(*)::int FROM chain_operations WHERE state IN ('UNKNOWN','SUBMITTED') AND $1='TESTNET'",[a.book],
      ),
      pool.query(
        "SELECT d.*,j.data->>'title' AS title,j.book FROM disputes d JOIN jobs j ON j.id=d.job_id WHERE j.book=$1 AND d.decision IS NULL ORDER BY d.created_at",
        [a.book],
      ),
    ]);
    const chainHealth=await testnetHealth();
    return {
      database: "CONNECTED",
      rpc: chainHealth.state,
      testnetReadiness:chainHealth,
      runtime: config.model ? await modelStatus().then(r=>r.state+' | '+r.model) : 'DETERMINISTIC',
      price: { mode: "FIXTURE", priceMicro: "5000000" },
      states: states.rows,
      queue: queue.rows,
      unknown: unknown.rows[0].count,
      disputes: disputes.rows,
      paused:a.book==='TESTNET'?(await view('get_config')).paused:
        (
          await pool.query(
            "SELECT data FROM price_snapshots WHERE id='system-config'",
          )
        ).rows[0]?.data?.paused || false,
    };
  });
  mutation('/admin/reconcile',async(db,a,b)=>{
    assert(a.roles.includes('admin'),'FORBIDDEN','An administrator session is required.',403);
    if(a.book!=='TESTNET')return {checked:0,confirmed:0,failed:0,unresolved:0};
    const op=(await db.query("SELECT * FROM chain_operations WHERE state IN ('UNKNOWN','SUBMITTED') AND ($1::uuid IS NULL OR id=$1) AND proposal->>'receiverId'=$2 ORDER BY updated_at LIMIT 1 FOR UPDATE SKIP LOCKED",[b.operationId?idSchema.parse(b.operationId):null,config.contract])).rows[0];
    if(!op)return {checked:0,confirmed:0,failed:0,unresolved:0};
    let confirmed=0,failed=0;
    if(op.tx_hash||op.candidate_tx_hash||b.txHash){const result=await reconcile(db,op,b.txHash||op.tx_hash||op.candidate_tx_hash);confirmed=Number(result.state==='CONFIRMED');failed=Number(result.state==='FAILED');}
    else if(op.account_id===config.serviceAccount){
      const outcome=await view('get_operation',{account_id:op.account_id,request_id:op.request_id});
      if(outcome){await db.query("UPDATE chain_operations SET state='CONFIRMED',receipt=$2,updated_at=now() WHERE id=$1",[op.id,{contractOperation:outcome,finality:'FINAL'}]);confirmed=1;}
    }
    await db.query('UPDATE chain_operations SET updated_at=now() WHERE id=$1',[op.id]);
    return {checked:1,confirmed,failed,unresolved:1-confirmed-failed};
  });
  app.get("/api/v1/admin/audit", async (req) => {
    await admin(req);
    return (
      await pool.query("SELECT * FROM audit_log ORDER BY id DESC LIMIT 50")
    ).rows;
  });
  mutation("/admin/disputes/:id/decision", async (db, a, b, p) => {
    assert(
      a.roles.includes("admin"),
      "FORBIDDEN",
      "Admin access required.",
      403,
    );
    const decision = z
      .object({
        awardBps: z.number().int().min(0).max(10000),
        penaltyBps: z.number().int().min(0).max(10000),
        reason: z.string().min(10).max(2000),
        category: z.enum([
          "NO_DELIVERY",
          "CONFIRMED_FRAUD",
          "BREACH_OF_CRITERIA",
          "NO_PENALTY",
        ]),
      })
      .parse(b);
    assert(
      decision.penaltyBps === 0 || decision.category !== "NO_PENALTY",
      "INVALID_PENALTY",
      "Select a proven breach category for a penalty.",
    );
    const d = (
      await db.query(
        "SELECT * FROM disputes WHERE id=$1 AND decision IS NULL FOR UPDATE",
        [p.id],
      )
    ).rows[0];
    assert(d, "INVALID_STATE", "This case has already been decided.");
    const j = await loadJob(db, d.job_id, a, true);
    if (a.book === "TESTNET"){
      const result=await proposal(
        db,
        a.id,
        "resolve_dispute",
        {
          job_id: j.id,
          award_bps: decision.awardBps,
          penalty_bps: decision.penaltyBps,
          reason_hash: hash(decision),
        },
        "0",
        j.id,
      );
    await db.query('UPDATE chain_operations SET context=$2 WHERE id=$1',[result.operation.operationId,{decision}]);return result;
    }
    const result = await settleJob(
      db,
      j,
      a.id,
      decision.awardBps,
      decision.penaltyBps,
      decision.reason,
    );
    await db.query("UPDATE disputes SET decision=$2 WHERE id=$1", [
      d.id,
      { ...decision, evidenceHash: hash(decision), decidedAt: Date.now() },
    ]);
    return result;
  });
  mutation("/admin/pause", async (db, a, b) => {
    assert(
      a.roles.includes("admin"),
      "FORBIDDEN",
      "Admin access required.",
      403,
    );
    const paused = z.boolean().parse(b.paused);
    if (a.book === "TESTNET")
      return proposal(db, a.id, "pause_new", { paused });
    await db.query(
      "INSERT INTO price_snapshots VALUES('system-config','FIXTURE','1',now(),$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
      [{ paused }],
    );
    return { paused };
  });
  mutation("/admin/agents/:id/state", async (db, a, b, p) => {
    assert(
      a.roles.includes("admin"),
      "FORBIDDEN",
      "Admin access required.",
      403,
    );
    const state = z.enum(["ACTIVE", "SUSPENDED"]).parse(b.state);
    if(a.book==='TESTNET')return proposal(db,a.id,'set_agent_active',{agent_id:p.id,active:state==='ACTIVE'});
    await db.query(
      "UPDATE agents SET state=$3,version=version+1 WHERE id=$1 AND book=$2",
      [p.id, a.book, state],
    );
    return { state };
  });
  await creditRoutes(app, mutation);
  app.get("/api/v1/openapi.json", async () => ({
    openapi: "3.1.0",
    info: { title: "Orby API", version: "1.0.0" },
    servers: [{ url: "/api/v1" }],
    components: {
      schemas: {
        CreateJob: z.toJSONSchema(jobSchema, { unrepresentable: "any" }),
        Criterion: z.toJSONSchema(criterionSchema),
      },
    },
    paths: {
      "/jobs": {
        get: {
          summary: "List authorized jobs",
          responses: { "200": { description: "Jobs" } },
        },
        post: {
          summary: "Create a job",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateJob" },
              },
            },
          },
          responses: {
            "200": { description: "Created job and optional wallet proposal" },
          },
        },
      },
      "/health": {
        get: {
          summary: "Database health",
          responses: { "200": { description: "Healthy" } },
        },
      },
    },
  }));
  const frontend = resolve(process.env.FRONTEND_DIST || "../frontend/dist/orby/browser");
  if (existsSync(frontend)) {
    app.get('/',async(req,reply)=>serveSpa(req,reply,frontend));
    app.get('/index.html',async(req,reply)=>serveSpa(req,reply,frontend));
    await app.register(staticFiles, { root: frontend, wildcard: true,index:false });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply
            .code(404)
            .send({ code: "NOT_FOUND", message: "API route not found." })
          : (()=>{
              const pathname=req.url.split('?')[0];
              if(/\.(?:js|css|png|jpe?g|svg|ico|woff2?|json|map)$/.test(pathname))return reply.code(404).send({code:'NOT_FOUND',message:'Asset not found.'});
              const known=/^\/(?:$|settings$|trust$|explorer$|workspace\/tools$|client\/jobs(?:\/(?:new|[0-9a-f-]{36}))?$|agents\/[a-z0-9-]{3,48}$|creator\/(?:agents|earnings|runs|credit)$|lender\/pool$|admin\/system$)/.test(pathname);
              return serveSpa(req,reply,frontend,known?200:404);
            })(),
    );
  }
  return app;
}
async function creditRoutes(app: any, mutation: any) {
  app.get("/api/v1/credit", async (req: any) => {
    const a = await actor(req);
    assert(
      a.book === "SIMULATION",
      "SIMULATION_ONLY",
      "Credit is simulated in this version.",
    );
    const epochs = (
      await pool.query(
        "SELECT e.*,COALESCE(s.shares,0)::text AS my_shares,COALESCE(s.redeemed,false) AS redeemed FROM pool_epochs e LEFT JOIN pool_shares s ON s.epoch_id=e.id AND s.account_id=$1 ORDER BY e.created_at DESC LIMIT 20",
        [a.id],
      )
    ).rows;
    const loans = (
      await pool.query(
        "SELECT * FROM loans WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 20",
        [a.id],
      )
    ).rows;
    return {
      book: "SIMULATION",
      epochs,
      loans,
      creditReserve: await balance(pool, a.book, a.id, "credit"),
    };
  });
  mutation("/pool/deposit", async (db: any, a: Actor, b: any) => {
    assert(
      a.book === "SIMULATION",
      "SIMULATION_ONLY",
      "This pool is simulated.",
    );
    const amount = amountSchema.parse(b.amount),
      epoch = (
        await db.query(
          "SELECT * FROM pool_epochs WHERE id=$1 AND state='FUNDRAISING' FOR UPDATE",
          [idSchema.parse(b.epochId)],
        )
      ).rows[0];
    assert(epoch, "INVALID_STATE", "Deposits are closed for this epoch.");
    await move(
      db,
      a.book,
      a.id,
      "free",
      epoch.id,
      "pool",
      amount,
      "pool_deposit",
    );
    await db.query(
      "INSERT INTO pool_shares(epoch_id,account_id,shares) VALUES($1,$2,$3) ON CONFLICT(epoch_id,account_id) DO UPDATE SET shares=CASE WHEN pool_shares.redeemed THEN EXCLUDED.shares ELSE pool_shares.shares+EXCLUDED.shares END,redeemed=false",
      [epoch.id, a.id, amount],
    );
    await db.query(
      "UPDATE pool_epochs SET data=jsonb_set(data,'{totalShares}',to_jsonb($2::text)) WHERE id=$1",
      [epoch.id, String(BigInt(epoch.data.totalShares) + BigInt(amount))],
    );
    return { ok: true };
  });
  mutation("/pool/:id/advance", async (db: any, a: Actor, b: any, p: any) => {
    assert(
      a.book === "SIMULATION" && a.roles.includes("admin"),
      "FORBIDDEN",
      "The simulation operator controls epoch transitions.",
      403,
    );
    const e = (
      await db.query("SELECT * FROM pool_epochs WHERE id=$1 FOR UPDATE", [p.id])
    ).rows[0];
    assert(e, "NOT_FOUND", "Epoch not found.");
    if (e.state === "FUNDRAISING") {
      if(BigInt(e.data.totalShares)===0n){await db.query("UPDATE pool_epochs SET state='CLOSED' WHERE id=$1",[e.id]);return {state:'CLOSED'};}
      await db.query(
        "UPDATE pool_epochs SET state='LENDING',data=data||$2::jsonb WHERE id=$1",
        [e.id, JSON.stringify({ lendingUntil: Date.now() + 86400000 })],
      );
      return { state: "LENDING" };
    }
    assert(
      e.state === "LENDING",
      "INVALID_STATE",
      "This epoch cannot advance.",
    );
    const active = (
      await db.query(
        "SELECT 1 FROM loans WHERE epoch_id=$1 AND state='ACTIVE'",
        [e.id],
      )
    ).rowCount;
    assert(
      !active,
      "LOANS_OPEN",
      "All active loans must settle before redemption.",
    );
    const assets = await balance(db, a.book, e.id, "pool");
    await db.query(
      "UPDATE pool_epochs SET state='REDEMPTION',data=data||$2::jsonb WHERE id=$1",
      [
        e.id,
        JSON.stringify({
          finalAssets: assets,
          redeemed: "0",
          redeemedShares: "0",
        }),
      ],
    );
    return { state: "REDEMPTION" };
  });
  mutation("/pool/:id/redeem", async (db: any, a: Actor, b: any, p: any) => {
    assert(
      a.book === "SIMULATION",
      "SIMULATION_ONLY",
      "This pool is simulated.",
    );
    const e = (
      await db.query("SELECT * FROM pool_epochs WHERE id=$1 FOR UPDATE", [p.id])
    ).rows[0];
    assert(
      e && ["FUNDRAISING", "REDEMPTION"].includes(e.state),
      "INVALID_STATE",
      "Withdrawals open after the epoch loans settle.",
    );
    const s = (
      await db.query(
        "SELECT shares::text,redeemed FROM pool_shares WHERE epoch_id=$1 AND account_id=$2 FOR UPDATE",
        [e.id, a.id],
      )
    ).rows[0];
    assert(
      s && !s.redeemed && BigInt(s.shares) > 0n,
      "INVALID_STATE",
      "There are no unredeemed shares.",
    );
    let amount = s.shares;
    if (e.state === "REDEMPTION") {
      const last =
        BigInt(e.data.redeemedShares || "0") + BigInt(s.shares) ===
        BigInt(e.data.totalShares);
      amount = last
        ? String(BigInt(e.data.finalAssets) - BigInt(e.data.redeemed))
        : String(
            (BigInt(e.data.finalAssets) * BigInt(s.shares)) /
              BigInt(e.data.totalShares),
          );
      await db.query(
        "UPDATE pool_epochs SET data=data||$2::jsonb WHERE id=$1",
        [
          e.id,
          JSON.stringify({
            redeemed: String(BigInt(e.data.redeemed) + BigInt(amount)),
            redeemedShares: String(
              BigInt(e.data.redeemedShares || "0") + BigInt(s.shares),
            ),
          }),
        ],
      );
      if(last)await db.query("UPDATE pool_epochs SET state='CLOSED' WHERE id=$1",[e.id]);
    } else {
      await db.query(
        "UPDATE pool_epochs SET data=jsonb_set(data,'{totalShares}',to_jsonb($2::text)) WHERE id=$1",
        [e.id, String(BigInt(e.data.totalShares) - BigInt(s.shares))],
      );
    }
    await move(
      db,
      a.book,
      e.id,
      "pool",
      a.id,
      "free",
      amount,
      "pool_redemption",
    );
    await db.query(
      "UPDATE pool_shares SET redeemed=true WHERE epoch_id=$1 AND account_id=$2",
      [e.id, a.id],
    );
    return { amount, book: a.book };
  });
  mutation("/credit/preview", async (db: any, a: Actor, b: any) => {
    assert(a.book === "SIMULATION", "SIMULATION_ONLY", "Credit is simulated.");
    const principal = amountSchema.parse(b.principal),
      fee = (BigInt(principal) * 400n) / 10000n,
      due = BigInt(principal) + fee,
      reserve = await balance(db, a.book, a.id, "credit");
    return {
      principal,
      fee: String(fee),
      due: String(due),
      reserve,
      eligible: BigInt(reserve) >= due,
      book: a.book,
      unit: "simNEAR",
      feeBps: 400,
      annualized: false,
      disbursement: "child escrow only",
      message:
        "This is a financing preview. Issuance requires a funded root, eligible owner and separate credit reserve.",
    };
  });
}
if (process.argv[1]?.replaceAll("\\", "/").match(/server\.(ts|js)$/)) {
  const app = await buildApp();
  await app.listen({ host: config.host, port: config.port });
  console.log(`Orby API: http://${config.host}:${config.port}`);
  const close = async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
