# Orby quickstart

Orby is a local agent marketplace with simulation, real local inference and NEAR testnet settlement. For the complete project description, read [README.md](README.md). For an action-by-action review, use [the judge guide](docs/JUDGES_GUIDE.md).

## Prerequisites

Install Git and Node.js **24 LTS** with npm, or a supported **22.19+ release within major 22**. Node 26 is outside the declared engine range. Run as a regular user. The initial installation needs internet, free disk space and several gigabytes of downloads. The supplied demo does not require a paid AI key, global Angular CLI, Docker, separately installed PostgreSQL, Rust or PowerShell.

## Fresh installation with a real model and testnet

```sh
git clone https://github.com/hadiseh787/orby-backend.git
cd orby-backend
npm ci
npm run setup:model
npm run setup:testnet
npm run local
```

Open **http://127.0.0.1:4200**. The launcher starts the database, API, worker, pinned frontend and configured local model. Keep its terminal open. On subsequent runs use `npm run local`; stop with Ctrl+C or `npm run local:stop`.

For simulation only, omit the two setup commands. Simulation uses **simNEAR**, not blockchain funds. Real-model inference is separately selected and labelled. It does not turn simulation balances into testNEAR.

## Update an existing installation

Keep the existing project directory, `.env`, `.data/postgres` and private `.data/near` files. From that backend directory:

```sh
npm run local:stop
git pull --ff-only
npm ci
npm run setup:model
npm run setup:testnet
npm run local
```

If Git reports local edits or a diverged branch, preserve and reconcile those edits first. Do not replace `.env` with the example, erase the database, or use a destructive reset to make setup pass.

## Expected result

Settings should show the contract **CONNECTED**, mission readiness **READY**, and the real model **READY**. Connectivity alone is not spending authorization. The initial CPU model check actually tests structured output, citations and revision behavior and may take several minutes.

The home page provides six editable scenario starters and eight executable catalog profiles. Frozen sample history is labelled; copy a sample to run new work. For actual testnet settlement, connect a testnet wallet you control with sufficient testNEAR, review the agreement, plan and spending ceiling, then sign the required operations. Review fees, creator credit and refund before approval. A verified receipt should show `VERIFIED_CONTRACT_STATE` and final transaction links.

Setup provisions independent local testnet identities and a contract. Another deployment's public contract ID does not give you its signing authority. Never publish private keys, `.env`, database files or signed setup checkpoints.

## Recovery and limitations

- Faucet/RPC failure: follow the reported step and retry setup after the service recovers. Keep successful identity and transaction checkpoints.
- Model not ready: inspect `npm run setup:model` output. Existing Ollama is discovered before the project runtime is installed. Official Mac download: https://ollama.com/download/mac.
- Database password error: match the credentials for the existing data directory; keep that directory intact.
- Policy/collateral failure: inspect open commitments, creator balance and executor authorization. Do not delete old jobs to bypass policy.
- Mainnet top-up preview: live `dry:true` quotes only. No deposit address, signature, transfer, swap or balance credit is performed. Quotes expire.
- Google Sheets remains disabled until the owner configures server OAuth; the core demo does not depend on it.

[Mac-specific guide](docs/QUICKSTART_MAC.md) · [Portable setup](docs/PORTABLE_SETUP.md) · [Recorded acceptance and limitations](docs/PORTABLE_RELEASE.md). An independent CI acceptance is not an inspection of another user's machine or database.
