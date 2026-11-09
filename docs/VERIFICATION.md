# Orby 1.3 verification

Fresh pass: 9 November 2026 on Windows x64 / Node 22.19.0. [Complete review-v2 implementation](REVIEW_V2_RELEASE.fa.md).

**87 automated tests passed:** 17 Node unit/runtime, 31 isolated PostgreSQL integration, 13 Rust behavioral, 3 Rust financial and 23 production-browser tests. The financial suites additionally exercise 10,000 conservation cases. Both production builds passed. Nine migrations applied; consistent backups, including all new product tables, restored into fresh migrated databases with row-count and integrity verification.

The full 23-browser suite also passed against a source-only installation that automatically fetched the exact pinned frontend, installed both lockfiles, created configuration and PostgreSQL, and built and launched API, worker and Angular. [Clean-start evidence](orby-clean-start-1.3.json). The new product flows passed axe WCAG A/AA checks at desktop and mobile widths, including dark mode, without horizontal overflow.

Actual testnet checks passed: [V2 to V3 migration](orby-v3-upgrade.json) compared every entry of all nine old maps and preserved user liabilities; [browser-wallet lifecycle](orby-browser-testnet.json) includes real NEP-413 signatures, revision-1 approval, withdrawal callback and receipt verification; [delegated lifecycle](orby-delegated-testnet.json) settled a separately creator-funded child before its root. Explicit negative probes reject unbound native approval and a forged callback. Those probes intentionally produce RPC ActionError messages.

[Actual WASM load evidence](orby-v3-load.json): 100 indexed jobs, 518-byte state header and 2,741,725,803,397 callback gas against a 50 TGas limit (94.51% margin at this bounded target). Native mock-host tests separately cover 500 jobs; mock-host gas is not represented as actual WASM gas. The isolated load fixture was cleared and deleted only after zero liabilities/open escrows. Its sponsor was the admin testnet wallet, never marketplace backing.

[Final contract state](orby-v3-final-state.json) verifies the deployed code hash, resumed state, zero open escrows and protected sponsor reserves. [Read-only testnet rehearsal](orby-testnet-rehearsal.json) observes final agent/policy/job/balance state and blocks re-funding an already settled job without changing money or operations.

[Screenshots and local simulation video](demo/), [dependency assessment](DEPENDENCY_REVIEW.md), [publication status](SUBMISSION.md). Google append/crash recovery and model-boundary behavior are tested with explicitly controlled HTTP fixtures. A real Google account, actual Ollama inference, human HOT/Meteor approval and Linux/macOS execution were not verified by these fixtures. No mainnet or independent security-audit claim is made.

## Historical 1.2 verification

Latest workspace release: 7 November 2026. [Full revised request and implementation checklist](WORKSPACE_RELEASE_2026-11-07.fa.md), [Google Sheets setup](GOOGLE_SHEETS_SETUP.md), [security boundaries](../SECURITY.md).

Production Angular and TypeScript builds passed. Node unit/runtime tests: **13**. Isolated PostgreSQL integration tests: **23**, including current inbox state, queue separation, independent milestone terms, program ceilings, all paid-trial payouts, private knowledge snapshots, version-bound approval and uncertain Google append reconciliation. Native Rust financial tests: **3**, with 10,000 conservation cases. All seven migrations applied. A consistent backup restored into a fresh migrated database with file integrity, table row counts and sequences verified.

Full production browser suite: **19/19 passed** on Windows/Chrome, covering both themes, mobile layouts, CSP, signature review/cancellation/recovery and account isolation, account-scoped drafts, validation/focus, resumed login intent, 390×844 job cards, readable source feedback and immutable revisions, templates, program forms, real funding comparisons, uploads and the complete simulation lifecycle. The suite observes API quota headers between tests; it does not disable rate limits. Desktop and mobile screenshots were visually inspected.

The 1.2 source-only startup also passed on Windows x64/Node 22.19.0: an archive without configuration, dependencies, frontend or database fetched frontend `141fde5b7b6b294b82e1604e4a621a639cd6e8d3`, installed both lockfiles, built both applications, created PostgreSQL/configuration and applied seven migrations. A new knowledge-backed job was funded, delivered by the worker and explicitly approved/settled through the resulting API. [Clean-start evidence](orby-clean-start-1.2.json). No application key or wallet was needed.

The [real browser/testnet flow](archive/orby-browser-testnet-1.2.0.json) passed using real development signatures and RPC: **11 user transactions**, including targeted revision, exact revision-1 approval, unused bond release and callback-confirmed withdrawal. The contract upgrade preserved **8 jobs and 8 balances**; see [upgrade evidence](orby-workspace-upgrade.json). Its data layout version remains 2. The new methods require the updated contract code.

Live Google OAuth consent was not exercised: owner-supplied OAuth client configuration is required. Google protocol integration is covered by a declared HTTP fixture. Recurring testnet jobs require wallet signatures for each publication/funding; monthly ceilings are workspace reservations. Mainnet and real credit lending remain disabled. No independent security audit was performed.

## Earlier 1.1 evidence

Latest pass: 7 November 2026. [Current fixes and verification](CHANGES_2026-11-07.fa.md) and [security boundaries](../SECURITY.md) supersede the relevant 6 November findings below. Node tests: 10; isolated PostgreSQL tests: 12 (consecutive clean teardowns); browser tests: 10, including CSP, wallet sandbox RPC and legacy USD submission. Contract code was upgraded without changing the 7 existing jobs or 8 account balances; see [upgrade evidence](orby-upgrade-20261107.json). The real [browser/testnet flow](archive/orby-browser-testnet-1.2.0.json) also passed with enforced CSP, an open bid surviving a price-only update, a five-minute funding preview, settlement and withdrawal.

The following is the original 6 November baseline.

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

Public evidence: [browser flow](archive/orby-browser-testnet-1.2.0.json), [deployment](orby-deployment.json), [migration](orby-migration.json), [expiry recovery](orby-expired-start.json), [legacy/failure checks](orby-compatibility.json), [administrator reconciliation](orby-admin-reconciliation.json), [IPFS](orby-ipfs.json).

## Startup and repository delivery

Run npm run local in the backend, or double-click start-local.cmd. The launcher gets the pinned frontend, installs dependencies, builds both applications, creates local configuration, starts PostgreSQL, applies migrations/seed and serves Angular with the API and worker. Default address: http://127.0.0.1:4200. Ctrl+C or npm run local:stop stops owned services and preserves data.

Private repositories: [frontend](https://github.com/hadiseh787/orby-frontend), [backend](https://github.com/hadiseh787/orby-backend). Each repository has independent Git history. workspace.json pins the frontend revision. Private keys, databases, backups, runtime data and dependencies are excluded from Git.

The final source-only backend checkout was tested on Windows x64 with Node 22.19.0 and bundled npm 10.9.3. With no .env, dependencies, frontend or database, npm run local fetched the pinned private frontend, installed both lockfiles, generated configuration, built both applications and initialized PostgreSQL successfully. The verification used ports 4312/5545; defaults remain 4200/5433.

## Limits

Mainnet is disabled. A personal third-party wallet's consent flow has not been exercised; the real selector and development wallet flow have. Ollama is optional and unconfigured. Default execution is explicitly deterministic. Production IPFS requires a persistent trusted node/pinning service. Real lending, arbitrary external runtimes, TEE and Intents remain outside the base scope. A fresh clone needs its own testnet deployment/credentials for blockchain execution; the one-command local simulation needs no wallet or application key. Windows x64 was tested; Linux/macOS were not tested on this machine. This is not an independent security audit.

Detailed findings and deployment requirements: [Persian release report](ORBY_RELEASE.fa.md).
