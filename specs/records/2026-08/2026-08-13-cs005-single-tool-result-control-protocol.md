# CS-005 — Single Tool-result turn-control protocol

## Recall

- User requirement: continue the long-running code-smell remediation without colliding with active implementations; deeply inspect `CS-005` and write an isolated Recall/plan only. Do not change production code, shared indexes, or User Interface (UI) automation in this pass.
- Acceptance target: every successful Tool result that intentionally ends the current model turn stores exactly one strict `opencorvusToolResultControl` value. Immediate parking uses `{kind:"immediate_park"}`; coordination handoff uses `{kind:"handoff_drain", request_id, dispatch_lineage_id}`. Session processing and exact permission-result recovery apply that one parsed contract, while every current producer persists the typed value. The legacy boolean and its reader/writers are deleted together.
- Hard constraints: one current writer representation and one parser; no legacy fallback, dual read, data-derived inference, hidden host workflow, or keyword gate; preserve visible ToolParts and existing durable Task/coordination/scheduler facts; language-model calls remain streaming; focused positive non-UI tests must cover production writers and real Session processing; implementation requires an uninvolved read-only final review.
- Sources read: root `AGENTS.md`; `CS-005` and its refactoring wave in the continuous audit; remediation program; current Task control-plane and extension architecture; Tool-result control type/parser; Session processor stream, ToolPart completion and stop decisions; Session loop continuation and exact Ask-me recovery; Agent runner handoff extraction; normal/orchestrator wait; Task completion/failure; agent-to-agent (A2A) failure response; runtime-repair wait; coordination-request Tool; batch Tool/registry projection; Tool result and durable permission-result schemas; current database data-integrity policy; relevant tests, Git history and blame.
- Whole-repository search:
  - the legacy `opencorvusParkAfterToolResult` constant has five production import sites and six successful-result writers: normal `wait`, Orchestrator/runtime-repair `wait`, `complete_task`, `fail_task`, A2A `respond_agent_coordination(decision=fail_task)`, and their shared lifecycle paths;
  - the typed `opencorvusToolResultControl` has two production writers, both `request_orchestrator_decision` branches, and two consumers using the same parser: Session processor turn control and Agent runner handoff validation;
  - `immediate_park` has no production writer; `shouldParkAfterToolResult` is the only dual reader;
  - aborted wait, rejected completion, failed lifecycle execution, and unrelated Tool results correctly omit a turn-control value; they must not gain one merely because the Tool identity is normally control-bearing;
  - Session processor parses control only on live Software Development Kit (SDK) `tool-result`. `completeRecoveredToolPart` persists a durable permission result without applying the control, and permission continuation then has separate continuation behavior;
  - ToolPart `state.metadata` and durable permission execution results preserve arbitrary JSON. The control is an occurrence-time decision, not a database row or scheduler authority;
  - `wait` is a global registry Tool and can currently be a `batch` child when experimental batch is enabled. The child schedules a wake and stores its control only on the child ToolPart; the batch parent result has no control, so the Session continues. Bubbling the child value after concurrent siblings have already run would not restore immediate/exclusive semantics;
  - existing tests cover wait schema prose, permission/Session processing, coordination recovery and lifecycle facts, but no focused test proves the Tool-result control protocol, all current writers, live stop behavior, recovery behavior, or batch exclusivity.
- Current dirty-worktree boundary: concurrent work owns dispatch-adapter contract, Build, Engine persistence/store/schema, Requirements, Project bootstrap, Storage/database/schema, Task API, Workspace, Task-control-plane architecture, two unrelated tests, and both spec indexes. This planning pass touches none of them. The later architecture/index edits and any database-integrity decision require coordination after those owners settle.
- Independent-agent feedback: the repository-wide audit independently admitted this as a concrete incomplete protocol migration and required each producer plus the stored ToolPart contract to be verified. Focused plan review rejected four missing boundaries: post-hook reserved-control preservation, the ToolPart-to-assistant crash cut, legacy recoverable permission results, and top-level parallel Tool calls. The revised design below makes all four explicit implementation and acceptance requirements.

## Root cause and complete impact

The Session turn boundary is encoded inside arbitrary Tool result metadata, but the migration introduced a typed discriminated union only for coordination handoff. Immediate parking retained a separate boolean. The live processor therefore asks two facts for one decision: it first parses the typed control for handoff, then calls a second helper that accepts either the old boolean or the unused typed `immediate_park` variant.

This incomplete migration has three consequences beyond duplicate constants:

1. every new wait/lifecycle/repair result continues to persist the legacy shape, guaranteeing that the dual reader can never be removed by ordinary use;
2. control application is tied to the live SDK event rather than ToolPart completion. An exact result returned from the durable permission authority can be persisted through the recovery-specific path without passing the same control decision;
3. `wait` can be invoked as a batch child. Its wake effect succeeds, but the only Session-driving result is the ordinary batch parent, so the promised immediate park is lost and later model output may continue against a deliberately parked Task.

The affected facts are successful Tool output metadata, the completed ToolPart, current assistant finish reason, processor stop/continue result, coordination-handoff identity, Agent runner handoff projection, exact permission execution result/recovery, wait scheduling, terminal Task lifecycle, A2A response/action settlement, runtime-repair wait, batch target projection, and current architecture/tests. The scheduled job, Task terminal row, completion decision, coordination request/response and dispatch lineage remain the real domain authorities; Tool-result control only tells the owning Session how to close the current model turn after those facts commit.

No public route or generated Software Development Kit schema needs to change because Tool result metadata is already an open JSON record. Completed historical ToolParts with the old boolean remain immutable historical bytes, but the old key is no longer interpreted as current control and is not rewritten. A completed past turn cannot be parked retroactively. The repository is pre-release and does not add an upgrade compatibility reader. Exact in-flight/durable continuations created by the new code always carry the typed value; implementation verification must start from an isolated current database.

## Target contract

### 1. One strict schema and construction surface

Replace the manual union parser with one strict Zod schema owned by `session/tool-result-control.ts`:

- `immediate_park` has exactly the `kind` field;
- `handoff_drain` has exactly non-empty `request_id` and `dispatch_lineage_id` in addition to `kind`;
- absent metadata or absent control returns `undefined`;
- a present malformed control maps to the existing explicit invalid-control error before a Session treats it as success;
- the legacy key, constant, boolean branch and `shouldParkAfterToolResult` are deleted.

Export typed constructors/constants rather than making producers hand-author open objects. The immediate helper merges ordinary metadata with the frozen `{kind:"immediate_park"}` under `TOOL_RESULT_CONTROL_METADATA_KEY`; the handoff helper requires its exact request/lineage identity. A helper rejects caller metadata that already contains the reserved key, so there is one construction point and no silent overwrite.

All current successful writers move in the same change:

| Producer result | Typed control |
| --- | --- |
| normal `wait` scheduled successfully | `immediate_park` |
| Orchestrator/runtime-repair `wait` scheduled successfully | `immediate_park` |
| `complete_task` that committed its exact terminal Task and Completion Decision | `immediate_park` |
| `fail_task` that committed/reused the exact terminal failure | `immediate_park` |
| A2A `respond_agent_coordination=fail_task` that committed its response/action and Task failure | `immediate_park` |
| new or exactly replayed `request_orchestrator_decision` | existing `handoff_drain` identity through the constructor |

Aborted waits, rejected `complete_task`, lifecycle exceptions and non-control Tool outcomes remain without control. `cancel_task` remains outside this metadata protocol: its explicit cancellation authority aborts the owning execution through the Task lifecycle, and this finding does not introduce a second stop signal for cancellation.

### 2. Apply control at the ToolPart completion boundary

Add one exhaustive `applyToolResultControl` decision in Session processor. It accepts only the parsed union and returns one typed disposition:

- no control: ordinary continuation;
- `immediate_park`: set assistant finish to `tool-calls`, mark the current generation to stop consuming after the exact result, and return `park`;
- `handoff_drain`: validate that at most one matching request/lineage identity exists for the assistant, set finish to `tool-calls`, prohibit any later Tool call while allowing already emitted non-Tool stream material to drain, and return `handoff`.

Parsing happens before the ToolPart terminal write. Completion persists the same validated metadata and returns the disposition. The live SDK `tool-result` branch no longer decides from raw metadata after persistence; it consumes the completion disposition. Agent runner continues to parse completed ToolParts through the same schema to validate the handoff against its durable coordination request. These are distinct consumers of one contract, not parallel parsers.

For host-owned control results, the runtime snapshots the parsed control before `tool.execute.after` and verifies exact preservation immediately after the hook and before `PermissionAuthority` can persist the result. Removing or changing the reserved value is a typed failure; absence is valid only when the producer returned no control. Plugins never become a second control writer.

The recovered completion path also receives the disposition from the same completion function. An `immediate_park` or `handoff_drain` durable result closes the recovered assistant and does not start an ordinary continuation loop. A result without control retains the existing source-appropriate continuation behavior. Invalid control cannot be silently discarded during recovery. This does not change `PermissionAuthority`: it remains the at-most-once effect/result authority and stores the exact typed Tool result.

Completed ToolPart metadata is also the recovery authority for the later crash cut. If recovery finds the exact Part already completed while its assistant is incomplete, it reparses the same control and idempotently writes the assistant finish/time before returning. Startup repetition is harmless. For pre-protocol data, database startup inspects only succeeded permission results whose corresponding ToolPart is still pending/running; a legacy park boolean without the typed control returns `DATA_RESET_REQUIRED`. Already completed historical Parts remain visible bytes and are not interpreted or rewritten.

The control is evaluated only after its producer returned success. Tool-result persistence failure leaves the existing open/recoverable occurrence and does not apply a transient in-memory park that lacks its visible ToolPart evidence.

### 3. Make turn-control Tools exclusive batch targets

A Tool whose successful result may end or hand off the turn cannot be an independent concurrent batch child. Do not aggregate/bubble child control to the batch parent: sibling effects have already started, and `handoff_drain` carries an occurrence-specific coordination identity that cannot truthfully become the parent's call.

Add an internal Tool definition execution mode such as `ordinary | turn_control_exclusive`. Mark registry `wait` and `request_orchestrator_decision` as exclusive. Batch construction filters exclusive Tools from its discriminated input schema and rejects an attempted target through its existing explicit invalid-input contract. Projected extra Tools are already excluded from batch targets, so Task lifecycle, runtime-repair and coordination extra Tools require no duplicate ID list.

The same execution mode is propagated through all registry and projected-extra wrappers into one assistant-occurrence coordinator. Ordinary calls may overlap only while no exclusive call is pending. An exclusive call first reserves the occurrence, waits for already-started ordinary calls to settle, then alone performs its effect; no later sibling starts while it is pending, and a successful result carrying control seals the occurrence. This prevents top-level parallel provider calls from bypassing batch exclusivity without inferring behavior from Tool IDs.

The execution-mode declaration controls only batching. Whether one particular successful result parks remains exclusively determined by its typed result metadata; for example, an aborted `wait` still returns without control.

## Implementation boundary

- `packages/opencorvus/src/session/tool-result-control.ts`: strict schema, parser, constructors, reserved-key guard and typed disposition helpers; delete the legacy key/helper.
- `packages/opencorvus/src/session/processor.ts`: make ToolPart completion parse/return the disposition; one exhaustive live/recovered application path; delete the boolean reader and duplicated branching.
- `packages/opencorvus/src/session/loop.ts`: preserve host control across the post-execution hook before permission-result persistence; coordinate exclusive top-level execution; consume/reapply recovered completion disposition so a typed parked/handoff result cannot start an ordinary continuation.
- `packages/opencorvus/src/storage/db.ts`: fail startup for a legacy succeeded permission result that still owns an open recoverable ToolPart; no runtime legacy reader or payload rewrite.
- `packages/opencorvus/src/tool/tool.ts`, `tool/batch.ts`, and registry materialization: carry the internal exclusive execution mode and reject turn-control batch targets without an ID-specific second list.
- `packages/opencorvus/src/tool/wait.ts`, `orchestrator/task-lifecycle-tools.ts`, `orchestrator/tools.ts`, `orchestrator/runtime-repair-tools.ts`, and `tool/request-orchestrator-decision.ts`: use only typed constructors at every successful producer.
- `packages/opencorvus/src/agent/runner.ts`: retain the same handoff validation semantics but consume the strict shared schema/type.
- One focused non-UI protocol test and a small independent-process worker only if needed for the durable-result recovery cut. Update current Task control-plane architecture, this record and both spec indexes after implementation. No Engine domain writer, scheduler schema, route, generated SDK, UI or database schema edit is expected.

## Positive verification

### Producer matrix and live Session behavior

Use current isolated production fixtures, real Tool constructors and a real `SessionProcessor` stream:

1. execute a normal scheduled wait and an Orchestrator/runtime-repair scheduled wait; assert their returned metadata parses as exact `immediate_park`, the scheduled job identity remains present, the completed ToolPart stores the same typed value, the assistant finishes `tool-calls`, and processor returns `stop` before accepting later model material;
2. execute successful `complete_task` and `fail_task` occurrences through their real execution contexts; assert the exact terminal Task/domain evidence first, then the typed completed ToolPart and parked assistant;
3. execute A2A `respond_agent_coordination=fail_task` over a real pending request/action; assert the response/action/Task facts and exact typed park result survive replay, and the Session stops;
4. execute new and replayed `request_orchestrator_decision`; assert the same exact `handoff_drain` request/lineage identity is stored, processor drains the handoff turn, and Agent runner resolves the same durable pending coordination request;
5. execute an aborted wait and a rejected completion. Assert each explicit result remains ordinary and Session processing follows its ordinary disposition. This verifies the success-result contract rather than inferring control from Tool name.

Each fixture reads the persisted ToolPart and parses its metadata through the production schema. It does not merely inspect source strings or helper return values.

### Recovery and exclusivity

1. In Ask mode, run a permission-bearing projected terminal lifecycle Tool in child process A, approve it, and hard-exit after `PermissionAuthority` stores the typed successful result but before ToolPart completion. In successor process B, resume the exact continuation and assert the original ToolPart receives the same typed control, the assistant finishes `tool-calls`, no additional continuation model turn starts, and the Task effect/result occurs once. Repeat with a cut after ToolPart completion but before assistant update; successor startup must idempotently apply the Part-owned disposition, and a second startup must not add facts or turns.
2. Run a controlled ordinary permission-bearing Tool through the same recovery path and assert its no-control result follows the existing continuation behavior. This proves recovery switches on the stored protocol rather than parking every recovered result.
3. Materialize a real batch surface with registry `wait` and `request_orchestrator_decision` visible. An attempted batch call for either maps to the explicit batch input error, while an ordinary registry Tool in the same surface executes successfully. This is a positive input-to-error contract and proves exclusive Tools never schedule/handoff as invisible children.
4. Feed a present malformed typed control through the real Tool-result completion boundary and assert the explicit invalid-control failure identifies the call/Part and never treats it as park or handoff.
5. Install a real test plugin whose `tool.execute.after` respectively deletes and changes an exact host control. Both executions must fail before the permission result/ToolPart can persist an ordinary result; an unrelated no-control result remains valid.
6. Drive a real provider stream with overlapping top-level ordinary and exclusive Tool calls. The exclusive effect waits for prior ordinary settlement and prevents any later sibling effect; two exclusive calls map to the typed execution-conflict contract. No wake, Task lifecycle, or handoff is hidden inside a sibling.
7. Reopen a real database containing a legacy succeeded permission result plus its pending ToolPart and assert exact `DATA_RESET_REQUIRED` for `Database.Client.dataIntegrity.toolResultControl`; a completed historical Part does not trigger this recoverable-state check.

Run only the focused non-UI tests, OpenCorvus typecheck, current documentation checker after coordinated architecture/index edits, and task-owned `git diff --check`. Search the whole repository for the exact legacy key/constant and require zero production/test/document references other than this historical record. Then obtain an uninvolved read-only implementation review, repair every valid finding, and repeat until clean.

## Overlap and sequencing risk

- `CS-004` plans to centralize Tool execution and ToolPart settlement in the same `session/processor.ts`, `session/loop.ts`, `tool/tool.ts` and `tool/batch.ts` area. Do not implement the two plans concurrently. Either land `CS-005` first and have the unified envelope preserve its typed completion disposition/exclusive execution mode, or implement it as a reviewed slice inside the `CS-004` envelope; never leave two completion/control owners.
- Task-control-plane architecture and both spec indexes are currently dirty under other batches. This planning file is intentionally isolated and unindexed; coordinate mandatory documentation edits before delivery commit.
- Storage/database files are dirty but do not need modification. Do not add an eager row rewrite, schema trigger, or legacy decoder merely to mutate historical completed ToolParts. They are visible evidence, not pending control decisions.
- Do not infer control from Tool ID, Task terminal status, scheduled-job presence, output text or metadata booleans. Only the successful result's strict typed control governs the Session turn.
- Do not let Plugins or normalization accidentally replace the reserved control. If `CS-004` lands first, its post-hook canonical result validation must preserve/validate this host-owned reserved field before ToolPart completion; if it has not landed, the `CS-005` completion parser is the mandatory final validation boundary.

## Delivery state

- Root-cause, complete producer/reader/recovery/batch impact, single target protocol, deletion boundary, positive verification and overlap analysis are complete. The first independent plan review's four blockers are incorporated into the target contract.
- Production implementation now uses one strict schema/construction surface, migrates every current writer, validates host control before and after runtime hooks, applies the same parsed disposition to live/recovered ToolPart completion, repairs an incomplete assistant from its completed Part, rejects legacy recoverable permission results at startup, and coordinates batch plus top-level exclusive execution.
- Focused positive verification passes all 24 cases with 66 assertions. The previously passing protocol suite is extended by seven production-writer cases: the normal registry `WaitTool` scheduled and aborted results; the final projected Orchestrator/runtime-repair `wait`; successful public `manage_task` actions for both `complete_task` and `fail_task`; a terminal-Task `manage_task` rejection whose public structured result remains ordinary; a real projected worker `request_orchestrator_decision` new/replay pair bound to one dispatch lineage; and a real pending A2A request settled and replayed through `respond_agent_coordination(decision=fail_task)`. The A2A case proves both the first result and exact completed-action replay retain `immediate_park`; the replay check runs before terminal Task refusal and does not alter other coordination replay shapes. The production scheduler-overlap and real post-hook mutation cases use an explicit 120-second integration deadline. Each successful writer is executed through its production constructor/projection and checked against durable Task, Automation, dispatch-lineage, coordination request/response/action, or ToolPart evidence rather than hand-authored control metadata. The full command `bun test --timeout=360000 test/tool-result-control-protocol.test.ts` passes 24/24 with 66 assertions.
- The suite constructs the Base scheduler through the real `PromptProfileResolver`, snapshots its projected runtime contract, and resolves the final provider-visible surface through `SessionLoop.resolveTools`. A real projected `read_context` occurrence overlaps a real projected `wait`: the exclusive occurrence waits for the earlier ordinary effect, rejects the later sibling, seals after its typed result, and creates exactly one durable Automation. The projected worker fixture likewise uses the production coordination runtime tools, `projectWorkerTools`, exact enabled-tool descriptor, runtime contract, current invocation authority and immutable dispatch lineage before executing the handoff writer.
- Two controlled in-process recovery cuts and two matching independent-process cuts now pass through a real Ask-mode `PermissionAuthority` request, operator reply, execution attempt and durable result owner. The independent worker starts a projected Base scheduler and its production `wait`, then uses three distinct operating-system processes per case over one isolated shared database. At the result-to-ToolPart cut, process A exits with the authority-owned typed result committed while the Part remains running; process B reconstructs the projected scheduler runtime, completes the same Part and assistant, and a repeated recovery leaves one Automation, one durable result, one execution start and one execution success. At the ToolPart-to-assistant cut, process A exits after the Part is completed but before the assistant write; process B treats that Part as the disposition authority and the repeated recovery remains exact-once. `bun test packages/opencorvus/test/tool-result-control-protocol.test.ts -t "operating-system process cut"` passes both cases (2/2, 12 assertions, 256.60 seconds).
- The operating-system recovery fixture also exposed and verifies a narrow scheduler reconstruction defect: persisted assistant messages store `Provider.Model.id`, while recovery compared them with the distinct provider API model identifier. Reconstruction now compares the persisted value with `selectedModel.id`; the fixture deliberately gives `model.id` and `model.api.id` different values so the regression cannot be hidden.
- No UI automation was added, modified, or run. The final uninvolved read-only implementation review passed with no P0-P3 actionable finding after checking the complete diff, producer matrix, A2A replay, hook preservation, exclusive coordination, permission recovery, startup reset contract, architecture and test evidence. Commit and push remain owned by the coordinating agent.
