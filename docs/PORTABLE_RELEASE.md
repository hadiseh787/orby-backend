# Orby 1.5 portable release acceptance

## Scope

The 14 November review requested independent macOS Apple Silicon setup with locally owned testnet identities, actual Ollama inference, preserved existing PostgreSQL/settings, eight executable agents, six sample starters and a fresh no-transfer quote. This release adds those paths without a UI redesign or new finance module.

Native acceptance backend revision: 549767ef67b7655acdf29013c03288abc44a1857. Paired frontend: 16f188ecfd4627dbcfad0835c09c69998fe88bf5. Subsequent launcher selection correction 5a62fe7 has separate regression coverage and successful local startup; the fresh native workflow had no adjacent developer checkout. Final evidence/documentation commits follow these revisions. Both applications report 1.5.0; Settings reports actual checkout commits and installation paths.

## Regression checks

| Check | Result |
|---|---|
| Backend TypeScript build | Passed |
| Angular production build | Passed; upstream wallet package CommonJS optimization warning remains |
| Unit tests | 37 passed, including legacy RPC responses, limited-key permissions, model schema/revision readiness, diagnostic redaction and configuration preservation |
| Integration tests | 36 passed against disposable databases |
| Browser regressions | 31 passed against a disposable database, including all five new specialist workflows, frozen samples, scenario prefill, empty Quality Lab and 390px layout |
| Actual model catalog deliveries | Eight passed on isolated Windows PostgreSQL with actual Ollama; all funds explicitly simulated |
| Existing installation setup repeat | Passed: 231 jobs preserved, database/model settings and identities unchanged, zero additional transactions |
| Reachable Git text secret review | No configured secrets/common token patterns found in either repository at review time |

[Eight actual-model deliveries](orby-catalog-real-windows.json). Existing Windows repeat evidence: [public JSON](orby-portable-repeat-windows.json). It is not evidence of the user's Mac database. The existing installation's active simulation jobs can consume creator collateral; no old obligation/policy was erased to force another run. Actual catalog inference is exercised independently with fresh simulated funds.

## Independent Apple Silicon acceptance

Latest native run: https://github.com/hadiseh787/orby-backend/actions/runs/43634985936 . The complete workflow passed on native darwin/arm64. It started from a fresh clone without Windows configuration/key files. The actual native mission, eight catalog deliveries, repeat seeding, preserved settings/jobs/receipt after restart, fresh provider quote and 390px browser checks all passed.

The workflow asserts darwin/arm64, installs the actual model, generates independent local keys, deploys/initializes V3, installs a limited executor, starts the paired application, repeats setup, runs real testnet escrow/specialist recovery/client revision/settlement and verifies the receipt. The second acceptance script runs eight actual-model deliveries with clearly labeled simulated funds, seeds twice, restarts and verifies the testnet receipt/settings/jobs persist, then obtains a fresh dry quote and checks mobile layout.

Public evidence includes the job/child IDs, final transaction hashes and methods, actual model attempts/usage, revision checks, VERIFIED_CONTRACT_STATE, quote amount/deadline, preservation results, screenshots and a full browser video. Private keys, .env, model binaries, raw signed checkpoints and PostgreSQL files are excluded.

Earlier attempts are retained in Actions. Runs 43629578683 and 43629804797 were cancelled while preparing corrected acceptance fixtures. Run 43631808204 exposed uninitialized contract errors nested in result.error; run 43632685767 exposed the same legacy response shape for missing access keys. Both conditions now have explicit error normalization and regression coverage. Run 43633756723 passed independent provisioning/setup repeat but its browser stopped during the first full model readiness check at the old 120-second test limit. The current UI/test permits the bounded full check and records its measured duration. These attempts are not represented as passing.

The [Mac quickstart](QUICKSTART_MAC.md) documents the same commands and recovery actions.

## Verified native evidence

- [Actual mission and 17 CONFIRMED chain operations](orby-mac-acceptance.json)
- [Eight actual-model deliveries, restart/receipt, fresh dry quote and mobile checks](orby-portable-catalog-acceptance.json)
- [Setup repeat: 17 existing jobs preserved, unchanged model/database settings and zero new transactions](orby-portable-repeat-mac.json)
- [Additional Windows quote: all simulation balances/ledger and client testnet balance unchanged](orby-portable-quote-windows.json)
- [Full recorded mission](mac-acceptance/real-mission-7d3b7a71-40be-43ec-9522-3db54f0f4274.webm) and [390px quote screenshot](mac-acceptance/fresh-quote-mobile.png)
- [Original public Actions artifact](https://github.com/hadiseh787/orby-backend/actions/runs/43634985936/artifacts/14130368930)

Contract: orby-contract-1794686568767.testnet. Main job: 7d3b7a71-40be-43ec-9522-3db54f0f4274. Specialist job: 15ad68d1-8e3b-4947-a810-304f906d4a9f. Four delivery/revision model attempts completed with actual Ollama; none used a deterministic replacement. The first complete runtime compatibility check took 72.776 seconds on this runner.

| Client action | Final testnet transaction |
|---|---|
| Publish native agreement | [9pB1sPRx...](https://testnet.nearblocks.io/txns/9pB1sPRxRKkv9ypxRkRrARpKGibrSo3CGJ1dFxZrvqUc) |
| Award and fund | [4DMdMYFd...](https://testnet.nearblocks.io/txns/4DMdMYFdshLESiz6EaLV7cDWtMRYJyxHBAAe6YkkxGDb) |
| Request Revision 1 | [CW9gGrYo...](https://testnet.nearblocks.io/txns/CW9gGrYoCxsLS1RKw95ubKDTTHLsy9TCokdj9g2GKNAd) |
| Approve exact revised delivery and settle | [CUgKctP7...](https://testnet.nearblocks.io/txns/CUgKctP7GvBvh4cugHw3gfHy9b1paaJuUBbfRY9uCH64) |

The 4 testNEAR award used a 4.4 escrow: creator credit 3.6, fee 0.4 and client refund 0.4 testNEAR. The creator separately funded the specialist with 1 testNEAR; specialist credit was 1, with no second payment for recovery. Hardware/electricity/gas are unpriced, so the remaining amount is not represented as complete profit.

The native dry quote observed at 2026-11-14 20:24:10 UTC used 100 USDC on Ethereum (100000000 atomic units) toward wrapped NEAR. It estimated 32.775165087383137419 NEAR, minimum 32.44741343650930604481, and expired at 20:27:09 UTC. Provider route fees were not itemized; the separate published platform surcharge is labeled an estimate. This historical quote must be refreshed and cannot authorize a transfer.

## User commands

From the existing reviewed Mac backend folder, stop the old stack before updating, preserving .env and .data/postgres:

```sh
cd /Users/hess/project/orby-backend-clean
npm run local:stop
git pull --ff-only
npm ci
npm run setup:model
npm run setup:testnet
npm run local
```

Open http://127.0.0.1:4200. Subsequent runs need only npm run local. A fresh installation uses the same setup commands after cloning the backend; the launcher retrieves its pinned frontend. Git and Node 24 with npm (or 22.19+) are prerequisites. Preserve local edits if git pull refuses; do not reset or delete the database.

## Limits

No remote access to /Users/hess or that user's original database is claimed. A separate native Mac is acceptance evidence for portability, not an inspection of their personal installation. The new setup never distributes Windows signing keys or provides authority from a public contract ID.

The browser acceptance wallet adapter signs real NEP-413 messages and testnet transactions with newly generated, ignored development keys. It is not a claim of manual approval in HOT/Meteor. Controlled specialist failure is deliberately selected in the demo, with one bounded recovery. Local inference has zero API billing, but unpriced hardware/electricity/gas prevents a complete profit claim.

RPC, faucet, model downloads and the live quote provider require internet and can fail/rate-limit. Quotes expire and must be refreshed. Mainnet dry mode performs no signature, transfer, executable deposit-address disclosure or balance credit. Eight catalog checks use simulated funds; the separate mission uses actual testnet escrow. Google Sheets remains disabled until OAuth is configured. No mainnet lending/payment, TEE, multisig, production deployment or contest submission is included.

A subsequent launcher correction preserves stale or edited adjacent frontends and chooses the clean pinned revision by default. Explicit developer frontend selection remains supported. This branch selection has dedicated regression coverage; the native workflow starts without any adjacent developer checkout.
