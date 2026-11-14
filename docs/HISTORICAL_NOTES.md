# Historical planning and release notes

This English reference consolidates superseded planning briefs, change requests, design exports and review/roadmap documents. It is a summary, not a verbatim translation or a new acceptance run. Those originals remain in Git history; their removal from the current tree does not change authorship, build dates or previous evidence.

For current behavior and installation, use [the project README](../README.md), [judge guide](JUDGES_GUIDE.md), [portable release report](PORTABLE_RELEASE.md) and [build history](BUILD_HISTORY.md). [VERIFICATION.md](VERIFICATION.md) retains the detailed chronological results and links to the original JSON evidence and videos. A proposal, review recommendation or historical test is not proof that a feature works in every later release.

## Initial handoff and design

The 6 November handoff described a local English-language agent marketplace using Angular, Node/Fastify, PostgreSQL and a Rust NEAR contract. It separated an executable MVP from future lending, production hosting and stronger privacy. Its static prototype was design material, not a deployed application. Its old PDF/HTML exports and duplicate review attachments are not required to build or run Orby and are no longer distributed in the current source tree.

The core design principles remain: short action-led flows; English left-to-right UI; explicit simNEAR/testNEAR units; readable human amounts; semantic financial states; mobile cards instead of wide tables; keyboard/focus support; light/dark/system themes; technical hashes behind expandable details; no synthetic performance claims.

Runtime styling is maintained in the frontend `src/styles.css`, `src/tokens.css` and `src/orby-tokens.*`. Current logo assets and brand tokens remain in their tracked directories. Third-party licensing and authorship notices for retained assets remain intact.

## Version 1.1: identity, wallet and financial correctness

The 6 November release addressed the wallet connector's CommonJS/default export shape, NEP-413 callback compatibility, native NEAR amount handling, account/environment isolation, immutable financial previews, registration recovery, clear role-based controls and the Orby identity. Later changes supersede the initial deployment/setup instructions. The historical report was never an independent security audit.

## 7 November fixes

The next change request covered these concrete boundaries:

- Separate public wallet RPC configuration from the server RPC so a server-only credential is not exposed to a browser.
- Keep job deadlines publication-relative; show remaining time before funding and reject expired jobs.
- Preserve legacy USD accounting with six decimals separately from native NEAR with 24 decimals. Do not substitute a display exchange rate for settlement arithmetic.
- Recover pending agent registration using the original operation ID; reconcile submitted/unknown transactions before another attempt.
- Validate callback flow, one-use nonce, recipient, expiry and account authorization.
- Round the agent minimum consistently, read the relevant contract rate, and refresh stale funding previews.
- Keep a price-only agent edit from invalidating the accepted manifest version.
- Align accelerated start windows and require timestamped, fresh reference-price observations.
- Enforce cumulative file count/byte quotas with concurrency control.
- Preserve applied migrations and shut workers/connections down before removing a disposable test database.
- Apply nonce-based CSP without relying on Angular's incompatible inline critical-CSS event handler.

[Historical upgrade evidence](orby-upgrade-20261107.json) and [archived browser/testnet flow](archive/orby-browser-testnet-1.2.0.json) retain the measured result. Do not substitute the later workflow's job counts for this earlier run.

## Version 1.2: workspace and order flow

The workspace request called for account/environment-specific draft recovery; field-level validation; explicit decision actor/time/revision/hash; mobile job cards; human-readable policy amounts; consistent price units; continuation after login; complete final review; editable acceptance criteria; less raw technical detail in ordinary flows; fast access to agents; and sample/history evidence that distinguishes seed data from real orders.

The delivery added job copying and personal templates, proposal comparisons, supporting source quotations, versioned output and targeted revision, a state-derived action inbox, weekly programs, private knowledge snapshots, paid agent auditions, staged projects and server-side Google Sheets OAuth.

Boundaries matter: recurring testnet publication/funding still needs wallet signatures; an audition pays each successful participant; a later stage waits for settlement; revocation cannot retract data already delivered; and Sheets HTTP fixtures are not proof of a live Google account authorization. See [workspace upgrade](orby-workspace-upgrade.json), [clean start](orby-clean-start-1.2.json), [browser/testnet evidence](orby-browser-testnet.json) and [Sheets setup](GOOGLE_SHEETS_SETUP.md).

## Version 1.3: six critical fixes and six review tools

| Fix | Evidence boundary |
| --- | --- |
| Indexed V3 storage and liability/sponsor accounting | [Migration preservation](orby-v3-upgrade.json) and [actual WASM/RPC load](orby-v3-load.json); not an unlimited scale guarantee |
| Knowledge preserved and filtered during delegation | Frozen stage inputs and explicit child grants; trusted server administrator remains |
| Failed child cannot be paid or consumed as accepted output | Required checks gate settlement; one allowed revision then dispute |
| Approval bound to revision and output hash | Native `approve_delivery`; legacy approval remains limited to legacy jobs |
| Uncertain Sheets append recovery | Durable intent marker and paginated reconciliation; no blind duplicate append |
| Calendar/time-zone correctness | Local calendar scheduling, DST cases and strictly advancing execution |

The accompanying tools were **Work Receipt**, **Execution Plan/Rehearsal**, **Scoped Knowledge**, **Agent Quality Lab**, **Team Workspace** and **Counteroffer**. Team review is not on-chain multisig. Rehearsal does not move real funds. Quality Lab is a bounded internal benchmark, not a general truth score. Counteroffers do not automatically fund an agreement. Receipts prove recorded state and consistency, not semantic correctness of model claims.

## Versions 1.4 and 1.4.1: real model, recovery and revision

The Windows real-model mission demonstrated editable model-suggested agreements, bounded specialist selection, client-approved escrow, separately creator-funded specialist work, a clearly controlled first check failure, one recovery, main delivery and testnet settlement. Version 1.4.1 added actual recommendation Revision 1, rejection of stale approval, distinct planning inputs, truthful model outage behavior, robust mandatory-dry quote handling and isolated sample history.

- [1.4 mission evidence](orby-real-mission-1.4.json) and [recording](demo-1.4/).
- [1.4.1 mission evidence](orby-real-mission-1.4.1.json) and [continuous recording](demo-1.4.1/).
- [Earlier failed model run and refund](orby-real-model-regression-refund.json).
- [Revision preflight](orby-real-revision-preflight-1.4.1.json) and [model outage](orby-model-outage-1.4.1.json).
- [Historical dry quote](orby-intents-safe-mode-1.4.1.json); expired observation, not an executable payment.

These recordings used local runtime/development wallet fixtures with real signatures and testnet transactions. They do not claim manual approval in every third-party wallet. Historical statements that Mac setup was untested belong to those releases; the later native Mac acceptance is documented separately.

## Version 1.5: current portable acceptance

Independent native Apple Silicon setup, account/key provisioning, real Ollama execution, actual revision, testnet settlement, repeated setup preservation and eight-profile real-model catalog checks are covered in [PORTABLE_RELEASE.md](PORTABLE_RELEASE.md) and [the current evidence index](mac-acceptance/README.md). Catalog checks using simulated funds are distinct from real testnet settlement. No prior result is relabelled as a new test of this English documentation cleanup.

## Continuing limitations

No production mainnet custody, lending deployment, TEE, multisig treasury or independent security audit is claimed. Mainnet Intents is a server-enforced `dry:true` preview. Local compute, hardware, electricity and gas are not fully priced; remainder is not complete profit. Google Sheets needs owner OAuth. Source claims and model outputs require human review. Current public-repository status does not mean the entrant has published the required X demo or submitted the event application.
