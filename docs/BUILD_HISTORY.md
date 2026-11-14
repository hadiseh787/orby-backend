# Build history and attribution

This file distinguishes the repository's dated source history from later acceptance evidence. It does not invent a pre-hackathon origin statement or claim every imported line was written during the event.

## Repository history

The public backend Git history inspected for this documentation update begins with [a543c0b](https://github.com/hadiseh787/orby-backend/commit/a543c0b658522d188acc59e4d177aec812848b37), dated **6 November 2026**. [bab0231](https://github.com/hadiseh787/orby-backend/commit/bab023163b8a099cadab89ef8cbbd49cc747206f) explicitly imports original workspace root files. Initial delivery contains marketplace/API/PostgreSQL/contracts; that is a release baseline for subsequent comparisons, not proof that imported material had no earlier history.

The event's published rules permit development from its 19 October announcement through the 14 November deadline. Earlier work counts as baseline. The entrant must disclose any earlier product, library, template or imported code that applies; repository import dates alone cannot establish original authorship dates. If another independent project is entered by the same participant, its name/link must also be disclosed as required by Q-015. No such additional project or definitive pre-window declaration has been supplied for this update.

## Dated implementation stages

| Date in UTC | Commit | Recorded change |
| --- | --- | --- |
| 6 Nov | [a543c0b](https://github.com/hadiseh787/orby-backend/commit/a543c0b658522d188acc59e4d177aec812848b37) | API, database, contracts and local launcher delivery |
| 6 Nov | [79edd07](https://github.com/hadiseh787/orby-backend/commit/79edd076912976e482ab0331893f71137d79cb03) | Native contract/workflow and portable startup release |
| 7 Nov | [d5af65c](https://github.com/hadiseh787/orby-backend/commit/d5af65cd30f29f7f56a0bc2b92eb67213ea733cd) | Wallet-flow and audit fixes |
| 7 Nov | [87e8713](https://github.com/hadiseh787/orby-backend/commit/87e871328bc94b6b8c8bd126c2a5259f3623de5c) | Programs, private knowledge and Sheets integration paths |
| 9 Nov | [c36dba9](https://github.com/hadiseh787/orby-backend/commit/c36dba90aa2da97fcdc83df133cf48cde728f0f2) | V3 migration and review features |
| 14 Nov | [b875f1b](https://github.com/hadiseh787/orby-backend/commit/b875f1bcbf4938f63ee2029c547e5ca00227ae3a) | Bounded real-model mission and testnet demo |
| 14 Nov | [e5312d4](https://github.com/hadiseh787/orby-backend/commit/e5312d436b47ffed9cd21af8b55105191512922e) | Repeatable revisions, safe quotes and sample/workflow reliability |
| 14 Nov | [b03ced8](https://github.com/hadiseh787/orby-backend/commit/b03ced804ea0e460936781ccc43681a399eb1a7c) | Independent macOS setup, verified executor readiness and eight specialists |
| 14 Nov | [549767e](https://github.com/hadiseh787/orby-backend/commit/549767ef67b7655acdf29013c03288abc44a1857) | Revision used by successful native Mac acceptance |
| 14 Nov | [5a62fe7](https://github.com/hadiseh787/orby-backend/commit/5a62fe73d66bb6e225e979d8bce07ed81f326ba5) | Preserve adjacent checkouts and select the pinned frontend |
| 14 Nov | [12943d5](https://github.com/hadiseh787/orby-backend/commit/12943d5fca26e09649b262b51e9f2a1cdcb4342d) | Publish successful native Mac evidence |
| 14 Nov | [720bd30](https://github.com/hadiseh787/orby-backend/commit/720bd3031ccf8930236fd77461d4f9ad9779b53e) | Public history secret-review record |

Reviewable comparisons:

- [Initial delivered baseline → 1.5 evidence snapshot](https://github.com/hadiseh787/orby-backend/compare/a543c0b658522d188acc59e4d177aec812848b37...720bd3031ccf8930236fd77461d4f9ad9779b53e)
- [V3 review release → bounded real-model missions](https://github.com/hadiseh787/orby-backend/compare/c36dba90aa2da97fcdc83df133cf48cde728f0f2...b875f1bcbf4938f63ee2029c547e5ca00227ae3a)
- [Prior installed-demo evidence → portable native Mac release](https://github.com/hadiseh787/orby-backend/compare/09dfd276d68addbed47c6142fe656b8a3bd6cc54...720bd3031ccf8930236fd77461d4f9ad9779b53e)

These diffs describe release stages **inside** the available history; none is mislabeled a pre-hackathon tag. Subsequent documentation commits remain visible in Git history. The entrant should record the actual final reviewed commit/tag when the entry is finalized, rather than reuse an earlier implementation hash as the final entry by accident.

## Tested revisions versus current source

The successful [native workflow](https://github.com/hadiseh787/orby-backend/actions/runs/43634985936) ran backend `549767ef67b7655acdf29013c03288abc44a1857` with frontend `16f188ecfd4627dbcfad0835c09c69998fe88bf5`. Later launcher selection correction and its regression scope are documented in [PORTABLE_RELEASE.md](PORTABLE_RELEASE.md). Documentation-only changes do not create a new native execution result.

[`workspace.json`](../workspace.json) is authoritative for the runtime frontend pin. A later frontend documentation commit need not replace an already tested application pin. The two repositories form a single project.

## Dependencies and reuse

Versions and full transitive dependencies are recorded in the backend/frontend `package-lock.json` files and contract `Cargo.lock` files. Important reused components include:

| Component | Project use | Primary reference |
| --- | --- | --- |
| Angular, RxJS and TypeScript | Frontend application and typed code | [Frontend manifest](https://github.com/hadiseh787/orby-frontend/blob/main/package.json) |
| Fastify and plugins, Zod | API transport, cookies, headers, validation and rate limits | [Backend manifest](../package.json) |
| PostgreSQL, pg, embedded-postgres | Persistence and local database provisioning | [Backend lockfile](../package-lock.json) |
| near-api-js, NEAR Rust SDK | Testnet interaction and contract implementation | [Backend manifest](../package.json), [contract source](../contracts/orby-market/) |
| @hot-labs/near-connect | Wallet connection UI | [Frontend manifest](https://github.com/hadiseh787/orby-frontend/blob/main/package.json) |
| Ollama | Local model runtime | [Ollama](https://github.com/ollama/ollama) |
| Qwen2.5-1.5B-Instruct GGUF | Default model weights, not a model trained by Orby | [Upstream model](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF) |
| Playwright and axe-core | Browser automation and scoped accessibility checks | [Frontend manifest](https://github.com/hadiseh787/orby-frontend/blob/main/package.json) |
| NEAR Intents 1Click API | Mainnet-only dry quote discovery/preview | [Adapter](../src/intents.ts), [official docs](https://docs.near-intents.org/) |

Project source is [MIT](../LICENSE). Upstream software, weights and assets retain their own licenses; Orby's MIT file does not relicense them. Existing brand/font notices remain with their tracked assets, including the [handoff font notice](handoff/Orby-Handoff-v1/FONT_LICENSE.txt). No external template, paid asset or undisclosed original model training is claimed by this attribution list.

AI-assisted code and documentation are allowed by the event. This update was prepared with AI assistance and reviewed against source/evidence; no claim of wholly manual authorship is made. This does not infer an exhaustive tool-use history for earlier contributors. The entrant should add any additional reused code/assets or earlier work before final submission if applicable.

## Historical documents

The 1.4, 1.4.1 and owner-Windows reports are retained as dated evidence. Their references to then-private repositories or older setup requirements are historical, not current installation instructions. Current entry points are the [root README](../README.md), [native evidence](mac-acceptance/README.md), [portable setup](PORTABLE_SETUP.md) and [submission checklist](SUBMISSION.md). The former submission-preparation text remains inspectable in [the prior revision](https://github.com/hadiseh787/orby-backend/blob/720bd3031ccf8930236fd77461d4f9ad9779b53e/docs/SUBMISSION.md).
