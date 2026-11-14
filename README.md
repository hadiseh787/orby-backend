# Orby - repeatable agent mission demo

Angular 21 + Node.js/Fastify + PostgreSQL + a deployed NEAR V3 testnet contract. Real local Ollama inference proposes an editable agreement and a fixed-budget plan, selects an existing specialist, performs at most one recovery, and delivers work for version-bound client approval. Mainnet Intents is preview-only.

## Run locally

Install Git and Node.js 24 LTS with npm (Node 22.19+ also supported).

```powershell
git clone https://github.com/hadiseh787/orby-backend.git
cd orby-backend
npm.cmd run local
```

Open http://127.0.0.1:4200. One command obtains the exact frontend commit in `workspace.json`, installs lockfiles, starts embedded PostgreSQL on 5433, migrates, seeds the labeled sample workspace, builds Angular/backend, and starts API/worker/model. Windows also supports `start-local.cmd`. Stop using Ctrl+C or `npm.cmd run local:stop`. Keep `.data/postgres` to preserve data.

If both repositories are cloned beside each other as `backend` and `frontend`, run the same command from backend. No separate frontend command, global Angular CLI, Docker or PostgreSQL installation is required. Development-only split servers use Angular 4200 with `/api` proxy to backend 3000; the normal launcher serves both on 4200.

## Real Ollama without an API key

On Windows x64, stop the app and run:

```powershell
npm.cmd run demo:model:setup
npm.cmd run local
```

The installer downloads the official pinned Ollama v0.40.16 Windows archive and Qwen2.5-1.5B-Instruct Q4_K_M model, verifies SHA-256 checksums, imports `orby-qwen2.5:1.5b`, and requires an independent `/api/generate` response with nonempty text and `done:true`. Runtime/model downloads total about 2.74 GB; extracted files and the imported model require additional disk space. The executable stays in `.tools/ollama/ollama.exe`; it is not added to the system PATH. While the application runs:

```powershell
& .\.tools\ollama\ollama.exe list
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

Other platforms: install [official Ollama](https://docs.ollama.com/), choose an installed model and set `LLM_PROVIDER=OLLAMA`, `OLLAMA_URL` and `OLLAMA_MODEL` in backend `.env`. Docker must use an address reachable from inside its container instead of host loopback.

Settings > Installation readiness > Recheck connections verifies an actual small inference and displays public frontend/backend commit IDs, API origin, network, contract and model. Concurrent health checks share inference; routine status has a ten-second cache, while explicit Recheck bypasses cached success. No fixed response replaces failed real AI. Local API billing is zero; hardware, electricity and chain gas are unpriced.

## Testnet configuration

`.env` is loaded from the backend project directory even when the process starts elsewhere. Copy `.env.example` only for a new configuration; never overwrite an existing owner configuration. Independent clones contain no private keys and cannot inherit the project owner's executor permissions. Simulation and samples work without them. Real testnet execution requires a deployed initialized V3 contract, its limited executor configuration and an owned testnet client wallet with funds. Follow [the deployment/key guide](docs/TESTNET_SETUP.md). Use the actual functions in `contracts/orby-market/src/lib.rs` and `scripts/deploy.ts`; never substitute an undeployed account.

The verified owner installation uses public contract `af-contract-1793954330698.testnet`. This public ID gives no signing authority. Executor access is restricted to the contract methods; deployment/admin and executor keys are separate and excluded from Git. Public RPC defaults to `https://test.rpc.fastnear.com`.

## Exercise the product

1. Settings > Switch demo account > Demo / Sample workspace > Enter simulation. My jobs shows 15 labeled frozen samples. Workspace tools contains two knowledge collections, two templates and a paused program. Running `npm.cmd run demo:seed:samples` again preserves user jobs and creates no duplicates.
2. A configured real model enables 'Suggest editable agreement with real AI'. Enter a goal, inspect/edit the proposed brief and acceptance criteria. No publication or payment occurs at this step.
3. For a real testnet mission, connect the configured client wallet, create a REAL_AI job with a 4 testNEAR award and three supplied sources. Request proposals, select Brief Writer, generate a plan and enable the clearly labeled controlled first specialist failure. Approve the plan, review the 4.4 testNEAR maximum escrow and sign funding.
4. Follow live collaboration. The creator funds the 1 testNEAR specialist stage; its one recovery uses the same escrow. Inspect the real output, request a recommendation revision, review the new version, and approve only its exact hash/version.
5. Inspect settlement confirmation amounts before signing. Receipt > Build receipt preview > Verify receipt must show verified contract state and final transaction explorer links. A hash alone is not payment confirmation.
6. Balance > Mainnet top-up preview: select origin network/token, destination token, amount and owned mainnet recipient/refund addresses. Get real dry quote shows net estimated/minimum output and expiry. Unknown fees are explicitly unpriced. No deposit address, signing, transfer or balance credit exists; backend enforces `dry:true`.

Simulation uses simNEAR; testnet uses testNEAR; mainnet preview affects neither balance. Google Sheets controls remain disabled until OAuth is configured. No real mainnet lending, TEE, multisig or complex credit system is included.

## Evidence and tests

[Installed-machine verification and limitations](docs/INSTALLED_DEMO_VERIFICATION.md) records the actual http://127.0.0.1:4200 installation, successful and failed rehearsals, model responses, quotes, job IDs and transaction links. [Continuous full scenario recording](docs/installed-demo/) accompanies the actual mission evidence. Historical 1.4/1.4.1 proofs remain separately dated in `docs` and are not substituted for the current installation.

With the local database running:

```powershell
npm.cmd test
npm.cmd run test:integration
npm.cmd run test:browser:isolated
npm.cmd run contract:test
```

Node/integration/browser regression tests use controlled fixtures. Integration tests and the isolated browser runner create and remove only uniquely named disposable databases; they never reset the owner database. The browser runner uses port 4201 and labels simulated fixtures explicitly. The real-model/testnet acceptance recording and installed checks use the owner database on 4200. Running the raw frontend suite repeatedly against a long-lived owner database can hit legitimate account quotas and is not a database-reset command.

`node --import tsx tests/installed-demo-testnet.ts --run` is an explicit actual-testnet harness. It requires owner-local ignored fixture keys and signs real testnet transactions, including a 4.4 testNEAR escrow. Its development wallet adapter is disclosed; it does not claim a person clicked a HOT/Meteor signature. The video and receipt retain all acceptance attempts. No fixture keys ship with the source.

## License and release

Project source: [MIT](LICENSE). Ollama and the Qwen model retain their upstream licenses. Dependencies are locked in both repositories; Node versions are constrained in package.json. Secrets, `.env`, `.data`, model/runtime binaries and build outputs are excluded. Public source release is authorized by the project owner; contest submission and social posting are separate actions.

The current patch fixes installation identity, working-directory-independent configuration, actual Ollama installation/inference, health-check overload, quote error classification and automatic sample provisioning. The V3 contract code and hash are unchanged. Historical feature work and competition-period changes are documented in [the 1.4 guide](docs/DEMO_1_4.fa.md) and [1.4.1 guide](docs/RELIABILITY_1_4_1.fa.md).
