# Task-root in-activation decision repair and stage Tool identity convergence

## Recall

- User request: continue the root repair after a new Task still showed redundant Orchestrator wakes and then appeared stuck.
- Acceptance:
  - within one live physical attempt, one Task-root ingress owns one activation and one visible assistant Message while the Orchestrator repairs a missing decision;
  - a successful streamed Provider step without a valid decision receipt continues inside that same activation instead of creating another control Message or activation;
  - the next Provider request receives explicit ephemeral decision-repair context but the Host never chooses or synthesizes a decision;
  - repeated missing decisions are bounded by the ingress's immutable semantic limit and project `exhausted/semantic_limit` without another activation;
  - a completed valid decision still resolves normally, parallel dispatch remains valid, and a later independent ingress remains FIFO-eligible;
  - every internal projected-worker stage Tool executes through one persisted invocation-identity wrapper, so architect and other stage-owned Tool calls receive exact project/session/message/call/part/tool authority;
  - focused production-path tests, current checkers where authorized, typecheck, documentation checks and an uninvolved read-only review have no unresolved findings.
- Hard constraints: preserve immutable fact reduction, one reconciler, FIFO and lease ownership; do not add mutable retry state, parse prose, auto-select a Tool, synthesize Messages, add compatibility paths or make non-streaming model calls; do not add or run User Interface automation tests; do not restart or mutate the user's running application or database.
- Read material: `specs/current/architecture/task-control-plane.md`; `specs/records/2026-08/2026-08-15-task-root-fact-reduction-kernel.md`; `specs/records/2026-08/2026-08-15-task-root-no-action-convergence.md`; `specs/records/2026-08/2026-08-15-task-root-multistep-assistant-convergence.md`; `packages/opencorvus/src/engine/task-root-ingress-reducer.ts`; `packages/opencorvus/src/engine/task-root-ingress-delivery.ts`; `packages/opencorvus/src/engine/task-root-fact-store.ts`; `packages/opencorvus/src/session/loop.ts`; `packages/opencorvus/src/session/processor.ts`; `packages/opencorvus/src/agent/runner.ts`; `packages/opencorvus/src/agent/stage-tool-materializer.ts`; `packages/opencorvus/src/architect/agent.ts`; and the focused Task-root and SessionLoop authority tests.
- Repository search:
  - `SessionProcessor` retains a projected-scheduler assistant only when the finish reason contains `tool`; a clean `stop` always completes it;
  - the reducer then counts that completed decision-less assistant as a semantic Turn and the reconciler immediately acquires another activation lease while below `semanticTurnLimit`;
  - `StepFinishPart` is already a durable immutable record of each Provider step, so decision-repair attempts need no mutable counter;
  - `runAgentSession` marks non-permission-bearing stage-owned Tools with `InternalStageToolBinding`;
  - `SessionLoop.wrapExtraTool` validates that binding and immediately returns the raw Tool, bypassing `ensureToolPart`, `withTaskToolInvocation`, and the `opencorvus` execution metadata injection used by every other projected Tool;
  - architect output Tools deliberately reject calls without that exact persisted metadata, yielding the observed deterministic failure;
  - permission-bearing stage Tools follow a separate materialized path and already retain their authorization binding.
  - an Orchestrator `artifact_read` failure on the redundant activation was not an Artifact catalog defect: locator references are deliberately scoped to the exact control parent/physical Turn, so the second activation could not consume references minted under the first; preserving the activation also preserves this communication authority;
  - the shared Tool bridge compared immutable inputs with `JSON.stringify`; the Provider stream persisted `{filePath, content}` while the execution wrapper supplied the identical object as `{content, filePath}`, so ordinary Tool execution failed before the Tool body with a false request conflict;
  - fresh-process Tool continuation also exposed runtime cycles caused by schema consumers importing full storage/Engine modules; schema-only values and pure attachment/diagnostic helpers require cycle-free dependency leaves.
- Existing uncommitted work: none; `git status --short` was clean before this record.
- Independent agent feedback: none before implementation. An uninvolved read-only delivery review is mandatory after focused verification and after every review-driven repair.

## Observed facts

The supplied debug bundle at `2026-08-15 12:40:32Z` contained one accepted Task ingress, one activation and three valid parallel `dispatch_agent` receipts. That exact snapshot did not yet contain a duplicate activation.

Subsequent read-only production API inspection showed ingress sequence 2 (`art_hv1vzLCdxLWkBhtn4CUC`) with two activation leases. The first activation's assistant (`msg_hRGjVbhpieavk9poGDD9`) became idle without a decision; the second activation was acquired roughly 175 milliseconds later by the same occurrence owner and later produced a valid dispatch receipt. Lease expiry was not the trigger.

The same live Task later had two distinct worker-terminal ingresses in `ready`, while `solution-architect` remained `streaming`. Its transcript showed repeated `register_contract` and `view_architect_draft` failures with `Architect output tool is missing persisted project/session/message/call/part/tool identity`. New streaming events continued, so the process was alive but making no durable architecture progress and blocking FIFO consumption behind the active worker.

Unavailable data remains unknown: no production database was queried directly, no process was restarted, and no claim is made about state after the last read-only API snapshot.

## Root cause

The redundant wake is not a duplicate ingress and not an expired-lease race. A clean Provider `stop` without a valid decision closes the only assistant Message for the activation. Durable reduction correctly sees an unresolved semantic attempt, but the reconciler's only legal next action is a new activation. The previous `no_action` repair completed the decision algebra but incorrectly assumed the model would always obey it.

The architect stall is a separate direct trigger in the same convergence family. Internal stage Tools are excluded from the only SessionLoop wrapper that persists and injects execution identity. Architect output Tools correctly fail closed, but the model is then allowed to retry an unrecoverable Host contract error for hundreds of steps.

The communication failure has two direct triggers. A redundant activation creates a new control parent and therefore invalidates the prior Turn's capability-like Artifact references by design. Independently, key-order-sensitive Tool input comparison rejects semantically identical Provider/wrapper requests before execution. Loosening Artifact reference scope would cross the security boundary and is not a valid repair; retaining the original activation and using structural Tool input equality repairs both without adding a fallback channel.

The shared control-flow defect is that recoverable model noncompliance and locally repairable Host identity omission are both crossing a physical Turn boundary instead of converging at their owning boundary.

## Canonical design

### Decision repair

Keep the existing Task-root activation and deterministic assistant Message open when a streamed Provider step settles without error, without an interaction/coordination park, and without a valid completed decision receipt. On the next streamed request append an ephemeral system fragment that states the prior step ended without a decision and requires exactly one valid current decision set. It may not name the chosen Tool or interpret prose.

Every non-Tool final `StepFinishPart` on that assistant is an immutable decision-gap attempt. The ingress's persisted `semanticTurnLimit` is the sole bound. Below the limit, retain the assistant and continue. At the limit, complete the assistant once; the reducer projects `exhausted/semantic_limit` from those immutable step facts before any new lease can be acquired. Existing completed prose-only assistant Turns remain supported as historical semantic evidence.

### Internal stage Tool identity

Validate the `InternalStageToolBinding`, then run the Tool through the same `ensureToolPart` and `withTaskToolInvocation` wrapper as other exact runtime Tools. Classify this host-native stage closure with the explicit `internal` provider kind; permission authority returns no permission descriptor for that kind, preserving its non-permission-bearing semantics while injecting the exact persisted `opencorvus` identity. Permission-bearing materialized stage Tools retain their existing separate path.

There is one wrapper and one persisted Tool request/outcome authority; no stage-specific identity fallback is added inside architect Tools.

Immutable Tool request equivalence compares call identity, Tool identity, input and metadata structurally; object property insertion order and wrapper-local start timestamps are not semantic request identity. The first persisted request remains authoritative, and genuine value changes still produce the explicit immutable-conflict error.

Schema-only consumers import cycle-free schema modules. Attachment URL parsing and Tool diagnostic redaction are pure leaf helpers; storage access remains lazy at provider-conversion time. This keeps fresh-process continuation from depending on partially initialized Session, Engine, Panel or storage namespaces.

## Horizontal audit

- Production entry points: direct Task, Mission-created Task, lifecycle and conversational ingresses all enter the same reducer/reconciler and projected-scheduler SessionLoop.
- Occurrences: initial Task activation, worker-terminal lifecycle ingress, operator/coordination ingress and reused Orchestrator Session occurrences share the same activation/message identity checks.
- Normal and terminal paths: valid decision, interaction wait, coordination handoff, Task close/cancel and Provider error remain prior branches; only successful decision-less final steps enter repair.
- Retry/restart: StepFinish facts, decision receipts and ingress policy are durable, so process loss cannot reset the semantic budget. A process crash is a real physical-attempt boundary: after the append-only lease expires, the reconciler terminalizes the exact abandoned open assistant before reduction. Below the limit that completed provider-error Turn becomes the predecessor of a distinct successor activation with freshly minted Artifact references; at the limit recovery converges exhausted without another Provider activation.
- Serial/parallel: a valid parallel dispatch set still resolves; concurrent reconcilers still contend on the immutable lease. Repair does not acquire a lease.
- Multi-project isolation: invocation identity retains exact project and Session lineage checks; no global mutable repair state is introduced.
- Stage adapters: architect and every other non-permission-bearing stage-owned Tool gain the same identity wrapper; permission-bearing materializers and registry/MCP Tools remain unchanged.
- Communication: Artifact search/read/select refs remain exact physical-Turn capabilities; in-activation repair preserves their parent authority, while later independent ingresses must mint new refs normally.
- Tool sources: registry, projected package, stage-owned, permission materializer and recovered executions share structural request identity; the official integration covers ordinary write, Ask-me restart, projected worker restart, internal stage identity and fresh operating-system recovery.

## Positive verification

1. SessionLoop production integration: first streamed Task-root step ends with prose/no decision; the second request contains repair context, uses the same activation and assistant ID, completes `no_action`, and leaves exactly one lease and one decision receipt.
2. Reducer/fact reader: durable non-Tool `StepFinishPart` rows count as decision gaps; reaching the immutable limit yields `exhausted/semantic_limit` after one completed assistant and cannot project `ready`.
3. Crash boundary: an expired lease with one open assistant, a durable decision gap and a unique successful Provider receipt is terminalized before reduction. Below the limit two concurrent reconcilers converge on one byte-equivalent terminal boundary and exactly one distinct deterministic successor control/assistant/lease chain; at the exact limit the old assistant becomes terminal and the projection converges exhausted with the original lease and Provider receipt set.
4. Regression: direct valid decisions, parallel dispatch, interaction/wait, ordinary Tool continuation, later FIFO ingress, restart, concurrent reconciliation and separate Projects retain current outputs.
5. Internal stage integration: a real exact projected-worker `resolveTools` call executes an internal stage Tool and positively asserts exact project/session/message/call/part/tool metadata plus its persisted request; ordinary Provider-driven and recovered executions assert terminal Tool outcomes.
6. Architect path: the production `view_architect_draft` Tool executes through `assertArchitectOutputToolTurnIdentity` and `assertTaskAssistantProducerToolPart`, returning the valid empty collector draft instead of the missing-identity error.
7. Run focused official isolated tests, package typecheck, documentation checks, `git diff --check`, and the real Provider checker only if credential/model use is explicitly authorized.

## Completion record

Implemented the canonical in-activation decision repair, immutable decision-gap reduction, internal stage Tool invocation identity, structural Tool request equivalence, and the cycle-free schema/helper dependency leaves required by fresh-process recovery. No production process or database was restarted or mutated.

Latest verification completed before final independent review:

- official isolated runner: 76 focused tests passed across Task-root reduction/reconciliation including both hard-crash limit edges, production Orchestrator delivery and inactivity-observer ownership, same-assistant multi-step continuation, Artifact reference authority, attachment projection/materialization, SessionLoop Tool authority including the real Architect output identity boundary and a fresh operating-system process, two-mode permission authority, Project Memory, and Session error projection;
- root `bun run typecheck`: 8 packages passed; the generated Software Development Kit package also passed its direct typecheck;
- `bun run docs:check`, `bun run api:routes-check`, `bun run check:control-state-redundancy`, and `git diff --check`: passed;
- generated OpenAPI and JavaScript Software Development Kit types expose the immutable `decisionGapStepIDs` and `semanticAttemptIDs` debug evidence.
- the Overlay clipboard renderer now prints both evidence families; an isolated real Vite page at `http://127.0.0.1:5173/` was opened in the in-app Browser and visually inspected without UI automation. The page rendered normally while disconnected from the deliberately unstarted backend; the temporary page and development server were then closed.

Independent read-only review first found an overstrong cross-process same-activation claim, a custom Tool that did not exercise the real Architect assertion chain, and missing clipboard rendering for the new debug evidence. Follow-up review then identified the exact hard-crash window: an open assistant with durable decision-gap evidence could collide with its deterministic Message identity below the semantic limit or remain permanently streaming at the limit. The implementation now takes the architecture-consistent recovery contract: operating-system process loss is a legitimate new physical attempt under an append-only lease; after expiry, the exact abandoned assistant is terminalized before reduction, then either becomes the predecessor of a distinct successor or converges exhausted. The real Architect path replaced the custom Tool, and the clipboard renderer was updated and visually inspected.

The official runner initially exposed a reproducible test ownership race rather than being rerun until green. An Orchestrator inactivity poll could outlive prompt settlement, and the integration's fake Provider could also drive an unrelated Project Memory durable publication after its fixture directory was released. Production now joins the in-flight inactivity observation. The integration holds unrelated durable draining for its entire temporary-project lifetime and waits for post-commit effects; the file then passed five consecutive isolated runs before the complete 76-test command passed. The real Provider checker was not run because this task did not authorize credential/model use.

Final independent read-only review found no unresolved P0-P3 issue. The reviewer confirmed pre-reduction terminalization, byte-equivalent concurrent recovery from `lease.expires_at`, one successor under two competing reconcilers, exact-limit exhaustion without a new Provider activity, inactivity-observer ownership, real Architect Tool identity, Artifact boundaries, structural Tool request equivalence and the cycle-free dependency leaves. The reviewer independently reran the official Task-control file at 6/6 and `git diff --check`; both passed.
