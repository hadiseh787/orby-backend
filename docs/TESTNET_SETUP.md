# Independent NEAR testnet setup

Cloning source does not grant access to the owner's signer. The installed owner demonstration is already deployed; do not redeploy it merely to run the local UI. Independent deployments need their own accounts, keys, balances and V3 WASM.

Use Node.js 22.19+ or 24, Rust/cargo with `wasm32-unknown-unknown`, and the platform compiler required by near-sdk 5.30.1. The repository pins Rust dependencies in Cargo.lock.

```powershell
rustup target add wasm32-unknown-unknown
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-contract.ps1
npm.cmd run contract:optimize
```

Inspect `scripts/deploy.ts` before invoking `npm.cmd run near:deploy`. It creates project-specific accounts through the public TESTNET faucet only when absent, saves generated credentials in ignored `.data/near/accounts.json`, deploys the compiled contract, calls the actual `new({admin,evaluator,updater,accelerated:true})` initializer, registers agents and policies and funds development testnet balances. Faucet availability and required test tokens are external dependencies; the tool fails explicitly rather than pretending an account exists. Back up your existing local key files before running a deployment against an existing workspace.

The deployment script writes backend `.env` with these loader-supported settings:

```
NEAR_NETWORK=testnet
NEAR_RPC_URL=https://test.rpc.fastnear.com
NEAR_WALLET_RPC_URL=https://test.rpc.fastnear.com
NEAR_CONTRACT_ID=<your deployed V3 contract>
NEAR_SERVICE_ACCOUNT=<your executor account>
NEAR_SERVICE_PRIVATE_KEY=<your locally stored limited function-call key>
NEAR_ADMIN_ACCOUNT=<your admin account>
```

Values above are placeholders, not working credentials. Source-only clones do not distribute the project keys. An existing configuration must not be overwritten with placeholders. The key used by backend must be the exact private key corresponding to its on-chain function-call access key; CLI keychain storage alone does not configure backend.

The service key is separate from deployment/admin authority. The verified owner key permits only `record_bid`, `start_job`, `fund_child`, `submit_delivery`, `record_checks` and `claim_due_transition` on the exact contract. Inspect an independent deployment's access-key permissions and the matching policy `executor` before claiming readiness. After an independent deployment run `node --import tsx scripts/restrict-executor.ts` from backend. It generates a separate local function-call key, adds the six-method permission with a 0.5 testNEAR gas allowance and updates only the backend executor key. Verify permissions on chain and restart the backend. The full-access account owner key remains a private development fixture; never configure it as the runtime signer or publish it.

Restart `npm.cmd run local`. Settings > Recheck connections must verify testnet RPC, a deployed contract with `get_version()==3`, and a real model. For real acceptance use your testnet wallet for NEP-413 sign-in and transaction signatures; fund that wallet using your own faucet/test balances. Confirm final RPC outcomes and settlement/withdrawal callbacks, not just a transaction hash. Mainnet coins and signing keys are never required.

Official references: [NEAR CLI](https://docs.near.org/tools/near-cli), [NEAR RPC](https://docs.near.org/api/rpc/introduction). Development scripts and fixture keys are for local testnet work, not a production key-management design.
