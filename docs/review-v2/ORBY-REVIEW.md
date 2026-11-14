**Independent review report of the ORBY project, version 1.2.0**

Second edition of the document: the review report of the examined version together with six development proposals, technical details, acceptance criteria and the delivery order. The score of 85 belongs to that earlier review; the new proposals have not been implemented or reviewed in this round. For the next release, fixing the findings first and then the "complete work receipt" and "execution rehearsal" are recommended.

Review date: 8 November 2026. Basis: the two ZIP files inside `D:\NEAR Hackathon\ORBY`.

**Current score: 85 out of 100.** The project is in good shape regarding execution, interface and the main order flow. To pass 95, fixing the contract storage logic and several incomplete behaviors takes priority. Adding more features does not compensate for these errors.

This score is my strict assessment with the weights declared below. The contest has published no official numeric weights or a 95 threshold; the final decision rests with the human judges. Per the official page and Q-017, first-stage screening looks at project execution and at behavior matching the README. [Official contest page](https://nearhackathon.com/)

**Scoring basis**

| Axis | Cap | Score | Reason |
|---|---:|---:|---|
| Independent execution and reproducible package | 25 | 25 | Install from ZIP, both builds, database, migration and worker succeeded. |
| Working declared capabilities | 30 | 23 | Private knowledge dropped from the model input: 3 points; child settled with a failed check: 2; Sheets recovery: 1; DST scheduling: 1. |
| Financial safety and transaction state handling | 25 | 17 | Uncontrolled storage cost and growth: 6 points; public version-less approval path: 2. |
| Interface, user paths and accessibility | 15 | 15 | The reviewed paths worked; across eight views no automated WCAG errors, overflow or JavaScript errors were seen. |
| Claim transparency and contest-track fit | 5 | 5 | The simulation/testnet/optional-model/simulated-credit boundaries are clear; the Agent Economy track fits. |
| Total | 100 | **85** | A quality score for the examined version; release requirements were assessed separately. |

No points were deducted in this assessment for having no active users, revenue, mainnet, paid API, commercial audit, or for not using every ecosystem project. These are not declared contest conditions. Per Q-010 and Q-011, testnet is accepted and no specific protocol integration is mandatory. Per Q-012, for a purely local demo a public repository, a reproducible guide and an X video are required. [Current official rules](https://nearhackathon.com/HACKATHON.md)

**What was actually reviewed?**

- Both ZIPs were extracted into an independent folder. Installation with the lockfile and the TypeScript and Angular builds succeeded. The application ran on port 14420 and the database on 15433.
- 13 unit tests and 23 integration tests passed on a temporary database. The three Rust tests for the financial arithmetic library also passed. The 10,000-case financial test is the number of cases inside the test, not 10,000 independent tests.
- The full browser run had 18 passes out of 19. The single failure was fetching the wallet list under the review environment's network restriction. Rerunning the same file on a normal network passed all three of its scenarios. So all 19 distinct scenarios passed across the two runs combined; I do not claim a single 19-of-19 run this round.
- Across eight real views, desktop and mobile screenshots, JavaScript errors, horizontal overflow and the automated WCAG 2 A/AA and 2.1 AA rules were checked; nothing was found. This does not replace a full human accessibility audit.
- The public contract `af-contract-1793954330698.testnet` was read from RPC. The code hash matched the deployment document in the package. The order introduced in the document was in `SETTLED` state; the approval and withdrawal receipts and the successful withdrawal callback event were also checked.
- Seven additional independent tests, on a local copy, reproduced the six groups of findings below. Passing those seven tests means "the findings are confirmed", not that the product is healthy.

No transaction was sent to the network during this review. The collaborator's key was not used, no real Google account was connected, and no product code was modified. The original ZIPs remained with their initial SHA-256.

**Strengths to keep**

The order flow — proposal, escrow funding, delegation to a child agent, delivery, correction and settlement — is implemented. Recording the client decision against the output version in the API, separating dispute from approval, idempotent request recording, CSRF and ownership checks, and separating simulation from testnet are valuable. Money arithmetic is done in integers. The transaction receipt is matched against signer, contract, method and arguments, and the withdrawal depends on a successful callback.

The English interface is orderly and understandable; job creation is staged, with drafts, a payment preview and recoverable states. The project is explicit about the default deterministic model, optional Ollama, simulated credit and trust in the arbiter/evaluator. The testnet data is not merely a screenshot or display number; it has readable public receipts.

**Finding 1: data growth can tie user-owned liquidity up in storage**

Priority: immediate, P1. Score deduction: 6 from the safety axis.

In the contract, job information, balances, requests and withdrawals live in plain `BTreeMap`s. Every new request creates a permanent history entry. The `new_allowed` control compares the account's total balance against past storage costs; it does not set aside the contract's debt to users or the space growth of this very operation. The order id also has no length cap on this input. An agent price change does not even pass this balance control.

In a local test, an order with a 3,000-character id was accepted and the contract state grew by 6,460 bytes. At the test environment's rate this growth cost 0.0646 NEAR, while the sponsor's free budget was set to only 0.02 NEAR; the user's 1 NEAR claim remained fully recorded. In a separate test, ten price changes were accepted in the paused state with zero attached deposit and added 1,720 bytes of history.

This is local proof of the control and backing calculation flaw; an unsuccessful withdrawal or an attack on the deployed contract was not tested. Nor was the real gas failure threshold measured. Still, unbounded state growth raises the read and write cost of every method; the withdrawal callback currently has 15 TGas. The NEAR documentation likewise recommends SDK storage collections for growing data. [Official collections documentation](https://docs.near.org/smart-contracts/anatomy/collections)

Required action: separate the users' payable debt from the operational budget; pay the real space growth of each operation from the storage deposit or a bounded sponsor budget; cap the length of all ids and inputs on the contract itself; keep histories under a clear retention policy; migrate to `near_sdk::store` while preserving balances. Deleting idempotency history must not reopen the possibility of replaying an old payment.

Acceptance criteria: no accepted write consumes the backing of user debt; the paused state and an insufficient deposit prevent unnecessary growth; withdrawal and callback succeed at the target data volume with a measured gas margin; the migration preserves debt and escrow exactly.

Code locations: `contracts/orby-market/src/lib.rs`, lines 96, 191, 200, 827, 970 and 1049. Evidence: `contract-probe.log` and the tests in `contract-probe/src/lib.rs`.

**Finding 2: private knowledge does not reach the model on the delegation path**

Priority: high, product-level P1. Score deduction: 3 from capability functioning.

The user selects the knowledge set and the correct snapshot is stored in the order. But the Brief Writer, after the child agent's work, replaces the input with two fields of sources and the child's output hash. The `knowledge` field is dropped. The testnet path has the same replacement pattern. The default deterministic run also does not consume private knowledge at all.

An independent test with a local HTTP model captured the actual prompt: the order contained a knowledge set, but the knowledge field and the marker phrase inside it were absent from the model input. So the problem is not model answer quality; the data never reached the model.

Required action: define a shared versioned input for direct and delegated runs; keep the permitted knowledge and source ids when merging the child output. For the deterministic mode, make the supported behavior explicit; if it is not meant to consume knowledge, offering the selection must not be presented as if it affects the answer.

Acceptance criteria: the knowledge marker text reaches the authorized model; later edits to the set do not change the order snapshot; another account's knowledge is not retrievable; the child output does not drop essential information.

Code locations: `src/worker.ts:94`, `src/near.ts:503` and `src/runtime.ts:47`. Evidence: `runtime-probes.log`, test one.

**Finding 3: the child agent settles with a failed check in simulation**

Priority: high, product-level P1. Score deduction: 2 from capability functioning.

In the simulation worker, the child's criteria results are computed but not checked before settlement. The test forced a two-row cap; the child delivered three rows, the result was `FAIL`, but the child order became `SETTLED` and a full simNEAR was paid. The recorded settlement reason was also wrongly "checks passed".

This error was reproduced on the simulation path; I do not generalize it to incorrect payment on testnet. Divergent behavior between the two environments moves the demo away from the expected logic.

Required action: a failed mandatory check must stop settlement and, per the contract, move to correction or dispute. Define the child's acceptance rules to fit its own work and use shared logic across both environments.

Acceptance criteria: with the same rejected input no income credit is recorded; after a valid correction, payment happens exactly once; the settlement reason matches the actual evidence.

Code locations: `src/worker.ts:67` and `src/worker.ts:86`. Evidence: `runtime-probes.log`, test three.

**Finding 4: the legacy approval path does not require the output version and hash**

Priority: high, P2. Score deduction: 2 from the safety axis.

The `approve_delivery` method checks the version and hash, but the public `approve_job` method remains open for native NEAR orders too. The test showed an old version being rejected by the new method, while the same order's version one was settled via the old method with just the order id.

The client's signature is still required; this finding is not proof of unsigned theft. The issue is that the "same reviewed output" requirement is not enforced across all contract paths.

Required action: keep the settlement logic in an internal function and close the version-less public path for new contracts; if needed for history, limit it to legacy orders only. A repeated request must also stay bound to the same operation's method, version, hash and real effect.

Acceptance criteria: for a new order, all public approval inputs without a hash or with a stale version are rejected; a valid repeated request creates no second payment.

Code locations: `contracts/orby-market/src/lib.rs:697` and `contracts/orby-market/src/lib.rs:714`. Evidence: `contract-probe.log`, the legacy approval test.

**Finding 5: Sheets output recovery gets stuck on a narrow range**

Priority: medium, P2. Score deduction: 1 from capability functioning.

If the range is `Results!A1:G20` and data is appended at the end of the sheet, the new row may fall outside that range. If the append response is lost, recovery re-reads only the previous range; it does not see the output marker and stays in `UNKNOWN`. In the fake HTTP test, 25 rows were actually recorded in the service memory, the read returned only the first 20 rows, and the next preview stayed closed with `EXPORT_UNKNOWN`. No second write happened; avoiding duplication is good, but the recovery path is incomplete.

Required action: define the destination range and marker search so they cover the append output; for example an independent destination and a marker column with a bounded, paginated search. Recover the uncertain state without blind writes, and also test the scenario of the process dying after the external write.

Acceptance criteria: a dropped response, leaving the initial range and restarting the application all lead to detecting the same output; no duplicate row is added.

Code location: `src/google-sheets.ts:79`. Evidence: `runtime-probes.log`, test four. No real Google account was used in this test.

**Finding 6: weekly scheduling breaks on daylight-saving changes**

Priority: medium, P2. Score deduction: 1 from capability functioning.

Sunday 02:30 in `America/New_York` does not exist on the spring-forward day. The function only checks nine days and, from the previous Monday, never reaches the following week. Calling it with a base of `2027-03-08T12:00:00Z` errored. Because creating, continuing and updating the schedule depend on this function, the policy for this state must be explicit.

Required action: define a clear policy for the nonexistent and the repeated hour; reject with a clear message, shift to the first valid time, or move to the next occurrence. The schedule must not simply die with an internal error.

Acceptance criteria: tests pass for normal time, the spring-forward change, the repeated fall hour and month rollover across several timezones.

Code location: `src/programs.ts:15`. Evidence: `runtime-probes.log`, test two.

**Additional items without a separate score deduction**

A fresh npm audit for the backend reported fifteen items in the dependency chain: one High, two Moderate and twelve Low. For the frontend, sixteen Moderate were reported, all in the dev tooling tree. These numbers are not the count of independently exploitable vulnerabilities in the application. The High item concerns `@fastify/static` and depends on files whose protection rests on the path guard. In ORBY the static path is for the public frontend files and private files come from the authenticated API; exploitation of private data was not proven in this review. Upgrade the dependencies or record a vulnerability reachability assessment; blindly running `npm audit fix --force` is not recommended. [Fastify maintainer advisory](https://github.com/fastify/fastify-static/security/advisories/GHSA-83w8-p2f5-377r)

For contract financial testing, three arithmetic tests alone are not enough. Add an independent behavioral suite for transfer failure, repeated callbacks, insufficient deposit, concurrency, role permissions, version change and migration. This recommendation is for closing this product's risks; a monetary audit was not made a scoring condition.

The real wallet was tested up to showing the picker and cancelling. Human signing with Meteor/HOT, running the real Ollama model, connecting a real Google account, IPFS and Linux/macOS execution were not done in this review. Historical testnet receipts were read; a fresh deployment or full source reproduction down to the deployed WASM hash was not done.

**Contest submission requirements, separate from the quality score**

Both GitHub addresses given in the README returned 404 to anonymous access. That response alone does not distinguish private from nonexistent, but they were not reachable for a public judge; the README also describes them as private. A public version and a specific commit must be ready by the submission deadline. The ZIPs contain the font license, but a LICENSE file for the project code was not found. A public X post link and a demo video were also not confirmed in the reviewed package.

Publication actions: make both required components public and reachable from the main README; add the code LICENSE; prepare a video of one complete path and an X post with the contest tags; the build history within the allowed window, and the boundary of older code if any, must be clear. If one person competes in both projects, disclosure of the other project per Q-015 is required. None of these publication actions were performed in this review. [Official submission guide](https://nearhackathon.com/HACKATHON.md)

**Proposed path to pass 95**

| Order | Work | Delivery criterion | Focused development estimate |
|---|---|---|---|
| 1 | Fix storage accounting, input control, contract collections and the approval path | Close findings 1 and 4; migration and withdrawal tests at target data volume | 12 to 20 hours |
| 2 | Fix the knowledge input and the child payment gate | Close findings 2 and 3 in direct and delegated runs | 5 to 8 hours |
| 3 | Fix Sheets recovery and the weekly schedule | Close findings 5 and 6 with dropped-response and DST tests | 4 to 6 hours |
| 4 | Final tests, a fresh receipt and the public judging package | Clean tests, a precise guide, LICENSE and a reproducible video | 5 to 8 hours |

My total estimate is 26 to 42 hours of focused work for a developer familiar with this code and Rust; typically four to six working days. Contract migration complexity can extend it. This time does not include waiting for Google access or approval. The main fixes can be done with local tools and testnet, without a paid API.

With findings 1 through 4 fixed, the 13 deducted points are reviewable and a target of 98 is defensible within this table; only after a rerun with no new errors. For safety, close findings 5 and 6 as well. This calculation is not a promise of a contest score.

Choose new capabilities after these steps. The highest presentation value is a "complete agent collaboration receipt": the output version and hash, pass criteria, each child's cost, the remaining balance and the settlement link shown together. Most of its data already exists. Showing a real Ollama run with selected sources and knowledge also displays the product difference better. These two proposals do not replace the financial fixes or any official contest condition.

**List of evidence accompanying the report**

Install and build logs in `startup.log`; test results in `unit.log`, `integration.log`, `rust-financial.log`, `browser.log` and `wallet-recheck.log`; bug proofs in `runtime-probes.log` and `contract-probe.log`; the fresh rules in `HACKATHON.current.md`; public chain data in `public-evidence.json`; the repository check in `public-repositories.json`; screenshots and the accessibility result in the `ui-evidence` folder.

The hash of the received official rules equaled the previous version of the rules: `903794f4b656b456eaee087941517d024a33633641d167b90c3f060d381d9aed`. The machine-readable score and findings are recorded in `review.json`. The original ORBY files were not changed.

**Completing the ORBY product: six proposed development features**

This section is a development proposal based on the code and behavior of the reviewed version. The capabilities below have not been implemented or tested within this scope, and the project's current score remains 85 out of 100. The priorities in this section are for choosing the next work; they do not change the priorities of the findings in the review report.

Proposed product goal: the client can order work with a defined output, understand the limits before paying, and after completion inspect the output quality and the money trail. The agent creator can likewise offer testable capability and get paid within the agreed framework. The product interface stays English; the English names below are proposed for menus and design.

**Feature selection order**

| id | Feature | Priority | Type of change vs the current version | Person-hour estimate |
|---|---|---|---|---|
| Capability 1 | Complete work receipt and evidence pack; Work Receipt | High, first choice | Completing existing display, decisions and receipts | 6 to 10 |
| Capability 2 | Order execution preview and rehearsal; Execution Rehearsal | High, second choice | A new experience over the existing rules and financial preview | 8 to 12 |
| Capability 3 | Selective knowledge access; Scoped Knowledge | High, after the knowledge-transfer fix | Finer control and display of data sharing with agents | 8 to 14 |
| Capability 4 | Agent quality lab; Agent Quality Lab | Medium | Standardized version testing; complements the existing sample test and paid trial | 8 to 14 |
| Capability 5 | Team workspace; Team Workspace | Medium | Membership and team review flow with a clear paying owner | 20 to 32 |
| Capability 6 | One round of price counteroffer; Counteroffer | Later | Bounded negotiation over the existing price proposal | 12 to 20 |

These estimates cover implementing and purposefully testing the same capability and are a first estimate for a developer already familiar with the project. Fixing the six reported findings has a separate time cost. The weekly schedule, staged project, paid trial, templates, the action inbox and the Sheets connection already exist; rebuilding them as new features is not proposed.

If only two capabilities are chosen, my recommendation is the complete work receipt and the execution rehearsal. Both are close to the product's core problem and, without adding financial dependencies, improve the demo and everyday use.

**Capability 1: complete work receipt and evidence pack**

Interface names: `Work Receipt` and `Download Evidence Pack`.

Problem: the order information, the child agent, the output review, the approval and the payment live in several places. To understand what was delivered and what was paid for, the user has to piece them together.

Proposed behavior: every order gets a receipt page. The top shows the final result and the actual amount. Below, the path "agreement, funding, delegation, delivery, review, decision and settlement" is shown with times and evidence. The child order appears expandable under its parent. The child's money source is the agent creator's balance; it must not be mistakenly shown as another draw from the client's escrow.

First-version scope:

- Show the agreed budget, escrow amount, creator share, fee, refund and bond in the exact unit of that environment.
- Show the output version and hash, each criterion's result, the decision-maker's identity, and the separation of client approval from a dispute ruling.
- Show the transaction hash, final status and the withdrawal callback result; the uncertain state stays visibly separate.
- A versioned JSON export for technical review and printable HTML for the user. The private export goes only to authorized people.
- A `Verify receipt` section comparing the receipt with readable contract data; a missing RPC must lead to a "cannot verify" state, never wrongly shown as invalid or verified.

Implementation plan: a readable receipt service gathers existing data from the order, output, decisions, ledger and chain operations. The response includes `schemaVersion`, `generatedAt`, `book`, `jobId`, the contract id, the output version and the evidence for each stage. For every field, the origin — "contract", "application record" or "simulation data" — is explicit. A transaction id and hash alone are not evidence of output correctness or of a human review having happened.

NEAR's role: amounts and operation results are proven from the contract and on-chain receipts. The first version of this feature needs no new transactions. Keep RPC load controlled with a short cache and an observation timestamp; final payment verification still follows the current finality rules.

Privacy: the shareable version needs a preview and must remove private sources, knowledge text, files and connection tokens. Do not build a public receipt or a permanent link without explicit consent. A public hash is not equivalent to text confidentiality either.

Acceptance criteria: the sum of the amounts equals that order's settlement; a change to the receipt file content is detected in the verifiable section; an unauthorized account cannot fetch the private receipt; a corrected order shows the approved version; a dispute ruling is not displayed as the client's approval; an uncertain transaction is not labeled successful.

Dependency: fixing the legacy approval path and the child payment. Product value: an understandable client receipt, fewer disputes and a clear presentation of NEAR's role in the demo. Paid service needed: none.

**Capability 2: order execution preview and rehearsal**

Interface names: `Execution Plan` and `Run Rehearsal`.

Problem: a payment amount preview is not enough for the user to know whether the whole path is executable; the agent's balance, bond, data access, deadline and output criteria also matter.

Proposed behavior: before funding, the client sees the order's execution plan: the chosen agent, the known stages, any delegation, where costs come from, the spending cap and the acceptance criteria. With a rehearsal button, the same plan runs in a separate environment with controllable scenarios and shows the stopping points.

First-version scope:

- Compatibility check of the brief and criteria, including contradictory minimums/maximums or a citation requirement without a valid source.
- Check the budget cap, required balance, free bond, delegation permission and the proposal deadline.
- Show the current path up to one level and three children; avoid building a free-form graph designer or running arbitrary code in this version.
- Run three scenarios: the success case, a rejected child output, and a disconnection while receiving the payment result.
- Show the difference between "rule simulation" and "real balance or receipt check"; a rehearsal is no guarantee of future success.

Implementation plan: independent records in `rehearsal_runs` store the input snapshot, the rule version and the stage report. These records must not change the real ledger, the financial execution queue or `chain_operations`. Financial validation and acceptance criteria should reuse the application's domain functions as far as possible so no contradictory second logic is created. Amounts stay integer strings and computation stays in BigInt.

If the user changes the budget, agent, source, criteria or policy version after the rehearsal, the previous report becomes "stale". At real payment time, balances, proposals and conditions are checked again. An old rehearsal result must not be used as spending authority.

NEAR's role: balances and policy can be checked read-only from testnet; the rehearsal itself is internal and needs no signature. The report must explicitly say this run is not a real NEAR virtual-machine dry-run. Later funding still goes through the preview and the wallet signature.

Acceptance criteria: the count of financial operations and the balances are unchanged before and after the rehearsal; the same input with the same rules gives a reproducible result; a bond shortfall is visible before payment; a rejected child output never reaches a simulated successful payment; changing any financial input invalidates the previous report.

Dependency: closing the child-settlement bug and cleanly separating the budgets. Product value: preventing incomplete orders, simpler setup and a repeatable demo. Paid service needed: none; a language model is not needed for this version.

**Capability 3: selective knowledge access and usage display**

Interface names: `Knowledge Access` and `Data used in this run`.

Problem: choosing private knowledge must have exact meaning for the user: which agent has access to which part, which snapshot was consumed, and what data moves on delegation? The fix for knowledge being dropped from the prompt is the foundation of this capability, but by itself it does not answer these questions.

Proposed behavior: when selecting a knowledge set, the user sees the main agent's and the child agents' access separately. By default, knowledge is allowed only for the main run. A child receives only the specific data permitted for its own work. After the run, the order page shows the set names, the snapshot version and the authorized recipients.

First-version scope:

- Select the allowed sets per stage with a preview of the data that can be sent.
- Record an immutable snapshot for the published order and record which run used which snapshot.
- A clear stop when a stage lacks access to needed data; sending all knowledge to a child must not be the default solution.
- Label deterministic vs Ollama runs and show the data sent to the local model, without needlessly storing private prompts in the public log.
- The ability to revoke access for future runs; explain that revoking access does not claw back data already delivered.

Implementation plan: the proposed `knowledge_grants` model holds the owner, order, snapshot, destination agent or stage, usage scope and status. Each stage's input is built by one shared function with ownership checks. A `run_input_manifests` table records the ids and versions of permitted inputs; private text is not written to the public operations log. A child job must not inherit the parent's entire `input` unfiltered.

NEAR's role: knowledge text does not go on-chain. If data permission must be part of the payment agreement, include a versioned digest of the grants in the agreement commitment and confirm it before publishing/paying. This connection needs a review of the agreement serializer and contract compatibility. The first version can keep the details in the permitted database; in that case only commitments actually recorded on-chain are presented with an on-chain proof label.

Acceptance criteria: the permitted knowledge token is present in the main model's input; the same token is absent from an unauthorized child's input; changing the set after publishing does not change the order's snapshot; another account's access is denied; the public receipt does not leak knowledge text; a source that never reached the model is not shown as "used".

Dependency: fixing the second finding of the report. Product value: trustworthy use of company information and clarity about agent access boundaries. Paid service needed: none; this is application-level access control and claims no TEE or confidentiality against the server administrator.

**Capability 4: quality lab and agent version compatibility**

Interface names: `Agent Quality Lab` and `Compare Versions`.

Problem: a sample output and a few successful jobs are not enough for the client to know what quality a new agent version has under specific conditions. ORBY already has samples, statistics and the paid trial; this proposal adds a standard, reproducible test suite.

Proposed behavior: the creator can test an agent version on a fixed sample input set and see a report of criterion pass rates. The client, on the profile, sees the agent version, execution type, test count, run date and result limits. Comparing two versions runs on the same set.

First-version scope:

- One fixed set for the three existing job types: text comparison, source extraction and structure review.
- Scenarios for an incomplete source, text with a malicious instruction, a word cap, an invalid citation and a targeted correction.
- A report of pass percentages per defined criterion, run time and a sample error; the result comes with the sample count.
- A data-origin label: internal sample, creator test or real order. Seeded data is not merged into real performance.
- Compare manifest and model versions; one version's success is not carried over to a changed version.

Implementation plan: the proposed `benchmark_suites` and `benchmark_runs` tables record the input version, the settings hash, the output and the criterion results. Running the internal set is not tied to money or escrow. If the user sends a test as a real order to another agent, the existing paid-trial path is used with clear cost and confirmation. A language model can add explanatory text; the decisive score is computed by the test rules.

NEAR's role: real-order results can link to the order id and the settlement receipt. An internal test result does not count as network confirmation. A pass percentage also speaks only about these data and criteria and does not prove the correctness of every output claim.

Acceptance criteria: re-running the deterministic mode on the same version gives the identical result; a fabricated citation is rejected; changing the model or manifest stales the report; seeded data does not enter the real order success rate; a paid trial is never created without client confirmation.

Dependency: correct acceptance criteria and a readable receipt. Product value: better agent choice with concrete evidence, catching quality regressions before release, and evaluable evidence for the demo. Paid service needed: none; local deterministic testing suffices and Ollama stays optional.

**Capability 5: team workspace with a clear paying owner**

Interface names: `Team Workspace` and `Review Queue`.

Problem: in professional use, the person ordering, the person reviewing output and the payment authority are usually not the same person. The current version relies mostly on account ownership.

Proposed behavior: a team has its own orders, knowledge and templates. An authorized member creates drafts, a reviewer gives an opinion on a specific output version, and the wallet owner signs the final financial action. Changing the output after review stales the previous internal approval.

First-version scope: three defined roles, `Owner`, `Member` and `Reviewer`. The owner connects the existing paying wallet to the workspace. A member can add drafts and permitted files; a reviewer can record opinions and recommendations; the owner performs payment and settlement. Membership happens via a one-time invitation accepted by the signed-in identity. Email is not required for the first version; the owner sends the invitation link themselves.

Implementation plan: add the `workspaces`, `workspace_members`, `workspace_invites` and `workspace_reviews` tables. Orders, files, knowledge, templates and the weekly schedule must carry a `workspace_id` boundary with identical access control. The migration creates a personal workspace for existing personal data and does not change the owner of previous contracts. An expired, used, or other-workspace invitation is rejected. A valid session alone does not replace the per-API role check.

NEAR's role: member identity uses verified wallet login. The login signature is not spending authority; the final transaction is signed by the contract-authorized account. Team review in this version is an application process, not on-chain multisignature. Make this separation clear in the interface. [Official backend authentication docs](https://docs.near.org/web3-apps/backend/backend)

Acceptance criteria: a team member sees no one else's orders or private files; a membership removal applies from the next request; a Reviewer cannot execute a payment; changing the output version stales the previous review; a different account cannot sign the wallet owner's financial proposal and record it as successful; previous orders remain accessible after the migration.

Dependency: data ownership control and stable versioned approval. Product value: real-world use for agencies and small teams. Paid service needed: none; because of the breadth of access control, this feature is best built after the core is stable.

**Capability 6: one round of price counteroffer within a set cap**

Interface name: `Request Counteroffer`.

Problem: the agent marketplace becomes more complete when the client can run a bounded, predictable negotiation over price. The official Agent Economy track sample also raises negotiation and a purchase receipt as ideas; these are not mandatory requirements of the contest. [Official Agent Economy track sample](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/07-agents.md)

Proposed behavior: for each proposal, the client raises a counterprice at most once, within their own budget. The agent accepts or declines by a defined rule and gives a short reason. An accepted proposal does not automatically spend from the wallet; the client must review and fund the final proposal.

First-version scope:

- Negotiation is over price only; scope, criteria and deadline do not change at the same time.
- The price floor, budget cap and validity time are defined. A price below the agent's registered floor is not accepted.
- Responses follow a deterministic local rule; Ollama may only polish the explanation and must have no authority to change the financial limit.
- The history of the initial proposal, the client request and the final response is recorded with status and time.

Implementation plan: a `negotiation_rounds` table links to the order, agent and initial proposal and has a unique one-round limit. The final proposal gets its own id and goes through the existing `record_bid` validation and funding path. The contract's price floor is not bypassed without the agent owner's authorized change. Increasing the client budget or changing scope is not this order's negotiation and needs a fresh agreement.

Note on the current contract: registering a new bid does not automatically invalidate the previous one. In the simple version, every proposal stays valid until its own expiry and the user must confirm the exact chosen id and amount. If the product wants to declare a previous proposal truly cancelled, it must apply and test cancellation or an active-version field on the contract itself; a UI label alone is not enough.

NEAR's role: the final price and agent identity link to the on-chain bid and the funding transaction. A negotiation stored in the database is not an on-chain financial commitment before that step. The testnet version needs no NEAR Intents or paid API.

Acceptance criteria: two simultaneous requests do not create a second round; an expired proposal is not accepted; below the floor and above the budget are rejected; declining the negotiation moves no money; model text cannot change the amount; funding stays bound to the chosen bid.

Dependency: fixing the financial findings and the contract's idempotency tests. Product value: a more tangible display of the agent's economic decision and more pricing flexibility. Paid service needed: none.

**Shared technical guide for the developer**

The table, API and field names in this section are proposals; their current existence is not claimed. Match them against the current structure before migrating. The base stays the existing Angular, TypeScript, Fastify, PostgreSQL and Rust contract; a framework change is not required for this development plan.

- Interface: the capabilities live in the existing order details, agent profile and Workspace tools. Every state has a clear next action. Long tables become cards on mobile; financial numbers are shown with the environment's unit.
- Contract: money-movement logic, spending caps and signer authority stay in the contract. Storage changes go through versioned migration with debt-preservation tests. The presentation layer and model output must not be able to change these limits. [NEAR contract collections guide](https://docs.near.org/smart-contracts/anatomy/collections)
- Data: money amounts stay integers with an explicit unit; sample, simulation and testnet are never mixed. Knowledge text, private files and keys must not reach public events or the receipt pack.
- Operations: on an uncertain transaction status, reconcile first. Creating a fresh id and blindly resending is not recovery. Every financial effect and decision record is deduplicated by the same versioned input.
- Model: the deterministic mode runs without an external service. Ollama stays optional when installed locally; model failure is not hidden behind a fake success. Recording the model name and settings version is required for comparability.
- Cost: a paid API, domain, public hosting or an SMS service are not required for the proposed scope. The cash cost of local development can be zero; time, laptop resources and maintenance are not zero. Real on-chain execution still costs gas and storage; this plan relies on testnet.

**Proposed delivery order**

| Stage | Deliverable | Pass condition |
|---|---|---|
| Stage zero | Closing the six reported findings and stabilizing the contract | Reproduction tests become regression tests; migration and withdrawal pass. |
| Stage one | Complete work receipt | One direct and one delegated order are shown with reviewable version, amount and evidence. |
| Stage two | Order execution rehearsal | The success path and two failures are demonstrable without real financial effects. |
| Stage three | Selective knowledge access | Permitted data arrives and unauthorized data never appears in any stage. |
| Stage four | Quality lab | Comparing two versions on shared input and separating sample from real data work. |
| Stage five | Team workspace or price negotiation | Choose by audience: working teams, the team workspace; agent-economy focus, bounded negotiation. |

My proposed minimal package for the next professional version is the fixes plus capabilities one and two. The combined estimate is 40 to 64 person-hours. Implementing all six proposals takes roughly 62 to 102 person-hours beyond the base fixes; they should therefore not all be taken on as one short release's commitment. With two developers, the receipt interface and the contract tests can proceed in parallel after agreeing the schema, but the final review of any shared financial change stays joint.

**Proposed demo scenario for the collaborator and the judge**

A client creates a three-proposal comparison with a clear budget and criteria. The execution rehearsal shows the effect of a rejected child output. The client fixes the input and sees the financial preview. On testnet they sign the payment; the main agent delegates a specific piece of work to a child. The output and sources are visible; the client requests one targeted correction and approves that new version. The receipt shows the work result, the child cost, the shares and the settlement transaction together. If the selective-knowledge capability is built, it becomes clear before the run which stage receives which data.

For every demo part, the result's origin must be clear: local deterministic execution, a real local model, a simulated failure, or a real testnet transaction. The internal rehearsal is not presented as real on-chain execution. The video is recorded from the version whose commit and run instructions are the ones delivered in the README.

**Development delivery checklist**

- Every chosen capability has this document's acceptance criteria and its own related tests; a large number of tests without failure-path coverage is not enough.
- The client, agent-creator and admin paths are checked with separate accounts; wallet cancellation and network loss are tested on the same paths.
- A fresh environment starts without the collaborator's private files; the optional model or Google setup is separate from the base run.
- The contract version, application commit, migration file and fresh receipts are recorded in the release report; no completion claim is made for an unbuilt capability.
- The README and the video present only the actually delivered scope. The next score is set after reviewing the corrected version; no notional points are added to 85 for adding feature names.
