import { randomUUID } from "node:crypto";
import { type DB } from "./db.js";
import { assert, atomic } from "./domain.js";
export async function balance(
  db: DB,
  book: string,
  account: string,
  bucket = "free",
) {
  return (
    (
      await db.query(
        "SELECT amount::text FROM balances WHERE book=$1 AND account_id=$2 AND bucket=$3",
        [book, account, bucket],
      )
    ).rows[0]?.amount || "0"
  );
}
export async function move(
  db: DB,
  book: string,
  from: string,
  fromBucket: string,
  to: string,
  toBucket: string,
  value: string,
  reason: string,
  jobId: string | null = null,
) {
  const amount = atomic(value);
  if (amount === 0n) return;
  const keys = [
    { account: from, bucket: fromBucket },
    { account: to, bucket: toBucket },
  ].sort((a, b) =>
    (a.account + ":" + a.bucket).localeCompare(b.account + ":" + b.bucket),
  );
  for (const k of keys) {
    await db.query(
      "INSERT INTO balances(book,account_id,bucket) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [book, k.account, k.bucket],
    );
    await db.query(
      "SELECT amount FROM balances WHERE book=$1 AND account_id=$2 AND bucket=$3 FOR UPDATE",
      [book, k.account, k.bucket],
    );
  }
  assert(
    BigInt(await balance(db, book, from, fromBucket)) >= amount,
    "INSUFFICIENT_BALANCE",
    "Insufficient available " + fromBucket + " balance.",
  );
  await db.query(
    "UPDATE balances SET amount=amount-$4 WHERE book=$1 AND account_id=$2 AND bucket=$3",
    [book, from, fromBucket, value],
  );
  await db.query(
    "UPDATE balances SET amount=amount+$4 WHERE book=$1 AND account_id=$2 AND bucket=$3",
    [book, to, toBucket, value],
  );
  const id = randomUUID();
  await db.query(
    "INSERT INTO ledger_entries(transfer_id,book,account_id,bucket,delta,job_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7),($1,$2,$8,$9,$10,$6,$7)",
    [
      id,
      book,
      from,
      fromBucket,
      "-" + value,
      jobId,
      reason,
      to,
      toBucket,
      value,
    ],
  );
}
