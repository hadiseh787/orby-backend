# Orby review-v2 submission preparation

The source remains in the two private repositories requested by the owner:

- [Frontend](https://github.com/hadiseh787/orby-frontend)
- [Backend, contract and launcher](https://github.com/hadiseh787/orby-backend)

The backend `workspace.json` pins the exact paired frontend commit. Clone the backend and run `npm run local`; a user with access to both private repositories gets the complete application. The final backend commit is the commit containing this document; `git rev-parse HEAD` identifies it without a self-referential hash.

## Included evidence

- `REVIEW_V2_RELEASE.fa.md`: all six defects and six features, boundaries and reproduction commands.
- `orby-deployment.json`: exact deployed WASM hash and contract version.
- `orby-v3-upgrade.json`: exact preservation of all nine V2 maps and liabilities.
- `orby-v3-load.json`: actual WASM/RPC withdrawal callback at a stated load target.
- `orby-browser-testnet.json`: actual wallet-signature, funding, revision, settlement, withdrawal and receipt verification flow.
- `orby-delegated-testnet.json`: separately funded child and root flow.
- `demo/`: local recording and UI evidence. A simulation video is labelled as simulation; real testnet evidence is in the separate receipt reports.
- MIT `LICENSE` in both repositories; asset/font licenses remain in place.

## Public submission still requires publication

Repository visibility has not been changed: the owner explicitly requested private repositories. No X message has been sent. Making source public, choosing a public video host and posting to X are external publication steps, separate from preparing these artifacts. The original supplied review's score is not a new score for this implementation.

The [official event rules](https://nearhackathon.com/HACKATHON.md) were retrieved on 9 November 2026. They currently require public source by 14 November 2026 at 23:59 UTC and a human-published X demo post tagging @NEARProtocol and #NEARHackathon. Recheck them before submitting. Disclose the actual build dates and pre-existing code. Q-015 requires disclosure of another independent submission by the same participant; the code cannot establish a participant's other submissions. No application has been submitted by this release workflow.

Draft copy, **not posted**:

> Built at NEAR HACKATHON: Orby connects clients and agents through bounded NEAR testnet agreements, delegated work from the creator balance, version-bound review and an exportable Work Receipt. Angular/Node/PostgreSQL, one-command local startup. Demo: [public video URL pending]. Source: [public repository URLs pending]. @NEARProtocol #NEARHackathon
