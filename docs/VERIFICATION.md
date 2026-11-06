# Verification — 6 November 2026

The project uses Angular 21, Node.js, PostgreSQL and a Rust NEAR testnet contract. The supplied source documents are included in `docs/handoff`; React/SQLite were replaced as requested. The later request changed the palette to slate/teal/mint and replaced the header theme selector with an accessible icon menu. Page structure, financial labels and the base product flows follow the handoff.

## Verified behavior

- Frontend and backend production builds pass.
- Seven Node unit/runtime tests pass, including six golden settlement scenarios, 10,000 exact-integer conservation cases, canonical JSON hashes, NEP-413 domain binding, HMAC replay rejection and asynchronous HTTP runtime idempotency.
- Eight PostgreSQL integration tests pass in an isolated database: complete delegated workflow, concurrent funding, request conflicts, ownership and CSRF, stale previews, disputes, pause behavior, pool redemption and API rate limiting without charging SPA requests.
- Three native Rust financial tests pass, including overflow-safe U256 arithmetic and another 10,000 conservation cases. The production contract imports this tested financial crate.
- Four browser tests pass and cover the complete local client workflow, theme persistence and OS changes, icon-menu keyboard behavior, dialog Escape behavior, direct routes, and creator/credit/admin layouts at 375 and 1440 pixels in light and dark mode.
- A consistent PostgreSQL backup was restored into a fresh migrated database; its content hash, table row counts and serial sequences were checked.
- `npm run local` or `start-local.cmd` fetches the pinned frontend, installs locked dependencies, creates a random local database password, builds both applications, starts PostgreSQL, applies migration/seed, then starts the API and worker. The API serves Angular at the same origin. Startup waits for SQL and HTTP readiness. Ctrl+C, `npm run local:stop` or `stop-local.cmd` stops owned services and shuts the project database down through `pg_ctl`.

## Clean-checkout delivery check

On Windows x64 with Node 22.19.0 and its bundled npm 10.9.3, a source-only backend archive was extracted into a separate folder without `.env`, dependencies, database files or testnet keys. Its launcher fetched the private frontend from GitHub at `d9d14e28254189f97c53a3b43300dbb1a16e6d3b`, installed dependencies, generated configuration, built both applications and initialized a fresh PostgreSQL cluster. The check used application port 4310 and database port 5543 to avoid existing local services; normal defaults are 4200 and 5433.

The seven unit/runtime tests, eight isolated database integration tests and all four browser tests passed against this setup. The browser workflow created, funded, delivered and settled a simulation job through the actual API and worker. Backup/restore also passed. Stopping closed both owned ports; restarting reused the database and dependencies. All 31 supplied handoff files matched their original SHA-256 hashes. Cross-platform startup paths are implemented; Linux/macOS have not been verified on this Windows machine.

The frontend lockfile includes the optional peer entries required by bundled npm 10 as well as npm 11. SPA navigation and static assets do not consume the API rate-limit budget. The authenticated local shutdown endpoint is available only to launcher-spawned processes and remains usable after API throttling.

## Repository delivery

- Private frontend: https://github.com/hadiseh787/agent-freelancer-frontend
- Private backend: https://github.com/hadiseh787/agent-freelancer-backend

The backend contains the original handoff, migrations, seed, contracts, lockfile, launchers, examples and verification evidence. `workspace.json` pins the matching frontend commit. Generated databases, backups, dependencies, build outputs, runtime secrets and testnet private keys are excluded from Git. Access to both private repositories is required for automatic frontend cloning. No public web hosting or mainnet deployment was performed.

## Real testnet evidence

Contract: `af-contract-1793954330698.testnet`.

The optimized, MVP-compatible WASM was deployed through an owner-only chunk uploader and its on-chain code hash was verified. Bootstrap used separate development accounts for the client, creators, administrator, updater and executor.

The real end-to-end check passed:

1. NEP-413 login with registered full-access development account keys.
2. Client-signed job creation and executor-signed bids.
3. A real 4.4 testNEAR root escrow and separate performance bond.
4. A 1 testNEAR child escrow paid from the creator's own free balance.
5. Child delivery, deterministic checks and timed child settlement.
6. Root delivery, explicit client approval and exact escrow conservation.
7. A 0.1 testNEAR withdrawal, completed callback and zero pending reservation.
8. Rejection of a forged withdrawal callback.

The worker now uses a function-call key restricted to six methods, with no attached deposits and a 0.5 testNEAR gas allowance. A permitted bid call executed with that key; a withdrawal attempt was rejected. Public deployment and transaction evidence is in `docs/testnet-*.json`. Private keys remain only in ignored local files.

## Scope and verification limits

- The reference price is an explicit fixture. `Ref USD` never represents guaranteed dollar value.
- Local development sessions use a separate simulation ledger and cannot claim testnet balances. The local workflow remains usable without a wallet or RPC connection.
- No Ollama model has been installed or configured. The default runtime is explicitly labeled deterministic. Optional Ollama generation is implemented behind configuration; model performance and LLM review quality have not been verified on this machine.
- Base credit functionality is a financing preview and a simulated closed-epoch pool. Real lending, external runtime endpoints, IronClaw, TEE, Intents and mainnet remain outside the base P0 delivery, as scoped in the handoff.
- Financial parameters use the proposed base values: 10% fee, 10% buffer and 20% performance bond. There is no parameter-editing UI in this delivery.
- Real signatures were checked with generated development accounts. A third-party browser wallet's interactive consent/redirect flow has not been exercised with a user's personal wallet.
- Native NEAR sandbox tests were not run on Windows. The contract was compiled, its arithmetic tested natively, and its core state transitions exercised on the actual testnet. This does not constitute a security audit.
