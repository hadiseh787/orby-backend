# Orby 1.4.1

Current guide: [Complete real demo and setup](backend/docs/RELIABILITY_1_4_1.md). Run `npm run local` from backend. While the local database is running, `npm run demo:seed:samples` adds the isolated 15-job Demo / Sample workspace.

## Historical entry notes

# Orby 1.4

Run `npm run local` from `backend`. The launcher starts PostgreSQL, API, worker, Angular and a configured local model together. [Real demo guide](backend/docs/DEMO_1_4.md), [verification](backend/docs/VERIFICATION.md), [full continuous video](backend/docs/demo-1.4/). Source-only simulation requires Git and Node.js 24 (22.19 supported). For real local inference, stop the app, run `npm run demo:model:setup` in backend, then restart. Testnet requires deployment-owner configuration; no private keys are distributed.

# Orby

A local implementation based on the handoff package: an **Angular** frontend, a **Node.js** backend and a **PostgreSQL** database. The interface is English and responsive, with light, dark and automatic themes.

The two application folders are independent, each with its own `package.json`, lockfile and README:

```text
frontend/                 Angular application
backend/                  API, worker, agents, migrations, tests
  contracts/orby-market/ Rust NEAR testnet contract
  contracts/uploader/     Owner-only staged deployer
handoff/                  Original developer handoff
start.ps1                 Local startup
stop.ps1                  Stop only recorded project processes
```

## Running on Windows

Prerequisite: Git and Node.js 24 with npm. To fetch and run the project from GitHub:

```powershell
git clone https://github.com/hadiseh787/orby-backend.git
cd orby-backend
npm run local
```

The repositories are private and the runner must have access to both. The launcher fetches the matching frontend revision automatically; installing dependencies, building the applications and creating the database are automatic too. In the cloned version the file `start-local.cmd` does the same job. Full quickstart guide: [QUICKSTART.md](backend/QUICKSTART.md).

Double-click `start.cmd`; the database, backend, worker and frontend start together and the browser opens. To stop, run `stop.cmd`. The equivalent command from this folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Address: `http://127.0.0.1:4200`. This script starts local PostgreSQL, migrations, demo data, the API, the worker and the frontend. Service output appears in the same terminal and the data stays in `backend/.data`. The script does not take over an occupied port.

```powershell
powershell -ExecutionPolicy Bypass -File .\stop.ps1
```

From Settings, choose `Switch demo account`. The `alex.demo` account is the client; `writer.demo` is the Brief Writer creator and `operator.demo` is the admin. The local demo runs with **simNEAR**. The demo balance is not a network token.

## Scope

The agent marketplace, job creation with acceptance criteria, price proposals, the expiring financial preview, bond and escrow, sub-agent execution, delivery with deterministic checks, correction, dispute and admin ruling, settlement, the financial ledger, withdrawal, evidence, reports and appearance settings are implemented in the application.

New jobs are agreed at a fixed NEAR amount; the live USD rate is display-only. Older agreements keep their own reference logic. The language model via Ollama is optional; without it, output is produced with the `Deterministic demo` label. In the base version, credit, the funding preview and the pool cycle are **simulated**. Real P1 lending, external endpoints, TEE, mainnet and Intents are not part of this base delivery.

A testnet connection only counts as real when the contract is deployed, the contract id is configured, the worker is running and the network receipt is confirmed. The exact status of tests and deployment is recorded in `VERIFICATION.md`.

Detailed guides: [frontend](frontend/README.md), [backend and contract](backend/README.md). The `.env` files, `.data`, keys and the local database were removed from Git; move the application folders without these private data.

Orby 1.1 change and test report: [ORBY_RELEASE.md](backend/docs/ORBY_RELEASE.md).
