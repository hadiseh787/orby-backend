# Agent Freelancer backend

Node.js / TypeScript / Fastify, PostgreSQL, transactional outbox worker, deterministic local agents with optional Ollama, and a Rust NEAR testnet contract.

[راهنمای سریع فارسی](QUICKSTART.fa.md)

The original two-folder workspace's root files are included in `workspace-template/`; the original handoff is in `docs/handoff/`. See [workspace layout](docs/WORKSPACE_LAYOUT.md). Each application has its own Git repository; the enclosing workspace is a normal folder.

## Easiest complete local startup

Install **Git** and **Node.js 24 with npm** (Node 22.19+ also works). No global Angular CLI, PostgreSQL service, Docker, Rust, Ollama, paid account or application key is needed for the local simulation. The first setup needs internet access to download npm packages and PostgreSQL binaries.

Both repositories are private. The person cloning them needs access to both; authenticate Git through GitHub's supported sign-in flow first. No login credentials are distributed with the source.

```powershell
git clone https://github.com/hadiseh787/agent-freelancer-backend.git
cd agent-freelancer-backend
npm run local
```

On Windows, double-click `start-local.cmd` instead of the last command. Keep its single terminal open. The launcher gets the matching frontend revision, installs both lockfiles, creates a local `.env` with a fresh database password, builds both projects, starts PostgreSQL, applies migrations and seeds, then starts the API and worker. It opens **http://127.0.0.1:4200**, where the backend also serves the built Angular application.

Stop everything with **Ctrl+C**, `npm run local:stop`, or `stop-local.cmd`. Data persists in `.data/postgres`. Re-running startup preserves existing data. If setup was interrupted, run the same startup command again.

If both repositories were downloaded as ZIPs, extract them beside each other. The launcher recognizes `frontend`, `agent-freelancer-frontend`, and GitHub ZIP folder names such as `agent-freelancer-frontend-main`; Git is unnecessary when both source folders are already present. An explicit frontend path also works:

```powershell
node scripts/local.mjs --frontend ../path-to-frontend --no-browser
```

For occupied ports, use `node scripts/local.mjs --port 4300 --db-port 5434`. For an existing PostgreSQL server, set `DATABASE_URL` in `.env`; the launcher uses it without starting another server. On Linux/macOS run as a normal non-root user. Cross-platform startup paths are included; the clean-checkout verification was performed on Windows x64.

At the login gate choose **Open local demo** and **Alex · Client**. Create a comparison job, choose **Brief Writer** for the delegated workflow, fund its simulation escrow, review delivery and settle. Switch to `writer.demo` to inspect creator income or `operator.demo` to inspect administration. Simulation uses `simNEAR` and does not require a wallet.

The local simulation is fully runnable without other services. Real NEAR testnet activity additionally requires project-specific testnet credentials and contract configuration; optional LLM generation requires Ollama and a downloaded model. These are separate from initial local startup. See `docs/VERIFICATION.md` for the implemented scope and tested boundaries.

## Manual service development

Node 22.19+ and npm are required. Development PostgreSQL binaries are installed by the `embedded-postgres` dev dependency; no Windows service, Docker or administrator account is required.

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run db:start
```

Keep the database running. In another terminal:

```powershell
npm.cmd run db:migrate
npm.cmd run demo:seed
npm.cmd run dev
```

In another terminal:

```powershell
npm.cmd run worker
```

The API listens on `127.0.0.1:3000`. Database data is persisted in `.data/postgres`. The local database password in `.env.example` is only for this loopback development cluster. Use your own `DATABASE_URL` for an existing PostgreSQL deployment. `compose.yaml` provides another PostgreSQL option with a required password variable.

Demo login is disabled automatically for `NODE_ENV=production` and cannot bind to a public host. `alex.demo` is the client; `writer.demo`, `researcher.demo`, `reviewer.demo` own the sample agents; `operator.demo` is the simulation administrator. Simulation opening balances never create testnet claims.

## Validation

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run test:integration
npm.cmd run backup
node --import tsx scripts/verify-backup.ts
```

Integration tests create a fresh temporary PostgreSQL database, run migrations and seed, and remove only that test database afterward. They exercise delegated work, concurrent funding, stale previews, authorization, dispute settlement, idempotency, paused obligations and pool redemption. Unit tests include 10,000 exact-integer conservation cases.

Backup uses a consistent `REPEATABLE READ` snapshot. Text/JSON artifacts are in PostgreSQL and are included. Restore only into a new migrated database:

```powershell
$env:DATABASE_URL='postgresql://user:password@127.0.0.1:5432/new_database'
npm.cmd run db:migrate
node --import tsx scripts/restore.ts .data/backups/BACKUP.json
```

The restore verifies the content hash, dependency order, row counts and serial sequences. `verify-backup.ts` proves restoration into an isolated database. Protect backup files like other private application data.

## Agent execution

The built-in worker performs deterministic source organization and acceptance checks. A writer job funds a separate source-extractor child from the writer's free balance, incorporates the child's evidence, then delivers the final brief. Child funding never draws from the root client's escrow.

Set `OLLAMA_MODEL` to a locally installed model and `OLLAMA_URL` to your loopback Ollama service for LLM output. A configured model failure is reported as unavailable; it is not silently relabeled as a successful LLM run. AI cannot execute shell commands, arbitrary code, web requests or money transfers.

Three separately runnable HTTP agent adapters are available:

```powershell
node --import tsx src/agent-server.ts
```

Ports 4101–4103 expose `/health`, `/bid`, `/runs`, `/runs/:id`, `/runs/:id/cancel`. Requests except health require HMAC headers over method, path, timestamp, nonce and the canonical body hash. Per-agent secrets stay in ignored `.data/runtimes`. The default worker uses the embedded adapter; both use the same execution functions. Arbitrary external endpoints are not accepted in this version.

## NEAR testnet

The contract source is `contracts/agent-market`. Monetary arithmetic is shared with a small native Rust crate under `financial`; `cargo test` from the market directory runs that crate without a native NEAR sandbox. Real contract integration must be validated against testnet or a supported Linux sandbox.

With Rust and the WASM target installed:

```powershell
rustup target add wasm32-unknown-unknown
cargo build --manifest-path contracts/agent-market/Cargo.toml -p agent-market --target wasm32-unknown-unknown --release
cargo build --manifest-path contracts/uploader/Cargo.toml --target wasm32-unknown-unknown --release
node scripts/optimize-contract.mjs
node scripts/optimize-contract.mjs contracts/uploader/target/wasm32-unknown-unknown/release/agent_contract_uploader.wasm .data/near/uploader.wasm
npm.cmd run near:deploy
```

The deployment script uses project-specific development testnet accounts and faucet tokens. Generated keys remain in `.data/near/accounts.json`; never commit or upload that directory. The owner-only uploader stages small chunks to tolerate connections that reset large uploads, validates SHA-256, deploys the main WASM and verifies its final code hash. The staging methods disappear after deployment. Each bootstrap method has a stable request ID so interrupted setup can resume.

Successful deployment writes `.env` and a public `.data/near/deployment.json`. Restart API and worker after configuration changes. Wallet authentication verifies a full-access account key against the configured **testnet** RPC. Financial proposals must be signed by the account owner; executors only perform contract-authorized methods.

Restrict the service signer after bootstrap with `node --import tsx scripts/restrict-executor.ts`. It creates a function-call key limited to six market methods and a 0.5 testNEAR gas allowance; it cannot attach deposits or withdraw. Verify it with `node --import tsx scripts/verify-executor.ts`. The local development setup has completed both checks. Keep the full bootstrap key offline; the worker uses the limited key from `.env`.

`npm.cmd run near:smoke` performs the real testnet flow using the generated development accounts and saves public transaction hashes to `.data/near/smoke.json`. It consumes faucet testNEAR and waits for the child review window. It never switches to mainnet.

Never infer a successful deployment from account creation. Deployment, receipt and application integration results are recorded separately in the project verification document.

## Boundaries

- `SIMULATION` and `TESTNET` have separate records. Cross-book job/agent references are constrained in PostgreSQL.
- Amounts are unsigned decimal strings; calculations use BigInt / checked U256 arithmetic. Internal simulation transfers have equal debit and credit entries.
- The NEAR contract is authoritative for testnet funds. PostgreSQL holds metadata, artifacts and projections.
- Session cookies are HttpOnly and SameSite; mutations require CSRF and a stable idempotency key. Ownership is checked by the API and contract.
- Reference prices are explicit fixtures in the base version. Live price adapters, external runtime registration, production lending, TEE and mainnet are later phases.
- Base credit functionality is a financing preview and a separate simulated pool lifecycle. It does not issue real loans or claim a connection to a lending protocol.
- The administrator is a trusted arbitrator; the evaluator attests off-chain checks; the deployment owner can upgrade code. This is an unaudited testnet implementation.
