# Permission Two-Mode Calibration Plan

## Status

Implementation and acceptance are complete. The first implementation gate failed with eight findings and the second gate failed with nine findings; both sets were retained as evidence and remediated rather than relabeled as passing. The final independent read-only gate reviewed the current diff, real checker, focused tests, and visual evidence and reported zero unresolved permission findings.

Verified evidence so far:

- 27 focused authority, recovery, SessionLoop continuation, stage-materializer, and transport-hydration contracts pass with 93 assertions, including a fresh operating-system-process recovery of one effectful private stage Tool;
- the real temporary-project checker exits successfully after driving default `Full access`, `Ask me`, built-in write, batch child, plugin hooks, controlled stdio MCP, MCP App, Browser, Computer, schedule create/run/delete, protocol-task restart, real Session Server-Sent Events (SSE), a real CLI subprocess, and the official ACP client;
- OpenCorvus typecheck and `git diff --check` pass in the current shared worktree;
- the isolated real Overlay page was manually inspected in English and Simplified Chinese: `Full access` is selected by default, `Ask me` is the only alternate mode, the broad-authority warning is visible, the old five-row matrix is absent, and the layout remains legible without UI automation;
- real Task-owned Ask prompts were captured in English and Simplified Chinese with typed provider/Tool/effect/endpoint scope, redacted query digest, all four decisions, long-value wrapping, and visible keyboard focus; a real Chinese `Allow once` reply succeeded and the resolved conversation state was captured;
- the broader schema-migration test file is currently blocked by a concurrent Project-generation authority change whose predecessor fixtures omit its new required `generation`; the permission-focused suite is separated and passing rather than treating those unrelated failures as permission evidence.

Independent implementation gate findings:

1. restart recovery retains the request but does not reconstruct and execute the original Tool continuation;
2. the checker invokes the authority directly rather than the actual SessionLoop/MCP/transport families required by the acceptance matrix;
3. typed filesystem, shell, network, and schedule canonical scopes remain incomplete;
4. expiry, stale-input, execution reconciliation, and MCP task recovery lifecycles remain incomplete;
5. legacy operator configuration migration and its visible migration record remain incomplete;
6. ACP, CLI, and protocol mirror do not hydrate durable pending requests after restart;
7. MCP binding loss must fail closed everywhere and revision-change tests are still required;
8. a public direct MCP execution helper bypassed the central authority.

Remediation completed after the failed gate:

- fixed the reply-during-publication lost-wake race and added a positive synchronous-reply contract;
- aligned config, authority, Overlay, tests, and current docs on the operator-selected `Full access` default;
- bound normal and scoped MCP Tools to canonical config/Tool digests, passed those digests through default/projected/MCP App wrappers, and made missing external/projected bindings fail closed;
- removed the unused public `MCP.callTool` and `MCP.serverTools` execution bypasses;
- expanded URL and composite secret-field redaction, recorded the working directory for local/process scopes, and disallowed project grants for write/process/external/destructive effects;
- separated successful effect execution from success-ledger persistence so a ledger write failure becomes recoverable `outcome_unknown`, not a false `execution_failed` fact;
- retained permission ledger rows after Session deletion and added a typed cancelled settlement for pending Session-owned requests.
- reconstructed approved Ask-me invocations through the ordinary persisted SessionLoop Tool surface after process restart; the recovery binds the original Session, assistant message, Tool call ID, ToolPart input, provider digest, and permission request ID, marks changed bindings stale, and uses the existing unique execution attempt as the at-most-once authority;
- persisted successful Tool return values in the execution outcome so a crash after the effect but before ToolPart completion can finish the original ToolPart from durable evidence without executing the effect again; project bootstrap scans approved, unstarted continuations;
- added a focused real SessionLoop file-write test that releases the first instance with a pending request, commits approval in a second instance whose recovery fails before execution, then recovers in a third instance and proves one execution start, one success, one file effect, and one completed original ToolPart.
- rebuilt an approved post-restart invocation from its persisted Session, assistant message, ToolPart, user message, model, agent, configuration, and ordinary resolved Tool surface; changed identities settle stale, durable completed results replay without repeating effects, and the real cross-Instance test records one start and one success despite a repeated reply;
- added typed filesystem, shell, normalized network-endpoint, and schedule resource scopes; fail-closed external provider binding; narrow reusable-grant eligibility; expiry, stale, and explicit unknown-outcome reconciliation lifecycles;
- added one-time legacy config migration: all-allow becomes `full_access`, restricted or mixed rules become `ask`, old fields are deleted, and the canonical choice is persisted with a structured migration record;
- replaced the direct-authority checker with a repository-owned `check:permission-modes` path that boots a real temporary project, resolves the real SessionLoop Tool adapters, executes real built-in file writes in both modes, and executes a harmless Tool through a controlled local stdio MCP server;
- hydrated the canonical durable pending-request snapshot into ACP load/fork/resume, CLI reconnect, and the Session protocol stream, with request-ID de-duplication and a positive process-release/reopen transport contract.

The second gate additionally found incomplete private-stage cold recovery, missing MCP protocol-task recovery, Tool-result leakage into the ledger, incomplete symlink/shell scope binding, cancellation races, incomplete provider/transport checker coverage, and migration/documentation drift. The implementation now uses revisioned private-stage materializers, a Session-owned result table, canonical real-path and parsed-command scopes, single-winner decision/outcome slots, task-ID polling through `tasks/get`/`tasks/result`, and real transport/provider checker paths. The fresh final gate judged the complete current diff and validation evidence and closed with zero unresolved permission findings; no earlier failed gate is being presented as zero findings.

## Decision summary

OpenCorvus should expose exactly two operator permission modes:

| Mode | Product behavior |
| --- | --- |
| `Full access` | Every legitimately projected built-in Tool, plugin Tool, Skill-owned Tool, Model Context Protocol (MCP) Tool, MCP App Tool, Browser/Computer Tool, shell operation, filesystem operation, network operation, schedule operation, and external-system operation is authorized without an OpenCorvus permission prompt. The action and the fact that it was authorized by `Full access` remain visible in durable evidence. |
| `Ask me` | Every invocation that crosses an operator-controlled trust boundary must pass through one central authorization decision. A matching, active, narrowly scoped grant may authorize it; otherwise OpenCorvus durably asks the operator before execution. The request, decision, grant scope, subsequent grant use, and revocation are durable records. |

`Full access` is the product default. `Ask me` remains an explicit operator choice for pausing permission-bearing invocations. `Full access` must be labeled as giving the agent the same effective local and connected-service authority as the running OpenCorvus process.

The two modes govern authorization, not capability discovery. A Tool that is not installed, assigned, projected, authenticated, or supported does not become available in `Full access`. Operating-system consent, service authentication, OAuth, credentials, CAPTCHA, organization policy, and protocol-mandated user interaction are external prerequisites rather than a third OpenCorvus permission mode.

## Recall

- User request: re-audit the permission system; replace it with two modes named `Full access` and `Ask me`; make `Full access` allow all Tools, MCP Tools, and equivalent execution surfaces; make every permission issue in `Ask me` ask the user and save approval records; research current industry practice and provide a calibrated plan.
- Implementation continuation: the operator subsequently requested that the plan be implemented and that an independent agent perform the delivery gate review.
- Default-mode correction: the operator explicitly selected `Full access` as the default; omitted configuration, runtime fallback, settings projection, generated API schema, and documentation must all resolve to that single value.
- Acceptance indicators for this planning round:
  - the existing implementation, configuration, data flow, UI, persistence, tests, and architecture records are inspected;
  - observable behavior, direct triggers, root causes, reasons the old path was not corrected, and affected surfaces are recorded;
  - current primary documentation from OpenAI, Visual Studio Code, Claude Code, GitHub Copilot, and the MCP specification is compared;
  - one two-mode target contract, migration path, durable approval model, and executable acceptance matrix are specified;
  - no runtime behavior is changed in this planning-only round.
- Hard constraints:
  - one current authorization implementation and one fact source; no legacy fallback, dual reads, or compatibility mode;
  - host enforcement checks data and authority; it must not teach the language model a workflow through hidden gates;
  - all language-model interactions remain streaming and all real permission participants/messages remain visible;
  - no UI automation may be added, changed, or run; UI acceptance uses the real page, screenshots, and manual visual review;
  - focused positive contract tests and a real checker are required during implementation;
  - the existing dirty worktree belongs to other work and must remain untouched outside this record and its two indexes.
- Read repository materials:
  - `specs/current/architecture/security-permission.md`;
  - `specs/current/architecture/04-extensions.md`;
  - the permission remediation sections in `specs/records/2026-08/2026-08-09-architecture-debt-remediation-plan.md` and `2026-08-09-architecture-debt-p0-1-remediation.md`;
  - `packages/opencorvus/src/permission/next.ts`, `permission/types.ts`, `session/session.sql.ts`, `engine/interaction.ts`, `engine/model.ts`, `server/routes/permission.ts`;
  - `packages/opencorvus/src/config/config.ts`, `agent/native-agent-permissions.ts`, `agent/native-agent-materializer.ts`, `session/prompt/run.ts`, `task-api/index.ts`, `session/loop.ts`, `tool/registry.ts`, Tool definitions, MCP Browser/Computer permission plans, and the MCP App host;
  - `packages/opencorvus/src/acp/session.ts`, the permission bridge in `acp/agent.ts`, the command-line event consumer in `cli/cmd/run.ts`, and the protocol event projection in `protocol/session-mirror.ts`;
  - `packages/overlay/src/components/settings/PermissionsPanel.tsx`, `components/InteractionCard.tsx`, `services/interaction-reply.ts`, `services/config-load.ts`, settings state, and bilingual permission strings;
  - current Git history and blame for the catch-all `ask` removal and permission storage changes.
- Whole-repository search results:
  - operator permission configuration currently exists in both top-level `permission` and `tool_permissions`;
  - the same `PermissionNext.Ruleset` shape also represents agent Tool visibility, per-message Tool switches, Skill policy, session overrides, runtime permission requests, and persistent approval grants;
  - execution admission is distributed across Tool-local `ctx.ask`, generic MCP wrapping, Browser/Computer special wrappers, MCP App annotation handling, projected Tool wrappers, session rules, and capability projection;
  - only a subset of built-in Tools call `ctx.ask`; projected non-Browser/Computer Tools execute without the same permission request path;
  - resolved Task interactions preserve some request/response evidence, but direct sessions and the mutable project approval row do not form a complete append-only authorization ledger;
  - pending permission waiters are process-local, time out to rejection, and are abandoned after runtime recovery even when an Engine interaction row exists;
  - Agent Client Protocol (ACP) sessions create ordinary assistant Sessions, translate `permission.asked` into their own once/always/reject request, and keep their permission queue in process memory; the command-line interface (CLI) only reports that a reply is required, while the protocol mirror republishes request/reply/abandon events;
  - the current UI edits five Tool keys only: `websearch`, `webfetch`, `skill`, `external_directory`, and `schedule`, while the runtime exposes many more built-in, plugin, Browser/Computer, MCP, MCP App, and projected Tool identities.
- Independent agent feedback: the planning review found four draft issues; the first implementation gate then failed with eight findings and the second implementation gate failed with nine findings. Their valid findings drove the recovery, immutable binding, typed scope, lifecycle, transport hydration, MCP protocol-task, stage-materializer, checker, and documentation work summarized above. The final independent gate is intentionally still pending at this point.

## Implementation benchmark

- Task: replace the current mixed permission authority with the exact two-mode contract in this record, delete the old operator ruleset authority, and prove the real execution and recovery paths.
- Input: a temporary real Git project, actual OpenCorvus configuration with `permission_mode` set to each supported value, representative built-in/projected/MCP invocations, and typed operator decisions.
- Required output: `Full access` executes every representative invocation without an OpenCorvus prompt and records its authority; `Ask me` durably pauses each permission-bearing invocation, accepts one typed decision, records exact-scope grant use/revocation and execution outcome, and never duplicates an uncertain external effect.
- Environment: the repository's pinned Bun/Node runtimes and SQLite database under a temporary `OPENCORVUS_HOME`; a controlled local MCP server supplies harmless protocol effects. No production credential or external write is part of the checker.
- Timeout: repository test/checker processes use the existing activity-aware runner and fail after 120 seconds without output or state progress; pending operator decisions are a successful durable state and have no wall-clock auto-rejection timeout.
- Passing threshold: every focused positive contract and the real checker passes; typecheck, build, route/schema/docs checks pass; real-page desktop screenshots confirm both modes and the pending/history/grant states; whole-repository searches find no old operator `tool_permissions`, old reply enum, mutable permission authority, independent Tool-local authorization decision, or unclassified executable provider; the independent gate reviewer reports zero unresolved findings.
- Current baseline failure: operator authority is distributed between `PermissionNext`, five `tool_permissions`, Tool-local `ctx.ask`, MCP-specific wrappers, a mutable project row, and process-local waiters. Default MCP and projected execution do not share one durable invocation ledger, and recovered permissions are abandoned rather than retained.

## Existing-system diagnosis

### Observable behavior

1. Settings present a five-row `allow | ask | deny` matrix and describe it as the default for new tasks.
2. Unmatched permissions default to `allow` in `PermissionNext.evaluate`.
3. Task creation copies only the five configured keys into the root Session. It explicitly avoids a wildcard `ask` rule because an earlier catch-all made internal Tools such as todo, planner, and panel block indefinitely.
4. A Tool asks only if its own implementation, an MCP wrapper, or a special host path calls `PermissionNext.ask`.
5. `always` writes mutable project-wide allow rules to `PermissionTable`. `once` and `reject` do not enter that row. Task-owned prompts are separately projected into Engine interaction records.
6. The current persistence contract intentionally prevents a stored allow rule from overriding a current `ask` or `deny`. Consequently, a configured `ask` keeps asking even after an `always` reply; the stored record and active rule do not express a coherent grant model.

### Direct trigger and control flow

The immediate decision is `PermissionNext.ask -> evaluateRequest -> pending process-local promise -> permission.asked -> UI reply -> PermissionNext.reply`. The permission-bearing descriptor is created by each caller. Generic MCP Tools now use `mcpPermissionPlan`, Browser and Computer use special baselines, and MCP App calls add an `ask` rule only when a Tool advertises `destructiveHint`. Registry Tools depend on their own implementations to call `ctx.ask`.

### Root cause

One ruleset abstraction currently owns four different concerns:

1. whether a Tool is visible to an agent;
2. whether the operator allows, denies, or wants to be asked about a Tool;
3. the resource scope of one concrete invocation;
4. whether an earlier approval should authorize a later invocation.

Because those concerns are merged with last-rule-wins matching, there is no central invocation admission point, no stable two-mode semantic, and no durable request/grant identity. Adding more rows to the settings matrix cannot fix the missing execution boundary.

### Why the old path did not solve it

The old wildcard `ask` attempted to turn every model-visible Tool identity into a permission boundary. Internal orchestration Tools and ordinary read operations then blocked the autonomous task loop, so the catch-all was removed and five manually selected Tool keys remained. This reduced prompt fatigue but left authorization coverage dependent on scattered call-site cooperation. Later fixes repaired approval precedence and added generic MCP asking, but retained the mixed ruleset and process-local waiter design.

### Impact surface

| Surface | Required change |
| --- | --- |
| Public configuration | Replace operator `permission`/`tool_permissions` actions with one `permission_mode` enum. |
| Agent and Tool projection | Move visibility/assignment/disabled state out of authorization rules into capability projection and Tool switches. |
| Execution | Put every executable Tool surface behind one invocation authorizer. |
| MCP | Bind authorization to server identity/config digest, Tool identity, annotations, arguments, and concrete resource scope. |
| Persistence | Replace the mutable project approval row as authority with one append-only request/decision/grant-use/revocation ledger. |
| Recovery | Make pending requests and their exact invocation continuation durable and restart-safe. |
| UI/API | Replace the five-row matrix; expose two modes, a complete approval prompt, approval history, active grants, and revocation. |
| Tests/checker | Verify every real execution family through the central authorizer and restart path. |
| Documentation | Update current architecture, config/API docs, settings copy, security guidance, and migration notes at cutover. |

## Industry calibration

Sources were fetched on 2026-08-12 from their official documentation.

1. OpenAI documents sandbox/profile enforcement and approval policy as separate layers. It also states that connector/MCP calls with side effects can require approval and destructive calls must respect advertised destructive annotations. This supports keeping execution capability separate from operator authorization and putting non-shell integrations in the same gate. Source: [OpenAI Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security).
2. Visual Studio Code uses a high-level permission selector plus per-Tool approval scopes. Its prompt shows Tool parameters and supports one use, session, workspace, or future invocations. It groups Tools by source, treats terminal commands more narrowly than the terminal Tool as a whole, permits sensitive Tools to be ineligible for auto-approval, and separately reviews untrusted fetched output before adding it to agent context. Source: [VS Code Manage approvals and permissions](https://code.visualstudio.com/docs/agents/run/approvals).
3. Claude Code separates read-only observation from effectful shell/file actions, persists only selected narrow grants, explains the risk of a concrete command, and recommends bypass mode only in isolated environments. Its permission documentation also shows why command wrappers, redirection, environment assignments, and nested executors make broad string-prefix approval unsafe. Source: [Claude Code Configure permissions](https://code.claude.com/docs/en/permissions).
4. GitHub Copilot CLI offers explicit allow-all operation but warns that it grants the agent the same file and shell authority as the user. Its ordinary approval can be once or session-scoped, and MCP permissions address server plus Tool identity. The documentation specifically warns that approving a broad command Tool for a session can authorize materially different later commands. Source: [GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli).
5. The current MCP Tool specification recommends a human in the loop with the ability to deny invocations, clear exposure/invocation UI, confirmation prompts, and audit logging. It requires clients to treat Tool annotations as untrusted unless the server is trusted. It also defines `execution.taskSupport` (`forbidden` by default, `optional`, or `required`) for long-running Tool execution; this transports an already-authorized invocation and does not itself grant permission. Source: [MCP Tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

The consistent industry pattern is not a large user-facing matrix. It is a coarse autonomy choice, a central action gate, parameter-visible prompts, narrow reusable scopes, stronger treatment for destructive/untrusted actions, durable manage/reset controls, and an independent technical containment layer.

## Target authority model

### 1. One public mode

Add one canonical config field:

```json
{
  "permission_mode": "full_access"
}
```

Allowed values are exactly `full_access` and `ask`. New installations and configurations with no explicit choice use `full_access`, per the operator's explicit product decision. The settings UI labels are exactly `Full access` and `Ask me`.

The effective mode is frozen into a Task or standalone Session policy revision before execution. Changing the setting affects new work. Applying another mode to active work is an explicit operator action that creates a new policy revision and a visible audit record; a background config reload must not silently change authority mid-invocation.

### 2. Capability is not permission

Tool installation, Expert Squad assignment, native-agent Tool projection, per-message Tool switches, plugin availability, Skill enablement, and MCP connection/authentication remain capability controls. They decide whether a Tool can be offered, not whether one offered invocation is authorized.

Implementation must migrate current `agent.permission`, `Session.permission`, Skill policy, and Tool-switch uses to typed capability/projection fields. It must not retain `PermissionNext.Ruleset` as a second operator authorization path. Hard integrity checks, stale-runtime checks, path canonicalization, exact Task ownership, and authentication checks remain enforced in both modes because they validate identity/data integrity rather than ask the operator to choose a workflow.

### 3. Define the permission boundary

`Ask me` prompts for an unresolved invocation that can cross any of these boundaries:

- write, create, move, delete, or change metadata outside ephemeral runtime bookkeeping;
- execute a shell command, native program, script, formatter, package manager, or process;
- access a path outside the Task workspace or a protected/sensitive path inside it;
- reach the public internet, local network, loopback service, socket, or remote resource;
- invoke an MCP, connector, plugin, MCP App, Browser, Computer, schedule, notification, external-code-search, memory-write, publication, deployment, messaging, or other external-effect Tool;
- expose local content to an external service or ingest untrusted external content into the model context;
- perform a destructive, irreversible, credential-bearing, financial, publication, deployment, account, permission, secret, or production operation.

These are not permission prompts:

- in-memory bookkeeping, Tool-result formatting, lifecycle projection, event publication, progress/todo state used only by the current Task, and other host-owned control-plane work;
- read-only inspection of ordinary files already inside the exact Task workspace, provided the path is canonical, is not sensitive/protected, and the bytes remain within the local model/provider boundary already accepted for the Session;
- capability discovery such as listing projected Tool definitions or installed Skills without executing them;
- validation that rejects malformed, stale, cross-project, or unauthenticated requests.

This is the calibration that avoids the earlier wildcard deadlock while honoring “ask for every permission issue.” A Tool name does not define the boundary; the normalized effect of a concrete invocation does.

### 4. One invocation authorizer

Create one host primitive, conceptually:

```ts
authorizeInvocation({
  policyRevision,
  invocationIdentity,
  provider,
  operation,
  normalizedScope,
  risk,
  requestedGrantScopes,
})
```

Every executable path calls it after input validation/canonicalization and before any side effect, network request, child process, credential release, or external data ingestion. Tool implementations may contribute typed descriptors, but they cannot independently decide authorization.

Required adapters are:

- registry built-in Tools;
- shell and filesystem Tools;
- plugin Tools and Skill-owned Tools;
- default/configured MCP Tools;
- scoped/projected Expert Squad MCP Tools;
- Browser and Computer MCP Tools;
- MCP App-originated Tool calls;
- projected runtime Tools and control-plane Tool providers when they cross a permission boundary;
- every child invocation inside `batch`, not only the batch envelope;
- schedules/automations when created or mutated and again at execution if their stored authority does not cover the current concrete effect.

Standalone/direct Sessions, Task-owned Sessions, ACP clients, the CLI, the Overlay, and protocol-mirror consumers use the same durable request and settlement API. They are transport/presentation adapters, not separate authorization engines. ACP's current in-memory request queue and once/always/reject translation must be replaced with the canonical request identity and typed grant scopes; CLI and mirror events must carry the same request, decision, and recovery identities.

A Tool without a valid descriptor fails to a generic exact-invocation prompt in `Ask me`; it must never silently inherit `allow`. In `Full access`, the same invocation proceeds and records `full_access`, subject to capability, identity, authentication, and data-integrity checks.

### 5. Scope matching

Reusable grants are exact, typed, and versioned:

- filesystem: operation class plus canonical resolved file or directory boundary; symlink/junction resolution occurs before matching;
- shell: parsed executable/subcommand and canonical command abstract syntax, including redirects, pipes, wrappers, environment assignments, working directory, and network-bearing arguments; broad prefix matching is forbidden;
- network: protocol, normalized host, port, direction, method/action class, and bounded endpoint/resource; URL queries/fragments are redacted from display/storage unless a typed adapter proves they are non-secret;
- MCP/plugin: provider kind, trusted server/package identity, immutable config/package digest, Tool name, effect class, normalized resource identity, and argument fingerprint;
- Browser/Computer: session/profile identity, target origin/application, input/effect class, and selected resource;
- schedules: exact schedule identity, target, payload digest, and execution policy revision.

Changing the Tool implementation digest, server config digest, package revision, resolved path boundary, effect class, destination, or material arguments invalidates the old match and creates a new request.

MCP annotations inform risk only when bound to a trusted server revision. Missing or untrusted annotations never reduce prompting in `Ask me`. `destructiveHint: true`, credential release, external writes, publication/deployment, account/permission changes, and data deletion are ineligible for project-wide reusable grants; they require at least a fresh invocation-level decision. `Full access` still performs them without an OpenCorvus prompt because that is the explicit meaning of the mode.

An MCP descriptor also records the negotiated protocol version and `execution.taskSupport`. Authorization commits before OpenCorvus creates or resumes an MCP protocol task. `optional` or `required` task support changes long-running execution transport only: it never suppresses an `Ask me` decision or expands a grant. Once the server returns a protocol task identifier, that identity is linked to the execution attempt so restart recovery polls/resumes the same remote task instead of starting a duplicate invocation.

### 6. Approval choices

The `Ask me` prompt shows the real Tool/source, concrete effect, normalized target, relevant arguments with secrets redacted, risk/reversibility, Task/Session owner, and why the action is needed. It offers:

- `Allow once` — exact invocation only;
- `Allow for this Task` — reusable only for the exact typed scope and current policy/Tool revision;
- `Always allow this exact scope` — project-scoped only when the operation is eligible;
- `Deny` — denies the exact request and optionally carries operator guidance.

There is no wildcard “allow this Tool forever” action in `Ask me`, and no `deny` mode in the top-level settings. Operators manage and revoke active grants in one permission-history surface. Revocation appends a record and takes effect before the next invocation.

### 7. Durable single-source ledger

Replace the mutable `PermissionTable.data` authority with one append-only permission ledger. A record family needs, at minimum:

- globally unique record and request identifiers;
- project, Task, Session, message, Tool-call, and invocation identifiers when present;
- policy revision and mode;
- provider kind (`builtin`, `plugin`, `mcp`, `mcp_app`, `browser`, `computer`, `projected`, or another registered kind), provider identity/digest, and Tool identity;
- normalized operation/effect class and scope schema version;
- canonical request fingerprint and redacted human-readable summary;
- event type (`requested`, `allowed_once`, `grant_created`, `grant_used`, `denied`, `expired`, `revoked`, `cancelled`, `stale`, `full_access`, `execution_started`, `execution_succeeded`, `execution_failed`, `outcome_unknown`, or `execution_reconciled`);
- operator actor identity available to the local product, decision time, optional expiry, grant scope, source decision identifier, and revocation reason;
- Tool result linkage/outcome without copying Tool output into the permission record.

The append-only ledger is the sole authority. Active grants are a query/projection over ledger facts and may be indexed or materialized only as rebuildable derived state. Resolved Engine interaction cards reference the permission request/decision IDs instead of becoming a parallel approval database.

The ledger enforces these transactional invariants:

- `requested` is committed first, and compare-and-set settlement permits at most one authorization decision (`allowed_once`, `grant_created`, `denied`, `cancelled`, or `stale`) for its decision slot;
- `full_access` or an allowed decision/grant use must commit before `execution_started`; every start has a unique execution-attempt identifier;
- every started attempt has at most one terminal execution outcome (`execution_succeeded`, `execution_failed`, or `outcome_unknown`), with reconciliation appended against the same attempt;
- retry after `outcome_unknown` requires reconciliation or an explicit new invocation/attempt decision; an earlier approval cannot be interpreted as permission to duplicate an external effect;
- expiry and revocation alter later grant projection only and never rewrite the originating decision or execution history.

Never store tokens, passwords, cookies, authorization headers, raw OAuth URLs/state/code, secret environment values, complete sensitive file content, or unredacted URL query strings in permission records. Store a redacted display value and a canonical fingerprint when exact binding is required.

### 8. Durable waiting and recovery

The request must be committed before execution and before the UI is notified. Approval is a compare-and-set transition on the exact pending request fingerprint. The Tool may run only after that transition commits.

Pending `Ask me` work is a durable paused invocation, not a five-minute process-local promise. If no `execution_started` event exists, restart reconstructs the pending interaction and deterministically resumes the owning Session at the same Tool call after settlement. If execution started but no terminal outcome committed, restart marks the attempt `outcome_unknown` and reconciles it; it never blindly replays the effect. For MCP executions with a protocol task identifier, recovery resumes/polls that same MCP task. Concurrent clients may settle a request once; later replies receive the typed terminal decision. Cancellation, Task deletion, policy revision, or changed Tool input appends a terminal `stale` or `cancelled` decision and cannot reuse the old approval.

Headless or scheduled work in `Ask me` pauses visibly until an authorized operator replies. It must not silently switch to `Full access`, auto-reject because no UI is attached, or retry the external effect with uncertain outcome.

## Cutover and deletion plan

### Phase 0 — contract inventory

1. Produce a machine-readable inventory of every executable Tool provider and whether it has a typed effect descriptor.
2. Classify every current `PermissionNext`, `Config.permission`, `tool_permissions`, `Session.permission`, and Tool-local `ctx.ask` use as capability projection, invocation authorization, approval persistence, or dead code.
3. Inventory every request/reply/event transport and consumer, including direct Sessions, Task interactions, Overlay, ACP, CLI, server routes/Software Development Kit (SDK), and protocol mirrors; map each to the canonical durable request API.
4. Fail the inventory checker if an executable path or permission transport is unclassified.

### Phase 1 — ledger and policy revision

1. Add `permission_mode`, immutable policy revisions, the append-only ledger, typed scope schemas, redaction, and request fingerprints.
2. Implement durable request settlement and restart recovery before routing additional Tools through the gate.
3. Add read APIs for current mode, pending requests, decision history, active grants, and revocation; writes remain reply/revoke/mode-revision only.

### Phase 2 — central execution cutover

1. Insert the single authorizer in the shared Tool execution adapters.
2. Route registry, MCP, projected, plugin, MCP App, Browser/Computer, batch-child, shell, filesystem, and schedule surfaces through it; bind MCP protocol task identities to execution attempts.
3. Convert Tool-local permission plans into typed descriptor builders and delete their independent authorization decisions.
4. Move agent/session `deny` behavior to explicit capability projection and Tool switches.

### Phase 3 — configuration and UI cutover

1. Replace the five-row settings matrix with the two-mode selector and clear risk copy.
2. Replace `once | always | reject` transport with typed decision/grant scope values.
3. Cut direct Session, Task, Overlay, ACP, CLI, SDK, and protocol-mirror request/reply/event surfaces over to the canonical identities and durable recovery semantics.
4. Add one history/grant manager and real pending interaction presentation with source, parameters, scope, and risk.
5. Remove obsolete translations, settings state, config merge code, and generated API shapes.

### Phase 4 — one-time migration, then deletion

1. Explicit `ask`, `deny`, or mixed legacy operator settings map to `ask`; explicit all-`allow` and absent legacy configuration map to the `full_access` product default. Unverifiable malformed state fails typed configuration validation instead of silently choosing a mode. The migration emits one visible policy-migration record.
2. Existing mutable persistent grants are not silently trusted because they lack per-decision actor, scope version, Tool/provider digest, and exact request provenance. Start `Ask me` with no active legacy grant and retain only a non-authoritative migration summary if audit retention is required.
3. In-flight Tasks/Sessions receive one deterministic policy revision before resumption. Old session rules are classified into capability projection or discarded as obsolete operator authorization.
4. Delete `tool_permissions`, operator uses of top-level `permission`, `PermissionTable`, `PermissionNext` authorization evaluation, the old reply enum/routes, Browser/Computer allow baselines, MCP App special destructive-rule merge, and all compatibility readers/writers in the same cutover.
5. Update `specs/current/architecture/security-permission.md` only after the old path is physically gone.

## Acceptance matrix

### Focused positive backend contracts

1. A `Full access` policy revision executes one representative invocation from every provider family and emits a durable `full_access` authorization record linked to the real Tool outcome.
2. An `Ask me` policy revision creates a durable pending request before a representative write, shell, network, generic MCP, projected MCP, plugin, MCP App, Browser, Computer, external-directory, schedule, publication, and external-service invocation; approving the request resumes and completes that exact real path.
3. `Allow once`, Task grant, eligible exact project grant, grant use, denial, revocation, expiry, cancellation, and stale-input settlement each produce their explicit typed terminal lifecycle.
4. Restart before execution rehydrates the same pending request and resumes the exact Tool call once after approval; restart after `execution_started` without a terminal result records `outcome_unknown` and reconciles instead of blindly retrying.
5. A matching exact grant authorizes a later invocation and records `grant_used` with its source decision. A changed path, command structure, MCP server digest, Tool digest, effect class, destination, or material argument produces a new pending request.
6. A batch with multiple permission-bearing children creates/uses authorization for each child identity and returns the real child outcomes.
7. Capability projection still exposes the intended Tool set in both modes, and a child agent inherits the parent policy revision without gaining broader capability or authorization.
8. Secret-bearing arguments produce a usable prompt and stable fingerprint while the ledger contains only the approved redacted representation.
9. Two concurrent replies settle the exact request once and return the committed decision to the losing caller.
10. A scheduled/headless `Ask me` invocation remains durably pending and later completes after an operator decision without mode change or automatic rejection.
11. The same request identity and typed grant choices work through a direct Session, a Task/Overlay interaction, and ACP; CLI and protocol-mirror consumers expose the same durable request/decision state, including recovery after restart.
12. MCP `forbidden`, `optional`, and `required` task-support declarations do not change the authorization decision. When a long-running MCP invocation yields a protocol task identifier, restart resumes/polls that exact task and links its terminal result to the original execution attempt.

### Real checker

Build a repository-owned permission checker that launches the actual server/runtime against a temporary real Git project and a controlled local MCP server. It must drive the API as the Overlay would, exercise a direct Session and ACP client, observe the CLI/protocol-mirror contract, execute real harmless Tool effects, restart before execution and after an intentionally unresolved start, resume a long-running MCP protocol task, inspect durable ledger facts, and prove both modes across the real execution adapters. Mocks may cover descriptor units but do not satisfy this checker.

### UI acceptance

Do not add or run UI automation. Start an isolated real Overlay/server, inspect and capture the two-mode settings state, the `Full access` warning, a parameter-complete `Ask me` prompt, approval history, active grant, and revocation result in both English and Simplified Chinese. Manually verify hierarchy, density, keyboard focus, long path/command wrapping, redaction, pending/resolved state, and that no old five-row matrix remains.

### Static and documentation checks

- focused typecheck/lint/build for touched packages;
- focused permission tests and the real checker;
- repository `docs:check` and `git diff --check`;
- whole-repository searches proving no current `tool_permissions`, old permission reply enum, mutable approval authority, Tool-local authorization decision, or unclassified executable provider remains;
- independent read-only review after the first passing implementation, with every valid finding fixed and the affected checks rerun until no unresolved finding remains.

## Risks and explicit boundaries

- `Full access` is genuinely broad. Warning copy must not imply sandboxing, Tool annotations, or a trusted workspace makes it harmless. Prefer an isolated Task runtime, container, virtual machine, restricted service credentials, and network containment when unattended work needs this mode.
- `Ask me` can still suffer prompt fatigue. Narrow typed Task grants and ordinary local read-only observation are the intended relief; broad Tool-wide grants are not.
- MCP annotations are advisory and server-controlled. They may raise risk but may not lower it without a trusted immutable server revision.
- Approval is not outcome confirmation. External effects with an unknown result require an `outcome_unknown` Tool state and reconciliation before retry; a prior approval does not authorize duplicate effects.
- Exact shell parsing across PowerShell, `cmd.exe`, POSIX shells, nested runners, scripts, redirects, and wrappers is difficult. Unsupported or ambiguous syntax prompts once for the exact invocation in `Ask me`; it never falls back to broad string-prefix approval.
- The current permission and capability concerns are interleaved deeply. Implementation must complete the Phase 0 classification before editing, then cut over one shared execution boundary rather than adding another ruleset layer.

## Recommended delivery slices

1. Ledger, policy revision, durable request recovery, and checker skeleton.
2. Central authorizer plus built-in/shell/filesystem/batch adapters.
3. Generic/scoped MCP, MCP App, Browser/Computer, plugin, Skill, projected, schedule, and external-service adapters.
4. Capability/authorization separation and removal of old ruleset ownership.
5. Two-mode UI, approval history/grant management, migration, real visual acceptance, current-architecture update, independent review, commit, and normal push.

These are implementation slices within one cutover plan, not parallel permanent modes or compatibility stages. The release is acceptable only when the final slice removes the old authority and the real checker passes both modes end to end.
