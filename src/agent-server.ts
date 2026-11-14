import {catalog} from './catalog.js';
import Fastify from "fastify";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { hash, assert } from "./domain.js";
import { verifyRuntime, runModel } from "./runtime.js";
export const localAgents=catalog.map((a,i)=>({id:a.id,port:4101+i,price:a.minPriceUsdMicro}));
export async function buildAgent(id: string, secret: string) {
  const spec = localAgents.find((a) => a.id === id);
  assert(spec, "UNKNOWN_AGENT", "Unknown local runtime.");
  const app = Fastify({ logger: false, bodyLimit: 300000 }),
    nonces = new Set<string>();
  const runs = new Map<string, any>();
  const file = ".data/runtimes/" + id + ".json";
  if (existsSync(file))
    for (const r of JSON.parse(await readFile(file, "utf8")))
      runs.set(r.runId, r);
  const persist = async () => {
    await mkdir(".data/runtimes", { recursive: true });
    await writeFile(file, JSON.stringify([...runs.values()]));
  };
  app.addHook("preHandler", async (req) => {
    if (req.url === "/health") return;
    verifyRuntime(
      secret,
      String(req.headers["x-runtime-signature"] || ""),
      req.method,
      req.url,
      String(req.headers["x-runtime-timestamp"] || ""),
      String(req.headers["x-runtime-nonce"] || ""),
      req.body || {},
      nonces,
    );
  });
  app.get("/health", async () => ({
    protocolVersion: "1.0",
    agentId: id,
    capacity: 1,
    inputTypes: ["application/json"],
    maxInputBytes: 262144,
  }));
  app.post("/bid", async () => ({
    usdMicro: spec.price,
    etaMinutes: 2,
    expiresAt: Date.now() + 1800000,
  }));
  app.post("/runs", async (req: any, reply) => {
    const body = req.body;
    assert(
      typeof body?.runId === "string" &&
        body.runId.length <= 150 &&
        Array.isArray(body.input?.sources),
      "INVALID_INPUT",
      "Provide a stable runId and source input.",
    );
    const old = runs.get(body.runId);
    if (old) {
      assert(
        old.payloadHash === hash(body),
        "IDEMPOTENCY_CONFLICT",
        "runId already has different input.",
      );
      reply.code(202);
      return { runId: old.runId, status: "ACCEPTED", protocolVersion: "1.0" };
    }
    const record = {
      runId: body.runId,
      payloadHash: hash(body),
      status: "RUNNING",
    };
    runs.set(body.runId, record);
    await persist();
    void runModel(body.input)
      .then(async (r) => {
        if (runs.get(body.runId)?.status === "CANCELLED") return;
        runs.set(body.runId, {
          ...record,
          status: "SUCCEEDED",
          content: r.content,
          artifactHash: hash(r.content),
          mode: r.mode,
        });
        await persist();
      })
      .catch(async () => {
        runs.set(body.runId, {
          ...record,
          status: "FAILED",
          error: {
            code: "RUNTIME_UNAVAILABLE",
            message: "Local runtime unavailable.",
            retryable: true,
          },
        });
        await persist();
      });
    reply.code(202);
    return { runId: body.runId, status: "ACCEPTED", protocolVersion: "1.0" };
  });
  app.get("/runs/:id", async (req: any) => {
    const run = runs.get(req.params.id);
    assert(run, "NOT_FOUND", "Runtime execution not found.", 404);
    const { payloadHash, ...publicRun } = run;
    return publicRun;
  });
  app.post("/runs/:id/cancel", async (req: any) => {
    const run = runs.get(req.params.id);
    assert(run, "NOT_FOUND", "Runtime execution not found.", 404);
    if (!["SUCCEEDED", "FAILED"].includes(run.status)) {
      run.status = "CANCELLED";
      await persist();
    }
    return { runId: run.runId, status: run.status };
  });
  app.setErrorHandler((e: any, req, reply) =>
    reply
      .code(e.status || 400)
      .send({
        code: e.code || "RUNTIME_ERROR",
        message: e.message,
        retryable: false,
      }),
  );
  return app;
}
if (process.argv[1]?.replaceAll("\\", "/").match(/agent-server\.(ts|js)$/)) {
  await mkdir(".data/runtimes", { recursive: true });
  const file = ".data/runtimes/secrets.json";
  const secrets = existsSync(file)
    ? JSON.parse(await readFile(file, "utf8"))
    : Object.fromEntries(
        localAgents.map((a) => [a.id, randomBytes(32).toString("hex")]),
      );
  await writeFile(file, JSON.stringify(secrets));
  const servers: Array<Awaited<ReturnType<typeof buildAgent>>> = [];
  for (const agent of localAgents) {
    const app = await buildAgent(agent.id, secrets[agent.id]);
    await app.listen({ host: "127.0.0.1", port: agent.port });
    servers.push(app);
    console.log("Local agent runtime:", agent.id, "127.0.0.1:" + agent.port);
  }
  const stop = async () => {
    await Promise.all(servers.map((s) => s.close()));
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
