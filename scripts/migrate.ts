import { readdir, readFile } from "node:fs/promises";
import { pool, transaction } from "../src/db.js";
export async function migrate() {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const file of (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await transaction(async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(10101)");
      if (
        (
          await db.query("SELECT 1 FROM schema_migrations WHERE version=$1", [
            file,
          ])
        ).rowCount
      )
        return;
      await db.query(
        await readFile(
          new URL("../migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
      await db.query("INSERT INTO schema_migrations(version) VALUES($1)", [
        file,
      ]);
    });
    console.log("Migration ready:", file);
  }
}
await migrate();
await pool.end();
