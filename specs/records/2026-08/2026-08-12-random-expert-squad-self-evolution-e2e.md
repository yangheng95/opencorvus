# Random Expert Squad self-evolution end-to-end automation

Status: investigation complete; implementation and live campaign validation in progress.

## Recall

### User request

Run an automated Expert Squad evolution test. Randomly choose from the actually available Expert Squads, download
and install it, execute it, evaluate the result, and evolve it. Use an independent Agent review so the delivered
system does not depend on a mistaken interpretation or fall below industry practice. Investigate the depth and
impact of every observed failure instead of repairing one symptom at the expense of another. Run against an
isolated development backend with random ports, project directories, and databases.

### Acceptance criteria

1. One fresh backend process owns a unique `OPENCORVUS_HOME`, SQLite database, project directory, and operating-
   system-assigned loopback port; none of the existing user project or database state is read or mutated.
2. The controller enumerates the real `/expert-squad/market` production HTTP surface, selects one eligible
   uninstalled target with recorded random evidence, and installs the exact target plus `evolution-lab` through
   `/expert-squad/install-payload` at project scope.
3. Installation receipts, installed detail, package digests, and the active-profile projection converge without
   silently activating either newly installed package.
4. A real streaming Mission is created with an immutable held-Squad snapshot containing exactly the selected
   target and Evolution Lab. It creates fixed-profile Tasks for the baseline, opportunity/cause analysis, frozen
   development campaign, candidate authoring, candidate Trial, evaluation, integrity review, and recommendation.
5. The campaign uses one small synthetic non-UI case, one repetition, no production side effects, a frozen exact
   provider/model, and positive score/evidence contracts. Baseline and candidate Trials carry explicit expected
   package digests and identical frozen runtime inputs apart from arm revision and slot identity.
6. The terminal evidence includes the downloaded/installed revision, baseline run, candidate revision, both run
   bundles, measured-or-typed-unavailable evaluation results, independent integrity review, and an experiment-
   scoped `promote`, `retain`, or `inconclusive` recommendation.
7. The campaign never silently installs or promotes the candidate. Production mutation remains a later explicit
   user-authorized operation.
8. The controller records exact request/status/activity evidence and fails on pending interactions, infrastructure
   failures, incomplete Artifact closure, timeout, or identity drift. Mock, fixture-only, and synthesized message
   paths do not count as end-to-end acceptance.
9. Focused positive tests, type checking, documentation checks, a live isolated run, and a post-implementation
   read-only independent Agent review all pass with no unresolved finding.

### Hard constraints

- Preserve unrelated worktree state. Do not reset, clean, stash, create another branch/worktree, bypass hooks, or
  touch user-owned running application processes.
- Do not add or run UI automation. This task has no UI change; backend evidence is sufficient.
- Keep `prompt_profile.active` as the sole installed active identity and immutable Task package bindings as the
  sole Trial revision identity.
- Do not create a Host workflow engine, metric-to-dispatch gate, rank router, fallback provider/model, synthetic
  Agent message, hidden interaction answer, silent retry, or automatic production promotion.
- All Large Language Model interactions remain streaming and travel through the production Mission/Task wake
  paths.
- Secrets are inherited by name only for the declared live provider and are never written to logs, specifications,
  Artifacts, command arguments, or committed evidence.

### Sources read

- Root `AGENTS.md`.
- `specs/current/architecture/01-agents.md`, `02-data.md`, `03-control.md`, `04-extensions.md`,
  `09-verification-evidence.md`, `security-permission.md`, and `task-control-plane.md`.
- `specs/records/2026-08/2026-08-06-expert-squad-self-evolution-architecture.md` and
  `2026-08-11-expert-squad-on-demand-installation.md`.
- Evolution Lab manifest, README, campaign Skill, scorer contract, role prompts, package tools, public Artifact
  ABI, comparison implementation, mutation/history services, and focused tests.
- Market, Mission, Task, provider, Registry, Manager, resolver, immutable revision snapshot, database, and
  deployment production paths plus the existing on-demand production-route probe and Mission smoke script.

### Whole-repository search result

The repository has a real on-demand Market production-route test and complete Evolution Lab primitives, but no
current automation entry that composes random Market discovery, project installation, a real baseline, the three
Evolution Lab stages, exact-revision Trial execution, evaluation, and a terminal recommendation. Historical
benchmark launch records describe a retired external harness and immutable failed Prism runs; no current launcher
source exists in this tree. Reintroducing that campaign-specific launcher would create a second orchestration source
and is excluded.

### Independent Agent feedback

Pending. Per repository policy, the independent Agent will be delegated only after implementation and first live
validation. It will receive the full diff, test evidence, live run result, and this Recall, and will remain read-only.

## Problem depth and impact

### Observable gap

The component contracts can be tested separately, but an operator currently cannot run one command that proves a
random installable Squad can travel through the complete real evolution lifecycle in an isolated backend.

### Direct trigger

Existing tests stop at either Market installation or deterministic Evolution Lab Artifact/Compare-And-Swap
contracts. The general Mission smoke script deliberately forbids Task dispatch. No test controller bridges these
production surfaces.

### Root cause

The old benchmark launcher was campaign-specific, external to the current source tree, and coupled to a frozen
Prism/OCI matrix. The product later converged on Mission-owned orchestration and production HTTP routes, but no
target-agnostic black-box controller was added for the new boundary. The missing owner is a test controller that
selects inputs, starts isolated infrastructure, drives the existing production interfaces, and observes durable
facts without deciding workflow transitions itself.

### Why adjacent paths do not cure it

- Extending the Market install probe would still omit streaming execution and evolution.
- Calling `EngineService` or Evolution Lab tools directly would bypass HTTP, Mission authority, held-Squad
  snapshots, immutable cross-Task imports, and real provider behavior.
- A Host state machine that creates stage Tasks based on score/status would duplicate Mission orchestration and
  violate current architecture.
- Reusing the historical fixed Prism campaign would not prove random on-demand packages and would revive a retired
  campaign-specific fact source.
- Mocking the model, scorer, package tools, or database would prove only local schemas, not the requested end-to-end
  system.

### Impact surface

The controller touches only test/operation code and this record, but observes production provider discovery,
Market pagination/detail/install, Registry/Manager revision capture, Mission held-Squad authority, Task creation
bindings, streaming scheduler/worker execution, cross-Task Artifact import, Evolution Lab package tools, scorer
runtime, durable activity/status projection, cancellation/settlement, and SQLite/runtime cleanup. Public API or
schema changes are not planned; if investigation proves one is necessary, the route inventory, OpenAPI, generated
SDK, bilingual docs, and callers become part of the repair boundary.

## Frozen design

### Test controller boundary

Add one explicit live-operation script under `packages/opencorvus/script/`. It starts `Server.App()` on
`127.0.0.1:0`, declares the normal native development Task deployment, and drives only production HTTP endpoints.
The script is not part of backend startup and does not choose Task transitions.

The run root contains unique `home/`, `project/`, `logs/`, and `result.json` paths. `OPENCORVUS_HOME` is bound before
loading backend modules, making `data/opencorvus.db` unique. The project is initialized as a fresh Git repository
with only the synthetic case and its declared acceptance inputs. The selected loopback port, absolute project path,
absolute database path, database identity, and backend process identity are recorded.

### Random selection contract

Page the complete Market with `availability=available`. The eligible pool is the sorted set of project-installable
domain packages after excluding only platform/control packages that cannot be their own target (`evolution-lab`,
`squad-sdk`, and embedded default control identities if present). Generate a fresh random seed by default, derive an
unbiased index, and record the seed, algorithm, pool digest, pool count, index, and selected identity. An explicit
seed may be supplied only to reproduce a recorded failure; it is not the default acceptance mode.

### Campaign contract

Install the selected package and Evolution Lab at project scope, verify exact digests and inactive status, then wake
one Mission with `productPillar=work`, model `moonshotai-cn/kimi-k2.5`, and exactly those two held Squad IDs. The
request declares `required_only`, one repetition, one synthetic development Case, no User Interface work, no
external side effects, no interactions, and no promotion. Mission remains the sole owner of stage order and
cross-Task imports.

The frozen judge scorer uses the same exact live provider/model for both arms, a bounded evidence byte limit, an
activity-based timeout, predeclared criteria, and a complete rubric. Its positive criteria assess delivery
correctness, requirement coverage, evidence integrity, explicit assumptions/unknowns, and professional decision
usability. Cost, activity duration, failure outcome, permission/side-effect facts, and unavailable ratio come from
the real run evidence rather than prose.

### Monitoring and terminal result

After `/mission/wake`, poll the durable Mission activity cursor and status with an inactivity deadline that advances
only on real cursor changes. Record status transitions without scraping logs as lifecycle truth. Terminal success
requires an inactive Mission, all created Tasks terminal, zero pending interactions, and a complete Evolution Lab
Artifact graph ending in a recommendation. On failure, preserve the run directory, bounded server log, result, Task
and Artifact identities, first bad transition, deepest supported cause, affected owners/callers/contracts, competing
hypotheses, and remaining unknowns before changing code.

## Planned verification

1. Focused positive tests for unbiased deterministic selection from a frozen pool, eligible-pool construction,
   cursor-driven inactivity, terminal evidence validation, and redacted result serialization.
2. Existing Market production-route and Evolution Lab package/evidence/comparison/mutation contracts relevant to
   any changed code.
3. `bun run typecheck` in `packages/opencorvus`, `bun run api:routes-check`, `bun run docs:check`, and
   `bun run version:check` when their owned surfaces apply.
4. One live default-random run on a fresh random port/project/database using the connected
   `moonshotai-cn/kimi-k2.5` provider. The similarly discovered `moonshotai/kimi-k2.5` endpoint returned real HTTP
   401 during preflight and is excluded rather than used as a fallback.
5. Independent read-only Agent review after the first complete validation; repair every valid finding and repeat
   review after any correction until no unresolved finding remains.

## Evidence ledger

| Stage | Evidence | Status |
| --- | --- | --- |
| Repository identity | `main`, `7bcba88061c2d1155daf491629165ac3718ecc70`, `origin/main`, clean start | passed |
| Isolated backend preflight | unique temp home/project, SQLite schema apply, OS-assigned port | passed |
| Provider preflight | `moonshotai-cn/kimi-k2.5` real minimal stream reachable | passed |
| Alternate provider | `moonshotai/kimi-k2.5` returned HTTP 401 | excluded, no fallback |
| Implementation | controller and positive contracts | pending |
| Live random campaign | exact run result and Artifact closure | pending |
| Independent review | read-only full-diff and live-evidence review | pending |
| Commit/push | exact owned paths and outgoing commit audit | pending |

