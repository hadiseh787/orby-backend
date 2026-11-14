# Orby 1.4.1 — demo repeatability fixes

The active installation of this machine lives in `C:\Projects\Orby`. The start/stop files of the old IDE folder redirect to this installation. In Settings, the Installation readiness section shows the backend version, the real model status, the server RPC network and wallet, the contract, and the action needed to fix connectivity. A clone without `.env` deliberately carries no private key or owner contract; those being unset does not mean a successful connection.

[Continuous full-run video, 7:24](demo-1.4.1/real-mission-45919c01-007b-4309-8872-b9e1d235e47d.webm) · [real model/testnet report with 17 transactions](orby-real-mission-1.4.1.json). The scenario covers specialist failure and recovery, a real Recommendation revision, rejection of a stale version approval, and settlement of version 1. 108 automated tests, both builds and a backup restore passed.

## One-command install and run

Prerequisite: Git and Node.js 24 with npm; Node 22.19 is also supported. From the backend folder:

```powershell
npm run local
```

PostgreSQL, migrations, the API, the worker, Angular and the configured local model come up with the same launcher. The default address is `http://127.0.0.1:4200`. Stop: `Ctrl+C` or `npm run local:stop`.

To install the real model on Windows x64, stop the application, then:

```powershell
npm run demo:model:setup
npm run local
```

This machine's model is Qwen2.5-1.5B-Instruct-Q4_K_M with llama.cpp b12375. The initial download is about 1.12 GB and its SHA-256 is verified. The local API has no billing cost; electricity, hardware and gas are not fully priced, and the remainder is not called "profit". Automatic model installation on Linux/macOS was not tested in this delivery. `.env.example` is secret-free; testnet keys and the development account files are not in Git.

## "Do it → see the result" test

1. Settings → Recheck connections: the model must be `READY` and the testnet connection `CONNECTED`. The network check uses the `status` response; the presence of contract code and version 3 is also checked. A wrong RPC, an absent contract and missing settings each have their own messages. In an installation without owner settings, the reason and the required action are shown first.

2. Create a job → Draft an agreement from your goal: enter one goal about marketing and another about product specifications. The proposed title, brief and word-limit/citation requirements should differ and be editable. The disabled button carries a reason, and Recheck model connection re-measures real readiness. The agreement proposal performs no publication or payment. [Output of two real requests and the selection of two different specialists](orby-ai-planning-1.4.1.json).

3. Stop the model → the button/form shows the no-connection reason and the API returns a specific error; no canned output with an AI label is delivered. [Proof of a real model-process shutdown and unchanged balances](orby-model-outage-1.4.1.json). The launcher was restarted after this test.

4. Balance → Ethereum / USDC → amount 10, destination wNEAR, a sample 64-character hex recipient and a valid EVM refund address: a real quote with estimated received, minimum received and expiry must appear. [Real result](orby-intents-safe-mode-1.4.1.json). The sample addresses in this test are for preview only.

Decimal conversion also happens in the backend: 10 USDC with precision=6 equals 10000000 units. `dry:true` is set in the backend's outbound request; `dry:false` and executable fields are rejected. There is no signature, executable deposit address, transfer or balance credit. Only supported EVM networks and NEAR are offered in this form.

A zero/negative amount, extra precision and an invalid address must be correctable. No route, minimum amount, rate limit, timeout, disconnection and an unreadable service response each have their own code and message. On token-discovery failure the form disables from the start with a reason and a Retry. Changing an input invalidates the previous quote and the late reply to the earlier input; an expired quote is discarded.

The provable cause in the old code: `fetch` exceptions and non-JSON response parsing reached the generic 500 handler without becoming domain errors; address validation also rejected only the testnet suffix. For the historical browser error, no request-id and no contemporaneous log were available; no definitive historical cause was invented. The valid request now passes against the real service, and service errors are tested separately with declared fixtures. The new log records only the classified code and status, and the raw sensitive response is not returned to the form.

5. Publish a fresh job with the real model and an Agent-managed mission → view the plan, the client's escrow cap and the specialist cost from the creator's balance → approve the plan → sign the funding. The evidence request must select the evidence specialist and the structure-review request the format specialist; the model chooses from the permitted list and the server sets the price.

6. In the demo, enable the controlled first-attempt failure option → the specialist's first real output is rejected at the acceptance check → exactly one correction runs → the same escrow is reused. Live collaboration is a summary and expandable; status, attempt count, checks and each attempt's API cost are inspectable. A second failure stops the job for a user decision; a previous successful payment or hire is not charged again.

7. After delivery, click Request a change to this recommendation and enter exactly `Start Recommendation with Audit revision:` → version 1 must actually start with `Audit revision:`, the other rows stay, version zero remains, and the checks run again. Approving version/hash zero must give `DELIVERY_CHANGED`. In Simulation, the prefix command and targeted evidence clarification are supported; an unsupported free-form rewrite is rejected before consuming the correction opportunity. With the real model, the request, target section, checks and previous output reach the runtime.

In the real test, the llama.cpp log showed that the regex escape `\S` was unsupported and the constraint degraded to "any string". The compatible constraint `[^ ]` replaced it and an independent result check was added: a model ignoring the prefix gets `MODEL_REVISION_NOT_APPLIED` and the successful result is not substituted. This was a real limitation in this runtime's JSON Schema/grammar subset; [upstream grammar docs](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md). [Real model test after the fix](orby-real-revision-preflight-1.4.1.json). The rejected run was closed with [a dispute, zero award and a full refund of the original escrow](orby-revision-regression-refund-1.4.1.json); the previous output and acceptance history were not rewritten.

8. Review settlement → see the amount, fee, creator share and refund → the user signs the current version → the receipt and the final transaction links are shown. A hash or a closed wallet window alone is not success; the final RPC and the on-chain receipts are checked. An uncertain operation is reconciled first. In Simulation, the completion message and receipt claim no real chain payment or link.

## Repeatable demo data

While the launcher database is running, from the backend:

```powershell
npm run demo:seed:samples
```

Settings → Switch demo account → Demo / Sample workspace → Enter simulation: fifteen sample jobs across three topics appear, covering open, funded, executing, review, corrected delivery, settled, cancelled, refunded, failed-check, timeout/recovery and stopped states. There are two Knowledge items, two Templates and one stopped Program. No sample schedule is active by default.

All of these are fabricated, labeled snapshots living in the `samples.demo` account; they do not enter real agent success statistics and carry no fake transaction hashes or real-model claims. The invoices are built with the existing Simulation logic; transfers attach to the same job and the ledger stays balanced. Re-running creates no duplicates and does not erase user data. Samples must be Copied for live execution; a fixed sample receives no payment or re-execution. The real test and the video run with a fresh job from scratch.

## Verification commands

```powershell
# backend; local database running
npm test
npm run test:integration
npm run contract:test
npm run backup
npm run backup:verify

# frontend; application and the fifteen samples prepared
npm run test:e2e

# development-account owner only: real signing and testNEAR spending
# this command deliberately requires --run and development keys are not distributed
node --import tsx tests/reliable-demo-testnet.ts --run
```

Google Sheets stays disabled with a clear reason while OAuth is absent. Mainnet quotes, Simulation balances and testnet balances are never mixed. Public release, public hosting and contest submission were not performed; the repositories remain private at the owner's request. No claim is made of human HOT/Meteor signing, an independent audit, mainnet payment, TEE or a multisig.
