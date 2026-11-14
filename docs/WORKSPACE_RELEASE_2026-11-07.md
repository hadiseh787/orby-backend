# Orby 1.2 — full change-request implementation

Date: 7 November 2026. The reference for this round is the [saved copy of the document](ORBY_CHANGE_REQUEST_2026-11-07_workspace.txt). The user asked for all fixes and the development section to be implemented. The old exception "ignore item 1" applied to the previous version of the document; the current item 1, keeping drafts, was implemented. The report at the end of the document about another machine is not test evidence for this machine.

## The 12 main items

| Item | Delivered behavior | Check |
|---|---|---|
| 1. Drafts | Independent autosave per account and environment, recovery of title/sources/criteria and uploaded files, save status; a leave warning when the browser save fails | Browser refresh and account switching |
| 2. Validation | Invalid steps cannot proceed, error next to the field, focus on the error, cleared when fixed, server validation preserved | Browser and API |
| 3. Approval and settlement | An explicit decision with account, time, output version and hash; a separate history; compatible sample data; a dispute vote is not shown as client approval | Database and a real transaction |
| 4. Mobile | Job cards instead of a wide table, search and filter; no document overflow at 390×844 | Browser and screenshot |
| 5. Policy | Readable NEAR/simNEAR input with exact conversion to 24 decimals | Exact 2.5 registration in the API |
| 6. Price | The main price in NEAR/simNEAR on the card and profile; USD as a secondary estimate; legacy contracts keep their own financial rules | API and compatibility test |
| 7. Login continuation | Demo or wallet login continues into job creation; Enter demo is the main simulation action | Browser |
| 8. Full review | Brief, sources, files and rules expandable with a direct return to editing | Browser |
| 9. Criteria | Row count, word limits, the citation requirement and human confirmation before publishing are configurable | Browser and server |
| 10. Readability | Raw details moved into technical sections; Credit under Advanced finance appropriate to the role | Browser |
| 11. Quick access | A shorter introduction for the signed-in account, recent jobs, an action inbox and badge notification | Browser |
| 12. Agent selection | Readable sample input/output, privacy-respecting history, editable test input, statistics from real jobs in the same environment and no seeded samples | API and browser |

## Job-flow improvements

- Copy a previous job and a personal template from a successful job. The template keeps the brief and criteria; files, sources and the old budget are not carried over automatically.
- Select two or three bids and compare the server's real financial preview, delivery time, output and completion history; the selection still goes to paid review.
- Show the source and the witness phrase next to a citation; a quote appears only when the text exists in the source. Record "insufficient evidence" and request a correction on a specific row/recommendation.
- Numbered immutable outputs, a view of the changed section, one correction round per the contract, and approval of the exact reviewed version. Copy and download of the readable text together with the technical evidence.
- The action inbox is built from the current state: a new bid, output awaiting review, a correction or an approaching deadline. After settlement it leaves the inbox; technical events produce no separate notification.

## Development capabilities

| Capability | Implementation and practical boundary |
|---|---|
| Continuous hiring | A weekly schedule with timezone, a monthly escrow reservation cap, pause/resume and an independent order per run. Automatic financing is simulation-only and follows the user's explicit choice. On testnet every publication and payment needs a wallet signature. The schedule cap is a workspace reservation limit; a monthly auto-withdrawal authority is not on-chain. |
| Google Sheets | Real server-side OAuth, token encryption, importing up to 100 rows, job creation, an explicit append preview and confirmation, preserving existing rows and recovering an uncertain result. Setup requires an OAuth client owned by the owner; [setup guide](GOOGLE_SHEETS_SETUP.md). |
| Private knowledge | Private collections with a storage quota; only the selected collections are shared, as a fixed snapshot, in a job with the authorized party. Later edits to a collection do not change a published agreement. |
| Paid agent trials | Select 2-3 participants, an independent job and escrow, pay each successful participant, compare the real output and move the chosen agent into the main project draft. Selecting a winner does not cancel the other trials' payments. |
| Multi-stage project | A separate brief, budget, count/length/citation criteria and approval policy per stage; the next stage opens only after the previous one is SETTLED; pausing between stages. |

## Signing and contract

Before every user transaction, the account, contract, effect of the action, exact amount and gas are shown; cancelling without sending to the wallet is possible. Pending operations are bound to the account, environment and contract and can continue after a refresh. An uncertain hash is kept separate from a proven hash. The signer, contract, method, arguments, gas and amount are matched against the proposal. Success depends on RPC finality; a withdrawal additionally requires that contract's successful callback and request ID.

The simulation queue does not lease or consume testnet requests. An on-chain dispute is carried into the application's case file. `approve_delivery` is bound to the version and hash; `request_revision` commits the feedback. `release_unused_bond` moves only the free bond to the withdrawable balance and does not touch the reserved bond.

The existing contract `af-contract-1793954330698.testnet` was upgraded with a fixed data layout. All 8 jobs and 8 balances were preserved before the upgrade; [upgrade evidence](orby-workspace-upgrade.json) and [deployment fingerprint](orby-deployment.json). The contract structure version remains 2; adding the methods required no layout change. Old deployments must upgrade with this same code for the three new methods.

## Testing and evidence

- The production Angular and TypeScript builds succeed; the wallet connector's CommonJS warning remains.
- 13 unit/runtime tests and 23 integration tests on an independent temporary database pass; including settlement, concurrency, ownership, approved version, schedules, paying all participants, private knowledge, the action inbox and queue separation.
- The 3 native contract financial tests pass; the Node and Rust financial tests include 10,000 persistence cases.
- All 19 browser tests passed; desktop and mobile screenshots were also reviewed. Signature review and its recovery used a declared fixture, and the real financial flow used an independent testnet harness.
- A browser run through to testnet succeeded with NEP-413 signatures and real RPC: agent registration, policy, bond, job and file, bid, a price change without invalidating the bid, funding, delivery, on-chain correction, version 1, approval of that exact version, settlement, free-bond release and withdrawal with callback. 11 user transactions, separate from the worker transactions; [public receipts](orby-browser-testnet.json).
- Seven migrations were applied. A compatible PostgreSQL snapshot was restored to a fresh database; table dependencies, file contents, row counts and sequences were verified.
- Starting version 1.2 from a source-only archive without `.env`, frontend, dependencies or database passed: fetching the pinned frontend, installing both lockfiles, building, creating the database and the seven migrations; then a fresh job with private knowledge ran through worker delivery and approval/settlement. [Clean-run evidence](orby-clean-start-1.2.json).
- The Google connection HTTP test covers the one-time state bound to the browser, an encrypted token, no write before confirmation, preserving the previous row and reconciling an uncertain append. This is a fixture; a real Google account connection is not claimed.

The full browser suite runs respecting the API rate limit; the server does not lose its limits for the test. The final browser results are recorded in the [verification report](VERIFICATION.md).

## Running and owner-configuration items

Local startup is unchanged: in the backend folder, the `npm run local` command or the `start-local.cmd` file brings up both applications and PostgreSQL and the worker. Git and Node.js with npm are prerequisites; access to both repositories is required. There is no dependency on the project's historical folder. Data and keys were never committed; the frontend is pinned to a specific commit in `workspace.json`.

For live Google, the owner must configure a client ID/secret and Google account consent; without it only this connection is disabled. For an LLM, Ollama and a separate model are required; the default demo run is deterministic and limited to the input data and does not guarantee independent factual correctness. Credit is still simulated and there is no lending contract. Mainnet is disabled, no independent security review was done, and Linux/macOS were not run on this machine. These tests are not proof of the absence of all possible bugs.
