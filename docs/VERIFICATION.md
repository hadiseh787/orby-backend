# Verification — 6 November 2026

The project uses Angular 21, Node.js, PostgreSQL and a Rust NEAR testnet contract. The supplied source documents remain in `handoff`; React/SQLite were replaced as requested. The later request changed the palette to slate/teal/mint and replaced the header theme selector with an accessible icon menu. Page structure, financial labels and the base product flows follow the handoff.

## Verified behavior

- Frontend and backend production builds pass.
- Seven Node unit/runtime tests pass, including six golden settlement scenarios, 10,000 exact-integer conservation cases, canonical JSON hashes, NEP-413 domain binding, HMAC replay rejection and asynchronous HTTP runtime idempotency.
- Seven PostgreSQL integration tests pass in an isolated database: complete delegated workflow, concurrent funding, request conflicts, ownership and CSRF, stale previews, disputes, pause behavior and pool redemption.
- Three native Rust financial tests pass, including overflow-safe U256 arithmetic and another 10,000 conservation cases. The production contract imports this tested financial crate.
- Four browser tests pass and cover the complete local client workflow, theme persistence and OS changes, icon-menu keyboard behavior, dialog Escape behavior, direct routes, and creator/credit/admin layouts at 375 and 1440 pixels in light and dark mode.
- A consistent PostgreSQL backup was restored into a fresh migrated database; its content hash, table row counts and serial sequences were checked.
- `start.cmd` starts PostgreSQL, migration/seed, API, worker and Angular together. Startup waits for a successful SQL connection and HTTP readiness. `stop.cmd` stops only recorded project processes and shuts the project database down through `pg_ctl`.

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

The worker now uses a function-call key restricted to six methods, with no attached deposits and a 0.5 testNEAR gas allowance. A permitted bid call executed with that key; a withdrawal attempt was rejected. Public deployment and transaction evidence is in `backend/docs/testnet-*.json`. Private keys remain only in ignored local files.

## Scope and verification limits

- The reference price is an explicit fixture. `Ref USD` never represents guaranteed dollar value.
- Local development sessions use a separate simulation ledger and cannot claim testnet balances. The local workflow remains usable without a wallet or RPC connection.
- No Ollama model has been installed or configured. The default runtime is explicitly labeled deterministic. Optional Ollama generation is implemented behind configuration; model performance and LLM review quality have not been verified on this machine.
- Base credit functionality is a financing preview and a simulated closed-epoch pool. Real lending, external runtime endpoints, IronClaw, TEE, Intents and mainnet remain outside the base P0 delivery, as scoped in the handoff.
- Financial parameters use the proposed base values: 10% fee, 10% buffer and 20% performance bond. There is no parameter-editing UI in this delivery.
- Real signatures were checked with generated development accounts. A third-party browser wallet's interactive consent/redirect flow has not been exercised with a user's personal wallet.
- Native NEAR sandbox tests were not run on Windows. The contract was compiled, its arithmetic tested natively, and its core state transitions exercised on the actual testnet. This does not constitute a security audit.
- Git has no remote and no source has been pushed. No public web hosting or mainnet deployment was performed.
