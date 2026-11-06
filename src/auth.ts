import { randomBytes, randomUUID, createHash } from "node:crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { pool, transaction } from "./db.js";
import { config } from "./config.js";
import { assert, hash } from "./domain.js";
export type Actor = {
  id: string;
  roles: string[];
  book: "SIMULATION" | "TESTNET";
  csrf: string;
};
export async function actor(request: any): Promise<Actor> {
  const token = request.cookies.af_session;
  assert(
    token,
    "AUTH_INVALID",
    "Connect your wallet or open a local demo session.",
    401,
  );
  const row = (
    await pool.query(
      "SELECT s.*,a.roles FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.id_hash=$1 AND s.expires_at>now()",
      [hash(token)],
    )
  ).rows[0];
  assert(row, "AUTH_INVALID", "Your session expired. Connect again.", 401);
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method))
    assert(
      request.headers["x-csrf-token"] === row.csrf,
      "AUTH_INVALID",
      "Invalid request token.",
      403,
    );
  return {
    id: row.account_id,
    roles: row.roles,
    book: row.book,
    csrf: row.csrf,
  };
}
async function session(reply: any, id: string, book: string) {
  const token = randomBytes(32).toString("base64url"),
    csrf = randomBytes(24).toString("base64url");
  await pool.query(
    "INSERT INTO sessions VALUES($1,$2,$3,$4,now()+interval '12 hours')",
    [hash(token), id, book, csrf],
  );
  reply.setCookie("af_session", token, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: config.secure,
    maxAge: 43200,
  });
  const account = (await pool.query("SELECT * FROM accounts WHERE id=$1", [id]))
    .rows[0];
  return { id, roles: account.roles, book, csrf };
}
export function messageDigest(
  message: string,
  nonce: Buffer,
  recipient: string,
  callbackUrl?:string,
) {
  const tag = Buffer.alloc(4);
  tag.writeUInt32LE(2147483648 + 413);
  const str = (v: string) => {
    const b = Buffer.from(v);
    const len = Buffer.alloc(4);
    len.writeUInt32LE(b.length);
    return Buffer.concat([len, b]);
  };
  return createHash("sha256")
    .update(
      Buffer.concat([
        tag,
        str(message),
        nonce,
        str(recipient),
        ...(callbackUrl?[Buffer.from([1]),str(callbackUrl)]:[Buffer.from([0])]),
      ]),
    )
    .digest();
}
export async function authRoutes(app: any) {
  app.get("/api/v1/auth/me", async (req: any) => {
    try {
      return await actor(req);
    } catch {
      return null;
    }
  });
  app.post("/api/v1/auth/demo", async (req: any, reply: any) => {
    assert(config.demo, "FORBIDDEN", "Local demo login is disabled.", 403);
    const allowed = [
      "alex.demo",
      "writer.demo",
      "researcher.demo",
      "reviewer.demo",
      "operator.demo",
    ];
    assert(
      allowed.includes(req.body?.account),
      "AUTH_INVALID",
      "Choose a known local demo account.",
    );
    return session(reply, req.body.account, "SIMULATION");
  });
  app.post("/api/v1/auth/logout", async (req: any, reply: any) => {
    await actor(req);
    await pool.query("DELETE FROM sessions WHERE id_hash=$1", [
      hash(req.cookies.af_session),
    ]);
    reply.clearCookie("af_session", { path: "/" });
    return { ok: true };
  });
  app.post("/api/v1/auth/challenge", async () => {
    const id = randomUUID(),
      nonce = randomBytes(32).toString("base64"),
      recipient = new URL(config.origin).host;
    const message = `Sign in to Agent Freelancer on NEAR testnet. Request: ${id}. No transaction or spending permission.`;
    await pool.query(
      "INSERT INTO auth_nonces VALUES($1,$2,$3,$4,now()+interval '5 minutes',false)",
      [id, nonce, message, recipient],
    );
    return { id, nonce, message, recipient, callbackUrl:config.origin+'/settings', network: "testnet" };
  });
  app.post("/api/v1/auth/verify", async (req: any, reply: any) => {
    const b = req.body;
    assert(
      b &&
        /^[a-z0-9._-]{2,64}$/.test(b.accountId || "") &&
        typeof b.publicKey === "string" &&
        typeof b.signature === "string",
      "AUTH_INVALID",
      "Invalid wallet signature.",
    );
    const id = await transaction(async (db) => {
      const c = (
        await db.query(
          "SELECT * FROM auth_nonces WHERE id=$1 AND consumed=false AND expires_at>now() FOR UPDATE",
          [b.challengeId],
        )
      ).rows[0];
      assert(c, "AUTH_INVALID", "Expired or consumed challenge.", 401);
      const key = bs58.decode(b.publicKey.replace(/^ed25519:/, ""));
      const valid = nacl.sign.detached.verify(
        messageDigest(c.message, Buffer.from(c.nonce, "base64"), c.recipient,config.origin+'/settings'),
        Buffer.from(b.signature, "base64"),
        key,
      );
      assert(valid, "AUTH_INVALID", "Wallet signature does not match.", 401);
      const response = await fetch(config.rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "auth",
          method: "query",
          params: {
            request_type: "view_access_key_list",
            finality: "final",
            account_id: b.accountId,
          },
        }),
        signal: AbortSignal.timeout(15000),
      });
      const rpc: any = await response.json();
      assert(
        rpc.result?.keys?.some(
          (k: any) =>
            k.public_key === b.publicKey &&
            k.access_key?.permission === "FullAccess",
        ),
        "WRONG_NETWORK",
        "A full-access signing key registered to this testnet account is required.",
        401,
      );
      await db.query("UPDATE auth_nonces SET consumed=true WHERE id=$1", [
        c.id,
      ]);
      const roles = [
        "client",
        "creator",
        "lender",
        ...(b.accountId === config.admin ? ["admin"] : []),
      ];
      await db.query(
        "INSERT INTO accounts(id,roles) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET roles=EXCLUDED.roles",
        [b.accountId, JSON.stringify(roles)],
      );
      return b.accountId;
    });
    return session(reply, id, "TESTNET");
  });
}
