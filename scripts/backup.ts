import { pool, transaction } from "../src/db.js";
import { mkdir, writeFile } from "node:fs/promises";
import { hash } from "../src/domain.js";
const result = await transaction(async (db) => {
  await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const tables = (
    await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows.map((r) => r.tablename);
  const records: Record<string, any[]> = {};
  for (const t of tables)
    records[t] = (
      await db.query('SELECT * FROM "' + t.replaceAll('"', '""') + '"')
    ).rows;
  return {
    format: "agent-freelancer-postgres-v1",
    createdAt: new Date().toISOString(),
    records,
  };
});
const normalized = JSON.parse(JSON.stringify(result));
await mkdir(".data/backups", { recursive: true });
const path = ".data/backups/" + Date.now() + ".json";
await writeFile(
  path,
  JSON.stringify({ ...normalized, sha256: hash(normalized.records) }, null, 2),
);
console.log("Consistent PostgreSQL snapshot saved:", path);
await pool.end();
