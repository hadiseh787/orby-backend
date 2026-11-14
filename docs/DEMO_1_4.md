# Real Orby 1.4 demo — 14 November 2026

This release completes the existing path: the user request, an editable agreement proposal, the model plan and spending-cap approval, specialist hiring, one bounded recovery, real model output, client approval and NEAR Testnet settlement. The overall design, real lending, complex credit, TEE, a multisig and real mainnet payment were not added.

## Running on this system

The active installation lives in `C:\Projects\Orby`. Commands run from the `backend` folder:

```powershell
npm run local
```

The same launcher brings up PostgreSQL, the API, the worker, the local model and Angular together. Stop: `Ctrl+C` or `npm run local:stop`. The start/stop files of the old IDE folder also redirect to this active version; the old source was not deleted.

This machine's real model is `Qwen2.5-1.5B-Instruct-Q4_K_M`; CPU execution uses llama.cpp `b12375` with a local OpenAI-compatible API. No OpenAI service or paid API is needed. The model and runtime downloads were verified by SHA-256 against the primary source. The model and the keys are not in Git.

## Installing from source without secrets

1. Install Git and Node.js 24 with npm; Node 22.19 is also supported. The Angular CLI, Docker and a system-wide PostgreSQL service are not needed.

2. Clone the backend repository and run `npm run local`. The launcher fetches the frontend at the commit recorded in `workspace.json`, installs the lockfiles, builds the local configuration and database, and runs the 10 migrations. Both repositories are currently private and access to both is required. If a ZIP of both sits side by side, the `--frontend` path is also supported.

3. To install the real model on Windows x64:

```powershell
npm run local:stop
npm run demo:model:setup
npm run local
```

The model is about 1.12 GB and the first setup needs internet and disk space. A partial file does not activate before the hash is verified. Setup writes the non-secret model settings into the local `.env`. The model comes up with the same launcher; a separate terminal is not needed. On other systems, install Ollama and a model, then set `OLLAMA_MODEL` and `OLLAMA_URL`. Linux/macOS execution was not tested in this delivery.

4. Real testnet requires the contract owner's configuration and the executor's restricted signer. `.env.example` is the key-free template. This machine's private information must not be added to a clone or the README. For independent deployment, the Contract build and deployment section of the README covers building the WASM, optimization, the faucet and `near:deploy`. The deployment owner must supply the policy and the testNEAR balances of their own accounts. Testnet tokens have no monetary value.

## The "do → see" path

1. In the admin panel, RPC must be `CONNECTED` and the model `READY` with the model name. A merely filled environment variable does not report a successful connection.

2. Connect a testnet wallet → the NEP-413 message with nonce and account is verified server-side. The connected account is not the same as the confirmed session unless the signature is valid. Standard injected wallets for local discovery do not depend on the internet registry; the redirect wallet picker still needs the SDK's primary registry and the internet. No external registry or executor is pinned inside the application.

3. Create a job → open Draft an agreement from your goal; enter the goal and apply the model's proposal. The text and criteria are editable; the sources and the budget are reviewed by the client itself. On testnet, enable the Agent-managed mission option. This path uses the Brief Writer and one of the permitted specialists; it is not a free-form graph designer or unlimited search.

4. For the recorded sample, three example sources and a job budget of 4 testNEAR were used. Publish → the client signs only the agreement creation; no hiring or payment has happened yet.

5. Choose a proposal → select the Brief Writer's proposal in the Execution plan section. Generate real mission plan → the model proposes the bounded stages and picks the specialist. The server applies the registered real price, policy and spending cap; the model's amount is not financial authority.

6. Before execution, the costs are visible: award 4, maximum escrow 4.4, including a 0.4 refundable buffer. The client cap is explicitly confirmed. The specialist cost in the recorded run is 1 testNEAR from the creator's balance; it is not charged again from the client's escrow. Approve plan and fixed budget → only plan consent is recorded; the funding signature is separate.

7. To demonstrate failure, enable the controlled first specialist check failure before generating the plan. This flaw is explicit and specific to the accelerated local demo; it is not a claim of random model error. Review funding → the amount and the gas cap are shown and then signed with the wallet.

8. View execution → the child job is really created on the contract and funded from the creator's balance. The first attempt is rejected per the demo option; the contract opens a correction version. Only one correction attempt is allowed and it reuses the same escrow. A timeout also records an indeterminate result; the same model-execution id is not blindly resent. If the correction also fails, the job stops and a client/arbitration decision is required.

9. In accelerated mode the child review window is 90 seconds; this wait was not cut from or faked in the video. After the specialist settles, the main model builds the final output from the accepted evidence.

10. Review delivered output → inspect the text, citations and criteria. Review settlement → award, fee, creator proceeds and refund are shown before confirmation. The preview is bound to the output's version and hash and expires. Approve & settle with the wallet confirmation → real testnet settlement.

11. Receipt → Build receipt preview and Verify receipt → `VERIFIED_CONTRACT_STATE` with the transaction links. The private/redacted version and the evidence ZIP remain available.

12. View balance from the client page → a dedicated balance and history page, separating contract claims from the wallet's own balance. The Mainnet top-up preview section only gets a real `dry:true` quote. Network, token, amount, estimated received, expiry and fee information are shown; there is no deposit address, signature, transfer, swap or balance increase.

## Evidence and costs

- `orby-real-mission-1.4.json`: the real path, three model attempts for two specialist versions and one main output, the unchanged specialist cost, contract settlements and transaction hashes.
- `demo-1.4/`: the full WebM video and application screenshots, output, the settlement window and the verified receipt. The video was recorded with a development wallet that signs real messages and transactions with Git-ignored development keys; human HOT/Meteor signing is not claimed.
- `orby-intents-safe-mode.json`: the live quote and unchanged balances. The 25 bps rate is only the published surcharge estimate of the keyless request; it is not the total route fee. An unitemized provider fee is not presented as zero.
- The receipt shows the creator's proceeds, the settled cost and the specialist escrow, the fee and the balance before unpriced costs. Token usage and model time are recorded. The local API has no monetary billing; electricity, hardware and the full gas allocation are unpriced, so the remainder is not called "profit".

An early real run produced a two-word Recommendation and, even after one correction, still failed the length criterion. It received no main payment and was refunded in full to the client through the normal contract path; the evidence is in `orby-real-model-regression-refund.json`. The length constraint was fixed in structured generation along with the prior error feedback, and the next full run passed. No previous output or check was rewritten to make the demo pass.

## Tests and scope

```powershell
# backend, with PostgreSQL running
npm test
npm run test:integration
npm run contract:test
npm run build
npm run backup
npm run backup:verify

# frontend, after the launcher is ready
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4200'
npm run test:e2e
```

The database tests create a separate temporary database and drop only that one. The timeout and fake-HTTP tests are reported separately from the real model/testnet testing. The API rate limit was not turned off. The testnet loop, the simulation, the programs and the Quality Lab are independent so that waiting on RPC does not stall the simNEAR queue.

Re-recording the real scenario is optional and specific to the owner of the development keys:

```powershell
$env:DEMO_ORIGIN='http://127.0.0.1:4200'
node --import tsx tests/mission-demo-testnet.ts --run
```

This command consumes testnet faucet NEAR and, without the UI confirmations, the application and the wallet, it creates no costs. For a public judge, the video and the public receipts suffice; the development keys must not be distributed.

Google Sheets is disabled with a clear message while OAuth is absent, and this connection does not block the main path. The internet is required for RPC, quotes and external wallets. Semantic correctness of all model claims, an independent security audit, mainnet execution, TEE and a multisig are not claimed. The code LICENSE exists; the repositories remain private. Public release, the X post and the final submission happen only with the project owner's coordination.
