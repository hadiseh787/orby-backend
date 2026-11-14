# Orby 1.5 portable release acceptance

## Scope

The 14 November review requested independent macOS Apple Silicon setup with locally owned testnet identities, actual Ollama inference, preserved existing PostgreSQL/settings, eight executable agents, six sample starters and a fresh no-transfer quote. This release adds those paths without a UI redesign or new finance module.

Backend implementation revision: 549767ef67b7655acdf29013c03288abc44a1857. Paired frontend: 16f188ecfd4627dbcfad0835c09c69998fe88bf5. Later documentation-only commits may follow. Both applications report 1.5.0; Settings reports actual checkout commits and installation paths.

## Regression checks

| Check | Result |
|---|---|
| Backend TypeScript build | Passed |
| Angular production build | Passed; upstream wallet package CommonJS optimization warning remains |
| Unit tests | 36 passed, including legacy RPC responses, limited-key permissions, model schema/revision readiness, diagnostic redaction and configuration preservation |
| Integration tests | 36 passed against disposable databases |
| Browser regressions | 31 passed against a disposable database, including all five new specialist workflows, frozen samples, scenario prefill, empty Quality Lab and 390px layout |
| Actual model catalog deliveries | Eight passed on isolated Windows PostgreSQL with actual Ollama; all funds explicitly simulated |
| Existing installation setup repeat | Passed: 231 jobs preserved, database/model settings and identities unchanged, zero additional transactions |
| Reachable Git text secret review | No configured secrets/common token patterns found in either repository at review time |

[Eight actual-model deliveries](orby-catalog-real-windows.json). Existing Windows repeat evidence: [public JSON](orby-portable-repeat-windows.json). It is not evidence of the user's Mac database. The existing installation's active simulation jobs can consume creator collateral; no old obligation/policy was erased to force another run. Actual catalog inference is exercised independently with fresh simulated funds.

## Independent Apple Silicon acceptance

Latest native run: https://github.com/hadiseh787/orby-backend/actions/runs/43634985936 . Acceptance is still in progress; no success is claimed until the mission and persistence/quote/catalog assertions complete.

The workflow asserts darwin/arm64, installs the actual model, generates independent local keys, deploys/initializes V3, installs a limited executor, starts the paired application, repeats setup, runs real testnet escrow/specialist recovery/client revision/settlement and verifies the receipt. The second acceptance script runs eight actual-model deliveries with clearly labeled simulated funds, seeds twice, restarts and verifies the testnet receipt/settings/jobs persist, then obtains a fresh dry quote and checks mobile layout.

Public evidence includes the job/child IDs, final transaction hashes and methods, actual model attempts/usage, revision checks, VERIFIED_CONTRACT_STATE, quote amount/deadline, preservation results, screenshots and a full browser video. Private keys, .env, model binaries, raw signed checkpoints and PostgreSQL files are excluded.

Earlier attempts are retained in Actions. Runs 43629578683 and 43629804797 were cancelled while preparing corrected acceptance fixtures. Run 43631808204 exposed uninitialized contract errors nested in result.error; run 43632685767 exposed the same legacy response shape for missing access keys. Both conditions now have explicit error normalization and regression coverage. Run 43633756723 passed independent provisioning/setup repeat but its browser stopped during the first full model readiness check at the old 120-second test limit. The current UI/test permits the bounded full check and records its measured duration. These attempts are not represented as passing.

The [Persian Mac guide](QUICKSTART_MAC.fa.md) documents the same commands and recovery actions.

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
