# Orby 1.1 verification — 6 November 2026

Angular 21, Node.js and PostgreSQL, with the supplied Orby identity and a deployed NEAR testnet contract. New agreements use exact native NEAR amounts. USD quotes are informational; legacy agreements preserve their original rules.

## Completed checks

- Both production builds pass.
- Seven Node unit/runtime tests, nine isolated PostgreSQL integration tests, seven browser tests and three native Rust financial tests pass. The financial suites include 10,000 conservation cases each.
- Actual browser-to-testnet flow passes: NEP-413 login, registration, policy, bond, native job, attachment commitment, owner-signed bid, funding, worker delivery/checks, approval, settlement, withdrawal, session restoration, explorer links and disconnect. The test wallet uses real development account keys and submits real transactions; it is not a mocked chain.
- V1 migration preserved three original jobs and five original account balances before later test transactions.
- Expired-start recovery required the client's real signature, observed the contract deadline and refunded the actual escrow.
- Legacy pricing compatibility and known failed executor transaction classification pass on the actual contract.
- Administrator reconciliation matched an actual failed receipt and did not invent payment success.
- Real Kubo add/pin/CID retrieval and authenticated database fallback pass. This was an offline local node; external replication was not tested.
- Backup restoration includes attachments, content hashes, all supported tables, row counts and sequences.
- The final optimized WASM hash matches the code deployed on testnet.

Public evidence: [browser flow](orby-browser-testnet.json), [deployment](orby-deployment.json), [migration](orby-migration.json), [expiry recovery](orby-expired-start.json), [legacy/failure checks](orby-compatibility.json), [administrator reconciliation](orby-admin-reconciliation.json), [IPFS](orby-ipfs.json).

## Startup and repository delivery

Run npm run local in the backend, or double-click start-local.cmd. The launcher gets the pinned frontend, installs dependencies, builds both applications, creates local configuration, starts PostgreSQL, applies migrations/seed and serves Angular with the API and worker. Default address: http://127.0.0.1:4200. Ctrl+C or npm run local:stop stops owned services and preserves data.

Private repositories: [frontend](https://github.com/hadiseh787/orby-frontend), [backend](https://github.com/hadiseh787/orby-backend). Each repository has independent Git history. workspace.json pins the frontend revision. Private keys, databases, backups, runtime data and dependencies are excluded from Git.

The final source-only backend checkout was tested on Windows x64 with Node 22.19.0 and bundled npm 10.9.3. With no .env, dependencies, frontend or database, npm run local fetched the pinned private frontend, installed both lockfiles, generated configuration, built both applications and initialized PostgreSQL successfully. The verification used ports 4312/5545; defaults remain 4200/5433.

## Limits

Mainnet is disabled. A personal third-party wallet's consent flow has not been exercised; the real selector and development wallet flow have. Ollama is optional and unconfigured. Default execution is explicitly deterministic. Production IPFS requires a persistent trusted node/pinning service. Real lending, arbitrary external runtimes, TEE and Intents remain outside the base scope. A fresh clone needs its own testnet deployment/credentials for blockchain execution; the one-command local simulation needs no wallet or application key. Windows x64 was tested; Linux/macOS were not tested on this machine. This is not an independent security audit.

Detailed findings and deployment requirements: [Persian release report](ORBY_RELEASE.fa.md).
