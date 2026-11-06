import "dotenv/config";
import { readdir } from "node:fs/promises";
import pg from "pg";
import { spawnSync } from "node:child_process";
const files = (await readdir(".data/backups"))
  .filter((f) => f.endsWith(".json"))
  .sort();
if (!files.length) throw Error("Run npm run backup first.");
const baseUrl=new URL(process.env.DATABASE_URL||'postgresql://agent:agent_local_only@127.0.0.1:5433/agent_freelancer');
const adminUrl=new URL(baseUrl);adminUrl.pathname='/postgres';
const name = "af_restore_" + Date.now(),
  client = new pg.Client({
    connectionString:adminUrl.href,
  });
await client.connect();
await client.query("CREATE DATABASE " + name);
try {
  baseUrl.pathname='/'+name;
  const env = {
    ...process.env,
    DATABASE_URL:baseUrl.href,
  };
  for (const args of [
    ["scripts/migrate.ts"],
    ["scripts/restore.ts", ".data/backups/" + files.at(-1)],
  ]) {
    const r = spawnSync(process.execPath, ["--import", "tsx", ...args], {
      env,
      encoding: "utf8",
    });
    if (r.status !== 0) throw Error(r.stderr || r.stdout);
    console.log(r.stdout.trim());
  }
} finally {
  await client.query("DROP DATABASE " + name + " WITH (FORCE)");
  await client.end();
}
