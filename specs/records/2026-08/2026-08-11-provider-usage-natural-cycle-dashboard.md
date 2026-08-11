# Provider Usage And Natural-Cycle Dashboard

Date: 2026-08-11

API means Application Programming Interface. UI means User Interface. USD means
United States dollars. IANA means Internet Assigned Numbers Authority.

## Recall

| Item | Evidence and requirement |
| --- | --- |
| User request | Audit whether every Provider supports Token counting and billing, set a Goal to integrate usage statistics for every API, and design a complete, polished statistics page that shows the user's Token usage in natural calendar periods. Use an independent Agent review so the delivered page is not low-quality filler. The user then tightened the requirement: statistics must be meticulous, use official Provider interfaces wherever they exist, aggregate without simplification or incorrect arithmetic, and pass independent review. |
| Visual reference | The user supplied a dark Token-activity Profile screenshot and allowed an upgraded version. Preserve its restrained dark rhythm, centered primary number, continuous metric strip, activity heatmap, and two-column insight density; do not copy unrelated social/Profile concepts. |
| Goal | The active Codex Goal owns the full delivery: Provider audit, normalized metering repair, one statistics API, natural-cycle page, real-page visual acceptance, independent read-only Agent review, commit, and normal upstream push. |
| Acceptance | Every production streaming language-model Provider call, including Session and non-Session helpers, reaches one normalized request-usage ledger; input, output, reasoning, cache-read, cache-write, total Token, calculated USD cost, Provider/model, purpose, event time, and price-coverage state are retained once per upstream step. `day`, `week`, `month`, and `year` use a strict IANA time zone and real calendar boundaries. Official organization usage, official invoiced cost, account balance, and quota sources are fetched when the Provider publishes an applicable API and the required administrative scope is configured. Local and official ledgers stay distinct and expose reconciliation instead of being blindly summed. The desktop Settings/Data page renders exact current-period local usage, configured official credential sources and facts, cloud-control-plane coverage, reconciliation, composition, trend, Provider mix, top models, and pricing coverage with loading, empty, partial, and error states; unconfigured admin-key sources remain in the API inventory but are omitted from the page. |
| Hard constraints | Keep all language-model interactions streaming. Do not add a second pricing calculator, historical repricing, fake credit amount, invented Token usage, hidden/synthetic message, fallback, route gate, or UI automated test. Do not reuse ordinary inference credentials for administrative endpoints whose official contract requires an admin/management credential. Do not call an unavailable vendor endpoint by guessing an undocumented URL or response schema. Do not add local request usage to organization-wide official usage: their scopes overlap. Preserve unrelated dirty Overlay and website changes. Use one dedicated local usage-event table as the sole current request ledger, backfill historical `step-finish` facts during the registered schema migration, and reuse existing settings/design-language primitives. Desktop scope only. |
| Repository identity | `D:/myhexin-local/opencorvus`, `main`, `HEAD=1e552c414f2348724a9db3f3e72776fd49da5060`, upstream `origin/main`, remote `https://github.com/yangheng95/opencorvus.git`. The worktree already contains unrelated Overlay debug and public-website edits; task ownership must remain path- and hunk-bounded. |
| Sources read | Root `AGENTS.md`; `specs/current/architecture/06-provider.md`; `specs/records/2026-08/2026-08-06-conversation-turn-control-and-model-usage.md`; `specs/records/2026-08/2026-08-05-composer-personal-model-usage-hover.md`; Provider catalog, bundled adapters, model schema, `Session.getUsage`, Session processor, assistant-message schema, CLI stats command, server routes, generated SDK contract, Config dialog, settings composites, design tokens, turn-usage projection, and usage formatting. |
| External authority | AI SDK 6 documents `inputTokenDetails.{noCacheTokens,cacheReadTokens,cacheWriteTokens}` and `outputTokenDetails.reasoningTokens` as the current normalized fields while the flat cached/reasoning aliases are deprecated. OpenAI publishes separate organization Usage and Costs APIs and explicitly does not promise perfect reconciliation between them. Anthropic publishes separate organization Messages Usage and Cost Report Admin APIs. OpenRouter publishes management-key credit/key-usage endpoints. AWS Bedrock exposes Token metrics through CloudWatch and cost through Cost Explorer/Cost and Usage Reports at a coarser grain. Azure exposes Azure OpenAI Token metrics through Azure Monitor and invoice truth through Cost Management. Google Cloud exposes time-series metrics through Cloud Monitoring and billing truth through Cloud Billing export. These cloud control planes require project/subscription/account identities and cloud-scoped credentials; a normal model API key is not a substitute. Pricing remains OpenCorvus request-time model metadata sourced from models.dev or explicit Provider config. |
| Whole-repository search | The 24 bundled adapter packages are registered in `provider/bundled.ts`, while dynamically installed packages also enter the same Provider registry. Session calls flow through `finish-step`, but Provider connectivity, VCS commit-message generation, Metric Judge, and acceptance translation call the shared streaming wrapper without creating Session Parts. Therefore `step-finish` cannot be the complete ledger. All production calls do pass through `src/llm/api.ts`, so its per-step callback is the structural single owner. The CLI statistics command scans Sessions and filters on Session update time, so it can include old messages in recently touched Sessions and omit correct event-time calendar semantics. No official organization-usage aggregator or full usage page existed before this task. |
| Independent Agent feedback | First read-only review found no P0 and six valid issues: non-Session streams were omitted; Plugin price availability was not normalized; long-context threshold omitted cache-write and config merging discarded the long-context rate; period switching could label stale data as the new period; time-zone validation admitted non-IANA aliases; and the year grid was not weekday aligned. It also warned that generated SDK, i18n, and spec indexes contain unrelated dirty hunks. All findings are accepted and must be fixed before terminal review. |

## Problem-Depth Analysis

### Observable state

- Conversation turns can show persisted per-message Token and cost facts.
- `opencorvus stats` can print aggregate totals, but the Overlay has no historical
  statistics page and no HTTP contract for a natural period.
- Account-usage hover is a separate upstream quota/balance capability and is not
  a history ledger; it cannot answer how many Tokens OpenCorvus used.

### Direct trigger

The product has event-level facts but no time-window aggregation boundary or UI
projection. The only aggregate implementation is CLI-owned, scans Session trees,
and selects Sessions using `session.time.updated`, not assistant-message occurrence
time.

### Data-flow root cause

The Session path is almost canonical:

`Provider stream -> AI SDK LanguageModelUsage -> finish-step -> Session.getUsage`
`-> Message.Assistant aggregate + StepFinishPart occurrence -> SQLite`

Six gaps remain:

1. `Session.getUsage()` reads deprecated flat cache-read and reasoning aliases and
   obtains cache-write mostly from selected Provider metadata. AI SDK 6 exposes the
   complete Provider-neutral detail fields directly; ignoring them can undercount
   cache writes even when an adapter normalized them correctly.
2. The persisted usage occurrence stores a numeric cost but cannot distinguish a genuine
   zero-priced model from a model whose catalog/config supplied no price. Filling
   absent prices with zero hides billing coverage.
3. There is no event-time aggregation service. The CLI implementation owns a
   presentation-shaped accumulator and cannot safely become both CLI and HTTP fact
   sources without extraction.
4. Four production helper paths stream Provider calls outside Session persistence,
   so a Part-only query systematically omits real requests.
5. Provider-issued organization usage, cost, quota, and balance have different
   scopes and settlement delays. Treating them as one additive number would double
   count overlapping requests and confuse estimated cost with invoice truth.
6. Cloud Providers expose metering through their control plane rather than their
   inference key. Correct integration needs explicit account/project/subscription
   identity and credential scope, not guessed endpoints or credential reuse.

### Why the old paths do not solve it

- Per-turn UI answers only one Conversation turn and loads only the selected tree.
- Provider account usage reports quota or monetary balance for the few upstreams
  that publish it; it is not OpenCorvus request history.
- Current-model repricing of historical messages would violate event-time truth and
  make old totals change when a catalog refreshes.
- Session update-time filtering is not a natural-period usage query.

### Impact surface

| Surface | Required change |
| --- | --- |
| Provider normalization | Prefer AI SDK 6 detail fields, retain provider metadata only for older Provider-specific data not represented by the normalized contract, clamp invalid counts, and keep one calculator. |
| Model price metadata | Preserve whether pricing was supplied instead of making absent price indistinguishable from a real zero rate. |
| Persistence | Add one `provider_usage_event` table written by the shared streaming wrapper once per completed upstream step. Register a forward-only migration that creates the ledger and backfills historical Session `step-finish` facts. Retain assistant aggregates only for Conversation projection; statistics read only the ledger. Existing backfilled rows remain explicitly `unknown`, not silently relabeled. |
| Aggregation | Query `provider_usage_event` by occurrence time and aggregate each completed API call exactly once; support strict IANA day/week/month/year bounds and deterministic bucket fill. Fetch each configured official source independently with bounded pagination/timeouts and return partial status rather than discarding valid local facts when one remote source fails. |
| API and SDK | Add one documented route and regenerate the canonical JavaScript SDK artifacts. |
| UI | Add one Data/Usage settings page using the existing full-screen Settings shell and design tokens. No parallel navigation system. |
| Tests | Positive non-UI tests for normalized usage/cost, period boundaries, aggregation output, and the route contract. No UI automation. |
| Docs | Update this record, both spec indexes, and the current Provider architecture after the contract is final. |
| Delivery risk | Dirty Overlay files require hunk-level preservation; route changes require SDK regeneration and route checks; real visual acceptance needs an isolated server/page so the user's active app is not disturbed. |

## Provider Coverage Decision

“All Providers” means every language-model implementation admitted by the canonical
Provider registry, not a hard-coded vendor list in the statistics layer. The 24
bundled packages and dynamically installed OpenAI-compatible Provider packages all
produce AI SDK `LanguageModelUsage` on the same streamed `finish-step` boundary.
Therefore:

- Token support is capability-by-contract at the shared stream boundary.
- If an upstream returns no usage, OpenCorvus records zero measured Token rather
  than estimating or tokenizing the prompt locally.
- Cost support uses the request-time model rate already held by `Provider.Model`.
- Missing model rates are visible as unpriced coverage; they are never represented
  as confirmed free usage.
- Provider quota/account-balance APIs remain separate because they describe a
  different authority and only some vendors publish them.

The canonical runtime catalog snapshot inspected on 2026-08-11 contains 181
Provider identities and 6,163 model records. Of those models, 5,753 have explicit
pricing and 410 do not: 152 Providers are fully priced, 19 are partially priced,
and 10 have no priced model in the snapshot. The largest missing-price groups are
Vercel AI Gateway (102), Qiniu AI (89), Poe (44), AnyAPI (30), Snowflake Cortex
(21), and Ollama Cloud (20). This proves billing cannot honestly be represented as
universally available even though metering is integrated universally. Catalog
contents can change; request-time `available` and persisted coverage, rather than
this audit snapshot, remain the product authority.

## Statistics Contract

`GET /global/usage?period=day|week|month|year&timeZone=<IANA>` returns:

- current natural-period `start`, `end`, `timeZone`, `period`, and bucket grain;
- total input, output, reasoning, cache-read, cache-write, and total Token;
- calculated USD cost, streamed API-call count, average Token per call, and pricing coverage;
- equivalent previous complete natural-period totals and deltas;
- zero-filled chronological buckets;
- Provider aggregates ordered by Token, then cost, then stable identity;
- model aggregates ordered with the same rule.

The default period is `month`. The browser supplies
`Intl.DateTimeFormat().resolvedOptions().timeZone`; the server validates it with
Luxon and calculates every boundary in that zone. Weeks start Monday. The current
period is half-open `[start, end)`, where `end` is the next calendar boundary, so
requests stay deterministic across daylight-saving changes.

Historical `step-finish` Parts are copied exactly once into the canonical usage
ledger by schema migration. Parts without pricing-coverage metadata contribute
measured Token and persisted cost while coverage remains `unknown`. New streamed
steps record `priced` or `unpriced` from request-time model metadata. Multi-step
assistant turns and non-Session helper streams each create one row per actual
upstream step.

## Official Source And Reconciliation Contract

The API returns a source inventory even when no administrative credential is
configured. A source has a stable Provider, kind, authority, scope, freshness,
status, and optional normalized facts. The first implemented official strategies
are the interfaces whose schemas can be verified and whose credential boundary is
unambiguous:

| Provider/control plane | Official interface | Authority | Integration decision |
| --- | --- | --- | --- |
| OpenAI API | Organization Usage API plus Costs API | organization request ledger plus financial ledger | Fetch with a dedicated `OPENAI_ADMIN_KEY`; paginate both APIs; never reuse the inference key. Compare Provider/time bucket totals, but present Costs as financial truth. |
| Anthropic API | Messages Usage Report plus Cost Report Admin APIs | organization request ledger plus financial ledger | Fetch with a dedicated `ANTHROPIC_ADMIN_KEY`; paginate; normalize uncached/cache-create/cache-read/output components and decimal USD amounts. |
| OpenRouter | Credits and Keys List management APIs | lifetime credit/spend and per-key usage/limit ledger | Fetch only with `OPENROUTER_MANAGEMENT_KEY`. Paginate Keys List in documented 100-row `offset` pages; preserve every key's lifetime/daily/weekly/monthly and BYOK usage plus limit/reset facts. Present these lifetime/account facts separately because neither source is a natural-period Token ledger. |
| AWS Bedrock | CloudWatch metrics plus Cost Explorer/CUR | account/region metrics plus billing ledger | Declare supported-by-official-control-plane but unconfigured until account, region, and AWS credential scope exist. Do not pretend the inference configuration is enough. |
| Azure OpenAI | Azure Monitor plus Cost Management | subscription/resource metrics plus invoice ledger | Declare supported-by-official-control-plane but unconfigured until subscription/resource identity and Azure credential scope exist. |
| Google Vertex AI | Cloud Monitoring plus Cloud Billing | project metric plus billing ledger | Declare supported-by-official-control-plane but unconfigured until project identity and Google Cloud credential scope exist. |
| Other bundled/dynamic Providers | Response usage and request-time price metadata; optional existing account-usage adapter | exact OpenCorvus request facts; vendor-specific capacity when documented | Always covered by the local ledger. No remote history claim is made unless an official documented API and credential contract are implemented. |

The headline remains **OpenCorvus local usage**. Official organization usage is
not added to it because it can include the same OpenCorvus requests plus traffic
from other clients. Reconciliation is a comparison for the intersecting
Provider/time scope: `official - local`, with explicit scope and lag labels. Local
calculated cost is an estimate fixed at request time; official cost is the billing
authority. Missing or failed official sources are `unconfigured`,
`requires_configuration`, `partial`, or `error`, never numeric zero.

## Page Design

The page lives under **Settings -> Data -> Usage**, preserving the existing
full-screen settings information architecture. It uses a restrained analytical
surface rather than a collection of generic cards:

1. A compact hero stack carries the scope statement and a fully visible
   natural-period segmented control with refresh, followed by a centered period
   Token total, exact date range, time zone, and event-time statement. The stack
   is deterministic across desktop host zoom levels and never pushes controls
   outside the Settings viewport.
2. Total measured Token, peak interval, cost, calls, and pricing coverage form one
   continuous metric strip with dividers rather than a loose card collection.
3. A code-native activity heatmap shows every natural-period bucket. A year uses
   weekday-aligned daily buckets in a seven-row calendar rhythm; other periods retain readable
   hourly or daily cells. No chart runtime or fabricated history is added.
4. Token composition and billing coverage share one activity-insights column;
   Provider rows form a parallel column with proportional bars, exact Token/cost,
   and model counts.
5. A compact model table exposes Provider/model identity, calls, Token, cost, and
   share. Dense data stays scannable and aligned.
6. Empty and failure states explain the fact boundary and offer only a real retry.

The page must remain coherent in light, dark, VS Code dark, and system themes by
using semantic tokens only. No hard-coded product palette, glassmorphism, gradient
decoration, stock imagery, or fake sample data is permitted.

## Implementation Plan

1. Repair the normalized usage calculator around AI SDK 6 detail fields and add
   focused positive metering/cost tests spanning ordinary, cache, reasoning, and
   over-200K pricing contracts.
2. Normalize price availability for catalog, configured, and Plugin models; retain
   long-context rates through merges and count every input component at the threshold.
3. Add the canonical usage-event table, registered migration/backfill, shared-stream
   recording hook, strict IANA bounds, aggregation, comparison, and zero-filled buckets.
4. Add verified OpenAI and Anthropic organization usage/cost strategies plus
   OpenRouter management account facts; expose a complete official-source inventory,
   partial failures, scope, freshness, and non-additive reconciliation.
5. Add the documented route, regenerate JavaScript SDK output, run route checks,
   and adapt the CLI to the shared service where doing so does not weaken its
   current options.
6. Add Usage to the canonical Settings section registry and implement the page,
   service call, i18n copy, icon mapping, and a dedicated semantic-token stylesheet.
7. Run focused non-UI tests, typechecks, internationalization check, Vite build,
   SDK generation/checks, docs checks, and `git diff --check`.
8. Start an isolated real server and current Overlay, navigate through the real
   Settings UI, inspect populated/empty/loading/error-recovery behavior available
   from real state, capture screenshots, and manually correct the visual result.
9. Delegate one uninvolved Agent for read-only review of the full diff, tests,
   screenshots, documentation, and regression risks. Resolve every valid finding,
   rerun affected validation, and repeat review if code changes.
10. Recheck `git status --short`, stage only task-owned paths/hunks, inspect
   `origin/main..HEAD`, commit, and push only when the pending set is authorized and
   reviewed.

## Verification Plan

- focused Provider usage normalization test;
- focused natural-period/statistics aggregation test;
- focused HTTP route test;
- `bun run --cwd packages/sdk/js build`;
- `bun run api:routes-check`;
- `bun run docs:check`;
- Overlay `typecheck`, `check:i18n`, and `build:vite`;
- relevant OpenCorvus typecheck/build checks;
- real current Overlay navigation, interaction, screenshot, and manual visual review;
- independent Agent read-only review with no unresolved findings;
- final `git diff --check` and staged-boundary review.

## Verification Evidence

- Canonical request ledger and migration: `provider_usage_event` is the sole
  statistics fact source; the registered migration backfills historical
  `step-finish` occurrences once while preserving `unknown` billing coverage.
  The common streaming wrapper records Session, Provider connectivity, VCS
  commit-message, Metric Judge, and acceptance-translation steps with an
  explicit purpose.
- Provider and price correctness: dynamic Plugin models require an explicit
  `cost.available`; DigitalOcean placeholder prices are unpriced; configured
  price merging retains `experimentalOver200K`; the long-context threshold
  includes cache-write input; reasoning output is charged once.
- Official sources: OpenAI organization Usage and Costs, Anthropic Messages
  Usage and Cost Report, and OpenRouter account Credits plus the complete
  offset-paginated per-key usage/limit ledger use dedicated administrative
  credentials, bounded pagination, 15-second request timeouts, independently
  retained partial results, decimal cost arithmetic, explicit UTC day envelopes,
  and compare-never-sum reconciliation. AWS Bedrock, Azure
  OpenAI, and Google Vertex AI expose honest cloud-control-plane configuration
  requirements instead of guessed inference-key calls.
- Focused backend verification on the final source: 26 tests passed, 0 failed,
  87 assertions across model-price coverage, Copilot catalog-price preservation,
  AI SDK 6 normalization,
  long-context pricing, schema migration/backfill, official pagination and
  partial failure, common-wrapper non-Session recording, strict IANA natural
  periods, daylight-saving 23/25-hour days, Monday weeks, year buckets, and the
  HTTP route.
- No OpenAI Admin, Anthropic Admin, or OpenRouter Management credential was
  available in the acceptance environment. Their real-account permission and
  current live response paths therefore remain explicitly unverified; official
  endpoint schemas, pagination, decimal derivations, partial failure, and
  credential boundaries were verified with focused HTTP contract tests only.
- Contract/tooling verification: OpenCorvus TypeScript typecheck passed; the
  JavaScript SDK regenerated successfully; `api:routes-check` passed across 34
  route files; API documentation regenerated to 330 operations in 25 groups and
  `docs:check` passed; the Overlay production Vite build passed with 7,104
  modules transformed.
- Runtime-boundary correction from visual acceptance: the global route originally
  attempted to read administrative keys through a project-instance environment
  and displayed `No context found for instance`. The final implementation reads
  a server-runtime environment snapshot; an isolated live route now reports
  `unconfigured` admin credentials and `requires_configuration` cloud scopes,
  never source errors or invented zero facts.
- Real-page visual acceptance used an isolated server at port 17881 and a
  consistent SQLite copy; the user's active backend was not restarted. Manual
  inspection covered dark month headline, official organization/admin-key cards,
  cloud-control-plane cards, activity/composition, Provider/model detail, a
  weekday-aligned natural-year heatmap, and Simplified Chinese. Final evidence:
  `specs/artifacts/2026-08-11-provider-usage-dashboard-final-dark-top.png`,
  `specs/artifacts/2026-08-11-provider-usage-dashboard-final-official.png`,
  `specs/artifacts/2026-08-11-provider-usage-dashboard-final-control-plane.png`,
  `specs/artifacts/2026-08-11-provider-usage-dashboard-final-activity.png`,
  `specs/artifacts/2026-08-11-provider-usage-dashboard-final-models.png`,
  `specs/artifacts/2026-08-11-provider-usage-dashboard-final-year.png`, and
  `specs/artifacts/2026-08-11-provider-usage-dashboard-final-zh-cn.png`. After
  the user clarified that unconfigured administrative keys must not add page
  noise, a final live-page pass confirmed that the complete API inventory still
  reports those sources while the page omits their cards until configured;
  `specs/artifacts/2026-08-12-provider-usage-dashboard-final-configured-only-1280x720.png`
  records the resulting desktop official-source region without a hover state.
- The service maps a 404 for `/global/usage` to a version-mismatch message that
  asks the user to restart the updated backend; it does not fall back to a second
  data path or keep old-period figures under a new selector.
- Independent review evidence is recorded in Recall. A terminal review of the
  final diff and screenshots remains required before commit.
