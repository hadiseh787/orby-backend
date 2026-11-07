import { readFile } from "node:fs/promises";
import { pool, transaction } from "../src/db.js";
import { hash, assert } from "../src/domain.js";
import {createHash} from 'node:crypto';
const file = process.argv[2];
assert(file, "BACKUP_REQUIRED", "Pass the path to a backup file.");
const backup = JSON.parse(await readFile(file, "utf8"));
assert(
  backup.format === "orby-postgres-v1" &&
    hash(backup.records) === backup.sha256,
  "INVALID_BACKUP",
  "Backup integrity check failed.",
);
await transaction(async (db) => {
  const tables = (
    await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows.map((r) => r.tablename);
  for (const table of tables.filter((t) => t !== "schema_migrations"))
    assert(
      (await db.query('SELECT 1 FROM "' + table + '" LIMIT 1')).rowCount === 0,
      "RESTORE_NOT_EMPTY",
      "Restore requires a fresh, migrated database.",
    );
  // Dependency order is explicit; table names never come from backup input.
  const order = [
    "accounts",
    "auth_nonces",
    "sessions",
    "agents",
    "agent_versions",
    "execution_policies",
    "jobs",
    "job_attachments",
    "bids",
    "funding_previews",
    "balances",
    "ledger_entries",
    "deliveries",
    "job_events",
    "disputes",
    "runs",
    "outbox_jobs",
    "idempotency",
    "chain_operations",
    "chain_events",
    "audit_log",
    "price_snapshots",
    "pool_epochs",
    "pool_shares",
    "loans",
  ];
  assert(tables.every(table=>table==='schema_migrations'||order.includes(table)),"UNSUPPORTED_SCHEMA","Restore does not support every table in this database schema.");
  for (const table of order) {
    let rows = backup.records[table] || [];
    if (table === "jobs")
      rows = [
        ...rows.filter((r: any) => !r.parent_id),
        ...rows.filter((r: any) => r.parent_id),
      ];
    for (const row of rows) {
      if(table==='auth_nonces' && row.flow===undefined)row.flow='DIRECT';
      if(table==='job_attachments'){
        const bytes=Buffer.from(row.content_base64,'base64');
        assert(bytes.length===row.bytes&&createHash('sha256').update(bytes).digest('hex')===row.sha256,"INVALID_BACKUP","Attachment content does not match its recorded hash.");
      }
      await db.query(
        'INSERT INTO "' +
          table +
          '" SELECT * FROM jsonb_populate_record(NULL::"' +
          table +
          '",$1::jsonb)',
        [JSON.stringify(row)],
      );
    }
  }
  for (const table of ["ledger_entries", "job_events", "audit_log"])
    await db.query(
      `SELECT setval(pg_get_serial_sequence('${table}','id'),COALESCE((SELECT max(id) FROM ${table}),1),(SELECT count(*)>0 FROM ${table}))`,
    );
  for (const table of order) {
    const count = (
      await db.query('SELECT count(*)::int AS count FROM "' + table + '"')
    ).rows[0].count;
    assert(
      count === (backup.records[table] || []).length,
      "RESTORE_MISMATCH",
      "Row count mismatch in " + table,
    );
  }
});
console.log("Backup restored and row counts verified.");
await pool.end();
