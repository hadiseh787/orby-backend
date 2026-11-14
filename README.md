# Orby 1.5 - independent macOS and Windows demo

Eight source-comparison agents, six labeled sample starters, real local Ollama, PostgreSQL and NEAR V3 testnet settlement. Runtime keys are generated locally for each independent deployment. A public contract ID does not supply signing authority.

[Persian Mac quickstart](docs/QUICKSTART_MAC.fa.md)

## Existing installation on macOS Apple Silicon

Keep the existing project folder, `.env` and `.data/postgres`. Stop its running terminal with Ctrl+C, or run `npm run local:stop`. Do not replace `.env` with the example, remove the database directory, or clone over existing data.

From the existing backend directory (for the reviewed installation: `/Users/hess/project/orby-backend-clean`):

```sh
cd /Users/hess/project/orby-backend-clean
git pull --ff-only
npm ci
npm run setup:model
npm run setup:testnet
npm run local
```

If Git reports local changes or a diverged branch, preserve those edits before updating; no reset/hard-delete command is part of setup. Install Git and Node.js 24 LTS with npm first (22.19+ also supported). The model setup supports native macOS arm64; it discovers the installed Ollama CLI or installs a checksum-verified official runtime into this project. No paid model key, global Angular CLI, Docker, separate PostgreSQL installation, Rust or PowerShell is required for the supplied demo.

## Fresh clone

```sh
git clone https://github.com/hadiseh787/orby-backend.git
cd orby-backend
npm ci
npm run setup:model
npm run setup:testnet
npm run local
```

Open **http://127.0.0.1:4200**. The launcher obtains the exact frontend commit pinned in workspace.json, installs its lockfile, builds both applications, starts PostgreSQL on 5433, applies migrations and idempotent sample seeds, and starts API, worker and a configured local model together. API and Angular share 4200. Stop with Ctrl+C or `npm run local:stop`; rerun `npm run local` to resume with the same database and configuration. Windows PowerShell may use `npm.cmd` instead of `npm`; `start-local.cmd` is also available.

For simulation only, run `npm run local` without the two setup commands. This mode is explicitly simulated and cannot satisfy real-model/testnet acceptance.

## Real model setup

`npm run setup:model` discovers `OLLAMA_EXECUTABLE`, the project-local executable, macOS `/Applications/Ollama.app/Contents/Resources/ollama`, Homebrew and PATH locations. On supported macOS/Windows it can install the pinned official Ollama runtime locally without replacing a system installation. [Official macOS installation](https://ollama.com/download/mac) is also supported. Linux users install official Ollama, then run the same setup command.

The default model is checksum-verified Qwen2.5-1.5B-Instruct Q4_K_M, imported as `orby-qwen2.5:1.5b`. An existing installed model can be selected with:

```sh
npm run setup:model -- --model your-installed-model-name
```

The installer checks actual plain generation, project JSON structure, three rows, valid supplied citations, the requested recommendation revision and an editable agreement. A model that responds only READY is insufficient. Failure leaves previous settings intact and never substitutes deterministic output. Only `LLM_PROVIDER`, `OLLAMA_URL`, `OLLAMA_MODEL` and the actual executable path are updated after success. Model/runtime downloads need internet and several GB of disk. The normal loopback endpoint is `http://127.0.0.1:11434`.

A pre-existing external Ollama process may need restarting with the documented project ChatML settings; the launcher cannot change another process's environment. The project-owned runtime uses `OLLAMA_GO_TEMPLATE=1` and `OLLAMA_NO_CLOUD=1`. See [model troubleshooting](docs/PORTABLE_SETUP.md).

## Independent testnet setup

`npm run setup:testnet` uses existing owned deployment credentials when available. A new installation generates its own eight local account keypairs, creates testnet accounts through the public faucet, verifies the supplied V3 WASM checksums, deploys and initializes the contract, synchronizes eight manifests/prices/policies into contract and database, and configures the six-method limited executor key. Its owner/admin and runtime keys are separate. Existing healthy contracts are not redeployed and existing jobs are not changed.

Versioned `contracts/artifacts/v3/` contains the V3 market and owner-only staged-uploader WASM plus SHA-256/code hashes. This is the no-Rust setup path for Mac; source remains in `contracts/orby-market` and `contracts/uploader`. Artifacts are delivered through this repository, not private Windows files.

Private keys and signed setup checkpoints stay in ignored `.data/near`, with owner-only file permissions on macOS. Only the seven NEAR settings are updated in `.env`; model and database settings remain intact. The setup saves transaction hashes and signed bytes before broadcasting. On interruption it checks the original hash before any retry and can rebroadcast only identical signed bytes. Confirmed stages are reused. Faucet failure, bad RPC responses, invalid keys, wrong owner/receiver, paused or expired policy and insufficient funds have explicit repair actions. Full details: [portable setup and recovery](docs/PORTABLE_SETUP.md).

If an existing `.env` points to someone else's healthy public contract and has no matching authorized signer, setup stops explicitly. It does not invent credentials or replace that selection. Use an independently owned deployment or have the deployment owner provision authorized access.

## Verify readiness, then run work

Settings shows backend platform/architecture, actual project/configuration paths, frontend/backend commit, network, public contract ID and model. Recheck connections performs live verification. Contract CONNECTED is separate from mission READY. A registered limited key, exact receiver/six methods, finite allowance, executor balance, contract role, storage reserve, agent policies/collateral and creator specialist funds are checked. Model READY also requires the actual project schema and Revision checks. Private-key values are never returned.

1. Choose one of six Demo/Sample starters on the marketplace. Its three supplied sources and specialist selection populate the editable job form. Eight agent profiles explain purpose, examples, price, inputs and limits. No agent performs web research or promises verified facts.
2. For an actual mission, connect an owned, funded testnet wallet. Generate/edit the real agreement, inspect the plan and fixed spending ceiling, approve it, then review and sign the exact escrow. The main Brief Writer hires a permitted specialist from creator funds.
3. Follow live work, inspect delivery checks, request Revision 1, then approve the exact new version/hash. Old-version approval is rejected. Settlement confirmation itemizes the amounts. Receipt verification must show VERIFIED_CONTRACT_STATE and final transaction links, not only a hash.
4. Stop/restart and inspect the same job/versions/receipt. `.env` and PostgreSQL persist.
5. Balance > Mainnet top-up preview: choose supported tokens/amount and owned mainnet recipient/refund addresses. The actual provider quote shows estimated/minimum output and expiry. Backend forces dry:true and provides no executable deposit address, signature, transfer or balance credit. Quote observations expire and must be refreshed. Provider failures are separately classified and diagnostic fields are sanitized in backend logs.

Simulation uses simNEAR, testnet uses testNEAR, and mainnet preview is separate. Seeded history is labeled fixed, excluded from performance statistics, does not auto-run and offers a fresh copy. Quality Lab explains missing agent ownership and links registration/account selection. Google Sheets stays disabled until OAuth is configured.

## Tests and acceptance evidence

With the local PostgreSQL instance running:

```sh
npm test
npm run test:integration
npm run test:browser:isolated
```

Integration/browser regression tests create uniquely named disposable databases and preserve the owner database. They are not a substitute for actual native Mac acceptance. The [native Apple Silicon workflow](.github/workflows/native-mac.yml) asserts darwin/arm64, starts from a fresh clone without Windows secrets, installs the real model, provisions a separate testnet deployment and runs the actual mission/revision/settlement plus eight real-model catalog deliveries, repeat seeding, restart persistence and fresh Safe Mode quote. Its exported artifacts exclude `.env`, private keys and signed setup checkpoints. [Current release report](docs/PORTABLE_RELEASE.md) distinguishes verified checks, failed attempts and remaining limits.

Historical Windows-only proof is retained in [the prior verification](docs/INSTALLED_DEMO_VERIFICATION.md); it does not prove the reviewed user's Mac is configured. A CI Mac is an independent acceptance machine; it is not remote access to `/Users/hess`.

## License and scope

Source: [MIT](LICENSE). Ollama/Qwen retain upstream licenses. No owner secret is distributed, including through CI evidence. RPC/faucet/provider availability and client testnet funding remain external prerequisites. No production hosting, mainnet payments/lending, TEE, multisig or new large finance module is included. Publishing source does not submit a contest entry or post to social networks.

Cold model verification runs actual schema and revision inference; on native CPU-only installations the first check can take several minutes. The UI keeps CHECKING visible and permits up to seven minutes for full readiness, then shows a specific failure instead of enabling REAL_AI prematurely. Verified compatibility is cached briefly for the same model digest; explicit checks still verify current service availability.
