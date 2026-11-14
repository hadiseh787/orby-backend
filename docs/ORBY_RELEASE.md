# Orby 1.1 change and test report

Date: 6 November 2026. The request reference is the `orby-brand-kit.zip` package and the [change document](https://docs.google.com/document/d/1YiVYrZaljRfxTBTUaCOB1bmGK0P4zMINKqaWXpAwtFs/edit). The received text of the document is kept in `ORBY_CHANGE_REQUEST.txt` and the five main brand files in `orby-brand-kit/`.

## Bugs, causes and fixes

| Item | Cause | Fix |
|---|---|---|
| `t is not a constructor` error in Wallet | Difference in the CommonJS library import output in the final Angular build | Support for both the original and the default export; the real testnet picker was opened and cancelled in the production build as a test |
| Some login signatures rejected | NEP-413 requiring a single callback state | Validation of two standard formats with nonce, recipient and allowed callback; check of the key registered on testnet |
| Agent registration error with `my agent` | Identifier containing a space and a raw regex error | Space converted to a hyphen, format validation, a clear server message and a 409 for a duplicate identifier |
| Dollar base price and fixed rate | The previous contract and form were USD-referenced | New fixed-NEAR amount path in the contract; the live dollar rate is informational only and has no effect on the agreed payment |
| Minute-only deadline and a static counter | The form only had minutes and the standalone clock did not refresh | Day input, day/week/hour display, a dynamic counter, refresh on tab return and an Expired state |
| No attached files | No storage and download path existed | Up to five 2 MiB files, type and content checks, authorized download, a hash in the on-chain agreement and an explicit public IPFS publication option |
| Three fixed Sources | The form only rendered a sample array | Add, edit and remove 1 to 30 sources with a total input cap and a unique identifier |
| No manual creator bid path | Bids came only from the worker | A list of open jobs, a bid with an agent owned by the creator and the owner's real signature on testnet |
| Ambiguous states during operations | A generic busy state without stages or full recovery | Connection, signing, sending, processing, confirmation and failure states; form disabling and duplicate-submission prevention |
| Possible transaction loss after Refresh | The hash was not persisted before the confirmation request | Hash saved before reconciliation, return from the Wallet, Resume and status tracking without resending the payment |
| Admin reconcile depended on the user's local operation | The button was wired to the same browser's wallet handler | An admin path with a role check that really checks one operation per request; an operation without proof is not declared successful |
| A transient API error left settings incomplete | Retry only re-read the page data | Recovery of config and session together with the page data |
| API quota filled by files and page visits | A shared counter for the SPA, reads and writes | Files and navigation outside the quota; separate read and write quotas; a test that API control remains |
| New build files were not found | The static path list was built only at startup | Serving the current version's files; an invalid path and a missing asset get a proper 404 |
| An invalid URL showed the marketplace | The fallback sent all routes to the marketplace | A dedicated Orby 404 page with back navigation and HTTP 404 |
| A backup could be restored without attachments | The new table was missing from the restore order | Table added, with verification of full schema coverage, row counts and file content hashes |
| A funded job lost its start deadline | Old bids were processed before jobs started; the fast window was 30 seconds | Priority for funded jobs, a five-minute test window, separate handling of a failed start and a client signature request for non-delivery |
| An old bid queue blocked later jobs | A closed or expired job stayed in the QUEUED queue | Closing the queued job, removing expired policies from selection and preserving the real contract state |
| A definite executor transaction failure was recorded as UNKNOWN | All exceptions shared one state | Distinguishing a definite failure receipt from a network drop and storing the known hash for follow-up |
| A launcher upgrade could keep an old frontend | The managed checkout was not synced with the new pin | Fetching a specific revision while preserving local changes and preventing their overwrite |

## Identity and structure

The active product name, browser title, icon, favicon, packages, Angular output, database and repositories are Orby. The light theme uses the supplied tokens; the dark theme is implemented with the same identity and white text on the purple action color. The automatic system theme and keyboard behavior are preserved. The final working folder name is `Orby`; the applications still live in the two independent `frontend` and `backend` folders.

- [Frontend repository](https://github.com/hadiseh787/orby-frontend)
- [Backend repository](https://github.com/hadiseh787/orby-backend)

Historical account and contract identifiers on the blockchain and the Git history cannot be renamed; these are not the product's active name. The previous testnet contract was upgraded so that existing records and balances were not destroyed.

## Tests performed

- 7 Node unit tests, including 10,000 total-preservation cases, NEP-413 signing, canonical hashing and HMAC/replay.
- 9 PostgreSQL tests on a separate database, including the full flow, funding concurrency, access and CSRF, preview expiry, dispute, withdrawal, the simulation pool, private files and the fixed NEAR amount.
- 7 browser tests on a real local API, including light/dark mode, mobile and desktop, keyboard, Wallet and cancel, dynamic sources, files, Agent registration, 404 and local settlement.
- 3 Rust tests, including 10,000 total-preservation cases and overflow-free arithmetic; the optimized WASM build also passed.
- A real V1-to-V2 migration: the three existing jobs and the balances of five accounts were preserved unchanged. Evidence: `orby-migration.json`.
- A real browser flow to testnet, with the production connector and a development wallet producing real signatures and transactions: login, Agent registration, execution policy, bond, job, attachment, owner bid, funding, delivery and worker check, client approval, settlement, withdrawal, connection preserved after Refresh, history and Disconnect. Evidence: `orby-browser-testnet.json`.
- In that flow, `0.11 NEAR` of escrow was split into a `0.01` refund, a `0.01` fee and `0.09` of creator proceeds. The `0.01 NEAR` withdrawal and its callback were confirmed.
- A real expired-start path: the client's signature for the non-delivery case, waiting until the contract's real deadline and a full escrow refund; delivery success was not faked. Evidence: `orby-expired-start.json`.
- Real IPFS with a local Kubo node: add, pin, CID retrieval, recovery of the same bytes and an authorized download from the database passed. This test was offline and does not prove replication on external nodes. Evidence: `orby-ipfs.json`.
- A PostgreSQL backup was restored onto a fresh database; rows, sequences and attachment contents were checked.

Legacy agreement compatibility and definite executor transaction failure detection passed on testnet (`orby-compatibility.json`). Admin reconcile was also tested with a signed session and a real receipt (`orby-admin-reconciliation.json`). The final version ran from a copy without settings, dependencies, frontend and database; the launcher prepared everything and the application came up on an independent port. The details of this check are recorded in `VERIFICATION.md`.

## Financial behavior and storage

New job payments are computed as integer amounts in yoctoNEAR. The USD display rate does not change the amount. No fabricated fixed fee is added for registration and confirmation operations; the attached deposit and the gas cap are visible before signing. Real gas depends on execution and the network and differs from a product fee. The current testnet contract's storage is staked by the contract account.

Putting large files in contract storage creates unnecessary cost and attack surface; the file stays off-chain and its hash is kept in the signed terms. IPFS publication is optional and public and requires the user's explicit choice. [NEAR storage docs](https://docs.near.org/protocol/storage/storage-staking), [the connector used](https://github.com/azbang/near-connect), [CoinGecko price reference](https://docs.coingecko.com/reference/simple-price), [Coinbase price reference](https://docs.cdp.coinbase.com/coinbase-app/track-apis/prices).

## Not enabled or not verified

1. Mainnet is not enabled and the application blocks it. No real money or personal user account was spent on testing; the contract has not had an independent security audit.
2. The consent path was not run with a third-party extension or personal wallet on a real user account. The real picker and the full flow were tested with a development wallet and real testnet signatures; these are two different claims.
3. External IPFS pinning and access require a stable node or pinning service and setting `IPFS_API_URL`. The offline QA node is not a production service. Private attachments work without IPFS.
4. Ollama and a language model are not installed. The default output is really produced by the deterministic runtime and is not presented as a language model. LLM output quality and AI arbitration are not verified.
5. Real lending, arbitrary endpoint connection, TEE and Intents are outside the base stage. Local credit is explicitly simulated and creates no testnet balance.
6. A fresh clone has no testnet private key. Local execution works with one command; a real testnet run needs deployment and credentials configured for that environment. The development machine's keys were never committed.
7. Setup was tested on Windows x64; Linux/macOS execution was not tried on this machine.

Local execution runs from the backend folder with `npm run local`, or `start-local.cmd` on Windows. The run guide is in `QUICKSTART.md`.
