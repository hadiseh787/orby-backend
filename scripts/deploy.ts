import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { connect, keyStores, KeyPair, utils, transactions } from "near-api-js";
import { pool } from "../src/db.js";
import { hash } from "../src/domain.js";
import { createHash } from "node:crypto";
import bs58 from "bs58";
import { enableLargeUploadTransport } from "./rpc-transport.js";
enableLargeUploadTransport();
const dir = resolve(".data/near");
await mkdir(dir, { recursive: true });
const file = resolve(dir, "accounts.json");
const upgradeOnly=process.argv.includes('--upgrade-only');
if(upgradeOnly && !existsSync(file))throw Error('Upgrade-only requires existing development contract credentials.');
type Credential = { accountId: string; privateKey: string; publicKey: string };
const credentials: Record<string, Credential> = existsSync(file)
  ? JSON.parse(await readFile(file, "utf8"))
  : {};
const store = new keyStores.InMemoryKeyStore();
const rpcUrl = process.env.NEAR_RPC_URL || "https://test.rpc.fastnear.com";
const near = await connect({
  networkId: "testnet",
  nodeUrl: rpcUrl,
  keyStore: store,
});
for (const role of (upgradeOnly?['contract']:[
  "contract",
  "admin",
  "executor",
  "updater",
  "client",
  "writer",
  "researcher",
  "reviewer",
])) {
  if (!credentials[role]) {
    if(upgradeOnly)throw Error('Upgrade-only cannot create a missing contract account.');
    const key = KeyPair.fromRandom("ed25519");
    credentials[role] = {
      accountId: `af-${role}-${Date.now()}.testnet`,
      privateKey: key.toString(),
      publicKey: key.getPublicKey().toString(),
    };
    await writeFile(file, JSON.stringify(credentials, null, 2));
  }
  const c = credentials[role];
  await store.setKey(
    "testnet",
    c.accountId,
    KeyPair.fromString(c.privateKey as any),
  );
  try {
    await (await near.account(c.accountId)).state();
  } catch (error) {
    if(upgradeOnly)throw error;
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch("https://helper.testnet.near.org/account", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            newAccountId: c.accountId,
            newAccountPublicKey: c.publicKey,
          }),
          signal: AbortSignal.timeout(45000),
        });
        break;
      } catch (e) {
        if (attempt === 2) throw e;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    if (!response) throw Error("Testnet faucet unavailable.");
    if (!response.ok)
      throw Error(
        `Testnet faucet failed for ${role}: HTTP ${response.status}. No mainnet or paid service was used.`,
      );
    const body: any = await response.json();
    if (body.error)
      throw Error("Testnet faucet: " + JSON.stringify(body.error));
    await (await near.account(c.accountId)).state();
  }
  console.log("Testnet account ready:", role, c.accountId);
}
const wasm = await readFile(
  resolve(
    existsSync(".data/near/orby_market.wasm")
      ? ".data/near/orby_market.wasm"
      : "contracts/orby-market/target/wasm32-unknown-unknown/release/orby_market.wasm",
  ),
);
const contract = await near.account(credentials.contract.accountId);
const expectedCodeHash = bs58.encode(
  createHash("sha256").update(wasm).digest(),
);
if ((await contract.state()).code_hash !== expectedCodeHash) {
  const uploader = await readFile(
    existsSync(".data/near/uploader.wasm")
      ? ".data/near/uploader.wasm"
      : "contracts/uploader/target/wasm32-unknown-unknown/release/orby_contract_uploader.wasm",
  );
  const uploaderHash = bs58.encode(
    createHash("sha256").update(uploader).digest(),
  );
  if(upgradeOnly && (await contract.state()).code_hash!==uploaderHash && !(await contract.viewFunction({contractId:contract.accountId,methodName:'get_version',args:{}}).catch(()=>null)))throw Error('Upgrade-only requires an initialized contract.');
  const progressFile = resolve(dir, "upload-progress.json");
  let progress = existsSync(progressFile)
    ? JSON.parse(await readFile(progressFile, "utf8"))
    : { codeHash: "", nextChunk: 0 };
  if ((await contract.state()).code_hash !== uploaderHash) {
    await contract.deployContract(uploader);
    progress = { codeHash: expectedCodeHash, nextChunk: 0 };
    console.log("Owner-only staged uploader deployed.");
  }
  if (progress.codeHash !== expectedCodeHash)
    progress = { codeHash: expectedCodeHash, nextChunk: 0 };
  const size = 12288,
    count = Math.ceil(wasm.length / size);
  for (let offset = progress.nextChunk; offset < count; offset+=4) {
    const end=Math.min(offset+4,count);
    await contract.signAndSendTransaction({receiverId:contract.accountId,actions:Array.from({length:end-offset},(_,n)=>{
      const index=offset+n;
      return transactions.functionCall("stage",{index,data:wasm.subarray(index*size,(index+1)*size).toString("base64")},20000000000000n,0n);
    })});
    console.log(`Uploaded contract chunks ${offset+1}–${end}/${count}`);
    await writeFile(
      progressFile,
      JSON.stringify({ codeHash: expectedCodeHash, nextChunk: end }),
    );
  }
  await contract.functionCall({
    contractId: contract.accountId,
    methodName: "commit",
    args: { count, sha256: createHash("sha256").update(wasm).digest("hex") },
    gas: 200000000000000n,
  });
  if ((await contract.state()).code_hash !== expectedCodeHash)
    throw Error("Deployed contract hash does not match the verified WASM.");
  console.log("Main contract deployed and code hash verified.");
}
if(process.argv.includes('--migrate-v2')){
  let current=0;try{current=await contract.viewFunction({contractId:contract.accountId,methodName:'get_version',args:{}})}catch{}
  if(current!==3){await contract.functionCall({contractId:contract.accountId,methodName:'migrate_v2',args:{},gas:280000000000000n});console.log('V2 state migrated to indexed V3 storage.');}
}
if(upgradeOnly){
  const record={network:'testnet',contractId:contract.accountId,wasmBytes:wasm.length,version:await contract.viewFunction({contractId:contract.accountId,methodName:'get_version',args:{}}),codeHash:expectedCodeHash,wasmSha256:createHash('sha256').update(wasm).digest('hex'),source:'contracts/orby-market',verifiedAt:new Date().toISOString(),upgradeOnly:true};
  await writeFile('docs/orby-deployment.json',JSON.stringify(record,null,2)+'\n');
  console.log('Existing contract upgraded; account initialization and seed transactions skipped.');
  await pool.end();process.exit(0);
}
async function callOnce(
  role: string,
  method: string,
  args: any,
  deposit = "0",
) {
  const request_id = `bootstrap:${role}:${method}:v1`;
  const prior = await contract.viewFunction({
    contractId: contract.accountId,
    methodName: "get_operation",
    args: { account_id: credentials[role].accountId, request_id },
  });
  if (prior) return;
  await (
    await near.account(credentials[role].accountId)
  ).functionCall({
    contractId: contract.accountId,
    methodName: method,
    args: { ...args, request_id },
    attachedDeposit: BigInt(deposit),
    gas: 100000000000000n,
  });
}
let initialized = false;
if(process.argv.includes('--migrate-v1')) {
  let currentVersion=1;
  try{currentVersion=await contract.viewFunction({contractId:contract.accountId,methodName:'get_version',args:{}})}catch{}
  if(currentVersion!==3){
    await contract.functionCall({contractId:contract.accountId,methodName:'migrate_v1',args:{},gas:150000000000000n});
    console.log('V1 state migrated; existing balances and jobs preserved.');
  }
}
try {
  await contract.viewFunction({
    contractId: contract.accountId,
    methodName: "get_config",
    args: {},
  });
  initialized = true;
} catch {}
if (!initialized)
  await contract.functionCall({
    contractId: contract.accountId,
    methodName: "new",
    args: {
      admin: credentials.admin.accountId,
      evaluator: credentials.executor.accountId,
      updater: credentials.updater.accountId,
      accelerated: true,
    },
    gas: 100000000000000n,
  });
for (const role of ["writer", "researcher", "reviewer"]) {
  const account = await near.account(credentials[role].accountId);
  const id =
    role === "writer"
      ? "brief-writer"
      : role === "researcher"
        ? "source-extractor"
        : "format-reviewer";
  const existing = await contract.viewFunction({
    contractId: contract.accountId,
    methodName: "get_agent",
    args: { agent_id: id },
  });
  const manifest = {
    id,
    name:
      role === "writer"
        ? "Brief Writer"
        : role === "researcher"
          ? "Source Extractor"
          : "Format Reviewer",
    category:
      role === "writer"
        ? "writing"
        : role === "researcher"
          ? "research"
          : "review",
    description:
      role === "writer"
        ? "Turns supplied source material into a concise comparison brief."
        : role === "researcher"
          ? "Extracts evidence and citations from supplied text."
          : "Checks structure, fields and source citations.",
    skills:
      role === "writer"
        ? ["Writing", "Delegation"]
        : role === "researcher"
          ? ["Research", "Citations"]
          : ["Review", "JSON checks"],
    minPriceUsdMicro:
      role === "writer"
        ? "20000000"
        : role === "researcher"
          ? "5000000"
          : "2000000",
    minPriceNear:role==='writer'?'4000000000000000000000000':role==='researcher'?'1000000000000000000000000':'400000000000000000000000',
    initials: role === "writer" ? "BW" : role === "researcher" ? "SE" : "FR",
    health: "DETERMINISTIC",
    completed: 0,
    etaMinutes: 2,
    seeded: false,
    manifestVersion: 1,
  };
  if (!existing)
    await callOnce(role, "register_agent", {
      agent_id: id,
      manifest_hash: hash(manifest),
      min_price: manifest.minPriceUsdMicro,
    });
  const nearPrice=await contract.viewFunction({contractId:contract.accountId,methodName:'get_near_price',args:{agent_id:id}});
  if(!nearPrice)await callOnce(role,'set_agent_near_price',{agent_id:id,min_price:manifest.minPriceNear});
  await callOnce(role, "set_execution_policy", {
    agent_id: id,
    executor: credentials.executor.accountId,
    max_spend: utils.format.parseNearAmount("3.2"),
    max_bond: utils.format.parseNearAmount("10"),
    allowed: ["source-extractor", "format-reviewer"],
    expires_at: String(Date.now() + 86400000 * 30),
    paused: false,
  });
  await callOnce(role, "deposit_bond", {}, utils.format.parseNearAmount("2")!);
  await callOnce(role, "deposit_funds", {}, utils.format.parseNearAmount("2")!);
  await pool.query(
    "INSERT INTO accounts(id) VALUES($1) ON CONFLICT DO NOTHING",
    [account.accountId],
  );
  await pool.query(
    "INSERT INTO agents(id,book,owner_id,name,category,data,version) VALUES($1,'TESTNET',$2,$3,$4,$5,$6) ON CONFLICT(id,book) DO UPDATE SET data=EXCLUDED.data,version=EXCLUDED.version",
    [id, account.accountId, manifest.name, manifest.category, manifest,(await contract.viewFunction({contractId:contract.accountId,methodName:'get_agent',args:{agent_id:id}})).version],
  );
  await pool.query(
    "INSERT INTO agent_versions(agent_id,book,version,manifest,hash) VALUES($1,'TESTNET',1,$2,$3) ON CONFLICT DO NOTHING",
    [id, manifest, hash(manifest)],
  );
  await pool.query(
    "INSERT INTO execution_policies(agent_id,book,owner_id,data) VALUES($1,'TESTNET',$2,$3) ON CONFLICT(agent_id,book) DO UPDATE SET data=EXCLUDED.data",
    [
      id,
      account.accountId,
      {
        maxSpendYocto: utils.format.parseNearAmount("3.2"),
        maxBondYocto: utils.format.parseNearAmount("10"),
        allowedAgentIds: ["source-extractor", "format-reviewer"],
        paused: false,
        expiresAt: Date.now() + 86400000 * 30,
      },
    ],
  );
}
const envPath = resolve(".env");
let env = existsSync(envPath)
  ? await readFile(envPath, "utf8")
  : await readFile(".env.example", "utf8");
const values = {
  NEAR_RPC_URL: rpcUrl,
  NEAR_CONTRACT_ID: credentials.contract.accountId,
  NEAR_SERVICE_ACCOUNT: credentials.executor.accountId,
  NEAR_SERVICE_PRIVATE_KEY: existsSync(resolve(dir,'executor-limited.json'))?JSON.parse(await readFile(resolve(dir,'executor-limited.json'),'utf8')).privateKey:credentials.executor.privateKey,
  NEAR_ADMIN_ACCOUNT: credentials.admin.accountId,
};
for (const [k, v] of Object.entries(values))
  env = env.replace(new RegExp("^" + k + "=.*$", "m"), k + "=" + v);
await writeFile(envPath, env);
await writeFile(
  resolve(dir, "deployment.json"),
  JSON.stringify(
    {
      network: "testnet",
      contractId: contract.accountId,
      accounts: Object.fromEntries(
        Object.entries(credentials).map(([k, v]) => [k, v.accountId]),
      ),
      deployedAt: new Date().toISOString(),
      wasmBytes: wasm.length,
    },
    null,
    2,
  ),
);
console.log("Contract deployed:", contract.accountId);
console.log(
  "Private development credentials saved in ignored .data/near. Configuration saved in ignored .env.",
);
await pool.end();
