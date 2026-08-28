# Mission acceptance baseline readiness

## Recall

### Original request

The 2026-08-28 Mission acceptance change at `cb6995a8` must not become the Luna
600-case continuation baseline until six remaining production contracts are
closed:

1. replace the incomplete open/preserved acceptance ledger with explicit
   evidence-bearing criterion transitions;
2. make the frozen Task baseline the exact canonical JSON value to which its
   JSON Pointer delta applies, including an empty first delta;
3. separate a logical acceptance checkpoint from immutable execution attempts
   so a failed attempt can recover;
4. admit direct-dispatch Expert Squad responsibility through immutable dispatch
   lineage rather than requiring a virtual-workflow node;
5. prove dispatch decision settlement through the real streamed Provider,
   Tool, Processor, Session, and Task-ingress path without a second Provider
   request or synthetic `no_action`;
6. keep scheduler execution inactivity armed through Project, worktree,
   Session, database, admission, and model preflight, delegating only after the
   Session/Provider execution owner exists.

After source closure, reconcile the benchmark completion record to the current
rolling catalog and, only after credential/model/proxy/lease preflight, run a
small never-eligible Luna canary from the isolated benchmark checkout. Never
rerun an eligible case and never mix ARC or Overlay changes into this delivery.

### Acceptance metrics

- A criterion state reduces to exactly one of `open`, `accepted`, or `blocked`.
- `open -> open` requires new observation/repair evidence or a changed
  canonical structured repair-action hash.
- `open -> accepted` requires new resolution evidence; `open -> blocked`
  requires irreducible-blocker evidence; `accepted -> open` requires new
  invalidating evidence and the `stale_evidence` disposition.
- The exact serialized baseline parses as the prior `TaskDesc`, and applying
  the emitted strict JSON Pointer operations reconstructs the current
  `TaskDesc`. First and later steps have the same two-part shape.
- A failed logical checkpoint attempt remains immutable; recovery creates a new
  deterministic attempt and the reduced projection chooses the current pending
  attempt or latest successful control/summary binding.
- A direct criterion binds package revision, target Agent, and exact
  `dispatch_lineage` Artifact, and only that lineage's continuation may consume
  it.
- A real streamed dispatch step persists one decision receipt, converges the
  Task-root ingress, performs one Provider request, and does not add
  `no_action`; dispatch fan-out remains valid while mixed decision sets remain
  a typed conflict.
- A pre-owner scheduler stall times out, provider ownership suspends the
  scheduler timer, and settlement rearms it; concurrent delegated owners do not
  rearm until the final owner settles.
- Focused positive tests, package typecheck, root `bun run api:routes-check`,
  generated SDK/OpenAPI closure where required, documentation checks, and an
  independent read-only review pass.

### Hard constraints

- Preserve all pre-existing dirty ARC, Expert Squad evolution, MCP, Session,
  Overlay, and architecture-debt edits. This task does not amend, reset, clean,
  stash, rebase, or bypass hooks.
- Keep one current schema and one fact source; do not add compatibility readers,
  fallback acceptance state, synthetic messages, or Host workflow gates.
- All LLM interaction remains streamed. Tests assert positive current
  contracts and do not add UI automation.
- The benchmark runner must receive both Provider credentials and the exact
  model projection. Credential contents never enter logs, this spec, or Git.
- A source change is committed independently before any benchmark record or
  canary mutation. Remote integration uses merge, never rebase or force push.

### Materials read

- `specs/current/architecture/task-control-plane.md`
- `specs/current/architecture/{01-agents,02-data,03-control,13-agent-communication-matrix,15-agent-facts-and-turns}.md`
- `specs/records/2026-08/2026-08-28-mission-acceptance-delta-closure.md`
- `packages/opencorvus/src/mission/{acceptance-gap,acceptance-ledger,acceptance-checkpoint}.ts`
- `packages/opencorvus/src/orchestrator/{agent,tools,dispatch-turn-projection}.ts`
- `packages/opencorvus/src/engine/{workflow-binding,dispatch-lineage-facts}.ts`
- `packages/opencorvus/src/session/{compaction,control,loop,wake}.ts`
- `packages/opencorvus/src/scheduler/{execution-inactivity,event-service,automation-service}.ts`
- focused Mission acceptance, Session loop, Task-root reconciliation, Tool
  decision, and scheduler inactivity tests.

### Repository-wide searches and impact analysis

The public acceptance input is owned by the panel capability and materialized
once into canonical Artifact locators. The same canonical gap is then consumed
by the Task resume transaction, acceptance ledger, active repair projection,
dispatch continuation schema/message, checkpoint focus, Task query, prompt, and
generated OpenAPI/SDK. Those definition and call sites must change together.

The observable ledger defect is structural rather than a test-only mismatch:
`preserved_acceptances` and open `criteria` are mutually exclusive while prior
preserved facts must be copied exactly forever. Consequently accepted evidence
cannot become stale. Conversely, prior open evidence can be copied unchanged
into preservation and be called accepted. `repeat_disposition` also places
accepted/blocker outcomes on the open item and treats free-form action text as
progress. The root cause is that one snapshot shape is trying to represent
observations, actions, and resolutions without typed transitions.

The Task delta's direct trigger is that `renderTaskProjectionFull` embeds a
Markdown rendering, while its cursor and JSON Pointer operations are computed
over the internal `TaskDesc`. No consumer can apply the delta to the displayed
baseline. The first step also has a different one-part shape. The one current
contract will therefore be canonical JSON plus a strict operation envelope and
an exported applying validator used by the positive test.

The checkpoint direct trigger is one deterministic `session_control` ID per
logical epoch/ledger/session. A failed terminal event makes that immutable row
unusable, and the helper rejects it forever. Session controls already provide
append-only attempt outcomes and bind successful compactions to
`result_summary_message_id`; they remain the single fact source. Logical
checkpoint metadata and attempt number belong in the control payload, while a
reducer over controls chooses pending/latest-success and creates a successor
attempt only after failure.

Direct dispatches already persist package revision, target Agent, child
Session, dispatch ID, and workflow binding in immutable `dispatch_lineage`
Artifacts. The acceptance ledger nevertheless rejects every direct binding,
and dispatch continuation requires a non-null workflow node. Criterion
responsibility must therefore be a discriminated union: virtual workflow node
or exact direct dispatch lineage. The latter is validated against the current
binding and lineage, and consumption requires the exact continued lineage and
Agent.

Task decision settlement already has a durable decision-part reducer and a
step-level stop effect. Existing pure tests prove fan-out and mixed-set
conflict, while Task-root reconciliation tests manually persist completed Tool
parts. The missing proof is the production streamed Session loop with the real
`dispatch_agent` Tool and Processor boundary; a focused integration test must
observe the one Provider request, durable lineage/receipt, ingress reduction,
and absence of a follow-up Provider step.

Scheduler search found every `runDelegated` call. Event fires wrap both resume
and fresh wake before Session/model preflight. Automation additionally wraps
global/project target resolution, independent Project initialization, worktree
creation, Session creation, database admission, and wake persistence. The
durable `SessionWake.WakeReceipt.activation` promise is the precise handoff to
the physical Session prompt owner. Scheduler inactivity remains armed until
that promise resolves; only waiting for the exact reply completion is delegated.
Event settlement does not wait for reply completion and therefore needs no
delegated interval.

Horizontal audit scope includes both canonical Task reopen authorities,
Mission/Task/Session occurrences, first/repeated/terminal acceptance
transitions, failed checkpoint recovery, direct and virtual workflows,
continuation/fan-out/mixed decisions, Automation delay/recurrence and Event
wakes, resume and fresh wake paths, concurrent targets, restart-safe durable
controls, and project/worktree isolation. Recovery and late outcomes remain
bound to an existing epoch and gain no reopen authority.

### Independent agent feedback

No agent participated before implementation. The mandatory first read-only
review found four closure defects: evidence roles were retained as one flattened
set instead of per-role append-only facts; delayed Task execution delegated
before the Task activation lease; the delta consumer accepted a loose operation
shape; and the expected new evidence kind had two sources. The implementation
was corrected to retain all five evidence arrays in every state, validate each
role independently, expose a post-lease Task activation receipt, parse a strict
discriminated delta envelope, and make the structured repair action the only
expected-evidence authority. A second independent review is required after the
corrected verification closure.

## Delivery plan

1. Replace the gap/ledger schema with typed criterion states, separated evidence
   roles, canonical structured repair actions, and responsibility union;
   update panel materialization, Task resume, prompts, repair rendering,
   checkpoint focus, and dispatch validation as one schema transaction.
2. Replace Markdown Task baseline projection with canonical JSON and strict
   applicable delta envelopes, using the stable baseline-plus-delta shape on
   every Provider step.
3. Add logical checkpoint reduction and immutable attempt identities on the
   existing Session-control lineage, including current successful summary
   binding.
4. Narrow scheduler delegation to the exact post-activation completion wait and
   add pre-owner, rearm, and concurrent-owner tests.
5. Extend the production Session-loop acceptance test through real streamed
   dispatch settlement; retain the existing fan-out and mixed-conflict tests.
6. Regenerate the full SDK/OpenAPI closure from
   `bun ./packages/sdk/js/script/build.ts`; review every generated change and
   exclude unrelated dirty paths.
7. Run focused tests, package typecheck, root route/docs/import checks, and
   independent read-only review. Fix every valid finding and repeat review when
   changes are required.
8. Commit only this source/spec/generated closure, fetch and merge upstream,
   inspect the complete outgoing set, rerun required checks, and push.
9. In the isolated benchmark checkout, update the rolling completion record to
   the current catalog classification. Only after source sync and secret-safe
   Provider/model/proxy/lease preflight, select a small never-eligible canary,
   observe rolling settlement, and record exact evidence without rerunning any
   eligible case.

## Evidence log

- 2026-08-29 initial main-checkout identity: branch `v0.0.55beta`, local and
  upstream at `cb6995a800618b35ea54c4834f78dd71874ae44d`, divergence `0/0`.
- Pre-existing dirty paths were inventoried before this spec. None is owned by
  this follow-up at the time of writing.
- The ledger now stores typed `open`, `accepted`, and `blocked` criterion states,
  separates five evidence roles, hashes one canonical structured repair action,
  and validates new-evidence, resolution, irreducible-blocker, and stale-reopen
  transitions. Workflow-node and direct-dispatch responsibility share one
  discriminated contract; direct responsibility binds the exact package
  revision, Agent, and immutable dispatch-lineage Artifact.
- Task projection uses a canonical JSON baseline plus a cursor-bound strict JSON
  Pointer delta on the first and later Provider steps. JSON materialization
  omits optional `undefined` fields before canonical ordering.
- Acceptance checkpoints retain one logical identity and append deterministic
  immutable attempts after failure; current projection selects the pending or
  successful attempt and its exact summary Message.
- Event and Automation preparation remain under scheduler inactivity through
  durable activation. Session paths await the Session activation receipt; the
  delayed Task path installs an owner-completion wrapper invoked only after each
  Task-root lease is durably acquired. It wraps only that physical runner and
  rearms before reduction or a later activation continues. Focused tests cover
  pre-owner timeout, rearm, concurrent owners, and the production delayed-Task
  runner observing its exact durable activation. A sequential-ingress case
  additionally proves every physical owner enters its own delegation, no two
  delegations overlap, and the scheduler timer rearms after the final owner.
- A real streamed Provider regression drives `dispatch_agent` through the
  production Tool wrapper, persists one completed receipt and one Task-root
  Provider activity fact, settles the deterministic assistant Message with no
  follow-up `no_action`, and then drains the worker lifecycle ingress. This
  exposed and fixed the completed-assistant re-entry collision by making a
  Task-root decision receipt an explicit `stop` boundary and treating an
  already completed activation Message as an idempotent terminal loop state.
