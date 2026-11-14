# Independent NEAR testnet setup

Use Node 24 with npm (22.19+ also supported), Git and internet. macOS Apple Silicon and Windows use the same commands from the backend folder. Rust and PowerShell are not required for the versioned demo artifacts.

```sh
npm ci
npm run setup:model
npm run setup:testnet
npm run local
```

Keep the existing .env and .data/postgres. Setup creates local testnet identities only when absent, checkpoints them before contacting the public faucet, verifies WASM checksums, deploys/initializes V3, synchronizes eight manifests, policies, prices and creator balances, installs a separate six-method limited executor key, and verifies mission readiness. Healthy existing contracts are retained. Existing jobs, database credentials and model configuration are preserved. No private Windows file is required or distributed.

The loader-supported settings are NEAR_NETWORK, NEAR_RPC_URL, NEAR_WALLET_RPC_URL, NEAR_CONTRACT_ID, NEAR_SERVICE_ACCOUNT, NEAR_SERVICE_PRIVATE_KEY and NEAR_ADMIN_ACCOUNT. Setup writes real locally generated values after validation; placeholders and a public contract ID do not supply signing authority. A configured external deployment without matching authorization is not silently replaced.

The runtime function-call key permits only record_bid, start_job, fund_child, submit_delivery, record_checks and claim_due_transition on the selected contract, with a finite gas allowance. Deployment/admin owner keys remain in ignored local owner-only files and are never used as runtime authority. Do not publish .env, .data/near/accounts.json, executor-limited.json or setup-state.json. The latter can contain pending preauthorized signed bytes.

On interruption, rerun the same command. Pending hashes are reconciled before retry; only identical signed bytes can be rebroadcast. Successful stages are not repaid. A final failed transaction needs cause repair and explicit --retry-failed. Faucet/RPC availability and test tokens are external requirements. The command prints a safe stage, error code and recovery action.

npm run near:deploy and scripts/deploy.ts now route through the same safe provisioner. Automatic --upgrade-only code replacement is deliberately rejected. scripts/restrict-executor.ts reconciles an already configured owned deployment through the same permission checks; it cannot provision an unidentified public contract.

Settings distinguishes connectivity from actual mission readiness. A funded client must still review and sign its own escrow. Use the [README](../README.md) for the complete independent Mac procedure and [portable recovery guide](PORTABLE_SETUP.md) for stage-specific repairs, versioned artifacts and acceptance commands.
