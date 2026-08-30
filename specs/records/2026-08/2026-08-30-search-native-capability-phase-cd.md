# Search-native Capability Phase C/D: occurrence reveal and pre-materialization Harness

Status: complete; independent review PASS.

## Recall

### User request

- Pull every branch, switch to `0.0.55`, investigate how the industry handles Tool/Skill/MCP/agent harness discovery, identify the present framework's structural defects, and iteratively refactor until no problem or unknown item remains.
- Continue in batches. The current batch is the master plan's Phase C/D: make every model-visible harness search-native instead of keeping Tool, Skill, MCP, Expert Squad, Mission Skill, and squad-stage projection as independent eager systems.

### Acceptance for this batch

1. One exact leaf Registry owns descriptor identity and executable materialization. A model initially receives only `capability_search` from the executable Harness; an accepted search reveal determines the exact active leaf definitions on the next Provider step. An explicitly requested JSON-schema response may additionally carry the existing reserved `StructuredOutput` response encoder. It is not a capability, effect, permission occurrence, or Harness grant, but its normalized Provider definition is part of the immutable revision-zero base and the 32,000/8,000 total budget.
2. A reveal is an occurrence-bound, append-only Tool-result receipt. It records the catalog ref/hash, search call, prior revision, new revision, materialization fingerprint, activated/deactivated refs, normalized Tool definitions and digests, active refs, active payload digest, and measured payload characters.
3. Search and reveal are one operation but do not execute, authenticate, mount, approve, or silently expand a capability set. Exact refs may be requested only when they are visible and executable in the bound catalog snapshot.
4. Candidate definitions are materialized and measured outside the database transaction. A short compare-and-swap transaction re-reads the same assistant occurrence, snapshot binding, prior receipts, active Tool calls, and budget before committing the completed search ToolPart.
5. The initial Provider Tool payload is `capability_search` alone and stays within 4,000 canonical-schema characters. Each reveal activates at most five exact leaves, at most ten leaves remain active, total active canonical-schema payload remains at most 32,000 characters, and an individually oversized leaf is rejected.
6. The next Provider step reconstructs the active surface solely by folding persisted receipts from the same assistant occurrence. No process cache, hidden table, cross-input schema cache, V1 harness arrays, role Tool pool, stage eager Tool record, full MCP projection, or experimental batch Tool may be an execution source.
7. Native Conversation, native Mission, projected scheduler, projected worker, direct dispatch, recovery, restart, permission continuation, retry, and concurrent search calls use the same lifecycle and fail closed on stale or corrupt evidence.
8. Every language-model call remains streaming. UI automation is prohibited; any affected UI is accepted only through a real page, screenshots, and manual review.
9. Focused positive contract tests, real concurrent-process checks, recovery checks, and a post-change independent read-only review have no unresolved P0/P1/P2 finding.

### Hard constraints

- One current implementation and one fact source; no fallback, compatibility adapter, dual read/write, shadow active state, or post-hoc Harness inference.
- Host code may validate integrity, policy, budgets, and irreversible-operation confirmation. It must not route model behavior with a gate or workflow state machine.
- Capability search never becomes authorization or execution. Existing specialized execution owners remain responsible for real invocation after a leaf is revealed.
- Stable Provider Tool names must remain collision-free and map to one immutable descriptor/materializer binding in the bound occurrence.
- Existing unrelated untracked paths are user-owned and out of scope: `packages/opencorvus/script/benchmark/`, `script/video/`, and `\uf022\uf022`.
- Any implementation change must be committed, merged with the current upstream, revalidated, independently reviewed, and pushed.

### Materials read

- `AGENTS.md`.
- `specs/current/architecture/**` contracts cited by the master design.
- `specs/records/2026-08/2026-08-30-search-native-capability-harness-refactor.md`, especially contracts, runtime lifecycle, Provider projection, ownership, migration order, and acceptance sections.
- Phase A1, A2, and B implementation records and their final validation evidence.
- Current implementations in `capability/descriptor.ts`, `capability/catalog.ts`, `capability/catalog-binding.ts`, `capability/harness-projection.ts`, `tool/capability-search.ts`, `tool/registry.ts`, `tool/global-tools.ts`, `tool/execution-surface.ts`, `tool/tool.ts`, `session/loop.ts`, `session/runtime-contract.ts`, `session/message.ts`, `session/processor.ts`, and the scheduler/worker construction call sites.

### Whole-repository search results

- `SessionLoop.resolveTools()` is the shared Provider-step materializer. It eagerly initializes the Registry, projected worker Registry pool, host or task MCP Tool set, projected/stage Tool records, and Skill/Mission Skill loaders, applies policy, then derives or installs `HarnessProjection`. This is post-materialization evidence, not pre-materialization authority.
- `ToolRegistry.materialize()` initializes all visible global Tool definitions with `Promise.all`; it also conditionally synthesizes the experimental `batch` umbrella. `projectedWorkerTools()` filters a role/template Tool pool and still eagerly initializes the surviving set.
- `CapabilitySearchTool` reads the immutable A2 catalog snapshot and returns ranked metadata only. Its input has one `query`, broad `limit: 20`, and no exact-ref activation, deactivation, or expected snapshot hash.
- `HarnessProjection` is V1: separate arrays for Tool, Skill, Mission Skill, MCP server/tool/prompt/resource. Runtime contracts require this object plus eager `projectedRegistryToolIDs`, `projectedTools`, and `stageTools`.
- `CatalogOccurrenceBinding` already publishes a canonical content-addressed snapshot, atomically binds it to the canonical user input while admitting the assistant, validates caller/materialization/fixed-package bindings, and makes restart and continuation read the same occurrence fact. This is the correct catalog authority to extend; a new snapshot store is not needed.
- ToolPart completed-state metadata is already durable and visible. `SessionProcessor` currently creates/runs/completes ToolParts in separate writes, so reveal commitment cannot be safely bolted into `CapabilitySearchTool.execute()` after the fact; completion needs a search-specific transactional commit hook at the existing ToolPart owner.
- Runtime-contract construction appears in the worker runner, orchestrator scheduler, same-process prompt/recovery paths, and task execution scope. Every occurrence class must cut over together because retaining any eager record would create a second executable source.
- Independent-agent feedback before implementation: none. Phase B's repeated final review passed without a P0/P1/P2 finding. The Phase C/D reviewer later identified the Windows checker invocation mismatch, MCP App partial/final lifecycle precision and positive-test gaps, one stale scoped prompt/resource body-projection surface, and same-occurrence MCP App controller re-entry. All were resolved and independently rechecked; final review reported no remaining P0/P1/P2.

## Problem and root-cause analysis

### Observable behavior

- Search results are advisory references while the model can already call the complete eagerly projected Tool surface.
- Large umbrella definitions consume Provider schema budget before relevance is known.
- The execution Harness is computed after Tool/MCP/Skill materialization and therefore cannot prove which immutable catalog view authorized each schema.
- Restart and permission continuation can rebuild the eager surface, but cannot reconstruct an exact per-occurrence search-driven active set because no reveal receipt exists.

### Direct trigger

Every Provider step calls `resolveTools()`, whose present control flow enumerates execution owners before consulting any search outcome. `capability_search` is merely one member of that eager set.

### Data/control-flow root cause

Catalog discovery, executable materialization, Provider schema projection, execution authorization evidence, and restart reconstruction have different owners and different representations. `HarnessProjection` is a post-hoc list of categories; it is not an occurrence-bound precondition. Role/template IDs and stage closures therefore remain the practical execution authority even after Phase A/B established typed catalog identity.

### Why earlier paths did not cure it

- A1 deliberately created stable descriptors and caller views without changing eager execution.
- A2 deliberately bound the immutable catalog occurrence without revealing Tool schemas.
- B deliberately hard-cut package manifests to typed refs and one-level sets while keeping eager execution until this atomic cutover.
- Those staged boundaries were necessary migration prerequisites, but leaving both sides active now would violate the one-source rule.

### Impact surface

- Definitions: search input/output, Harness projection, runtime contracts, Tool Registry/provider metadata.
- Calls: native Chat/Work, native Mission, Task scheduler, worker/stage attempts, direct dispatch, retry, restart, permission continuation.
- Persistence: canonical input snapshot binding and same-occurrence ToolPart receipt fold.
- Execution: built-in Tool, package-projected Tool, stage Tool, MCP Tool, Skill/Mission Skill loaders, artifact transport/finalization tools.
- Tests/docs/delivery: focused catalog/search/runtime/recovery/concurrency tests, current architecture documentation, generated SDK/type surfaces where public contracts change, and real UI/manual evidence if rendering changes.
- Explicitly excluded: changing specialized Tool implementations, replacing MCP process/lifecycle ownership, redesigning Expert Squad semantics, or adding UI automation.

## Atomic design

### 1. HarnessProjectionV2

Replace V1 with one canonical object:

```text
context
owner_revision
catalog_snapshot_ref
catalog_snapshot_hash
grants[] = { ref, access, descendant_scope? }
projection_hash
```

`access` is `discover`, `execute`, or `discover_execute`. Grants are canonical, duplicate-free exact refs; any set expansion occurs once while composing the bound catalog view, never during reveal or execution. The projection hash uses a V2 domain separator. There is no per-kind array.

### 2. Exact leaf Registry

- Index each catalog descriptor ref to exactly one materializer binding and immutable definition digest.
- Materializers accept the same occurrence scope already captured by A2: model/provider/API, config/plugin revision, fixed package digests, and stage occurrence bindings.
- Materialize only requested exact leaf refs. Reject set refs, navigation-only leaves, unavailable/denied leaves, provider-name collisions, mismatched descriptor/materializer ownership, and definitions over the individual budget.
- Normalize Provider Tool definitions before hashing and measuring. Execution continues through the existing Registry/MCP/projected/stage owner wrapper selected by the immutable binding.

### 3. Search input and result

The one Tool accepts `queries` (one to four), optional exact kinds/owners, `exact_refs`, `deactivate_refs`, `limit <= 5`, and `expected_catalog_snapshot_hash`. Ranked metadata remains visible in output. Only exact executable leaf refs requested by `exact_refs`, including refs copied from search results, become candidates for activation; fuzzy hits are not silently activated.

### 4. Reveal receipt and active-state reducer

Completed `capability_search` ToolPart metadata contains one strict V2 receipt:

```text
schema_version, occurrence_id, search_call_id
prior_revision, revision
harness_projection_hash
catalog_snapshot_ref, catalog_snapshot_hash
materialization_fingerprint
result_refs, deactivate_refs
activated[] { ref, provider_name, definition, definition_digest, payload_chars, materializer_binding_digest }
active_refs, active_definition_digest, active_payload_chars
```

Receipts are append-only because completed ToolParts are immutable occurrence facts. The reducer orders canonical ToolParts, checks revision continuity and every digest, applies explicit deactivations then activations, and returns the next-step active projection. A new assistant occurrence has revision zero and no active leaves.

### 5. Two-phase materialize/commit

1. Read the assistant, parent snapshot binding, existing receipt fold, Harness V2, and open Tool calls.
2. Resolve search metadata and materialize requested exact leaves outside a database transaction.
3. Normalize definitions, calculate all digests/character budgets, and form a candidate receipt.
4. In one short transaction re-read the assistant/parent/ToolPart rows; verify the snapshot hash, current receipt revision, no conflicting active Tool calls, exact candidate fingerprint, and budgets; commit the search ToolPart completed state with the receipt.
5. The next Provider loop folds receipts and materializes exactly `capability_search + active leaves`, plus a budgeted conditional `StructuredOutput` response encoder when JSON schema was requested. Execution rejects a call absent from that surface.

Concurrent searches share revision CAS. One wins; the stale call receives a typed stale-revision error and may search again. A crash before commit leaves no reveal. A crash after commit reconstructs the same active set.

### 6. Provider-step cutover

- Resolve and validate the bound A2 snapshot before any leaf definition initialization.
- Build Harness V2 from the immutable catalog binding and current context owner grants.
- Always materialize `capability_search` first; verify its normalized definition budget.
- Fold same-occurrence receipts and materialize only their active exact leaves.
- Finalize Skill/Mission Skill and MCP lifecycle only when their exact loader or callable leaf is active.
- Remove eager Registry iteration, role Tool pool filtering, `batch`, stage/projected eager record merge, full MCP enumeration, and post-hoc conversation/mission Harness derivation in the same release.
- Runtime contracts carry immutable materializer bindings/grants needed for lookup, not executable Tool closures or projected ID lists.

## Implementation order inside the atomic release

1. Add V2 schemas/reducer/budgets and positive contract tests.
2. Add exact materializer registry over built-in, package/stage, Skill/Mission Skill, and MCP owners; split any leaf whose normalized schema alone exceeds 32,000 characters.
3. Add search candidate preparation and transactional ToolPart completion CAS.
4. Rewrite `resolveTools()` to pre-materialize from Harness V2 plus receipt fold.
5. Cut all runtime-contract producers/consumers to immutable bindings and remove eager fields/functions and `batch`.
6. Run focused typecheck and positive tests, then real restart/recovery/concurrent-process checks and payload measurements.
7. If UI-visible capability inspection changes, run the real dev page, inspect screenshots manually, and record console state without any UI automation.
8. Request an uninvolved read-only review. Fix every valid finding, rerun affected acceptance, and repeat review until no P0/P1/P2 remains.
9. Update this record and current architecture, run declared documentation checks, commit, fetch and merge upstream, inspect `upstream..HEAD`, revalidate, and push.

## Unknown resolution

1. Provider schema budget: resolved. `tool-definition-budget.test.ts` initializes every projectable Registry leaf through the real Provider schema adapter. `panel` was the only oversized umbrella and is now 26 canonical `panel_<action>` leaves; the model-facing umbrella and `batch` were deleted. Revision-zero `capability_search` is measured and enforced at 4,000 characters/1,000 estimated tokens. All permanent Provider definitions, including conditional `StructuredOutput`, are counted in the 32,000/8,000 total. A real streamed structured Turn verifies this base and persists its structured response before assistant completion.
2. Stage reconstruction: resolved to the occurrence contract. Runtime contracts no longer carry Tool records or projected/stage ID arrays; one immutable `RuntimeToolOwner.leaves` list owns per-leaf factory inputs and `exact(toolID)` constructs only the selected leaf without a cross-step Tool-object cache. Scheduler, shared context/codebase, and every stage output owner now expose real per-leaf constructors over an occurrence-local shared collector; the former `loadToolKit().tools[toolID]` lazy-full-record pattern is removed from production. Permission continuation validates the Worker Turn descriptor, exact effectful materializer set/digests, and Catalog dispatch-stage reducer/toolkit binding. Completed pure collector ToolParts are folded by one canonical total order before exact reconstruction. Deterministic reducer or binding drift is a typed stale continuation, is retired once, and produces zero replay on the next bootstrap scan. Requirements, Frontend Design, Visual QA, Integrity, and a mixed non-Requirements adapter have positive exact-factory/recovery contracts.
3. Transaction boundary: resolved at search ToolPart completion. Candidate initialization and Provider normalization occur outside SQLite. The immediate transaction re-reads the assistant role/parent, canonical user-input Catalog carrier, all occurrence ToolParts, active calls, receipt revision and budget reduction, then completes the running search Part atomically. `SessionProcessor` preserves an identical completed call and treats that CAS result as the sole completed writer. Revision-2 replay and a separate operating-system replay produce no second Part update; concurrent preparation still has one compare-and-swap winner.
4. MCP exact materialization: resolved. A direct Conversation/Mission has one callable MCP source: its Host Session owner. Project/config inventory supplies status and metadata but cannot publish a duplicate executable child. The Catalog composer derives eligible children, Tool views, and exact parent bindings from the same immutable Host snapshot after applying capability rules and Tool switches; Harness grants are never expanded post-publication. Native and package/default Task leaves revalidate config/definition identity at materialization and before final lifecycle input, the plugin hook, and business `tools/call`, mapping definition/owner/receipt drift to `StaleCatalogOccurrenceError`. An MCP App partial-input participant may already have been published; stale preflight settles that participant in its error lifecycle with the source failure message, while the outer Tool/assistant occurrence terminates with typed `StaleCatalogOccurrenceError`, without admitting those final boundaries. Identical concurrent inventory reads reuse the current immutable digest, while a real `listChanged` generation still forces a reread; five same-owner exact reveals converge and an in-flight call survives a later next-snapshot change. MCP prompt/resource names and bounded descriptions are searchable metadata with typed unavailable behavior and discover-only explicit access; bodies are not fetched or injected.
5. UI lease error: excluded with evidence. No UI source, DOM, route rendering, screenshot baseline, or browser automation was changed or run. Panel changes are model Provider identities over the existing action Registry; HTTP/UI continues to consume the same Registry. The earlier `Instance` lease error did not reproduce in affected native/mission/panel tests and is outside this backend occurrence cutover.

## Implemented cut

- Harness V2 grants and occurrence-bound Catalog projection replace V1 per-kind arrays and post-materialization inference.
- Revision zero executable Harness is exactly `capability_search`; append-only receipts activate/deactivate exact leaves with bounded rolling state. The reserved conditional `StructuredOutput` response encoder remains outside the Harness but inside the immutable Provider base and total payload budget.
- Registry, package Tool, stage Tool, Skill/Mission Skill, Host/configured MCP, scheduler, worker, direct Conversation and Mission paths use the same exact reveal lifecycle.
- Runtime contract Tool records, role eager built-ins, full MCP Tool projections, model `panel` union, and experimental `batch` are removed.
- Reveal receipts bind normalized definitions, exact materializer digests, ToolPart/call identity, persisted search input, and a recomputed fingerprint; every later step re-reads the input-bound Catalog and verifies them.
- Scheduler and worker factories construct one requested leaf at a time. Stage collectors share occurrence-local data but never build sibling Tool objects as a side effect of exact lookup.
- Permission recovery validates the Catalog effectful set/materializer digest and collector reducer history; permanent mismatches converge by retiring the stale ledger request.
- MCP descendant execution uses occurrence-bound server-to-child mappings rather than an unrelated server wildcard.
- Direct MCP discovery and execution use one Host Session owner, one immutable inventory read, and policy-narrowed child views; project-shared inventory cannot create a sibling execution path.
- Native and projected MCP call-time assertions reject pre-invocation schema drift as typed stale, while equal concurrent inventory snapshots converge and already-started calls retain their pinned definition.
- MCP App stale preflight leaves an unstarted call with only its canonical Tool error Part; an existing partial-input participant settles in its error lifecycle before the outer Tool/assistant occurrence becomes typed stale. Repeated exact resolution within one assistant occurrence reuses the Processor's canonical lifecycle controller only when session/message, server/config, Tool definition digest, resource URI, and configured or Expert Squad authority are identical. A same-name identity conflict is typed at the registry and maps to exact stale receipt evidence at the Session boundary, so partial stream and final invocation cannot split across owners. Obsolete scoped prompt/resource body-projection APIs were deleted; prompt/resource discovery retains bounded metadata only.
- Search-call idempotency, same-process compare-and-swap, two-process compare-and-swap, same-process revision replay, cross-process Processor replay, database reopen, permission continuation, and fresh-process mixed collector/effectful stage recovery are positive contracts.

## Validation log

- The first real pre-push generated-contract check exposed two tracked-output drifts from this atomic cut: the new typed `StaleCatalogOccurrenceError` and removal of `batch_tool` were absent from the tracked OpenAPI/SDK artifacts, while the built-in `general` Mission Skill still named the deleted `panel` umbrella. The authoritative generator rejected that obsolete ID instead of publishing a compatibility alias. The Skill prerequisite now names the exact 14-leaf `MISSION_PANEL_LEAF_TOOL_IDS` contract, its generated payload is current, and a positive test binds the built-in definition to that same canonical role surface.
- `bun run script/generate.ts`: completed, including built-in Mission Skill payload, OpenAPI, SDK, and API documentation generation.
- `bun run api:routes-check`: 6 rules and route inventory clean across 34 files.
- `bun run test test/execution-authority-tool-surface.test.ts`: 5 passed, including the exact built-in Mission Skill prerequisite contract.
- The declared permission-mode checker still configured and executed the deleted `batch` umbrella and manually called `resolveTools()` without an occurrence Catalog binding. Its obsolete batch-only evidence was deleted; every synthetic invocation now publishes the real immutable Catalog, reveals only its exact leaves, persists canonical Tool completion, and uses the production permission continuation owner. Browser, Computer, configured MCP, MCP App, schedule, durable MCP Task restart, Server-Sent Events (SSE), command-line interface (CLI), and Agent Client Protocol (ACP) paths remain real positive evidence.
- The migrated checker exposed a production restart defect: Host Session MCP exact materialization relied on process-memory inventory populated during the original search. Exact materialization now uses the frozen Tool-to-server parent binding to ensure only a missing parent owner, retains sibling owners for later search, rejects a present revision mismatch before rescanning, revalidates the ensured owner/revision/exact binding, and then performs the exact definition reread. A removed, failed, or auth-blocked leaf therefore terminates as typed `StaleCatalogOccurrenceError`, never a generic zero-binding error. Computer's per-process endpoint and authorization are excluded only from its stable Catalog/Tool-authority digest while its logical runtime scope remains bound; the live connection identity still includes the full endpoint and token, so adapter rotation reconnects. `bun run test test/mcp/host-session-runtime.test.ts`: 5 passed, including revision-zero restart then reveal, active-leaf restart, same-server sibling reveal without redundant ensure, cross-server sibling retention, exact execution, post-restart leaf removal as typed stale, and owner cleanup. `bun run test test/mcp/computer-configured-declaration.test.ts`: 4 passed, including stable logical Computer Catalog identity, distinct live adapter identity, and unchanged ordinary-local-MCP transport binding.
- `bun run check:permission-modes`: passed through the declared process supervisor; the durable MCP Task executed once, resumed from two polls after the process boundary, and all permission transports retained their canonical identities.
- `bun run typecheck`: 8/8 workspace packages passed.
- `bun run docs:check`: 338 operations, 25 groups, passed.
- `bun run check:architecture-index`: 16 current documents indexed, every link live.
- `bun run test test/tool-result-control-protocol.test.ts`: 27 passed, including both operating-system process cuts.
- `bun run test test/session-loop-tool-authority-integration.test.ts`: 8 passed, including database reopen, exact worker reconstruction, effectful stage recovery, and a fresh-process recovery.
- Capability receipt/owner/Skill/budget tests: 8 passed, including a true two-process reveal compare-and-swap.
- `bun run test test/capability/catalog-binding.test.ts`: two consecutive declared-checker runs passed 17/17, including immutable binding, pagination, `listChanged`, schema drift, collisions, auth/scope facts, five concurrent same-owner exact leaves, and long-call inventory advancement. Diagnosis proved that the earlier marker failure came from invoking bare `bun test`, which bypasses the repository runner's isolated `--timeout=0 --parallel=1` process contract and lets Bun's default 5,000 ms cleanup kill live descendants. The declared checker reproduced no dangling process or missing marker; no production assertion or supervisor lifecycle was relaxed.
- Real native Session MCP search/reveal/execute, policy narrowing, metadata publication, typed call-time drift without a participant, and error settlement of an existing partial-input MCP App participant: 4 passed.
- Real projected scheduler default-MCP receipt reconstruction and extras call-time drift: 1 passed.
- MCP App lifecycle identity owner: 2 passed, covering canonical same-owner partial-to-final reuse and exact typed same-name/different-identity conflict.
- MCP Browser/Computer/Host routes: Computer 15/15 and Host 3/3 passed in isolated review.
- Panel/Mission/artifact/recovery group: 26 passed.
- Expert Squad grants/catalog/dynamic/light/Evolution/provider surface focused tests passed after updating the revision-zero payload expectation to include `capability_search`.
- `bun test test/session-loop-provider-tool-input.test.ts`: 8 passed using exact `panel_<action>` Provider definitions.
- `bun test test/task-artifact-git-commit-publication.test.ts`: 4 passed.
- `git diff --check`: passed.
- UI automation: not run, as prohibited. UI source was not changed; visual acceptance is not applicable to this backend-only Provider identity cut.
- Independent review: PASS after repeated read-only review of the complete working tree, focused reruns, docs, and validation evidence; no remaining P0/P1/P2.
- Git delivery evidence is reported by the enclosing task because a commit cannot contain its own final hash.
