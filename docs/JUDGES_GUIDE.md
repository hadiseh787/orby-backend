# Orby judge walkthrough

This guide separates a fast local simulation from a real-model NEAR testnet mission. The current complete application is version 1.5. For installation, start with the [root README](../README.md). To inspect an already recorded run without installing, use the [native Mac evidence index](mac-acceptance/README.md).

## Choose the review depth

| Review | Prerequisites | Expected evidence |
| --- | --- | --- |
| Watch and inspect | Public GitHub access | Full application recording, public JSON, successful workflow and testnet transaction links |
| Exercise simulation | Git, supported Node/npm and local install | Eight profiles, six starters, editable job, simulated execution/receipt; no wallet or testnet payment |
| Run real AI with simulated funds | Model setup succeeds | Actual Ollama outputs and usage, while amounts remain simNEAR |
| Reproduce the complete testnet mission | Model, owned deployed testnet contract/executor, funded testnet client wallet | Actual testnet escrow, specialist work, revision and verified settlement |

Model/runtime downloads require internet and several GB of disk. Faucet, RPC and quote-provider availability are external dependencies. Do not interpret waiting for a download or cold model check as instant execution.

## 1. Verify which installation is answering

1. Start the backend launcher with `npm run local`; open `http://127.0.0.1:4200`.
2. Open Settings and select **Recheck connections**.
3. Confirm actual platform, architecture, backend project/configuration paths and frontend/backend commits.
4. For the real mission, require testnet contract **CONNECTED**, mission **READY** and model **READY**. Contract connectivity alone is insufficient. The model probe verifies project JSON and a revision, not just a response to READY.

**Expected:** missing model, invalid/unregistered key, wrong contract receiver, low allowance/funds and blocked policy have explicit states/actions. No private key is returned. The first model check may take minutes, with a bounded UI wait of up to seven minutes.

## 2. Explore labeled simulation

1. Use the local demo entry, or Settings → Switch demo account → Demo / Sample workspace → Enter simulation.
2. Open Marketplace. Inspect the eight specialist profiles, price units, supplied-source limits and examples.
3. Choose a starter, inspect the matching selected agent and its three sources, then edit the form.
4. Open My jobs. The 15 frozen sample scenarios cover multiple lifecycle states. They are illustrative saved snapshots; use their fresh-copy path for a new execution.
5. Visit Workspace tools for private knowledge, personal templates, programs and Quality Lab. A user without an owned agent receives an explanation rather than a misleading benchmark action.

**Expected:** explicit simNEAR units and sample labels. Fixed history does not auto-run or contribute to real completion metrics. Deterministic source organization must not be described as actual LLM inference. Selecting real AI with simulated funds changes execution provenance, not the ledger into testnet.

## 3. Prepare a complete real testnet mission

1. Run `npm run setup:model` and `npm run setup:testnet` from the backend directory, then start/restart the local launcher.
2. The testnet setup uses locally owned accounts and a limited executor; a historical public contract ID grants no authority. Preserve all local private files and existing database/settings.
3. Connect an owned **testnet** wallet with enough testNEAR for the escrow and gas. Local `.demo` login is not a testnet wallet.
4. Choose Brief Writer and create a real-model comparison job with three supplied sources and a **4 testNEAR award**. Example fabricated input:

```text
proposal-a: Build a research tool for 5000 units in six weeks.
Strong technical detail, but no user testing plan.

proposal-b: Build a focused writing assistant for 4000 units in four weeks.
Includes user testing, explicit milestones and a maintenance plan.

proposal-c: Build a broad automation platform for 9000 units in twelve weeks.
Broad capabilities, complex scope and uncertain milestones.
```

The source prices above are fictional comparison claims, not token prices or verified quotations.

5. Optionally ask real AI to suggest an agreement. Inspect/edit the resulting brief, budget and rules. Require one row per source, supplied-source citations and a bounded recommendation length.
6. Publish, request proposals and select a current Brief Writer proposal.

**Expected:** editable agreement; no model-authorized funding. Testnet publication can itself require a wallet transaction. Sources remain untrusted data and no external web research is claimed.

## 4. Review the plan and escrow

1. Generate the mission plan for the chosen proposal.
2. Inspect the specialist, reason, steps, fixed creator-funded ceiling and maximum recovery attempts.
3. Approve the plan before funding. A changed proposal/terms/policy requires an appropriate fresh review.
4. Review the **4.4 testNEAR cap** for the 4 testNEAR award, then sign only the intended testnet funding transaction.

**Expected:** the lead's specialist is selected from permitted, affordable candidates, not invented by the model. The client escrow and creator's specialist budget remain separate. A 10% buffer is locked up front; extra funds are not silently charged later.

The recorded acceptance deliberately selects a **controlled first-specialist-check failure** to demonstrate recovery. Enable it only when deliberately reproducing that scenario. It is a disclosed test condition, not proof that a naturally occurring failure happened.

## 5. Follow work and one recovery

1. Follow Live collaboration and its expanded stages, attempts/checks and costs.
2. Inspect the Source Extractor child work and its funding source.
3. In the controlled scenario, inspect the failed first acceptance check and the single recovery.
4. Open Deliverables when the root is ready for review; inspect the actual text, citations, checks and runtime provenance.

**Expected:** the 1 testNEAR specialist escrow is funded from creator funds. The recorded recovery reuses that subcontract escrow; it is not a second specialist payment. Required failure cannot be silently changed into acceptance. Real-model failure must not be replaced by a deterministic success.

## 6. Request a correction and approve the new version

1. Request a change to the recommendation with `Start Recommendation with Audit revision:`.
2. Wait for and inspect **Revision 1**. Confirm the prefix actually appears, previous comparison rows remain intact and Revision 0 remains inspectable.
3. Review the latest acceptance checks and settlement preview.
4. Approve the current version/hash, then complete the intended testnet settlement signature.

**Expected:** old-version approval is rejected (`DELIVERY_CHANGED` in the recorded acceptance); it cannot approve a changed artifact. Manual approval means client review is required, not that AI may infer consent from silence.

## 7. Inspect financial accounting and evidence

For the recorded main award:

| Item | testNEAR |
| --- | ---: |
| Client escrow | 4.4 |
| Main award | 4 |
| Platform fee deducted from award | 0.4 |
| Creator credit | 3.6 |
| Client refund | 0.4 |
| Separate specialist award from creator funds | 1 |

Open Receipt → Build receipt preview → Verify receipt. Inspect delivery version/hash, client decisions, checks, specialist record, final transaction links and allocations.

**Expected:** testnet receipt reports `VERIFIED_CONTRACT_STATE`. A simulation receipt reports only a simulation-record match. Creator remainder is not called complete profit: local inference hardware/electricity and gas allocation are unpriced. Public blockchain data contains amounts, accounts and hashes; private source text is not thereby made public.

Choose private or redacted evidence deliberately. Redacted packs remove source content but still require review before sharing. Do not publish fixture keys or raw signed setup checkpoints.

## 8. Restart and repeat safely

Stop with Ctrl+C or `npm run local:stop`, restart with `npm run local`, reopen the same job and inspect its delivery versions, settlement and balances.

**Expected:** existing data and configuration persist. Repeated sample seeding does not duplicate samples or erase jobs. An uncertain transaction response is reconciled by its saved hash before retry, rather than blindly signing another payment.

## 9. Inspect the no-transfer mainnet preview

In Balance → Mainnet top-up preview, use supported tokens, an amount and valid **owned** recipient/refund addresses. Request a new quote and inspect estimated/minimum received amounts, fees notice and expiry.

**Expected:** backend enforces `dry:true`. No executable deposit address, wallet signature, transfer or balance credit exists. Amount/address rejection, no route and provider outage are different outcomes. The historical native quote has expired; it must not be reused as a current offer. No mainnet coins are required merely to inspect a dry quote.

## What this guide does not claim

The native recording uses an automated development wallet adapter with private local fixtures. It signs actual NEP-413 messages and testnet transactions; it does not show a human approving HOT/Meteor dialogs. Eight catalog acceptance deliveries use real inference with **simulated** funds; they are not eight testnet payment demonstrations. A successful CI Mac does not certify another user's personal installation. Google Sheets requires OAuth; production hosting, mainnet payments/lending, TEE and multisig are outside the delivered scope.
