# Portable setup and recovery

Use README commands from the active backend directory. Git and Node 24 with npm (or 22.19+) are prerequisites. macOS Apple Silicon runs natively; no PowerShell or pre-existing Windows key file is needed. Project root, active .env, OS/architecture and commit IDs are visible in Settings without secret values.

## Preserve existing data

Stop the existing local stack before changing its configuration. `setup:model` changes only the four model settings after full model acceptance; `setup:testnet` changes only NEAR settings after verified provisioning. Both preserve DATABASE_URL, unrelated .env lines and `.data/postgres`. A missing .env is initialized once with a fresh development database password. An existing password is never reset. Never copy .env.example over a configured .env or delete the data directory to fix an authentication error.

## Ollama on Mac

The locator checks OLLAMA_EXECUTABLE, project-local `ollama`, `/Applications/Ollama.app/Contents/Resources/ollama`, `/opt/homebrew/bin/ollama`, `/usr/local/bin/ollama` and PATH. On Windows it detects the .exe equivalents. Setup can unpack the official checksum-verified runtime locally. Manual Mac installation: https://ollama.com/download/mac. With a running server, `ollama list` or `/api/tags` provides the exact installed name; when CLI is not on PATH use the executable path stored locally in .env.

For the supplied GGUF model the project uses a tracked ChatML template and explicit OLLAMA_GO_TEMPLATE=1. If a different already-running service ignores that template or fails schema/revision acceptance, stop that service through its own controls and let `npm run local` own the project runtime; do not kill an unidentified process. A compatible installed model can be selected with `npm run setup:model -- --model NAME`. There is no paid model API key and no fixed fallback for REAL_AI.

## Testnet stages

The setup checkpoints RPC selection, account creation, checksummed staged deployment, actual V3 initialization, manifest versions, native prices, policies, creator balances, limited-key provisioning and final mission readiness. Keys are generated locally and file permissions are 0600 on macOS. `.data/near/setup-public.json` contains only public setup evidence; accounts.json, executor-limited.json and setup-state.json are private local files and must not be published.

Confirmed setup transactions are reused. Interrupted broadcasts retain the original signed bytes/hash; retry first reconciles that hash against testnet. Only identical signed bytes may be rebroadcast. A final failed transaction requires repairing the cause and explicitly using `npm run setup:testnet -- --retry-failed`. This flag does not reset successful stages or the database. No new transaction is signed merely because a response was lost.

| Condition | Required action |
|---|---|
| No configured contract/model | Run the respective setup command, then restart local. |
| Faucet account not created | Keep the saved local keypair; retry after provider recovery or arrange creation/funding for the printed account/public key. No new identity is generated on rerun. |
| RPC unavailable/rate limited/non-JSON response | Check connectivity to public testnet RPCs, wait if rate limited and rerun. Read requests can use verified public fallback; unknown writes are not resigned. |
| Database authentication failure | Use the password belonging to the existing PostgreSQL data directory. Preserve both .env and the directory. |
| Configured external contract lacks owner authorization | Obtain the correct limited signer from its owner or configure an independently owned deployment. A public ID is not signing authority. |
| Wrong receiver/methods/full-access runtime key | Use setup with the matching executor account owner to install the six-method limited key. Never configure the deployment key as runtime signer. |
| Limited allowance low | Re-run owned setup to renew the same limited public key's allowance; owner balance must cover gas. |
| Paused policy/contract | Review the owner decision and unpause explicitly. Setup does not silently cancel a deliberate pause. |
| Expiring policy | Owned setup renews expiry while preserving valid spending/allowed-agent restrictions. |
| Insufficient account/creator collateral or specialist funds | Supply testNEAR through owned wallets/faucet. Existing obligations and user funds are not overwritten. |
| Port already in use | Stop the installation owning it or select another local port. Never test an unidentified backend. |

Required limited methods: record_bid, start_job, fund_child, submit_delivery, record_checks, claim_due_transition. Readiness verifies on-chain registration, public key, receiver, exact method set, finite allowance, account spendable balance, evaluator role, storage reserve, eight catalog policies and creator collateral. The current wallet's own available funding is still checked when it reviews/signs escrow.

## Contract artifacts

`contracts/artifacts/v3/manifest.json` pins the SHA-256 and NEAR code hash for the included market/uploader WASM. Setup refuses an invalid checksum and will not overwrite incompatible code on an existing account. Rebuilding from Rust is optional for the supplied demo; the contract source and pinned Cargo.lock remain available. The full market deploy uses owner-only staged upload and verifies final deployed code before initialization.

## Acceptance commands

After startup on an independently configured native Mac, `node --import tsx tests/mac-acceptance.ts --run` signs actual testnet development-wallet transactions with locally generated fixture keys. It is not a simulation and requires at least 4.4 testNEAR of client escrow capacity plus gas, creator specialist funds/collateral and executor allowance. It records the explicit controlled failure/recovery and a real client revision, rejects a stale approval and verifies final settlement. `node --import tsx tests/portable-catalog-acceptance.ts` runs eight real-model deliveries with simulated funds, repeats seeding, restarts and verifies persistence and a fresh no-transfer quote. Its simulation fund label must not be represented as eight testnet payments.

The scripts and CI upload only public evidence. A passing independent Mac run does not assert that another user's Mac or its original database was remotely inspected. Current evidence and remaining limitations are listed in PORTABLE_RELEASE.md.

Cold model verification runs actual schema and revision inference; on native CPU-only installations the first check can take several minutes. The UI keeps CHECKING visible and permits up to seven minutes for full readiness, then shows a specific failure instead of enabling REAL_AI prematurely. Verified compatibility is cached briefly for the same model digest; explicit checks still verify current service availability.
