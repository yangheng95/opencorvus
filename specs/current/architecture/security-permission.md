# Security and Permission Boundaries

## Current authority

1. Operator authorization has exactly two modes: `full_access` (shown as **Full access**, the default) and `ask` (shown as **Ask me**). The effective mode is persisted per Session at its first permission-bearing invocation, so a config reload cannot silently change an active Session's authority.
2. Tool installation, agent assignment, Skill enablement, per-message switches, and Session Tool projection are capability controls. They use `CapabilityRules` (`allow | deny`) and are not operator authorization.
3. Every executable built-in, plugin, Skill, Model Context Protocol (MCP), MCP App, Browser, Computer, projected, scheduled, or external provider crosses `withTaskToolInvocation`, which delegates to `PermissionAuthority.authorizeAndExecute` before the physical effect.
4. `Ask me` pauses concrete write, process, network, external-effect, credential-release, or destructive invocations. Ordinary canonical reads inside the exact project and host-owned observation/control-plane operations do not prompt. Reads outside the project become permission-bearing.
5. `Full access` bypasses OpenCorvus authorization prompts for every Tool and MCP invocation, but it does not bypass identity, authentication, canonical-path, stale-runtime, Task ownership, or data-integrity checks.
6. Host-native non-effectful stage Tools use the explicit `internal` provider kind. They still cross the shared persisted Tool invocation wrapper and receive exact project/Session/Message/call/part/Tool authority, but `PermissionAuthority` returns no permission descriptor and therefore never turns an internal collector/read operation into an operator authorization request. Effectful materialized stage Tools retain their projected provider binding and ordinary permission classification.
7. Core Task scheduler factories retain an immutable native Task/Session/Tool origin through exact materialization. Global Core Tools use the canonical built-in effect classification; private `read_task_message` and `read_context` readers use `internal`. Session invocation validates that origin against the current runtime owner before permission authorization. Package and MCP Tools keep their own provider origin even when their names match a Core reader. Native provenance does not bypass Task lineage, exact capability authority, or mutation approval, and is rebuilt from the same Core factory on recovery rather than rewriting recorded permission requests.

## Exact scope and decisions

The invocation descriptor binds provider kind and identity, provider/config digest, Tool identity, effect class, redacted normalized arguments, an exact argument hash, and a scope-schema version. Any material change produces a new fingerprint and therefore a new request.

`Ask me` can offer:

- `allow_once`: the exact invocation;
- `allow_task`: the exact typed scope within the owning Task;
- `allow_project`: the exact typed scope within the project, only for canonical built-in local reads and a normalized built-in `webfetch` endpoint;
- `deny`: the exact request.

Destructive, credential-release, and general external-effect operations cannot receive project-wide grants. Revocation appends a ledger fact and prevents later grant use. Project deletion appends an `expired` fact for every still-active project-wide grant inside the same fenced database transaction that deletes the Project row. A same-path Project occurrence may reuse durable Project identity, but it cannot inherit reusable authorization across that explicit deletion boundary.

## Durable ledger and recovery

`permission_policy` freezes the Session mode and revision. `permission_ledger` is the append-only single source of truth for requests, decisions, grant creation/use/revocation, Full-access admission, execution starts, terminal outcomes, and unknown outcomes. Unique decision, execution-start, and outcome slots enforce compare-and-set settlement and at-most-once execution admission.

The single `permission/ledger-facts` reader qualifies the complete requested owner, explicit
source-grant request graph, decision and deterministic attempt/result contract in one read
transaction or nested savepoint. Startup validates the whole retained graph in its physical
transaction. Missing owners, conflicting slots, unsupported scope material and inconsistent
execution/result pairs are typed integrity errors, including retained deleted-Project history.
An explicitly present `metadata.choices` is validated as recorded; only an absent field derives
the current choices from the immutable scope and owner.

Saved-grant capture, eligibility, decision-slot compare-and-set and winning Replied outbox share
one immediate transaction. New `grant_used` owns its request's decision slot and
`saved-grant-policy` actor. Only the targeted slot conflict reads the real winner; unrelated
SQL errors propagate. Version2 appends private `grant_decision_indexed` facts for qualified
historical slotless captures. The locator uses actual migration time and points at the original
grant_used; the original capture supplies authorization, response time and execution source.
Its automatic-reply provenance comes from that capture, not an inferred actor or UI title.

The canonical `requested` row is the only owner of the complete Project, Session, Message, Tool-call, provider, scope, and fingerprint identity; later rows are deltas keyed by `request_id`. The entire ledger chain outlives mutable Project and Session retention, so `permission_ledger.project_id` is not a cascading foreign key. Project-scoped history and grant readers select through the canonical owner in Structured Query Language (SQL) before reconstructing a request. Startup follows the shared versioned migration contract in [Data architecture](02-data.md). The current version-1 baseline includes this retention shape; later revisions must preserve the complete ledger graph through declared migrations before business access. Missing request owners cannot be fabricated. Failed upgrades roll back and retain a pre-upgrade backup; only current-format readers run after successful validation. Unversioned pre-baseline databases require separately authorized baseline maintenance.

The ledger stores redacted scope plus hashes; it must not store tokens, cookies, passwords, authorization headers, OAuth secrets, secret environment values, or complete sensitive content.

Pending requests survive process release and project restart. A later client can settle the same durable request. New execution admission commits the exact attempt's `execution_started` and effect lease in one immediate writer transaction. The lease owner is the original runtime process occurrence, whose physical liveness reference remains held through execution, serialization, result settlement or explicit MCP handback.

Recovery selects starts through their canonical requested Project owner. It observes the original physical receipt outside the writer, then rechecks the same start, lease, owner, latest immutable lease grant, MCP task and terminal winner in one immediate transaction. Only proven physical death admits `outcome_unknown` for an ordinary unfinished attempt. A live or unproven owner retains its original facts; natural lease expiry is not proof of process death. Dead expired leases retain their original expiry, while a still-valid dead lease is released with its unknown outcome. Missing or opaque physical evidence remains explicitly unproven. The same attempt is not blindly replayed.

MCP continuation retains its exact attempt and server task identity. A lease expiry earlier than that same lease's latest immutable grant proves an explicit handback; equal expiry only proves the original deadline. A confirmed handback or physical death admits the existing remote-task continuation, with the normal result writer retaining its unexpired execution fence. Engine interaction rows remain presentation projections that reference the ledger request rather than a second approval authority.

A paired `execution_succeeded` and durable execution result remain authoritative after the
continuation is retired, including Full access. Tool completion and interruption recovery use
one reader for the exact accepted Project/Session/Message/call/Tool identity and deterministic
attempt. Missing success/result pairs or multiple successful attempts are integrity faults.
Recovery materializes the original result and atomically commits its Tool outcome, display
and Sources through the Session writer; it never executes the effect again. The assistant's
interrupted state remains truthful. See [Tool result persistence](02-data.md).

Request-owner admission uses one immediate transaction for identity validation and the first
`requested` fact, including replay after a decision. Readers count distinct request identities;
repeated observations in the retained ledger do not imply additional successful executions.
The same transaction returns the canonical Request to authorization and execution. Its
`timeCreated` is the immutable requested-row timestamp; live Asked events, pending snapshots,
execution contexts and same-request replays use that time and one interaction order key.

Permission reply, startup scanning and asynchronous Tool completion share physical Prompt
admission. A live local or peer owner keeps its authority. The admitted recovery drains the
same Message's approved invocations, bounds each fault to one attempt, and rechecks durable
approvals after release so a decision arriving during release remains actionable. The exact
permission context ends before a subsequent model Turn begins.

Message completion reads every accepted Tool outcome and the current Prompt generation in
one writer transaction. Pending Tools keep the Message open. Park/handoff control is derived
from the whole Message; abandoned Provider activity retains its actual interruption. Successful
requests remain discoverable until Message completion is durable, then the canonical retirement
writer closes them. A process cut after the Tool result therefore still has a startup entry.
Normal assistant completion, silent writes, bundles, atomic imports and identical immutable
completion replay enter that same retirement writer from the canonical Message-row writer.
It reads the exact persisted Message and Session Project, not the ambient Project. Retirement
and Message publication belong to the original synchronous transaction; a retirement write
error rolls back this Message write and its outbox while preserving any earlier committed
Tool result. A compound Part or completion-callback failure also rolls back the outer write.
Recovery retains the same writer for historical completed Messages. Retirement failures are
propagated; if an original stale-continuation or superseded-activation error also occurs,
an AggregateError retains both causes. Per-request recovery remains isolated and reports
retirement only from the actual ledger, with an explicitly unknown diagnostic read on failure.
Mission interruption uses its existing process-recovery owner, frontier and wake protocol before
retiring the original Tool request; generic Prompt acquisition cannot consume Mission's dead-owner
evidence. This adds no permission queue, schema migration or second Mission recovery protocol.

## Transport contract

The Overlay, Agent Client Protocol (ACP), command-line interface, channel runtime, protocol mirror, server routes, and generated Software Development Kit share the same request identity and decisions. Presentation adapters may translate labels, but they cannot invent approval scopes or settle outside the canonical reply/revoke APIs.

Standalone Session hydration and ordered connection snapshots carry mandatory
`pendingPermissions` arrays from that ledger. Exact durable Project and Session lineage admit
non-Task children; Task requests retain their existing Board interaction owner. Asked payloads
keep the original Request fields, including its summary, before entering the same adapter.
Live and queued pending projections re-read the exact canonical request at emission. This
includes Session late Asked, ACP queue head, command-line notices and Channel SDK lookups.
Settled disappearance does not imply an approval. Channel reply confirmation uses the actual
returned Task interaction decision and status rather than the attempted command. Task Asked
materialization and Replied delivery may each invalidate a projection; both reference one
canonical result, and the transport invalidation does not admit another execution.
A real cancelled or stale decision winner publishes `permission.terminated` with its Project,
Session, request and ledger-event identity in the same transaction and owned outbox. It is
not an operator reply. Task invalidation validates that fact and its Interaction projection
before using the existing ephemeral protocol event; it creates no second terminal authority.

Denying an invocation persists the denied decision and real Tool error. That error enters the
next streamed model request through the existing Tool-result projection, so the model chooses
a permissible next action or a final reply. The former `continue_loop_on_deny` configuration
and host stop branch are removed. This does not approve or replay the denied effect. Prompt
cancellation retains its exact owner and AbortSignal; real control results, failure, compaction
and completed-reply admission keep their existing contracts. Already completed historical
denial-only turns are not automatically rewritten or repaired by startup recovery.

## Adjacent security boundaries

- Large Language Model telemetry may record operational metadata; prompt, message, response, and Tool content capture remains disabled without a separate opt-in contract.
- OAuth diagnostics may record server/host/correlation metadata but never authorization URLs, state, code, token values, or pending-state lists.
- Public unknown HTTP errors use a generic body and a request identifier; full diagnostics remain server-side.
- A no-waiter permission reply commits its real decision and authored outbox before awaiting
  continuation recovery. A subsequent retirement failure follows that public error contract;
  it does not revoke or roll back the already committed operator decision.
- Query metric evaluators remain typed named projections rather than arbitrary Structured Query Language (SQL).
