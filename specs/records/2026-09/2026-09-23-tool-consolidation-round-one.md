# First round of built-in tool consolidation

## Recall

- User: `先做一轮合并`, following the proposal to consolidate todo read/write, Task listing/status/board/plan reads, interaction answer/reject, and workspace Task/Session selection.
- Preserve the corrected rule: authorized built-in general tools are directly available; only specialist capabilities load on demand. Reduce redundant choices by replacing interfaces, never by hiding tools or keeping compatibility aliases.
- Acceptance: four canonical tools replace ten old entries (six fewer Chat declarations, five fewer Mission declarations); all corresponding state, output, permission and source facts remain correct; focused positive execution/projection tests, real source `/ui` and streaming Provider use, relevant type/build/generated-contract/docs checks, scoped commit and upstream merge/push. Do not restart the installed app on 7878 or the user-visible preview on 17886. No agents, release, database migration, whole-suite test run or UI automation tests.
- Read: AGENTS; current capability, panel/control and data architecture; prior model-memory and native-tool exposure records; full-repository Tool/action references; TodoStore, todo tool/description, permission/config/catalog/role pools, ACP and CLI consumers, Overlay checklist projection; Panel capability/action registries, Tool execution, Task query schema and terminal review facts, Mission lineage listing, control local-action response schema, generated SDK process and direct tests.
- Search findings: the old todo pair also exists in protocol config fields, CLI/ACP renderers, Harbor restrictions and docs. The four Task views have one shared Board authority but different output shapes; Mission listing is explicitly lineage-scoped. Terminal artifact acceptance consumes only exact `panel_query_task` completed rows carrying a terminal lifecycle reference. Interaction effects are owned by EngineService. Workspace selection emits existing typed local actions. No Tool implementation change has occurred before this record.
- Existing architecture research already consulted: [Anthropic tool design](https://www.anthropic.com/engineering/writing-tools-for-agents), recommending distinct purposes and consolidation of overlapping workflows, evaluated by actual outcomes/call errors rather than count alone. The historical umbrella Panel schema was very large; this round uses four narrowly scoped interfaces rather than recreating it.

## Analysis and contracts

The observable problem is unnecessary selection among interfaces for the same data/object. Prior exposure repair restored availability but intentionally did not alter these contracts. This is a model-interface refactor, not a scheduling or queue repair. Existing effect executors and persistence remain authoritative; no synthetic messages, host-selected workflow or parallel configuration is introduced.

1. `todo({action: "read"})` / `todo({action: "write", todos: [...]})` replaces todoread/todowrite, with one TodoStore and the existing complete-list JSON output, metadata and update event. The long duplicate-heavy description becomes a concise definition. ACP (Agent Client Protocol) plan synchronization uses write receipts; terminal and Overlay rendering recognize the new identity. `planner` is a separate persistent tree and is not migrated this round.
2. `panel_query_task({taskIDs?, includeInteractions?, include?: ["board", "plan"]})` replaces view_tasks/view_board/view_plan and extends the current batch query. Explicit IDs return canonical status plus requested details and existing terminal references. Omitted IDs list recent Project Tasks, or every Task owned by the active Mission; list rows stay identity/title/status summaries and do not become terminal-review receipts. Board/plan include compact existing information, not a full internal state dump. The root query name and terminal-review owner remain stable.
3. `panel_respond_interaction({interactionID, response})` replaces reply/reject leaves and public Panel actions. `response` is an explicit typed union of answer(message), allow_once, allow_project, reject(optional message). The existing reply/reject EngineService owners execute exactly the selected operation; permission class and Mission-exclusive mutation semantics remain intact.
4. `panel_select_workspace({target: {kind: "task" | "session", id}})` replaces both selection leaves/actions. Local desktop scope remains mandatory, and the result emits the existing real `select_task`/`select_session` local-action contract consumed by the UI. Those output event types are not legacy model-tool aliases.

Remove the retired Tool/action definitions and update all current prompts, role pools, grants, discovery hints, tests and generated public schema. Historical records and existing stored transcripts are evidence and are not rewritten. The generic renderer remains able to show old Tool records; no executable old-tool path is retained. Existing frozen permission continuations use the canonical stale-catalog error after schema changes; new inputs project the current interface.

Risks: list results accidentally becoming terminal authority; interaction answer/allow/reject ambiguity; local selection being granted remotely; todo write/read projections drifting across UI/ACP; duplicate declarations after rename; omitted generated schema consumers. Address with positive outputs/error contracts and real provider materialization checks. Whole-repository searches found only backend tests for these tool contracts. The discovered `overlay/test/inline-style-csp.test.ts` is an existing source-text UI/style assertion, explicitly forbidden by AGENTS; remove it without running it. No fixture or configuration exists solely for that test.

## Plan

1. Replace the four interfaces at their existing owners and update declarations/consumers/prompts. Keep terminal status authority and actual effect owners unchanged.
2. Add focused tests executing new input variants against real stores/effects and checking actual Provider tool definitions, permission narrowing and specialist reveal. Update obsolete tests to the current positive contracts.
3. Regenerate public SDK/OpenAPI and docs, typecheck/build and run focused verification. Inspect real checklist rendering and actual streaming model calls on a new isolated source server. Preserve assets used by the user's existing preview.
4. Review the complete diff, record exact outcomes/limitations, commit, fetch and merge upstream, verify the outgoing set, and push.

## Verification

Implemented all four replacements at the canonical Tool/Panel owners. Retired definitions and executable aliases were removed, while existing typed local selection events remain. Updated all current role pools, configuration permissions, ACP/CLI/Overlay consumers, prompts, Mission Skill payload, OpenAPI/client generation and English/Chinese documentation. Current source and architecture searches for the retired Tool/action identities return no references.

Declared counts: Chat 39 → 33, Mission 39 → 34, Work 43 → 37. The routine base contains respectively 32/32/36 definitions before model compatibility and explicit Skill selection. The shared provider normalizer still applies each model's supported tool variants (DeepSeek omits apply_patch); the exposure rule was not narrowed.

### Focused verification

- Backend and Overlay typechecks passed. Overlay `build:vite --emptyOutDir false` passed, including the renderer public-surface checker; preserved existing hashed assets for the user's preview.
- `bun test ./test/tool/consolidated-tools.test.ts ./test/panel-mission-terminal-authority.test.ts --timeout 120000`: 14 passed, 59 assertions. Real TodoStore effects, persisted Task list/detail, actual Question answer/rejection and EngineService interaction state, local selection payloads, remote-surface error, Mission ownership/terminal receipt and mutation execution modes were exercised. The two allow-response cases explicitly prove mapping to the existing permission writer using a spy; they are not represented as live approvals.
- `task-routine-tools`, `skill-reveal` and `native-mcp-search-execution` focused tests passed. All 21 `native-mission-transport-base` tests passed in the broader run.
- The broader run found five obsolete expectations from the preceding direct-exposure repair: hard-coded native routine inventories and reveal-first Chat/Work guidance. Updated those tests to complete current inventories and changed the Control SessionLoop case to call the consolidated query directly and verify its real empty-list result. Rerun of `session-loop-tool-authority-integration`, `execution-authority-tool-surface`, `mcp/host-session-runtime`, `expert-squad/catalog-index`: 34 passed, 123 assertions.
- The initial Harbor adapter test attempt exposed missing local Harbor dependencies. Reran with the repository-prescribed Python 3.13 / Harbor 0.23.0 environment via `uv run --no-project --python 3.13 --with harbor==0.23.0 python -m unittest discover -s packages/opencorvus/test/benchmark -p harbor_automationbench_adapter_test.py`: 20 passed. Existing Harbor deprecated-capability warning is non-fatal.
- Regenerated the built-in Mission Skill, SDK and OpenAPI through their existing scripts. `docs:api`, `docs:check` (342 operations / 25 groups), `check:architecture-index` (17 current documents) and `git diff --check` passed.

### Real streaming Provider and visual verification

Started an isolated source development server on `127.0.0.1:17887/ui/` with `.tmp/20260923-tool-consolidation` as its home. Preserved the installed 7878 server and the user's 17886 preview. Preflight verified the inherited DeepSeek credential exists and the copied canonical model catalog contains the exact target; no credential value was logged or committed.

On a separate browser tab, selected `deepseek/deepseek-v4-flash` and submitted a visible request to record two checklist steps, list Tasks, complete both steps, then reread the checklist. Persisted Session `ses_-zUTz5Y4Tzztws7XUSG3` contains five streaming assistant steps on that exact provider/model. The actual sequence is `todo(write)` → `panel_query_task({})` → `todo(write)` → `todo(read)`, with four completed Tool outcomes and final `finish: stop`. Task result is `{tasks: []}`; both canonical Todo rows are `completed` and the read result equals the completed write.

The input-bound published Catalog's materialization scope confirms the same provider/model and a 35-definition Work permanent base, including all four consolidated tools and direct websearch/webfetch, memory, planner and schedule. This is the actual occurrence catalog, not an inferred registry count.

Inspected emitted desktop screenshots of the real page and expanded checklist: structured todo rendering, two green completed rows, 2/2 progress, tool rows and final model report are legible. No UI automation tests were added or run. The encountered existing source-text CSP/UI test was removed under AGENTS; no dedicated fixture/configuration required cleanup. The focused non-UI tests are local contract tests; only the recorded isolated Provider/UI run is claimed as live end-to-end evidence.

### Delivery

All planned implementation and checks are complete. Final scoped commit, upstream merge/review and automatic push follow; the installed application and user-open preview have not been restarted or replaced.
