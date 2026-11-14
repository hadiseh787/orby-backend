# Actual installed demo verification

Verified 14 November 2026 on the owner's Windows machine. The real acceptance run uses **http://127.0.0.1:4200**, backend `C:/Projects/Orby/backend`, paired frontend `C:/Projects/Orby/frontend`, PostgreSQL `127.0.0.1:5433/orby`, and actual Ollama `127.0.0.1:11434`. No result from a different installation substitutes for this run.

## Source and routing

Implementation backend commit: `36cf6243b5cbc2c0b250231c6bd4208c422cbd16` (runtime changes in `9b8bbb27e4ca60631a9b681cf2c396d683348c6d`, followed by a tested installer-path quoting fix). Frontend commit: `184d5f412d08047dabec2ab3b4370896c0adc71f`, pinned in backend workspace.json. The evidence-only follow-up commit contains this report and recording. Settings reports the current responding backend HEAD and frontend build commit directly; the final browser identity artifact records the exact running revisions.

The complete launcher serves Angular and `/api/v1` from 4200. No separate backend on 3000 is used. The split development proxy targets 3000 only when running Angular separately. The fixed-path dotenv loader and launcher were exercised from `C:/Projects/Agent Freelancer`; this directory is not the active backend. [Working-directory proof](orby-installed-cwd-config.json), [browser Settings/sample/quote proof](orby-installed-browser-check.json).

## Real acceptance result

[Continuous full video](installed-demo/real-mission-aa117b1e-a031-4402-a5dc-f5eab770d9ec.webm), [complete mission evidence](orby-installed-real-mission.json), [redacted verified receipt](orby-installed-redacted-receipt.json).

- Contract: `af-contract-1793954330698.testnet`, deployed, initialized, version 3. Existing code is unchanged. The separately owned executor uses a contract-specific function-call key limited to six methods; deployment/admin keys are different.
- Job: `aa117b1e-a031-4402-a5dc-f5eab770d9ec`. Specialist child: `aaf5ab66-8333-4a12-a884-496b45f3a6f9`.
- A real model drafted an editable agreement, selected Source Extractor from existing permitted specialists and proposed a budget-bound plan. Client approval preceded funding.
- The client signed a maximum 4.4 testNEAR escrow for a 4 testNEAR award. The creator paid the 1 testNEAR specialist from creator funds. The explicitly enabled first specialist check failed; one recovery used the same subcontract escrow, with no second specialist payment.
- Main delivery revision 0 passed all required checks. The client requested `Start Recommendation with Audit revision:`. Real model revision 1 applied this exact prefix and preserved the other rows and immutable earlier delivery. Old-version approval was rejected with HTTP 409 `DELIVERY_CHANGED`.
- The client approved only revision 1. Final settlement: award 4, platform fee 0.4, creator credit 3.6 and client refund 0.4 testNEAR. The specialist cost is separately included in mission economics. Hardware/electricity/gas remain unpriced; residual is not labelled profit.
- [Escrow funding](https://testnet.nearblocks.io/txns/zdnhPuEcEnEw6yxAYAD5uTStcG9wsBVf2JH1fFkPXHj), [client revision](https://testnet.nearblocks.io/txns/6w3QXbSGN5XYgFWjPXBckj5Pwi32iWCT8zPrCc3ECV6a), [final approved settlement](https://testnet.nearblocks.io/txns/7bhb5afqXqwjehqyWhvfrbnF1ToEUan1iGR1D2png5eE). All 17 related operations were CONFIRMED; receipt verification reported `VERIFIED_CONTRACT_STATE`. Final storage inspection had zero open escrows.

The recording uses a disclosed development wallet adapter signing actual NEP-413 messages and testnet transactions with ignored local owner fixtures. It does not claim a person clicked a HOT/Meteor signature. There were no manual database edits, substituted deterministic deliveries or disabled acceptance assertions in the successful scenario.

## Model, quote and samples

Model: `orby-qwen2.5:1.5b`, official Ollama 0.40.16 with checksum-verified Qwen2.5-1.5B-Instruct Q4_K_M weights, explicit Go ChatML rendering and JSON-safe recommendation constraints. [Two distinct real editable agreements and independent completed inference](orby-installed-agreements.json), [two full-schema generations plus actual revision preflight](orby-installed-structured-preflight.json). Setup checks both plain generation and structured generation; no API key is required. [25 concurrent health requests used one inference](orby-installed-health-concurrency.json).

[Direct 1Click request/raw response](orby-installed-intents-direct.json) returned HTTP 201 for 100 USDC on Ethereum to NEAR mainnet wNEAR, using current token asset IDs/decimals and project-controlled mainnet addresses. The UI used the same asset IDs, amount and addresses; the backend refreshed the deadline and enforced `dry:true`. A quote is a dated observation and must be refreshed after expiry; the historical response is not currently executable. Recipient is a controlled NEAR implicit public address; refund address comes from a locally generated EVM key, excluded from Git. No mainnet wallet signature or transaction occurred and balances were unchanged. Authentication, rate-limit, amount, address, invalid-input, timeout, connection and genuine-no-route failures are distinct.

The same owner database contains 15 labeled frozen Demo/Sample jobs, two knowledge collections, two templates and one PAUSED program. Samples are excluded from real performance metrics. [Two repeated seeds](orby-installed-seed-repeat.json) added no duplicates and preserved all prior user job IDs. Samples were actually visible after selecting samples.demo in the 4200 browser.

## Recovery and persistence

[Concurrent approval replay and final reconciliation](orby-installed-idempotency.json) created no new signature, transfer, model attempt or operation and left settlement/client balance unchanged. Refreshes and version checks are included in the real recording. An actual disconnected rehearsal transaction was located on chain and reconciled by its original hash before further action; it was not blindly resent.

[Actual Ollama process outage](orby-installed-model-outage.json) produced UNAVAILABLE readiness and HTTP 503 MODEL_UNAVAILABLE for an agreement, with no fixed fallback. [Actual same-backend RPC outage drill](orby-installed-rpc-outage.json) temporarily pointed its RPC to an unreachable loopback port. Readiness reported UNAVAILABLE; settled job/model/operation records were unchanged. The original owner configuration was restored, the stack restarted and the final browser check reverified it. Final restart persistence is recorded separately in the current browser/receipt artifacts.

[Desktop and mobile receipt checks](orby-installed-final-ui.json) verified 17 transaction links and four model attempts, showed the failed specialist check, and found no horizontal overflow or WCAG A/AA violations on the checked light/dark 390px receipt. These checks are scoped, not a claim that every page is free of every accessibility defect.

## Test scope and failed attempts

110 automated regression tests passed: 31 Node, 36 disposable-PostgreSQL integration, 16 Rust and 27 browser tests. Browser regression fixtures run on a newly seeded disposable database at 4201 and are explicitly simulation. They do not replace the real 4200 acceptance described above. Both production builds passed, with the existing CommonJS optimization warning for the wallet connector.

The first raw browser run on the long-lived owner database passed 23/27. Four failures reflected a 25-knowledge quota, an existing creator concurrent-bond ceiling, the 20-report list window and a five-second wait for external health checks. The owner database was not reset and account limits were not bypassed. All unchanged browser assertions passed with newly provisioned disposable fixtures; the runner now includes sample seeding and refuses an occupied test port. An initial new-runner attempt omitted sample seeding and correctly failed its sample assertion; the fixture provisioning was corrected before the passing full run.

[Failed financial rehearsals and fixes](orby-installed-failed-rehearsal.json) remain explicit. Jobs `f2395087-8dea-427a-b940-657a3ab9cf2f` and `3afcbe47-4bb5-4018-9777-e5ed757accb5` failed the intended end-to-end revision path before the fixes. They were closed using normal signed disputes, zero main award and complete root refunds, followed by callback-confirmed withdrawals; their accepted specialists were still paid. [First refund](orby-installed-overload-refund.json), [second refund](orby-installed-parser-refund.json). No delivery/history was rewritten to convert either run to a pass.

## Fresh clone and remaining limits

[A fresh GitHub clone](orby-installed-fresh-clone.json) with no prior .env, database or node_modules fetched the pinned frontend, installed dependencies, built, migrated and showed all 15 samples in the browser. This separate source-only check used 4202/5434 and correctly reported real model/testnet NOT_CONFIGURED because no owner secrets were copied. Independent users must install/configure Ollama and provision their own testnet signer or receive owner-local configuration. The configured owner installation on 4200 is separately verified READY/CONNECTED.

[README](../README.md) provides exact setup/action/result steps; [.env.example](../.env.example) contains no secrets; [testnet setup](TESTNET_SETUP.md) explains limited-key provisioning. Git and Node.js are still prerequisites. The Windows installer needs network access and several gigabytes of disk; other platforms require official Ollama installation. RPC/faucet/quote-provider availability is external. Existing external Ollama servers must use the project template settings or pass the installer's structured probe; the launcher cannot change the environment of an already-running external service.

Google Sheets remains visibly disabled without OAuth. No production hosting, real mainnet payment/lending, credit system, TEE or multisig is included. No contest submission or social posting is claimed. Source is MIT, with upstream runtime/model licenses retained. A textual Git-history/current-file secret scan found no configured private keys or common tokens; this is a scoped review, not a claim of a formal security audit.
