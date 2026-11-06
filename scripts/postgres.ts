import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const data = resolve(process.env.AF_POSTGRES_DATA || ".data/postgres");
const port=Number(process.env.AF_POSTGRES_PORT||5433);
const user=process.env.AF_POSTGRES_USER||'agent';
const password=process.env.AF_POSTGRES_PASSWORD||'agent_local_only';
mkdirSync(".data", { recursive: true });
const database = new EmbeddedPostgres({
  databaseDir: data,
  user,
  password,
  port,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (m) => console.error(String(m)),
});
if (!existsSync(resolve(data, "PG_VERSION"))) await database.initialise();
await database.start();
const client = database.getPgClient();
await client.connect();
if (
  !(
    await client.query(
      "SELECT 1 FROM pg_database WHERE datname='agent_freelancer'",
    )
  ).rowCount
)
  await client.query("CREATE DATABASE agent_freelancer");
await client.end();
console.log("PostgreSQL ready on 127.0.0.1:"+port);
let stopped = false;
async function stop() {
  if (stopped) return;
  stopped = true;
  await database.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 60000);
