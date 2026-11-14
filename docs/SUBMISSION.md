# Orby hackathon submission preparation

This is the current **Orby 1.5** checklist, replacing older preparation notes. The [backend](https://github.com/hadiseh787/orby-backend) and [frontend](https://github.com/hadiseh787/orby-frontend) are public. They are one project; the backend is the recommended primary repository because it contains contracts, the complete launcher and the pinned companion frontend.

Preparing this repository does **not** register a contest entry, publish an X post, create a prize wallet or provide proof that an entry was accepted. No public X post URL or organizer submission receipt was supplied for this documentation update. If the entrant has already submitted elsewhere, use the correction procedure instead of creating another application.

## Rules and timing

Recheck [the official live rules](https://nearhackathon.com/HACKATHON.md) immediately before submitting. The rules reviewed on **14 November 2026 UTC** state a submission deadline of **2026-11-14 23:59 UTC**, equivalent to **15 November 2026 03:29 in Tehran**. The same published deadline applies to making the repository public. Keep both repositories public through judging.

A local-only demo is eligible with public source, reproducible README and a public X demo **video**. A screenshot-only post is insufficient when judges cannot access the local application. Hosting is optional. All applicable tracks belong in one application, not duplicate entries.

## Repository preparation

- [x] Public backend and companion frontend verified during this update.
- [x] MIT LICENSE retained in both repositories; upstream licenses remain applicable.
- [x] Complete install/update/model/testnet/recovery instructions in the root README.
- [x] [Action-and-result judge walkthrough](JUDGES_GUIDE.md).
- [x] [Current native recording/evidence index](mac-acceptance/README.md), with simulation/testnet/mainnet-preview distinctions.
- [x] [Dated build history, diffs and attribution](BUILD_HISTORY.md).
- [x] Historical/private-visibility statements removed from the current submission guide; earlier source remains in Git history.
- [ ] Entrant confirms any pre-window/imported work and any other independent project entered by the same participant. Public import dates are not a substitute for that declaration.
- [ ] Entrant selects the final submission revision/tag after reviewing any remaining implementation changes.
- [ ] Entrant publishes the public X execution-demo post and supplies its URL.
- [ ] Entrant confirms identity, team size, tracks, mainnet payout address and contact consent.
- [ ] Submit once after exact-payload review and retain the success receipt privately.

Do not mark owner-dependent items complete merely because documentation was committed. Do not commit private contact/payout payloads, request IDs, keys or saved application responses into public source.

## Recommended evidence

Lead with the [actual native Mac execution video](mac-acceptance/real-mission-7d3b7a71-40be-43ec-9522-3db54f0f4274.webm). It shows a real-model mission with approved plan, specialist hire, one disclosed controlled failure/recovery, applied Revision 1 and verified testnet settlement. An explanatory motion graphic can supplement it, but is not a recording of product execution.

The recorded browser wallet uses locally generated development fixtures to sign real testnet transactions and NEP-413 messages. It must not be described as a human manually approving HOT/Meteor dialogs. Eight catalog checks use actual inference but simulated funds; keep that distinction in video captions and descriptions. Historical quote amounts are expired observations, not current offers.

For a short edited execution demo, show:

1. Goal and editable agreement with supplied sources.
2. Brief Writer proposal, permitted specialist and approved budget plan.
3. Exact testnet escrow and creator-funded specialist execution.
4. Actual output/checks, targeted revision and changed Revision 1.
5. Approval of the current version, itemized settlement and verified receipt/transaction links.

Skip long setup/architecture introductions. Disclose edited waits and controlled failure if used. The published rules do not impose the motion graphic's length on the actual demo.

## Track fit for owner review

| Track ID | Fit supported by the current project | Qualification |
| --- | --- | --- |
| `agents` | A lead agent hires a specialist and pays for accepted work | Strongest fit; show actual creator-funded testnet work |
| `swarms` | Proposal/coordination market, approved handoff and bounded recovery | Show multiple roles and their acceptance/settlement evidence |
| `security` | Method-limited function-call executor, policy/spend ceilings and version-bound approval | Disclose trusted evaluator/admin and lack of independent audit |
| `business` | AI-assisted work, budgets, specialist procurement and revenue allocation | Human approval remains; do not claim unrestricted autonomous treasury |

These are recommendations, not a submitted selection. Do not claim privacy/TEE, mainnet lending or cross-chain execution merely because local inference, a simulated pool or a dry quote exists. Partner integrations and prompt examples are optional under the rules.

## Project description draft

Owner-review draft for the `idea` field, not an application sent to the organizer:

> Orby is a marketplace for agent work where clients define acceptance criteria and a fixed budget, review an AI-generated agreement and execution plan, then approve a specific delivered version. A lead agent can hire a permitted specialist using creator funds, with one bounded recovery when checks fail. NEAR V3 testnet contracts provide escrow, restricted executor policies, delivery commitments and settlement accounting. The work receipt exposes checks, decisions, costs and final transaction links. The local Angular/Node/PostgreSQL application includes eight supplied-source comparison agents and real Ollama inference. A recorded independent Apple Silicon run demonstrates actual testnet funding, specialist recovery, Revision 1 and verified settlement. Mainnet Intents is explicitly dry-quote preview only; simulation funds, testnet payments and mainnet preview are separate. No mainnet transfer, TEE or production custody is claimed.

The entrant must review the final length (20–2000 characters) and factual scope before sending it. Final team identity, email, team size, payout account, public post URL and consent are never inferred from repository files.

## X post requirements

The entrant publishes the post themselves. It must say the project was built at **NEAR HACKATHON**, include **@NEARProtocol** and **#NEARHackathon**, attach the execution demo and explain the concrete NEAR role. Optional community tags: @NearLegion and @NearBuilders. Link the public source and invite specific feedback.

Do not replace the public post URL with a localhost address, raw recording URL or an invented tweet ID. A recorded GitHub video is supporting evidence; it is not itself the required public X post.

## Final owner information and consent

Before using [the submission form](https://nearhackathon.com/#apply), obtain and confirm:

| Field | Validation |
| --- | --- |
| Project name | 2–80 characters |
| Team lead name | 2–80 characters; entrant-confirmed |
| Email | Valid, max 160 characters; no more than two independent entries per person/email under the event rules |
| Team size | Exactly `1`, `2 - 4`, `4 - 6`, `6 - 8` or `8+` |
| Tracks | At least one valid unique track ID; final owner choice |
| Prize account | Owned **NEAR mainnet** named or 64-character implicit account; not a testnet fixture |
| Repository | Public backend URL recommended; companion frontend linked in README |
| Demo | Actual public X demo post URL |
| Description | 20–2000 characters; problem, product and concrete NEAR role |
| Contact consent | Explicitly accepted by the entrant |

Required consent notice, verbatim:

> I agree that the organizers may use these details to review our submission and contact us about this hackathon.

For API submission, the only fields are `requestId`, `projectName`, `leadName`, `email`, `size`, `tracks`, `nearAddress`, `projectUrl`, `demoUrl`, `idea` and `consent`. Generate one UUID requestId locally and retain it privately for retrying the same entry. Do not add `website` or other fields. Show the exact completed JSON to the owner and wait for explicit approval before sending. No example credentials or generated contact identities should be sent.

## Confirmation and correction

- `201`: saved; retain the confirmation privately and stop submitting.
- `400`: correct the named invalid fields and reuse the same requestId.
- `403`: submissions closed or cross-site request rejected; report it, do not repeatedly retry.
- `409`: repository already submitted or entry limit reached; do not change the URL/email to bypass it.
- `413`: shorten the body/description within the published limits.
- `503` or an uncertain network result: follow the official retry procedure with the **same** requestId; never create a second project identity to retry.

Saved-entry mistakes are handled by the entrant at [request changes](https://nearhackathon.com/request-changes), using the previously submitted email/account/repository and the requested replacements. Organizer review is manual; this is not permission for a duplicate entry or a guaranteed deadline extension.
