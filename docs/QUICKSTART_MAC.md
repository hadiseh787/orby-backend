# Run Orby on macOS

This guide applies to the current native Mac launcher. Install Git and Node.js **24 LTS with npm**, or **22.19+ within major 22**. The prepared demo does not need separately installed Angular CLI, PostgreSQL, Docker, Rust or PowerShell. Native Apple Silicon acceptance and its exact tested revisions are linked in [the release report](PORTABLE_RELEASE.md).

## Existing installation

Keep the project directory, `.env`, `.data/postgres` and private `.data/near` files. Stop the existing process. From **your existing backend directory** run:

```sh
npm run local:stop
git pull --ff-only
npm ci
npm run setup:model
npm run setup:testnet
npm run local
```

If Git rejects the update because of local changes, preserve and reconcile them first. A database deletion or `git reset --hard` is not an installation step. Do not copy another machine's credentials or replace the existing `.env` with an example.

## Fresh installation

```sh
git clone https://github.com/hadiseh787/orby-backend.git
cd orby-backend
npm ci
npm run setup:model
npm run setup:testnet
npm run local
```

The app opens at **http://127.0.0.1:4200**. The launcher starts PostgreSQL, backend, worker, pinned frontend and configured model together. For later launches run only `npm run local`. Stop with Ctrl+C or `npm run local:stop`; settings and data remain.

`setup:model` detects an existing Ollama installation and actual executable path, or installs the verified official project runtime. Initial setup requires network access and disk space. A first CPU readiness check can take several minutes because it runs real schema, citation and revision probes. Official manual download: https://ollama.com/download/mac.

`setup:testnet` generates independent local accounts, keys, deployment and bounded runtime authorization. A public contract ID from someone else's demo does not provide signing authority. Testnet tokens have no real monetary value.

## Check the result

1. Settings: contract `CONNECTED`, mission `READY`, real model `READY`. A connected RPC alone is not mission authorization.
2. Choose a home-page starter. Its specialist and three sample sources should populate the editable form. The eight catalog profiles support bounded supplied-source workflows.
3. Connect a testnet wallet you control with enough testNEAR. Review the agreement, approved plan and escrow ceiling; sign each required operation.
4. Review the delivered version and settlement breakdown. Verify the receipt against final contract state and transaction links.

Frozen history samples are not fresh executions. Simulation balances are simNEAR and cannot be converted to testNEAR. To try the UI without model/testnet provisioning, omit those setup steps and use the labelled simulation mode.

## Resolve setup errors

| Observation | Action |
| --- | --- |
| Faucet/RPC failure | Read the failed step, retain checkpoints and retry the same setup after recovery. Confirmed transactions and local identities are preserved. |
| Model not ready | Inspect setup output and the Settings reason. Allow the bounded CPU check to finish. Do not silently substitute a deterministic output for real AI. |
| Existing database password mismatch | Match credentials to that data directory. Do not delete it or generate a different password over the existing database. |
| Policy/collateral limit | Check active commitments, creator balance and executor policy. Setup does not erase old work or override an owner's limits. |
| Port occupied | Stop the known owning installation or deliberately choose another port. |
| Mainnet quote failure/expiry | Correct the reported input or obtain a new `dry:true` quote. No transfer or balance credit occurred. |

Google Sheets stays disabled until server OAuth is configured. [Acceptance evidence](mac-acceptance/README.md) records an independent CI Mac; it does not claim remote access to your personal Mac. See [the complete quickstart](../QUICKSTART.md), [portable recovery](PORTABLE_SETUP.md) and [the judge walkthrough](JUDGES_GUIDE.md).
