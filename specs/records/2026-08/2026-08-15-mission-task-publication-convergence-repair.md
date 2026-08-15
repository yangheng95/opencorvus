# Mission Task publication and first-render convergence repair

## Recall

| Item | Record |
| --- | --- |
| User request | A real Mission cannot finish publishing a child Task and loops on repeated `mission_state` writes; the published Task also cannot render. Repair the root causes rather than hiding the symptoms. Preserve the already implemented anonymous diagnostic-copy and Composer dispatch-clear repairs in the same delivery. |
| Observable incident | Mission Session `ses_-zUXegA6szzNvjZyzcZc` accepted “帮我开发一个俄罗斯方块网页游戏”. `panel.create_task` completed once with child Task `tsk_g00VSLK5yM00yjgRl8sm`, after which the same physical user Turn produced 20+ assistant tool-call steps that repeatedly rewrote `tasks.md` and `handoff.md`. The child Task was visible but had no renderable Orchestrator conversation. A later production bundle for Mission Session `ses_-zUXeGP48zzUQNLYHLOL` reproduced the unparked old runtime and exposed two additional framework defects: a valid text `panel.view_tasks` receipt poisoned Artifact reference lookup as “output is not JSON”, and Task `tsk_g00VSLjqr100OEbMQdab` failed because a structured `dispatch_agent` Permission result conflicted with its normalized Tool output string. |
| Acceptance criteria | (1) A successful Mission `panel.create_task` is one durable decision/effect receipt and ends that physical Mission Turn after the result is persisted; it cannot continue into repeated state writes. (2) The Task creator Message and current typed control Message are both materialized under the one installed Orchestrator runtime contract, so a newly accepted Task reaches a real streamed Orchestrator Turn and produces renderable Session evidence. (3) Failed Task startup remains a typed terminal fact and is not masked as a UI problem. (4) Retry/restart, ordinary non-Mission Panel calls, Task follow-up ingress, terminal conversation ingress, multiple projects, and existing Task-root FIFO/fencing semantics remain intact. (5) Focused positive tests and a real isolated Mission-to-Task run prove the complete path. |
| Hard constraints | Do not mutate the reported production database or restart the user's application. Do not add a Host workflow gate or parse prose. Reuse the existing typed Tool-result `immediate_park` control and the existing runtime-contract owner. Do not create another status field, retry owner, compatibility reader, or shadow Task publication state. All LLM calls remain streamed. No UI automation tests; any UI validation uses a real isolated page and manual screenshot inspection. Preserve unrelated worktree changes. |
| Sources read | `specs/current/architecture/task-control-plane.md`, `specs/current/architecture/04-extensions.md`, `packages/opencorvus/src/prompt/core/mission-core.txt`, `packages/opencorvus/src/tool/panel.ts`, `packages/opencorvus/src/session/tool-result-control.ts`, `packages/opencorvus/src/session/processor.ts`, `packages/opencorvus/src/session/loop.ts`, `packages/opencorvus/src/orchestrator/agent.ts`, the supplied diagnostic bundle, production log `2026-08-15T055932-24040-1.log`, and read-only SQLite facts from `data/opencorvus.db`. |
| Whole-repository search | The repository already has one typed turn-boundary primitive: `withImmediateParkToolResultControl`, enforced by `turn_control_exclusive` execution and consumed by `SessionProcessor`. `panel.create_task` did not use it. The first typed Task ingress makes `materializeCreatorBeforeTypedControl=true`; `orchestrator/agent.ts` attempted `SessionPrompt.prompt(... noReply:true)` before installing the required `SessionRuntimeContract`, while `session/message-identity.ts` correctly rejects Orchestrator Message writes without that contract. No second renderer or fallback path is required. |
| Independent agent feedback | The first read-only review found two valid P1 gaps: the new-conversation Composer cleared its draft before Session creation reached the real dispatch boundary, and the Mission→Task path lacked an isolated streaming Provider plus real-page visual proof. The Composer callback was moved to the exact transport boundary. The isolated run then exposed and drove repair of shared watermark, protocol-envelope projection, lifecycle-event ownership, accepted-activity settlement, and `immediate_park` durable-reply defects. After the later production bundle drove the Artifact and Permission/Tool projection repairs, the final independent read-only review found no remaining P0, P1, or P2 findings. |

## Evidence and root cause

The Task publication itself succeeded exactly once. The canonical `engine_task` row links the Task to Mission `6bf8af76d78d8bcf`, and Task lifecycle facts contain `task.execution.opened` and `task.created`. Therefore “cannot publish” is not an acceptance or queue-write failure.

Three control-flow defects follow that accepted fact:

1. `panel.create_task` returned an ordinary Tool result. The generic streamed Session loop therefore treated `finish="tool-calls"` as permission to ask the model for another step. The model repeatedly authored mutable Mission notes about the already durable Task. The existing typed `immediate_park` result control is the correct physical boundary: it says that the accepted external coordination effect has completed this Turn; it does not teach the model a workflow or invent business state.
2. The initial Task-root ingress is a typed control occurrence. On that branch, the Orchestrator must first preserve the real Task creator Message and then expose the current control Message. The implementation tried to persist the creator Message before installing the projected Orchestrator runtime contract. The exact startup receipt proves the integrity guard fired: `Session message runtime contract missing for ses_-zUXeftMWzzgSquQhGLC (orchestrator)`. The Task then correctly terminalized as failed, leaving no assistant conversation for the UI to render.
3. After correcting that order, the Task-root assistant fence exposed a second invalid assumption: it required an activation-bound assistant to live in the Task root Session itself. Production Orchestrator replies live in the root Session's immutable `kind=orchestrator` child. The corrected fence now validates that exact same-project parent relationship, the control Message in the same child Session, deterministic ingress/predecessor identity, and uniqueness of both activation and continuation. It does not weaken the activation fence or accept an arbitrary sibling Session.

The real-page pass exposed four more shared cutover defects that fixture-only checks could not prove:

4. Task message watermarks still joined the removed redundant `part.session_id`. They now derive Part ownership through the canonical Part → Message → Session chain.
5. durable Protocol facts correctly keep Session identity and ordering in the envelope, but HTTP/UI consumers still required payload copies. Routes now validate the envelope only, and the Overlay projects `session_id` into the transient event properties once at the reducer boundary. No duplicate field is restored to storage.
6. a Task terminal decision can commit while its already accepted Tool/Provider activity is still settling. The lease fence now has an exact settlement path: it still requires the latest activation, matching epoch and continuation identity, and every accepted activity outcome; it permits only the final assistant boundary after the terminal fact. New requests remain forbidden.
7. `SessionLoop` treated every `finish="tool-calls"` assistant as “no durable reply”, even when the canonical Tool outcome carried `immediate_park`. The reply reducer now recognizes that persisted control receipt as the Turn boundary. This removes the false failure/recovery wake shared by Mission `create_task`, Task `wait`, and terminal management tools.

The later production bundle exposed two more single-authority projection defects:

8. Artifact reference lookup selected every completed `panel` request in the physical Turn by tool name, decoded every output as JSON, and only afterwards tried to recognize catalog/read shapes. Human-readable `view_tasks` is a valid Panel fact, so it deterministically broke every later `read_task_artifact`. The reader now classifies the persisted request through the exact `MissionPanelActionSchema` first and decodes only `query_task_artifacts` or `read_task_artifact` outputs for the corresponding authority.
9. Permission execution persistence owns the raw structured Tool result while the Session Tool outcome owns its normalized visible projection. The write and read boundaries used a second partial projector that understood strings and `{output}` only; a valid structured `dispatch_agent` accepted result therefore compared as `undefined` against its canonical JSON Tool output. Both boundaries now reuse `normalizeToolResult`, the same projector used by the streaming processor. The Tool outcome references the exact Permission attempt and no retry or error-string exception is introduced.

Mission Turn Artifact hydration also passed a resolved terminal projection back into a strict minimal terminal locator schema. It now validates the original `{terminalEventID}` locator and derives status/error/time separately, preserving one authority.

The repeated Mission files are consequences, not authorities. The `engine_task` row and immutable Task lifecycle remain the sole publication facts; the Mission state files are authored planning notes and must not drive execution or recovery.

## Design

### Mission dispatch boundary

- Materialize the Mission-specific `panel` tool as `turn_control_exclusive`.
- Only a completed Mission `create_task` result carries `withImmediateParkToolResultControl`. Failed creation has no success result and cannot park as success. Other actors retain ordinary Panel behavior.
- Persist the Tool request/outcome before the processor consumes the control. The assistant Turn becomes a real terminal boundary with the exact created Task ID visible in its Tool result.
- Update Mission instructions so all authored planning changes needed for dispatch are written before `create_task`; after success the Host parks the Turn. Later wakes reread canonical Task facts and do not poll.

### Orchestrator first-message boundary

- Resolve the projected scheduler capability and construct the one runtime contract as today.
- Install that contract before any Orchestrator Message write, including the creator `noReply` Message.
- Under the same installed contract, materialize the creator Message, then materialize/arm the exact current typed control occurrence, then start the streamed Orchestrator Turn.
- Bind the resulting assistant evidence to the Task root's Orchestrator child Session and the exact current control parent; derive this lineage from existing Session facts rather than duplicating a Session identifier in the activation.
- Keep the existing `finally` ownership and resource settlement. No runtime contract is persisted as business authority.

### Horizontal invariants

- Initial Task creation, operator follow-up, Mission resume, Retry/Replan, terminal conversation, and restart recovery all use the same Task ingress reducer and runtime-contract fence.
- A Mission may create several dependency-independent Tasks, but each successful `create_task` occupies its own physical assistant Turn. A subsequent Turn/wake may create another ready Task from freshly reduced facts; two irreversible Task creations are never hidden inside one ambiguous parallel Tool batch.
- Multi-project isolation remains keyed by the existing Project/Session/Task identities; no global stop flag or process-local business decision is introduced.

## Verification plan

1. Add a focused positive Tool-result-control test: Mission `panel.create_task` returns a persisted created Task receipt plus `immediate_park`, and the Session produces no successor model step.
2. Add a focused Orchestrator startup test covering the typed initial ingress branch: creator Message persists only after contract installation, current control Message follows, and the first streamed assistant Message is renderable.
3. Run affected Task-root reducer/reconciliation, Session runtime-contract, Panel, Mission, and Orchestrator tests; run typecheck and documentation checks.
4. Start an isolated Project/database with a controlled streaming Provider, submit one Mission request, inspect the real Mission and child Task page, and capture screenshots proving one Task creation, no repeated state-write loop, and a visible child Orchestrator conversation. Do not touch the user's running process.
5. Run an independent read-only agent review after all implementation and first-pass validation; fix every valid finding and repeat review until clear.

## Implemented verification

- `orchestrator-initial-task-render.test.ts` drives the production Task-root reconciler into the production Orchestrator with a controlled Session processor. It proves the runtime contract is present before processing and that one creator Message, one deterministic Orchestrator control Message, and one renderable assistant Message persist in the Orchestrator child Session.
- `task-event-projection-contract.test.ts` proves the public conversation watermark reaches a normalized Part through its canonical Message owner and that Protocol Session identity is projected from the durable envelope without restoring a payload copy.
- `permission-two-mode.test.ts` now persists a real structured Permission result, settles the matching Session Tool request, and proves the visible Tool output plus exact `resultAttemptID` reference converge through the shared normalizer.
- The Mission Artifact catalog test persists a human-readable `view_tasks` fact before the structured catalog and proves the exact catalog/read reference still resolves; the provider-input audit fixture now follows the immutable assistant completion boundary and the minimal terminal locator contract.
- `panel-mission-terminal-authority.test.ts` proves Mission Panel calls use exclusive control and a successful `create_task` result returns the exact created Task receipt plus `immediate_park`.
- The focused Mission/Task, Task-root continuation, Protocol projection, diagnostic-copy, Permission result, Artifact read, dispatch lifecycle, and Tool-result boundary sets pass with no failures; OpenCorvus and Overlay typechecks pass.
- Overlay diagnostic-copy checks pass 10 tests, Overlay typecheck and i18n checks pass, and the production Vite build completes. Earlier isolated real-page evidence for the same uncommitted Overlay repair showed an anonymous-project debug copy and immediate Composer clearing without a visual regression.
- A production CLI server was started against an isolated database and Project with a local OpenAI-compatible HTTP Server-Sent Events (SSE) Provider. The request used the real `/mission/wake` route, production Mission `panel.create_task`, Task-root reconciler, Orchestrator tool loop, normalized Tool request/outcome facts, `/session/:id/conversation`, `/task/:id/conversation`, and built `/ui`; `SessionProcessor` was not mocked.
- Final isolated evidence: Mission `c604c732e54151aa`, Task `tsk_g00VSLeSnL00XvPUsIel`, Mission Session `ses_-zUXeLXgOzzDGC1RCBre`, Task root Session `ses_-zUXeLX5Rzz4adxCiuJ8`. Raw database count was exactly one Task. Both Mission and Task conversation endpoints returned HTTP 200. Logs contained no `orchestrator failed`, `completed without a durable reply`, activation-fence rejection, or request failure.
- Manual screenshot inspection confirms the Mission page contains exactly one child Task and one visible `panel Task created` receipt: `specs/artifacts/2026-08-15-mission-task-publication-mission.png`.
- Manual screenshot inspection confirms that exact child Task opens and renders the real streamed Orchestrator text, without repeated prose: `specs/artifacts/2026-08-15-mission-task-publication-task.png`.
- Focused positive contracts additionally prove that an accepted assistant activity may append its exact final boundary after the Task terminal fact, and that a completed `immediate_park` Tool outcome is a durable reply boundary even when the assistant finish reason is `tool-calls`.
- Documentation, internationalization, control-state redundancy, production Overlay build, and `git diff --check` gates all pass.
- Final independent read-only review confirmed the exact `view_tasks`-before-Artifact path and structured Permission-result convergence, reran four core files with 20/20 tests passing, and reported no unresolved P0/P1/P2 findings.
