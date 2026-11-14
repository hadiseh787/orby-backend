# Orby 1.4.1 - repeatable real-model/testnet demo

[Full continuous real demo, 7:24](docs/demo-1.4.1/real-mission-45919c01-007b-4309-8872-b9e1d235e47d.webm) | [Actual mission and 17 confirmed transactions](docs/orby-real-mission-1.4.1.json)

[Complete Persian reproduction guide](docs/RELIABILITY_1_4_1.fa.md) | [Current verification](docs/VERIFICATION.md) | [Real model/planning proof](docs/orby-ai-planning-1.4.1.json) | [Actual dry quote](docs/orby-intents-safe-mode-1.4.1.json)

Install Git and Node.js 24 with npm (22.19 also supported), clone this backend and run:

```powershell
npm run local
```

The launcher fetches the exact frontend pinned in workspace.json, installs locked dependencies, starts PostgreSQL, applies ten migrations and runs API, worker, Angular and a configured model together. Both repositories remain private. No global Angular CLI or separate PostgreSQL installation is needed. Stop with Ctrl+C or npm run local:stop.

For Windows real AI: stop the app, run npm run demo:model:setup once, then npm run local. Settings > Installation readiness verifies actual RPC networks, deployed V3 contract and model availability. Source-only installs contain no owner keys and explicitly report unconfigured testnet/model prerequisites. Use .env.example and your own deployment for independent real-testnet execution.

While the database is running, `npm run demo:seed:samples` creates an isolated Demo / Sample workspace with 15 frozen, labeled jobs, two knowledge collections, two templates and a paused program. Repeating it creates no duplicates or user-data deletion. Select Demo / Sample workspace from Settings. Samples are excluded from real performance statistics and never claim real model execution or fake chain hashes. Run fresh jobs for actual acceptance.

The 1.4.1 changes correct quote transport/validation errors, separate real-model readiness from deterministic simulation, enforce actual recommendation revisions and preserve version/hash-bound approval. Two real goals selected different permitted specialists; an actual model outage returned a clear error with no substitute result or payment. Mainnet Intents remains mandatory-dry, with no signing or credit. Google export remains disabled when unconfigured.

## Historical 1.4 release

# Orby backend

Orby 1.4 turns a client brief into an approved, budget-capped agent mission. The main agent selects an existing specialist, funds its subcontract from the creator balance, performs at most one specialist recovery, delivers real local-model output, and settles on NEAR testnet only after the client approves the exact delivery version.

[Complete Persian demo guide and acceptance checklist](docs/DEMO_1_4.fa.md) | [actual model/testnet proof](docs/orby-real-mission-1.4.json) | [full recorded demo](docs/demo-1.4/real-mission-be469176-2c84-4f26-a7b3-59981756ee32.webm) | [safe Intents quote proof](docs/orby-intents-safe-mode.json)


Final verification: **95 automated tests passed** (22 Node, 34 PostgreSQL, 16 Rust, 23 browser). Both production builds and backup restore passed. The entire browser suite also passed against a [source-only installation](docs/orby-clean-start-1.4.json) with no prior frontend, dependencies, database or owner secrets.

## Run the complete application

Install Git and Node.js 24 with npm (22.19 also supported). From this backend folder:

```powershell
npm run local
```

The launcher obtains the pinned frontend and starts PostgreSQL, migrations, API, worker and Angular at http://127.0.0.1:4200. No global Angular CLI or separate PostgreSQL service is required. Windows: double-click start-local.cmd. Stop with Ctrl+C or npm run local:stop. Source-only simulation requires no application secrets; both private repositories need clone access.

For the tested real local model on Windows x64, stop the launcher, run npm run demo:model:setup once, then npm run local again. Setup downloads approximately 1.12 GB of model data, verifies pinned SHA-256 values and configures the CPU server. The same launcher starts it; no second terminal or paid API is needed. Other systems may configure Ollama using .env.example.

| Mode | Execution and funds |
|---|---|
| SIMULATION | simNEAR ledger; the composer defaults to deterministic execution. No real assets. |
| TESTNET + REAL_AI | Real local model, server-verified NEP-413 session, owner-signed escrow/approval and actual NEAR testnet settlement. Requires the deployment owner's private local executor configuration or an independent deployment. No keys are distributed. |
| MAINNET_PREVIEW_ONLY | Actual 1Click quote with backend-enforced dry:true. No signature, transfer, executable deposit address or balance credit. |

The passing recording uses a development wallet adapter that signs actual testnet transactions. It does not claim a human HOT/Meteor signature. A controlled first specialist rejection is explicitly enabled in the video. The client confirms a 4.4 testNEAR maximum escrow for a 4 testNEAR award; the 1 testNEAR specialist cost comes from the creator, with no second payment for its revision. The receipt distinguishes settled, committed, unknown and unpriced costs; remaining funds are not labelled profit.

Ten migrations and independent worker queues keep slow RPCs from blocking simulation. Real jobs cache model results by immutable execution key and never blindly repeat an uncertain result. The final confirmation shows settlement amounts before signing. Source, record and test commands are detailed in the demo guide.

Code: MIT LICENSE. The model is downloaded from Qwen/Qwen2.5-1.5B-Instruct-GGUF and the runtime from the official ggml-org/llama.cpp release; their upstream licenses apply. Neither binary nor private credentials are shipped in Git.

Work dated 14 November 2026 adds real-model setup, bounded model planning, durable inference/recovery, live collaboration, agreement assistance, economics, Safe Mode Intents and focused UI fixes on top of the 9 November 1.3 baseline. The V3 contract code/hash is unchanged in this release. Public release, X posting and contest submission remain owner-coordinated; repository visibility has not been changed.

## Prior releases and reference setup

Orby 1.3 implements all six review-v2 fixes and all six roadmap features: Work Receipt/evidence packs, execution rehearsals, scoped knowledge, versioned Quality Lab, team workspaces and one-round counteroffers. The indexed V3 contract preserves existing claims and sponsors storage independently. Read [the implementation and verification report](docs/REVIEW_V2_RELEASE.fa.md), [dependency review](docs/DEPENDENCY_REVIEW.md) and [submission status](docs/SUBMISSION.md).

Orby 1.2 implements the full revised change request: autosaved job creation, immutable delivery decisions, templates and action inbox, private knowledge, weekly programs, paid trials, independent milestones and Google Sheets OAuth/import/confirmed export. Read the [complete Persian implementation report](docs/WORKSPACE_RELEASE_2026-11-07.fa.md) and [Google setup guide](docs/GOOGLE_SHEETS_SETUP.md). Local startup is still one command; Google credentials are optional. Testnet program runs require individual wallet signatures and monthly limits are workspace escrow reservations.

Latest fixes (7 November 2026): [document checklist, tests and boundaries](docs/CHANGES_2026-11-07.fa.md), [security policy](SECURITY.md). The launcher and startup command remain unchanged. Local seeds now include OPEN and SETTLED simulation examples.

Node.js / TypeScript / Fastify, PostgreSQL, transactional outbox worker, deterministic local agents with optional Ollama, and a Rust NEAR testnet contract.

[راهنمای سریع فارسی](QUICKSTART.fa.md)

Orby 1.1 adds the supplied violet brand, native NEAR agreements, a live informational USD quote, day-based deadlines, private attachments with on-chain hash commitments, opt-in IPFS publishing, owner-signed proposals and recoverable wallet transaction states. Read [the release verification](docs/ORBY_RELEASE.fa.md) for findings, evidence and remaining deployment requirements.

The original two-folder workspace's root files are included in `workspace-template/`; the original handoff is in `docs/handoff/`. See [workspace layout](docs/WORKSPACE_LAYOUT.md). Each application has its own Git repository; the enclosing workspace is a normal folder.

## Easiest complete local startup

Install **Git** and **Node.js 24 with npm** (Node 22.19+ also works). No global Angular CLI, PostgreSQL service, Docker, Rust, Ollama, paid account or application key is needed for the local simulation. The first setup needs internet access to download npm packages and PostgreSQL binaries.

Both repositories are private. The person cloning them needs access to both; authenticate Git through GitHub's supported sign-in flow first. No login credentials are distributed with the source.

```powershell
git clone https://github.com/hadiseh787/orby-backend.git
cd orby-backend
npm run local
```

On Windows, double-click `start-local.cmd` instead of the last command. Keep its single terminal open. The launcher gets the matching frontend revision, installs both lockfiles, creates a local `.env` with a fresh database password, builds both projects, starts PostgreSQL, applies migrations and seeds, then starts the API and worker. It opens **http://127.0.0.1:4200**, where the backend also serves the built Angular application.

Stop everything with **Ctrl+C**, `npm run local:stop`, or `stop-local.cmd`. Data persists in `.data/postgres`. Re-running startup preserves existing data. If setup was interrupted, run the same startup command again.

If both repositories were downloaded as ZIPs, extract them beside each other. The launcher recognizes `frontend`, `orby-frontend`, and GitHub ZIP folder names such as `orby-frontend-main`; Git is unnecessary when both source folders are already present. An explicit frontend path also works:

```powershell
node scripts/local.mjs --frontend ../path-to-frontend --no-browser
```

For occupied ports, use `node scripts/local.mjs --port 4300 --db-port 5434`. For an existing PostgreSQL server, set `DATABASE_URL` in `.env`; the launcher uses it without starting another server. On Linux/macOS run as a normal non-root user. Cross-platform startup paths are included; the clean-checkout verification was performed on Windows x64.

At the login gate choose **Enter demo** or **Open local demo** and **Alex · Client**. Create a comparison job, choose **Brief Writer** for the delegated workflow, fund its simulation escrow, review delivery and settle. Switch to `writer.demo` to inspect creator income or `operator.demo` to inspect administration. Simulation uses `simNEAR` and does not require a wallet. Workspace tools contains programs, personal templates, knowledge and Google Sheets.

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

The restore verifies the content hash, dependency order, row counts and serial sequences. `verify-backup.ts` proves restoration into an isolated database. Protect backup files like other private application data. Encrypted Google tokens additionally require the original `INTEGRATION_ENCRYPTION_KEY` or `.data/google-token.key`; preserve it separately. A database snapshot alone cannot restore that connection without its key.

## Agent execution

The built-in worker performs deterministic source organization and acceptance checks. A writer job funds a separate source-extractor child from the writer's free balance, incorporates the child's evidence, then delivers the final brief. Child funding never draws from the root client's escrow.

Set `OLLAMA_MODEL` to a locally installed model and `OLLAMA_URL` to your loopback Ollama service for LLM output. A configured model failure is reported as unavailable; it is not silently relabeled as a successful LLM run. AI cannot execute shell commands, arbitrary code, web requests or money transfers.

Three separately runnable HTTP agent adapters are available:

```powershell
node --import tsx src/agent-server.ts
```

Ports 4101–4103 expose `/health`, `/bid`, `/runs`, `/runs/:id`, `/runs/:id/cancel`. Requests except health require HMAC headers over method, path, timestamp, nonce and the canonical body hash. Per-agent secrets stay in ignored `.data/runtimes`. The default worker uses the embedded adapter; both use the same execution functions. Arbitrary external endpoints are not accepted in this version.

## NEAR testnet

New jobs and agent prices use native NEAR amounts. Existing reference-based agreements retain their original contract logic. USD quotes come from public market-data providers and never change a native agreement's payment amount. Testnet tokens do not acquire monetary value from this comparison.

For an existing V1 deployment, deploy the current optimized WASM with `node --import tsx scripts/deploy.ts --migrate-v1`. Migration requires the contract account's full-access development key and preserves existing jobs and balances. The generated executor key remains restricted; no private key is shipped in Git.

An opt-in browser test runs the full UI against the actual testnet contract with a development wallet adapter and ignored local development keys:

```powershell
npm run test:browser:testnet
```

The test sends real faucet-funded testnet transactions. It is not part of the normal unit suite and never selects mainnet. Its wallet adapter exists only in the test runner.

## Attachments and IPFS

The default stores files privately in PostgreSQL and commits their SHA-256 metadata through the job's signed terms hash. Up to five PDF, TXT, MD, JSON, PNG or JPEG files are allowed per job, with a 2 MiB limit per file. Downloads enforce job ownership and selected-creator access. Backups include file content and validate its hash during restoration.

To enable opt-in public IPFS publishing, run a trusted Kubo node and set `IPFS_API_URL` to its private RPC endpoint. The upload form then exposes an explicit public-publishing checkbox. Public files cannot be made private by removing a link. Keep the Kubo API off the public internet and maintain its pins; the application also retains the authenticated database copy. This service is optional for private attachments and is not installed by the one-command launcher.

With a running node, verify actual add, pin and CID retrieval using:

```powershell
$env:IPFS_API_URL='http://127.0.0.1:5001'
npm run test:ipfs
```

## Contract build and deployment

The contract source is `contracts/orby-market`. Monetary arithmetic is shared with a small native Rust crate under `financial`; `cargo test` from the market directory runs that crate without a native NEAR sandbox. Real contract integration must be validated against testnet or a supported Linux sandbox.

With Rust and the WASM target installed:

```powershell
rustup target add wasm32-unknown-unknown
cargo build --manifest-path contracts/orby-market/Cargo.toml -p orby-market --target wasm32-unknown-unknown --release
cargo build --manifest-path contracts/uploader/Cargo.toml --target wasm32-unknown-unknown --release
node scripts/optimize-contract.mjs
node scripts/optimize-contract.mjs contracts/uploader/target/wasm32-unknown-unknown/release/orby_contract_uploader.wasm .data/near/uploader.wasm
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
- New agreements use fixed NEAR amounts; live USD quotes are informational. Legacy agreements retain their original reference rules. External runtime registration, production lending, TEE and mainnet are later phases.
- Base credit functionality is a financing preview and a separate simulated pool lifecycle. It does not issue real loans or claim a connection to a lending protocol.
- The administrator is a trusted arbitrator; the evaluator attests off-chain checks; the deployment owner can upgrade code. This is an unaudited testnet implementation.
