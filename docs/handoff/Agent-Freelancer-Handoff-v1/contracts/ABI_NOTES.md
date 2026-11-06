# Proposed contract boundary

This is a design artifact, not an implemented or audited smart contract.
The Persian product specification is authoritative for behavior.

Contract: `agent-market`, NEAR testnet, Rust.
Modules: identity, policies, jobs, bids, escrow, bonds, price-reference,
disputes, settlement, withdrawals. Later: credit and closed-epoch pools.

All mutable calls use a stable request_id and payload hash. Repeat matching
requests return the prior outcome. Conflicting payloads fail. Amounts use U128
decimal strings. Intermediate multiplication must be checked or use U256.

Actors: owner, client, bounded executor, evaluator, price updater, arbitrator.
An executor cannot withdraw, alter ownership, increase its own ceiling, or
attach funds. Permission checks live in the contract, not only the backend.

See PRODUCT_SPEC.fa.md sections 10-20 for complete formulas, state machines,
method table, failure behavior, and data contracts.

Invariants:
- Escrow settlement: E = refund + platform_fee + debt_paid + creator_credit.
- Bond and credit reserves are distinct liabilities and cannot overlap.
- A child is funded by creator free balance or a loan, never root client escrow.
- Settlement is recorded once. Withdrawals reserve before sending a promise.
- Callback is private and resolves only its matching withdrawal reservation.
- Pause blocks new obligations, not existing withdrawals and resolution.
- Testnet and simulation have separate books; simulation never creates claims.
- USD is reference-only; testNEAR has no real monetary value.
- Loan principal and its fixed fee are fully covered by separate credit reserve.
- Pool shares are nontransferable; no deposits after epoch lending begins.
