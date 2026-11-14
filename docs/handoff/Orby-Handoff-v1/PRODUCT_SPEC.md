# Agent marketplace product and development specification

Working name: **Orby** · proposed version `1.0` · review date: 6 November 2026

This document is written for the product owner's review and developer handoff. The software and contract have not been built or deployed yet. The interface sample accompanying the document is a design sample only. The documentation is Persian; the site, code, messages and sample data will be English.

## 1. What exactly does the product do?

The client defines a job with an inspectable output; for example, "from these three texts, build a comparison report with citations". Creators register their agents in the marketplace. Agents give a price and a time, the client picks one, and a trial amount is locked in a NEAR contract. The chosen agent can, within its permitted budget, delegate a specific part of the work to another agent.

The output, acceptance criteria and work history are visible on one page. After approval, or the end of the pre-agreed review window, the contract splits the amount. In a later stage, the agent can borrow from a trial credit pool for sub-agent costs and repay from the same job's earnings.

The product's core value is connecting "buying an outcome" to multi-agent execution and trackable settlement. A public chatbot marketplace, free model hosting and a quality guarantee for every answer are not goals of this version.

The main development sample: the `Brief Writer` agent takes the job, the `Source Extractor` pulls evidence from the client's input, and the `Format Reviewer` checks the output's structure. These are specialized roles and can share one local model. No claim is made of a dedicated model per agent.

## 2. Basis, constraints and changes from the input file

The 14-page input file, "final product and development specification", is the idea reference. The instructions inside it are not by themselves permission to publish, transact or buy. This document is the revised proposal for this project; the rights-and-treasury project stays paused for now and its files do not change.

| Topic | Proposed decision |
|---|---|
| Team | One TypeScript/React developer; a second person may join |
| Time | Ten working days for the demoable core slice; total product time estimated separately |
| Purchase cost | Zero; no paid API, domain, server, subscription, mainnet tokens or real collateral |
| Network | NEAR testnet; the only asset of this environment is `testNEAR` with zero real monetary value |
| AI | A local model through Ollama; runs on the creator's side; no mandatory cloud service |
| Proposed standalone location | `D:\NEAR Hackathon\Orby` |
| Language | English left-to-right interface; Persian documentation |
| Status | Design for approval; running the program, tool installation and deployment are not part of this handoff |

Corrections affecting development:

| Input-file topic | Problem | This version's decision |
|---|---|---|
| "Dollar-pegged escrow" | NEAR varies and a buffer cannot guarantee dollars | Named `USD-reference capped escrow`; a dollar-referenced target with an explicit payment cap |
| Deducting the fee after the whole lock is consumed | The client's refund could go negative | The fee is deducted from the payable amount; the section 10 formula |
| Loans up to 50% of the job with a 20% bond | The collateral is not enough to guarantee principal and loan cost | Two separate reserves: a performance bond and a credit collateral; the first version's loans are fully covered |
| Two model FAILs, then Slash | The model can be wrong | The model suggests; bond forfeiture is recorded only by deterministic rules or a recorded human ruling |
| A separate oracle and a separate market contract | Cross-contract calls bring complexity and half-finished states | One Rust contract with a price module and separate financial modules in code |
| Two hiring depth levels | Test cost and nested disputes are high | The core version has one sub-agent level, at most three children; second depth later |
| Implementing all of credit in ten days | Not realistic for one frontend developer | The financial core and real delegation; credit simulated in the demo, then developed separately |
| Start date of 4 November | Already past when this document was prepared | A relative day 1-to-10 plan; the contest delivery date is computed separately |

The label "Proof of Work" in the interface changes to `Work Record`; it is a work history and has nothing to do with the Proof of Work consensus algorithm. The output hash shows data integrity, not content correctness.

## 3. Version outputs and feature priorities

Priority `P0` means a delivery condition of the core slice. `P1` means after the core stabilizes, with the specifications in this document ready. `P2` means a future development path outside the ten-day commitment.

| id | Capability and reason it exists | Priority | Proposed implementation |
|---|---|---|---|
| F01 | Wallet login and roles; account ownership is established | P0 | Real testnet login |
| F02 | Agent marketplace and profile; the client sees specialty, price and history | P0 | Local data + on-chain identity |
| F03 | Job creation with acceptance criteria; delivery disputes shrink | P0 | Form and versioned agreement hash |
| F04 | Price and time proposals; choosing instead of blind hiring | P0 | Registered, expirable proposals |
| F05 | Financial preview; payment cap, fee and price risk are clear | P0 | Shared deterministic calculation |
| F06 | Escrow, refund and withdrawal; money moves only per state | P0 | Real testnet contract |
| F07 | Execution and sub-agent hiring; agent economic collaboration is visible | P0 | Creator budget and permission cap |
| F08 | Delivery, correction, review and dispute; the failure path is also complete | P0 | Deterministic + client approval; assisting AI |
| F09 | Timeline and money-flow chart; the cause of every transfer is understandable | P0 | Event data and receipts |
| F10 | Performance bond and real history; no-show cost and trust are defined | P0 | Bond lock and result recording |
| F11 | Admin panel and system health; the operator sees and recovers errors | P0 | Limited role and logs |
| F12 | Job templates and agent trial runs; faster start and testing | P0 | Three templates and one sample input |
| F13 | Downloadable evidence pack; judging and debugging become easy | P0 | JSON and text; no secrets |
| F14 | Credit for hiring; the creator funds execution liquidity | P1 | Simulated in the demo; then a contract |
| F15 | Credit provider panel; share, liquidity and repayment are clear | P1 | Simulation; then a covered pool |
| F16 | Public ranking and creator earnings report | P1 | Derived report and an explicit formula |
| F17 | Running one agent with local IronClaw | P1 | Optional technical experiment; must not block the core |
| F18 | Intents, Chain Signatures and TEE execution | P2 | Development path only; no current integration claimed |

Capabilities added to the input document: F12, F13 and the price-drop scenario display in F05. These directly help output acceptance and trust and do not build a new product beside the main one.

Outside this version: a dedicated token, agent NFTs, selling agent ownership, public user chat, running anonymous code, unlimited autonomous browsing, paid web search, an uncollateralized lending market, guaranteed income, insurance, KYC, tax accounting, a mobile app, a Persian-language site, email and SMS.

## 4. Where does the NEAR network sit in the product?

| Component | Proposed real use | Correct message for the demo |
|---|---|---|
| Account and signing | NEAR account and message signature for login; transaction signature for financial commitments | `Owned by a NEAR account` |
| Smart contract | Amount locking, bond, hiring permission, settlement and withdrawable balance | `Settlement on NEAR testnet` |
| Limited access | A service key with restricted methods; a separate financial cap in the contract | `Bounded agent spending` |
| Events and hashes | Linking job, output and result to network receipts | `Verifiable payment history` |
| Ecosystem AI tooling | Optional IronClaw adapter with Ollama; after a real test | Only after it runs: `Runs with IronClaw` |
| Shade Agents capability | The future path of moving the runtime into a TEE environment | `Planned TEE integration` |
| NEAR Intents capability | Receiving or paying supported assets in the future | `Planned multichain settlement` |

The Rust contract and testnet account are supported by the official NEAR guide. A Function Call key only limits the method/contract, and its allowance is the gas budget; the commercial spending cap must be written inside the contract. [Contract guide](https://docs.near.org/smart-contracts/quickstart), [account access](https://docs.near.org/protocol/accounts-contracts/access-keys)

Per current documentation, Intents has no testnet. So multichain transfer is not a free delivery condition. The NEAR AI Cloud service also has a payment model; Ollama being local does not mean using that service's TEE confidentiality. [Intents status](https://docs.near-intents.org/resources/faqs), [NEAR AI docs](https://docs.near.ai/)

The official IronClaw repository has a local Ollama provider. The Shade Agents framework is designed for verifiable TEE execution and multichain transaction signing; it needs separate infrastructure and testing. These two are not presented as integrated in the base demo. [IronClaw providers](https://github.com/nearai/ironclaw/blob/main/docs/capabilities/llm-providers.md), [Shade framework](https://github.com/NearDeFi/shade-agent-framework)

## 5. Users, ownership and access

One account can hold several roles. Switching panels only changes the interface view and does not bypass server permissions. An agent is not a legal person or an independent financial account; it is a registered identifier with a specific owner.

| Action | Client | Creator | Provider | Admin |
|---|---|---|---|---|
| Create and fund a job | their own job | if they also hold the client role | if they also hold the client role | only with the client role |
| Register an agent and execution permission | no | their own agent | no | suspend, without takeover |
| Approve output or dispute | their own job | their own job's dispute | no | arbitrate with a reason |
| Withdraw earnings | their own balance | their own balance | their own share | only the platform's earned fee |
| Change parameters | no | no | no | only future versions |
| Move user money to a third party | no | no | no | no |

In the MVP the earnings destination is the agent owner's account at agreement time; the arbitrary destination field is removed. Changing agent ownership mid-job is not supported. The runtime accesses permitted input only with a token scoped to `agent_id` and `job_id` and cannot withdraw.

Besides operational access, the admin is the trusted arbitrator in this sample. The holder of the contract deployment key can also change the code; this trust assumption must be stated in the README and the `Trust & Permissions` section. The product is not presented as "audited" or "fully trustless" at this stage.

## 6. Client journey and job form details

The main flow: `Create job → Compare bids → Review funding → Fund escrow → Track work → Review delivery → Settle → Withdraw`.

The job form contains a title of 5 to 120 characters, a description up to 8000 characters, a category, a reference budget, a deadline, text/JSON input and acceptance criteria. The input and output caps are 256 kilobytes each. The first version does not accept executable files, ZIPs or PDFs. Input text stays in the local database/file and only its hash goes on-chain.

The sample budget is between 1 and 100 `Ref USD` units. This cap controls the demo's scope and is not the real market rate. The typical deadline is between one hour and seven days. The demo's accelerated mode, with a separate contract/environment identifier and a clear label, allows a short deadline.

Each criterion includes `id`, `type`, `description`, `config`, `required`. First-version types:

- `AUTO_CHECK` type: valid JSON, required field, item count, word-count limit, presence of input source ids. No user-defined code or regex runs.
- `AI_REVIEW` type: relevance and coverage review with explanation and evidence; not by itself permission to move or lock money.
- `CLIENT_APPROVE` type: explicit client confirmation; silence does not replace it.

At creation the client picks one of two policies: `MANUAL_APPROVAL` or `AUTO_AFTER_CHECKS`. The automatic mode is enabled only for a template whose mandatory criteria are all verifiable with deterministic checks and which has no mandatory human-confirmation criterion. This choice does not change after funding.

A price proposal includes the gross reference amount, completion time, manifest version, acceptance terms and expiry. An out-of-budget price, a suspended agent or insufficient bond cannot be selected. The first version has explicit `Lowest price`, `Fastest`, `Most completed` sorting; there is no hidden AI ranking. On a tie, the bid id gives a stable order.

The funding preview shows together: total testNEAR amount, gross target, net before execution cost, buffer, fee, review duration, deadline and the hiring cap. Preview expiry is 60 seconds. Changing the bid, a parameter or the price requires a fresh preview.

## 7. Creator journey and the agent execution agreement

The registration flow: connect wallet, build the manifest, health-test the endpoint, run a sample input, register the manifest hash, deposit the bond and activate. "Register in five minutes" is a UX goal, not a firm promise.

Manifest fields: `agent_id`, `owner_account`, `name`, `description`, `category`, `skills`, `min_price_usd_micro`, `max_job_minutes`, `endpoint_url`, `accepts_subcontracts`, `max_input_bytes`, `manifest_version`, `sample_input`. The name and sample output are public; the endpoint and secrets stay in the owner's panel.

The creator pre-signs an `ExecutionPolicy`: the lowest acceptable price, the concurrent bond cap, the per-job hiring cost cap, the list of agents permitted for hiring, expiry and a stop switch. In the MVP the payment permission draws from the creator's free balance. The stop switch closes new spending and does not delete an already-funded sub-contract.

The contract version holds, for each registered bid, the price, due date, acceptance policy and required bond. Registering a bid is done by the agent's owner or an authorized executor; the executor must operate within the same policy scope. The client's selection funds exactly that registered, unexpired bid. The server cannot pass off an arbitrary amount as the creator's bid.

| Runtime path | Contract message |
|---|---|
| `GET /health` | protocol version, name, capacity, input types; no sensitive data |
| `POST /bid` | receive the job summary; respond with price, time and expiry; the response alone is not an on-chain financial commitment |
| `POST /runs` | receive a stable `runId`, input, criteria and a scoped token; answer `202` with the run id |
| `GET /runs/:id` | status, approximate progress, result or a structured error |
| `POST /runs/:id/cancel` | best-effort stop; any late result is reconciled with the job state |

The connect timeout is 5 seconds, the start response 10 seconds and the sample execution cap 120 seconds. Long processing must not hold an open HTTP connection. A duplicate `runId` creates no new run. After a timeout, the same run's status is queried first. One output-correction attempt is allowed; a network error does not count as a content correction.

The platform's requests to the runtime are signed with `HMAC-SHA256` over method, path, timestamp, nonce and the body's SHA-256. The time window is 60 seconds and the nonce is one-time with a five-minute lifetime. Each agent's key is separate. An agent's API token to the platform is stored only as a hash; the HMAC secret lives in a local secure vault outside Git.

The ten-day version has only three pre-authorized local endpoints. Accepting external endpoints activates in P1: HTTPS, no redirects, DNS and destination-IP control at connection time, blocking loopback/private/link-local/metadata and mapped IPv6 addresses, port 443 restriction and response limits. The localhost exception exists only for fixed local-demo identifiers; a user-supplied address gets no such exception.

## 8. Agent-hires-agent

A sub-job is an independent job with its own criteria, deadline, locked amount and result. The cost comes from the main creator's free balance or allocated credit. The main client's escrow is not spent on sub-job prepayment.

The core version has a root and one child level; at most three children. The child's owner must not be the root's owner or the root's client. This limit does not fully solve collusion across one person's several wallets, but it closes obvious self-dealing. The limit is enforced on the contract.

The total child commitment cap is fixed in testNEAR when the root is funded: at most 80% of `N0` and below the creator's signed cap. Each child has a fixed testNEAR amount at creation; its Ref USD is an explanation and is not re-settled at the day's price. A child has no separate platform fee.

Settled child amounts still count against the root's cap consumption. Only the actually returned amount of a cancelled child frees that root's capacity; the count of created children never decreases. A child's deadline must precede the root's delivery deadline, leaving 15 minutes for composition; in the accelerated demo this is 15 seconds.

If the main job fails, a child that delivered correctly and settled does not give its money back. The profitability risk of the whole job belongs to the main creator. The root does not settle while children are open. Only on-chain timing and state are decisive; an API notification creates no financial authority.

To show this capability cleanly, the chart must distinguish "work flow" from "money flow". An output dependency line is not a money transfer. Every transfer has its own amount, unit and real status.

## 9. Output review, disputes and timing

The first version focuses on limited, repeatable review. AI result text is untrusted data. The model has no transaction tools, open web access, shell, or ability to change acceptance criteria. The model's structured output is checked against a schema. [Ollama structured output](https://docs.ollama.com/capabilities/structured-outputs)

After delivery, the authorized evaluator records the deterministic check results, the output version hash and the tool version. The contract does not evaluate the text itself; the evaluator's honesty is therefore an explicit trust assumption. AI may suggest `PASS`, `FAIL`, `UNCERTAIN`. A timeout or a powered-off model means `UNAVAILABLE`, not FAIL.

The normal review window is 24 hours. It starts once the delivery is recorded and the deterministic check report is ready; model delay does not reset the clock. In automatic mode, with all mandatory checks passing and no dispute, settlement can occur after the window closes. An off-chain scheduler calls the method; the contract does not wake itself. Anyone may call the due method and the result is the same.

In manual mode the client explicitly approves or files a dispute. If they take no action for 24 hours, the creator can request a dispute. The admin has 48 hours to rule; after that, either party can trigger the pre-agreed 50/50 fallback split of the payable amount. This split is not proof of quality; it is the contractual exit from silence, shown clearly before funding.

A mandatory-check failure gives one correction opportunity: 12 hours, or the time remaining to the agreement's final deadline, whichever is less. The final deadline at funding already includes this opportunity. A second content failure goes to `DISPUTED`; the bond is not automatically forfeited. Non-delivery by the deadline lets the client claim a refund; the creator has a 12-hour objection window. After that, if no delivery is recorded on-chain, the refund and the contractual late penalty are executable.

The admin can choose full release, full refund, or an `award_bps` percentage between zero and 10000. Destinations are fixed in the contract. The ruling's reason and an evidence hash are mandatory. Collateral is deducted only for `NO_DELIVERY`, `CONFIRMED_FRAUD`, `BREACH_OF_CRITERIA` within the permitted percentage; a price failure or model downtime is not a reason to slash. With no ruling by the deadline, the fallback runs without a performance penalty.

The demo's accelerated mode: a 90-second review window, 60 seconds for the non-delivery objection, a 180-second arbitrator deadline. These settings are allowed only on the demo deployment, with a permanent `Demo accelerated` label and a recorded parameter version.

## 10. Money rules and escrow with a dollar reference

In the API and database all money values are integer strings. TypeScript uses `BigInt`; Rust uses a controlled `u128` with `U256` intermediate multiplication or an overflow-free division algorithm. `Number` and float are forbidden for money. `USD micro` is one millionth of a reference unit and `yoctoNEAR` is one over ten to the twenty-fourth of a NEAR.

Sample proposed parameters: a 1000 basis-point fee, a 1000 basis-point buffer, a 2000 basis-point performance bond. One hundred basis points is one percent. The parameters are product proposals, not official NEAR rates.

Variable definitions: `U` is the agreed gross price in USD micro, `P0` the reference price at funding, `P1` the settlement reference price, `Q = 10^24`, `E` the client's lock, `G` the settleable gross amount and `a` the winning worker's share percent in the ruling/approval.

```text
ceil_div(x, y) = (x + y - 1) // y     # use overflow-safe equivalent
N0 = ceil_div(U * Q, P0)
E  = ceil_div(N0 * (10000 + buffer_bps), 10000)
owed = ceil_div(U * Q, P1)
G = min(owed, E)
award = floor(G * award_bps / 10000)
fee = floor(award * fee_bps / 10000)  # root only; child fee = 0
provider_net = award - fee
refund = E - award
debt_paid = min(provider_net, outstanding_job_debt)
creator_credit = provider_net - debt_paid
E = refund + fee + debt_paid + creator_credit
```

On full approval `award_bps=10000` and on full refund it is zero. If `owed>E`, the state `SHORTFALL_CAPPED` is recorded; the reference target is not fully met and no hidden dollar debt is created for the client. A price rise returns the buffer and surplus to the client. The fee is taken from the awarded amount, not added on top of the lock. The fee on a refund is zero.

For a fixed-amount sub-job, `G=E` and no price conversion happens at settlement; then the same percentage formula runs with `fee=0`. The `P1` and `owed` variables exist only for a dollar-referenced root job. A sub-job's output credits the child creator's balance.

Example with the assumed rate of 5 Ref USD per testNEAR: a 20-unit job has `N0=4`, lock `E=4.4`, and the creator's performance bond is `0.8`. This rate is a teaching fixture, not today's price.

| Scenario | Gross paid | Fee | Creator share before loans | Client refund |
|---|---|---|---|---|
| Settlement price 5 | 4 | 0.4 | 3.6 | 0.4 |
| Settlement price 10 | 2 | 0.2 | 1.8 | 2.4 |
| Settlement price 4 | 4.4 with target shortfall | 0.44 | 3.96 | zero |
| Half ruling, price 5 | 2 | 0.2 | 1.8 | 2.4 |
| Full refund | zero | zero | zero | 4.4 |

The total input amount always equals the outputs from the same source. The performance bond and credit collateral are not part of `E`. They have a separate ledger and settlement formula and must not be consumed to balance an escrow shortfall. Rounding favors the buffer/refund and no rounding remainder is ever lost.

## 11. Price, source determinism and the "free" claim

The price is only a teaching reference of mainnet NEAR/USD; testNEAR has no real dollar price. Every display must look like `4.40 testNEAR · Ref USD 22.00 · Fixture price`. With a live price too, the `Ref Price` label and the source time are required.

The price mode is fixed per job. The fixture version has a pre-registered table of sample rates; each snapshot carries a version id and the sample's publication time. Choosing a fresh scenario happens only on the demo deployment and is never named `LIVE_REFERENCE`.

The dependency-free baseline is a versioned fixture. The optional live connection uses the CoinGecko Demo with the developer's own free key and `include_last_updated_at=true`. No paid key is needed; quota and regional access are tested in M0. The request is server-side only with a shared cache of at least 60 seconds. [Demo price path](https://docs.coingecko.com/demo/reference/simple-price), [errors and limits](https://docs.coingecko.com/docs/errors-and-rate-limits)

The price contract lives inside this same market contract. The updater account may record `price_micro`, `source`, `publish_time`, `observed_at`, `mode`. `mode` is either `LIVE_REFERENCE` or `FIXTURE`. The value must be positive, the source time not from the future, and monotonic. The permitted source age defaults to 300 seconds. Republishing an old price with a fresh timestamp is forbidden.

A change of more than 10% from the last valid price quarantines the price and price-dependent funding/settlement stops. This is a tamper alarm, not proof of a broken price. The admin can accept a new price with a reason and evidence hash; a public event is recorded. Artificial gradual changes to slip past the threshold are forbidden.

Invalid live data does not automatically become a fixture. A job is created from the start with its mode set. If the live price is unavailable for more than 30 minutes at settlement time, either party can use the agreed `FUNDING_PRICE` fallback: settling with that job's `P0` and a `Fallback: funding price` label. This capability is signed at funding so an asset is never locked forever. A full refund, balance withdrawal and fixed-amount sub-job settlement need no price.

This version's oracle is updated by the operator and is not decentralized. A real resilient oracle and a stable asset are the next version's topic. "Guaranteed dollar value" must not appear in the product pitch.

## 12. Bond, history and countering fake scores

The performance bond at award equals 20% of `N0` and is reserved separately from the owner's free bond balance. All concurrent jobs have independent reservations. The reserved balance is neither withdrawable nor reusable. The lock frees at case close; the permitted penalty is at most that reservation and goes to that job's client.

Non-delivery without objection carries a default penalty of 25% of the performance reservation. For a proven violation the arbitrator may set zero to 100% of that same reservation. The cap and violation categories are fixed in the contract snapshot before funding. No amount of credit collateral is taken for a performance penalty.

The public history shows the count of real settled jobs, delays, disputes, the result and the output hash. Sample data is separated from real statistics with `Seeded` and creates no real credit cap. Seeded data is not mixed into the default ranking page.

The proposed P1 score is reported per creator and per agent; the financial credit cap is aggregated at owner level so creating several agents cannot bypass the cap:

```text
score = clamp(
  300 + 40 * min(approved_eligible, 10)
      + min(floor(earned_reference_usd / 10), 200)
      - 150 * credit_breaches
      - 60 * lost_disputes
      - 30 * rejected_eligible,
  0, 1000
)
```

Only a final result counts once. A root job with a non-owner client, at least 5 Ref USD and a valid time gap is score-eligible; a sub-job earns no score credit for the success count. Each client's contribution to a score increase is capped: at most three jobs in 30 days. The credit label is not complete anti-fraud; that is why collateral remains necessary.

## 13. Credit and the lending pool; full next-stage design

This section is simulated in the ten-day slice and no testnet money enters it. The real P1 version activates only after independent testing of the financial module. The simulation has separate records and a separate unit, `simNEAR`, and never enters the withdrawable balance or the real history.

A loan funds only one specific sub-job's cost. There is no cash payout to the borrowing wallet. The atomic method `loan_and_fund_child` moves credit from the pool's liquidity into that child's escrow; if the child is not funded, the loan is not created either.

The first real version is fully covered: besides the performance bond, a `CreditReserve` belonging to that same creator is locked in testNEAR; the reserve is at least the loan's principal plus its fixed cost. This path separates execution cost in cash-flow terms but creates no new net capital. Real uncollateralized credit could have more commercial value later and could equally impose real losses on providers; it is not in the first version.

| Score | Owner's total cap at issuance rate | Sample fixed cost per loan |
|---|---|---|
| under 400 | lending disabled | none |
| 400 to 599 | 5 Ref USD | 6% of principal |
| 600 to 799 | 20 Ref USD | 4% of principal |
| 800 and up | 50 Ref USD | 2% of principal |

These percentages are demo parameters, not annual, and are not pricing advice for real lending. Before signing, the principal, cost, total debt and due date are shown in testNEAR; no APY is derived from these numbers.

The loan principal cap is the minimum of: half the root's `N0`, the child's remaining cost, the owner's unused cap, free liquidity, and the amount whose principal plus cost is covered by the free CreditReserve. All of these are checked and reserved in one contract call. Each root has exactly one loan in P1.

Debt is fixed in testNEAR units. The base due date is 24 hours after the root case's last allowed resolution time and never more than 14 days from issuance. After the root contract ends, `provider_net` pays the debt first, then the remainder is drawn from that loan's CreditReserve. The surplus collateral frees. A dollar price drop causes no same-unit principal shortfall; code, key and network risk remain.

At due time any account may call `settle_due_loan`; drawing from that loan's reserve and ending the debt is independent of the creator being online. On-time use of the reserve is `REPAID_FROM_RESERVE` and does not count as a credit breach; work-execution failure is reflected in the performance history. `credit_breaches` applies only to an uncollected shortfall or a proven credit violation. A loan past due creates no compound fee or new penalty.

If the child is cancelled before execution and the full principal returns, the principal goes straight back to the pool and the loan cost becomes zero. On a partial child refund, the returned amount pays the principal first; the initial fixed cost remains once execution has started. A simultaneous return to the creator's free balance and the loan principal is not counted.

Example: a 1 testNEAR loan with a 0.04 cost and a 1.04 credit reserve. In the success example of the 20-unit job at price 5, the net is 3.6; the pool gets 1.04 and the creator 2.56, and the 1.04 reserve frees. On full root failure, the client's 4.4 returns; the 1.04 debt is paid from the credit reserve and the performance bond settles separately only by ruling.

In P1 the pool is implemented as closed epochs so that entering and leaving mid-loan does not shift others' profit: `FUNDRAISING → LENDING → REDEMPTION → CLOSED`. Deposits only before LENDING starts, loans only in LENDING, and profit withdrawal only after all active principals reach zero. The maximum loan term is one day and an epoch's total life is at most 15 days. Creating a new epoch is independent of the previous one.

Shares equal the initial deposit amount; a share is not transferable. After the epoch ends, the divisible asset equals the cash present and collected; promised interest is not an asset. Each person gets `floor(final_assets * shares / total_shares)` and the last redemption takes the rounding remainder. The ownership percentage and total amount are recorded at redemption start. Early withdrawal in LENDING is not offered; this limitation must be accepted before depositing.

If an epoch has no shares it closes without division. Before LENDING starts every depositor can take back their principal share. At REDEMPTION start, the total assets and share count are snapshotted once; withdrawals are computed from that snapshot, not from a shrinking live ratio. Loan or epoch finalization does not depend on an exclusive daemon and the due method is callable by anyone.

Even in the covered pool, the phrase `Guaranteed yield` is forbidden. On a collateral invariant failure or code break, stopping new loans, recording the loss and reviewing is required; a loss is not hidden by minting or "manually closing the debt". This pool is a working credit sample of the project itself and no connection to Rhea or another lending protocol is claimed.

## 14. States and official events

| Job state | Allowed entry | Allowed exit and actor |
|---|---|---|
| `OPEN` | client, after hash registration | client cancels; client selects a valid bid |
| `FUNDED` | atomic selection and bond reservation | executor starts; client claims non-execution after the start deadline |
| `RUNNING` | runtime ready | creator delivers; timeout to the refund/dispute path |
| `DELIVERED` | delivery hash and version recorded | evaluator reviews; client approves or disputes |
| `REVISION_REQUIRED` | first mandatory failure | one corrective delivery; deadline end to dispute |
| `REVIEW_OPEN` | check report ready | client approval; automatic-mode window end; dispute |
| `DISPUTED` | valid dispute | arbitrator ruling or timed fallback |
| `SETTLED` | positive creator share | final; output includes the percentage and any shortfall |
| `REFUNDED` | zero creator share | final |
| `CANCELLED` | before funding | final; no financial reservation |

AI, runtime, transaction and liquidity states have separate columns; e.g. `RUNNING + RUNTIME_UNAVAILABLE` is not the same as `REFUNDED`. Job start must be confirmed within 10 minutes of funding; the demo value is 30 seconds. The contract uses the block clock.

Network operations: `PREPARED → SUBMITTED → CONFIRMED` or `FAILED` or `UNKNOWN`. An unknown result means reconciliation is needed, not permission to repeat a new transaction. A stable request id and payload hash are recorded in the contract. The same id with a different payload gives `IDEMPOTENCY_CONFLICT`.

Events: `agent_registered`, `policy_set`, `job_opened`, `bid_recorded`, `job_funded`, `child_funded`, `delivery_recorded`, `checks_recorded`, `dispute_opened`, `job_settled`, `bond_slashed`, `withdrawal_started`, `withdrawal_completed`, `price_updated`. For P1, `loan_funded`, `loan_repaid`, `epoch_closed` are added. Every event carries a version, id, actor, time, source and amount unit.

## 15. Architecture and proposed stack

```text
English React UI
   | wallet signatures / session requests
Fastify API + Zod
   |-- SQLite: metadata, sessions, artifacts, outbox, chain projection
   |-- Local artifact storage: content-addressed JSON/text
Worker
   |-- NEAR RPC --> orby-market Rust contract
   |-- Allowed agent endpoints --> Ollama on creator machine
   |-- Price adapter: fixture / optional free live reference
   |-- Evaluator: deterministic checks + optional AI review
```

Interface stack: TypeScript, React, Vite, CSS variables, accessible Radix components and open-source icons. The MVP chart is built with simple SVG and an equivalent table; React Flow is not a delivery condition. No paid UI kit is needed.

Server: Node LTS verified in M0, Fastify, Zod and SQLite with WAL, foreign keys and migrations; Drizzle is the suggested data layer. The worker is an independent process on the same machine with its queue in the database; Redis and Kubernetes are not needed. Exact versions are fixed in the lockfile after one successful install.

Contract: Rust and near-sdk; unit and sandbox tests with near-workspaces. On Windows, if the native sandbox tooling is incompatible, WSL2 is the suggested path; enabling it needs system access and costs nothing to buy. The React developer should budget separate time for learning/reviewing Rust.

Wallet connection sits behind an adapter. The first proposal is `@hot-labs/near-connect`, verifying `testnet` and `signMessage` support in M0; a Wallet Selector alternative exists. Without message signing, connecting a wallet alone does not count as login. [Connector repository](https://github.com/azbang/near-connect), [NEP-413 standard](https://github.com/near/NEPs/blob/master/neps/nep-0413.md)

The source of truth for money and financial state is the contract. The database keeps only projections and off-chain content. Public RPC is used with caching, backoff and a concurrency limit. An RPC error does not mean a zero balance. [Official RPC provider list](https://docs.near.org/api/rpc/providers)

## 16. Contract versus local data responsibility

| On-chain | Off-chain |
|---|---|
| Agent id and owner, manifest version hash | name, description, endpoint and display information |
| Agreement hash, price, due date, policy and job state | full description, input and criteria text |
| The accepted bid and bond reservation | bid reasons and search data |
| Output hash and review report | text/JSON output, evidence and AI explanation |
| Financial commitment, reservations, settlement and withdrawal | derived reports and state cache |
| Reference price and mode, policies and rulings | raw price payload and tool logs |

The hash is SHA-256 over UTF-8 bytes after canonical JSON; the proposed JCS/RFC8785 implementation is chosen in M0 and fixed with test vectors. The hash includes `schemaVersion`, `jobId`, `revision`, `criteria`, `inputHash`, `policyVersion`. Arbitrary JSON key order must not change the hash.

Confidential information is not sent on-chain. However, amounts, accounts, times and hashes are public. A short guessable text hash can leak information; this version is unsuitable for sensitive inputs. The local file also has no TEE encryption. Demo data policy: fabricated data only, adjustable retention, and off-chain content deletion after taking the output; network history is not erased.

## 17. Contract call surface

This is the contract's proposed ABI and is not a ready SDK. Every writable method takes `request_id` and `expected_version`, except the private callback. A previously executed request returns the same recorded result.

| Method | Allowed caller and deposit | Check and effect |
|---|---|---|
| `register_agent` / `update_agent` | owner; storage cost from separate credit | identity registration; changes only in a future version |
| `set_execution_policy` | owner | caps, whitelist and expiry; raising needs a signature |
| `deposit_funds` / `deposit_bond` | owner; attached NEAR | separate classification; no dollar math |
| `open_job` | client | hash, deadline, budget and mode |
| `record_bid` | agent owner or executor within policy | price, capacity, validity and time; no final reservation |
| `award_and_fund` | client; `attached_deposit=E` | preview validity, bid, bond and policy; atomic reservation |
| `start_job` | that agent's executor | before the start deadline |
| `fund_child` | executor per policy; nothing attached | debits the owner's free balance; reserves the child owner's bond |
| `submit_delivery` | that job's owner/executor | hash, revision and allowed state |
| `record_checks` | authorized evaluator | exact delivery hash, checker version, result |
| `approve_job` | the job's client | records consent and settles if no children are open |
| `open_dispute` | the parties of that job | only inside the allowed window |
| `resolve_dispute` | arbitrator | percentage, reason, penalty; only between the fixed stakeholders |
| `claim_due_transition` | any account | contract clock and fixed conditions; starts the due path |
| `settle_with_funding_price` | either party | definitive price lapse and initial fallback permission |
| `withdraw` | balance owner; 1 yocto from the wallet | reserve before transfer; only to that same owner |
| `on_withdraw_result` | private, the contract itself only | releases the reservation or returns the balance per PromiseResult |
| `update_reference_price` | updater | time, source, mode and circuit breaker |
| `set_params` / `pause_new` | admin | future version; exits and old cases stay open |
| P1 credit methods | owner/provider with signature | separate reserve and the pool state machine |

View methods: `get_agent`, `get_job`, `get_policy`, `get_balance`, `get_operation`, `get_price`, `get_config` and bounded pagination for ids. The withdrawal callback must be private and work with that withdrawal's reservation id. External calls in NEAR are asynchronous and there is no automatic rollback for a whole call chain; a transfer failure must be handled in the callback. [Asynchronous call behavior](https://docs.near.org/smart-contracts/anatomy/crosscontract)

The authorized execution key calls only the explicit executor methods and carries no deposit. Raising the cap, deposits and withdrawals need the owner's signature. The key restriction does not replace per-method permission control. The updater, evaluator, executor, admin and deploy keys are separate and outside the browser/Git.

Contract storage is separated from user assets. The testnet sponsor deposit funds storage growth; on reaching the minimum reserve, only new record creation stops. History retention cost is not secretly deducted from escrow. The request table is not pruned at this scale so replay prevention is preserved.

## 18. Proposed data model

All times are UTC, stored as integer milliseconds on the server; the nanosecond block-time conversion is explicit. Every entity has `id`, `created_at`, `updated_at`, `version`. Amounts are `TEXT` validated as non-negative integers.

| Table | Key fields and constraint |
|---|---|
| `accounts` | `near_account_id UNIQUE`, roles and status |
| `auth_nonces`, `sessions` | nonce hash, domain, expiry, consumed; session id hash |
| `agents`, `agent_versions` | owner FK, manifest hash, status; versions append-only |
| `execution_policies` | agent, owner, ceiling, allowlist, expiry, onchain version |
| `jobs` | client, parent, root, terms hash, book, mode, state, deadlines |
| `bids` | job, agent, version, amount, expiry; acceptance only of the registered version |
| `funding_previews` | actor, payload hash, quote ID, versions, expiry, consumed |
| `runs` | job, revision, `run_id UNIQUE`, endpoint version, state |
| `deliveries`, `artifacts` | content hash, media type, size, storage key; immutable |
| `check_reports` | delivery hash, checker/model version, result, evidence hash |
| `disputes`, `decisions` | job, actor, deadline, reason and award; append-only |
| `chain_operations` | unique account + request ID, payload hash, tx/receipt, state |
| `outbox_jobs` | type, aggregate, sequence, attempt, lease_until, next_attempt |
| `chain_events` | unique receipt ID + event index; block hash and finality |
| `balance_projection`, `ledger_entries` | book, account, bucket, debit/credit, source event |
| `price_snapshots` | source, mode, publish time, observed time, price |
| `audit_log` | actor, action, before/after hash, request ID; no secrets |
| P1 tables | `loans`, `credit_reservations`, `pool_epochs`, `pool_shares`, `redemptions` |

The `TESTNET` and `SIMULATION` books are separated by a composite key; FKs stop a simulation record from crossing into testnet settlement. Role and ownership must be filtered in the server-side query. Changing `job_id` in a URL or API must not reveal someone else's job content.

The internal ledger is double-entry: every internal transfer has at least two equal entries in one book. Financial buckets: free balance, root escrow, child escrow, performance reserve, credit reserve, pool cash, loan principal receivable and withdrawal pending. Gas/storage reserves and simulated balances are not withdrawable funds. The dashboard view is built from these entries.

## 19. API contract and errors

All routes are under `/api/v1`. Mutations require a valid session, an ownership check, CSRF and an `Idempotency-Key`; runtime requests use their own scoped token. Paging is cursor-based with at most 50 records. Error responses include `code`, `message`, `requestId`, `retryable`, `details`, with user-friendly English text.

| Route | Key inputs/outputs |
|---|---|
| `POST /auth/challenge`, `/auth/verify` | one-time nonce; NEP-413 signature and session |
| `GET /agents`, `/agents/:id` | category, price and history filters; public information |
| `POST /agents`, `/agents/:id/test` | manifest or sample-input run; owner only |
| `POST /jobs`, `GET /jobs/:id` | criteria schema, input and terms; read with ownership |
| `POST /jobs/:id/bids/request` | proposal request queue; moves no money |
| `POST /jobs/:id/funding-preview` | bid version and policy; immutable preview |
| `POST /jobs/:id/funding-transaction` | preview ID/hash; transaction payload for the client's signature |
| `POST /operations/:id/transaction` | signed hash; the server verifies from RPC |
| `GET /operations/:id` | real status and next action |
| `GET /jobs/:id/timeline`, `/evidence` | events and the permitted evidence pack |
| `POST /jobs/:id/approve`, `/disputes` | transaction proposal/evidence recording; not immediate financial success |
| `POST /runtime/jobs/:id/deliveries` | run ID, hash and content; scope of that job only |
| `POST /runtime/jobs/:id/children/preview` | need, agent and budget; readable |
| `POST /runtime/jobs/:id/children` | valid policy and preview; the transfer happens only in the contract |
| `GET /creator/earnings`, `/balances` | real/simulated data with separate books |
| `POST /admin/disputes/:id/decision` | percentage, reason and evidence; admin transaction build |
| `GET /admin/system`, `/admin/audit` | health, queue and events; no key display |
| P1 routes | `/credit/preview`, `/credit/loans`, `/pool/epochs`, `/pool/deposit-preview` |

For a financial submission, the API first creates an operation and gives the exact contract/method/args/deposit payload. The wallet signs; the browser reports the hash; the server matches account, network, args and receipt. `CONFIRMED` status is recorded only with the final receipt and the expected result. An HTTP `200` from the server is not a sign of money movement.

Required errors: `AUTH_INVALID`, `FORBIDDEN`, `WRONG_NETWORK`, `PREVIEW_STALE`, `BID_EXPIRED`, `PRICE_STALE`, `PRICE_QUARANTINED`, `INSUFFICIENT_BOND`, `POLICY_LIMIT`, `CHILDREN_OPEN`, `INVALID_STATE`, `DEADLINE_NOT_REACHED`, `RUNTIME_UNAVAILABLE`, `RECONCILIATION_REQUIRED`, `IDEMPOTENCY_CONFLICT`.

Sample payloads and responses are in the `examples` folder. Every schema change must come with a version and migration; at the end of M0 the developer generates the OpenAPI file from the Zod schemas.

## 20. Security, queue and recovery

NEP-413 login must verify a correct signature, a random 32-byte nonce, one-time use, domain/recipient, network, expiry and that the public key belongs to the account. The session uses an HttpOnly, SameSite cookie, and Secure in an HTTPS environment. The localhost exception is development-only. A mainnet address is not accepted on a testnet connection.

All agent inputs, model output, manifests and job documents are data. The sentence "release the funds" inside an output is not an executable command. The runtime's permitted tools are only: receiving input, requesting a hire within the cap, delivering and reading status. The private key and the full server environment are never sent to the model or an endpoint.

Worker processing takes a lease in a database transaction, reads business state and executes the outbox. Network errors get bounded backoff with jitter; validation errors get no retry. The transaction hash and request ID are recorded before waiting. After a restart, `SUBMITTED/UNKNOWN` operations reconcile first; only proven-unexecuted operations are resent with the same ID.

Network events are stored with final finality and a cursor. The indexer reads a few overlapping blocks each time and removes duplicates by receipt/event ID. If it falls behind the needed history and the RPC lacks it, the current contract state is read for balances and the history gap is reported explicitly; no fake history is generated. For the demo, the observed events are archived locally.

For withdrawal, the amount first moves from available to pending; a successful callback finalizes it and a failed callback returns exactly that reservation. An unknown operation does not create a second balance. There is no admin button to "assume the payment succeeded".

Output content is displayed as sanitized text or Markdown; raw HTML, scripts and dangerous URLs are removed. The download link has a safe name and Content-Disposition. Evidence files contain no confidential prompts, tokens or endpoint secrets.

Backups use the SQLite backup API plus a consistent copy of the artifacts; a simple DB file copy is not enough in WAL mode. Backups are taken daily and before migrations. Restore is tested on a fresh database and then the chain projection is rebuilt. The API and Ollama bind to loopback in the demo. A shut laptop means the worker stops; the contract itself and users' contractual rights remain.

## 21. Pages and shared behavior

| Section | Routes | Essential elements |
|---|---|---|
| Public market | `/`, `/agents`, `/agents/:id`, `/explorer` | categories, profile, history and network status |
| Client | `/client/jobs`, `/client/jobs/new`, `/client/jobs/:id` | form, bids, funding, timeline, output and dispute |
| Creator | `/creator/agents`, `/creator/agents/new`, `/creator/runs`, `/creator/earnings`, `/creator/bond` | manifest, run test, policy, earnings and bond |
| Credit | `/creator/credit`, `/lender/pool` | simulated in P0; simNEAR unit and lock explanation |
| Admin | `/admin/agents`, `/admin/jobs`, `/admin/disputes`, `/admin/parameters`, `/admin/system`, `/admin/audit` | suspension, cases, health and versioned changes |
| Settings | `/settings`, `/trust` | account, environment, permissions and trust assumptions |

Every page has loading, empty, error, stale and forbidden states. On amounts, the unit and book always sit next to the number. The labels `Testnet`, `Simulated`, `Seeded`, `Fixture price`, `AI suggestion` and `On-chain confirmed` are non-negotiable.

Visual behavior, sizes, components, English copy and the six sample views are defined in the design system document and `design/preview.html`. The sample look is not official NEAR branding; the phrase `Built on NEAR` is used only next to a precise status.

## 22. Acceptance criteria and required tests

Tests for money, permissions and recovery are delivery conditions. The goal is not an arbitrary coverage number; the high-risk paths must be repeatable. Identical numeric vectors run in TypeScript and Rust. The `examples/financial-vectors.json` file is the independent input of these samples.

| id | Scenario | Required result |
|---|---|---|
| T01 | duplicate nonce, wrong domain or network | login rejected |
| T02 | requesting another account's job | data and mutation rejected |
| T03 | zero/negative/stale price | funding blocked; no fake zero displayed |
| T04 | expired snapshot or bid | `PREVIEW_STALE` or `BID_EXPIRED` |
| T05 | two concurrent awards | only one succeeds and reserves once |
| T06 | insufficient free bond | no part of funding executes |
| T07 | fixed/rising/falling price example | the section 10 numbers exact |
| T08 | split and refund | outputs sum to the lock; no negative refund |
| T09 | retrying the same request with a different body | conflict rejected |
| T10 | executor cap/whitelist/expiry | hire request rejected |
| T11 | child from the client's escrow | withdrawal forbidden |
| T12 | fourth child or second depth | rejected |
| T13 | self-hire with the same owner | rejected |
| T14 | root ending with an open child | settlement waits |
| T15 | root failure after the child was paid | the child's money is not clawed back |
| T16 | runtime timeout and retry | the same run continues; no re-run/re-pay |
| T17 | malicious HTML output or prompt injection | no code runs and no money moves |
| T18 | model off/broken JSON | `UNAVAILABLE`; no penalty created |
| T19 | two model FAILs | human case; no automatic slash |
| T20 | automatic mode with a mandatory FAIL | automatic settlement rejected |
| T21 | client-approval criterion | silence is not recorded as approval |
| T22 | last-moment dispute | the contract's final state decides before settlement |
| T23 | non-delivery and end of the objection window | one refund and one contractual penalty |
| T24 | arbitrator deadline passes | signed fallback, without arbitrary-destination access |
| T25 | worker shutdown and restart | unknown operations reconcile; no repeated financial commitment |
| T26 | withdrawal failure | pending frees exactly |
| T27 | forged withdrawal callback | rejected |
| T28 | site pause | new funding closed; withdrawal and case resolution open |
| T29 | admin parameter change | old jobs keep their snapshot |
| T30 | excessive price jump | quarantine and a documented recovery path |
| T31 | long price outage | fallback with P0 only after the deadline |
| T32 | Seeded and simNEAR | do not change real balances or scores |
| T33 | one owner's concurrent jobs | total reservations never exceed the balance |
| T34 | backup and restore | metadata and output hashes stay consistent |
| T35 | unsuitable model memory/time | explicit, runnable deterministic mode |
| T36 | 375px mobile and 200% zoom | primary action usable and text readable |
| T37 | keyboard and modal | correct focus, Escape and focus return |
| T38 | interface text | English; unit and data type explicit |
| T39 | private endpoint and DNS rebinding in P1 | connection blocked |
| T40 | loan without sufficient CreditReserve | both issuance and child funding rejected |
| T41 | two loans on one reservation | only the first allowed; owner cap respected |
| T42 | successful/from-reserve repayment | principal and cost collected once |
| T43 | return of a child carrying a loan | principal reaches the pool, not the free balance |
| T44 | deposit mid-epoch | rejected |
| T45 | withdrawal before loans end | rejected; withdrawable zero with a reason |
| T46 | share redemption and rounding | exact sum of final assets and no double redemption |
| T47 | imbalance or under-covered reserve | new loans stopped and the loss not hidden |
| T48 | the package on another developer's machine | the README commands run with fixtures and no paid service |

Property-based tests: total commitments never exceed controlled assets; no negative reservation; each settlement at most once; reordering two allowed requests does not break invariants. P1 is not called "real testnet" without passing T40 through T47.

## 23. The ten-day plan and staged delivery

This plan counts from the development start date. If the start is 6 November, ten calendar days reach 15 November, which is not the same as the contest window. At review time the official page announced a deadline of 14 November 2026 at 23:59 UTC, equal to 15 November at 03:29 Tehran time; for that contest, 14 November must stay reserved for recording and submitting. [Contest schedule](https://nearhackathon.com/)

| Day | Deliverable | Pass condition |
|---|---|---|
| 1 | M0: tooling runs, signing, faucet, a small contract, local model and fixture | testnet login and one reversible sample transaction in the dev environment |
| 2 | UI/API skeleton, accounts, manifest, job form | role-aware save and retrieval; UI without a paid API |
| 3 | Escrow contract, bond, preview and settlement formula | money, reservation and idempotency tests |
| 4 | Wallet, funding, receipt and withdrawal | one simple real end-to-end flow |
| 5 | Runtime, three local agents and bids | one job with real output and a check report |
| 6 | Sub-agent hiring and policy | cost from the creator's balance; cap control |
| 7 | Review, correction, dispute, timeout | both the success and failure paths complete |
| 8 | Timeline, money chart, history and admin | the cause of every change and recovery operation visible |
| 9 | Simulated credit, responsive and acceptance testing | sim/testnet separation; main bugs fixed |
| 10 | Freeze, backup, README, video and the delivery package | reinstall and run the demo from scratch |

For a developer fluent in React but new to Rust, ten days is tight. The engineering estimate for the core is 10 to 15 person-days and P1 about 8 to 12 more. This estimate is not a deadline guarantee. The whole main scope plus real trial credit needs roughly 18 to 27 person-days. TEE execution and mainnet are not in this estimate.

If a second person joins: the first takes UI/API/runtime and the second contract/financial tests/indexer. The API and financial vectors are jointly fixed on day one. Every day must keep one demoable path; work on several half-finished pages is not a progress measure.

Cut order under time pressure: the leaderboard, the live price connection, external endpoints, IronClaw, chart decoration, detailed lender UI. Real credit moves to P1. Correct escrow, hiring at least one sub-agent, withdrawal, timeout, the simulation separation and the no-double-payment test are never cut. If this core is not ready, the product is called only a prototype.

## 24. Prerequisites, cost and setup without purchases

| Need | Option | Purchase needed | Limit |
|---|---|---|---|
| Development machine | the existing laptop; preferably 16 GB RAM and 10-20 GB free | no | model capacity measured in M0 |
| Model | a small suitably licensed model in Ollama | no | CPU is slower; download and electricity are running costs |
| Web and server | localhost on the same machine | no | the machine must stay on; not a permanent public service |
| Network | testnet and faucet | no | quota, disruption and resets possible |
| RPC | a public endpoint | no | caching and backoff needed |
| Price | fixture; optional Demo connection | no | free signup/key may be needed |
| Database and files | SQLite and local disk | no | local backups essential |
| Design | CSS/SVG, open-source icons, system font | no | no paid Figma or purchasable assets needed |
| Repository and demo | local Git, later permitted publication; local video recording | no | publication does not happen at this stage |

An 8 GB machine can be tried for deterministic review and a smaller model; sufficient capacity is not assumed. Without a runnable model, three deterministic runtimes labeled `Deterministic demo` show the product flow; they must not be presented as LLM execution.

Target commands for the future software package: `pnpm install --frozen-lockfile`, `pnpm db:migrate`, `pnpm demo:seed`, `pnpm dev`, `pnpm worker`, `pnpm test`, `pnpm test:e2e` and `cargo test`. These commands are not implemented in this documentation package; the developer builds them with these functions in the application repository.

No paid service sits in the automatic fallback. All API keys are optional and empty by default. The `.env.example` file contains no real secret. On a free-tier failure the fixture/local run is chosen; buying and mainnet connection are separate decisions.

## 25. Demo scenario and how the product is measured

A three-to-four-minute demo with fabricated data:

1. The client picks the comparison-report template; the output, criteria and 20 Ref USD budget are set.

2. Three agents bid; the client chooses `Brief Writer`. The preview shows the assumed rate of 5, the 4.4 testNEAR lock, that the fee comes out of the paid share, and that dollars are not guaranteed.

3. The client signs on testnet. After the real receipt, the timeline shows `Escrow funded`.

4. The main agent, with the creator's pre-authorized budget, hires the `Source Extractor`. The sub-job and its money transfer are recorded in the contract.

5. Outputs are delivered; the deterministic check and the AI suggestion display separately. The client approves, or in the automatic template the short demo window elapses.

6. Settlement and the withdrawable balance display; the creator makes a trial withdrawal with a real receipt.

7. A pre-prepared failure case shows how dispute, refund and penalty differ. The credit section, with `Simulated`, explains how loan money reaches the sub-job.

Internal success criteria: first job created in under three minutes by a test user, one real two-agent collaboration, all amounts fully reconciled, the timeout path running after a restart, zero purchase cost and no claim of an unbuilt capability. Model and network response times are measured and reported; no fake SLA is invented for them.

Proposed English pitch: `Hire AI agents. Define the outcome. Settle on NEAR.` Subtitle: `A testnet marketplace for agent work, bounded delegation, and transparent settlement.` The most important NEAR display is the transaction itself and the agent's limited authority; adding the logos of unused tools creates no technical value.

## 26. Delivery package and the developer's starting order

First read this document and the section 2 corrections; then `DESIGN_SYSTEM.md` and the English sample `design/preview.html`. The `design/tokens.css` and `design/tokens.json` files are the proposed visual contract. The JSON samples and financial vectors in `examples` are given for implementation and testing.

Proposed application repository structure:

```text
apps/web
apps/api
apps/worker
agents/brief-writer
agents/source-extractor
agents/format-reviewer
packages/domain
packages/schemas
packages/near-adapter
packages/ui
contracts/orby-market
tests/financial-vectors
tests/e2e
docs
```

The first executable task is M0: proving signing and a small contract, fixing tool versions, running the model on the actual hardware and recording the result. Essential changes are written as short ADRs: decision, reason, effect on scope and tests. No financial ambiguity is resolved by guesswork in the UI.

The final software delivery criterion: code and lockfile, migrations, tests and results, the real deployment address, an exact list of real/simulated parts, the recovery command, fabricated seed data, the demo video and a version manifest. The package must not contain a seed phrase, private key, session cookie or a real environment file.

## 27. Resources and decisions submitted for approval

Technical resources are linked in their sections and were checked on 6 November 2026. What is said about the product, parameters, time and cost is this document's proposed engineering decision, not a guarantee from NEAR or providers. Checking free capacity, libraries and the wallet on the developer's machine in M0 remains necessary.

Decisions submitted for approval: keeping the agent marketplace and sub-agent hiring as the core; real payment on testnet only; a dollar reference with a cap and no guarantee; assisting AI with human dispute resolution; one contract with separate modules; simulated credit in the ten-day slice and covered credit in P1; an English look per the design system; zero service purchases.

This package is the standalone statement of work for the second developer. Approving it means accepting the design baseline; actually starting up, buying, publishing publicly or submitting to the contest is not done by this file itself.
