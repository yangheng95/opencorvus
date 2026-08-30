# Code and Work Agent Platform

Status: Capability Catalog A1 implemented; search-native execution convergence pending

Implementation calibration (2026-08-30): typed `CapabilityRef`, `HarnessProjection`,
`capability_search`, product pillars and immutable Task package binding are present in current source. Phase A1 has
deleted the temporary Tool-owned catalog builder: `capability/descriptor.ts` and `capability/catalog.ts` now own
the pure contracts, canonical context snapshots, bounded project-local source/snapshot caches, search, and typed
stale/contract errors. `tool/capability-runtime-catalog.ts` is the only owner composition root and keeps the pure
Capability layer from depending back on Tool/Skill/MCP/Expert Squad runtime. Tool Registry,
Skill, Mission Skill, Expert Squad, Harness/Worker stage facts, and MCP config/status contribute exact revisions.
Durable input-Part catalog binding, pre-materialization native Harness authority, unified Expert Squad capability
declaration, and deferred Tool reveal are not complete. The evidence, industry comparison and hard-replacement plan are recorded in
[`2026-08-30-search-native-capability-harness-refactor.md`](../../records/2026-08/2026-08-30-search-native-capability-harness-refactor.md).
The exact A1 cut and exclusions are recorded in
[`2026-08-30-search-native-capability-phase-a1.md`](../../records/2026-08/2026-08-30-search-native-capability-phase-a1.md).

## Recall

### User requirements

- Keep `Code` and `Work` as peer product pillars. `Code` is a primary product
  and monetization surface, not merely one domain package beneath Work.
- Let Work reuse the existing Chat/Mission organization so long-running office
  work can move from a direct conversation into durable Mission, Task, Goal,
  scheduler, Artifact, receipt, and Work Ledger paths.
- Install office Skills and transactional Expert Squads for flows such as
  receiving mail, analyzing work, executing it, and submitting the result.
- Add one explicit field that prevents Code-only Expert Squads from appearing
  in Work and Work-only Expert Squads from appearing in Code.
- Keep provider-specific configuration, including Gmail behavior and required
  scopes, inside the owning Expert Squad package. Core should expose only thin,
  generic adapters so a new office integration does not destabilize the
  platform.
- Add a fuzzy Harness Search that can find relevant capabilities across Skill,
  Model Context Protocol (MCP), Tool, Expert Squad, and related catalogs. Every
  Agent should inherit discovery, while permission ownership remains explicit.
- Identify the missing daemon needed for unattended long-running office work.
- Optimize for a product that can ship and monetize quickly, not a speculative
  universal office-agent platform.

### Acceptance criteria for this design

1. The document distinguishes product taxonomy from runtime ownership.
2. It proves what already exists, what is partial, what is truly absent, and
   what must not be rebuilt.
3. It preserves one `prompt_profile.active` source and one
   `PromptProfileResolver` projection authority.
4. It gives Work durable orchestration by reusing Mission-owned Tasks rather
   than adding a Work Task engine.
5. It defines exact Code/Work Expert Squad isolation semantics.
6. It defines capability search as discovery, not an execution bypass.
7. It extends the existing permission and MCP authorization paths instead of
   introducing another grant engine.
8. It reduces daemon work to process lifetime and external ingress around the
   existing scheduler, event service, task queue, and session wake path.
9. It names one narrow paid Work scenario, measurable product outcomes, staged
   implementation owners, and explicit exit criteria.
10. It defines one typed capability identity and revisioned metadata catalog
    before fuzzy ranking, so search adapters cannot invent parallel identities.
11. It defines the complete Catalog -> Harness projection -> materialization ->
    authorization chain for Chat, Work, Mission, Task scheduler, and Task Agent.
12. It proves that search, mounting, authentication, and execution permission
    are separate operations and that none implicitly grants another.

### Hard constraints

- Preserve Code and Work as peer first-viewport product choices.
- Preserve Work as the fixed `work` primary-assistant harness.
- Preserve Chat, Work, Mission, Task, Goal, Work Ledger, Session, Message,
  permission, Skill, MCP, Artifact, and scheduler single sources.
- Preserve `prompt_profile.active` as the only active Expert Squad identity.
- A Task has one Expert Squad for its complete lifetime. Cross-squad or
  cross-pillar work uses separate Mission-owned Tasks.
- Mission coordinates domain Tasks but never receives a domain package's
  provider tools. Scheduled provider discovery executes inside a fixed Work
  Task, not inside Mission.
- Do not add a Work scheduler, Work database, Work workflow engine, hidden
  context packet, synthetic message, host keyword router, generic capability
  binder, or provider-specific Gmail logic in Core.
- Search results do not confer authority. An Agent may discover a capability it
  cannot load or execute.
- `Harness` is an ephemeral resolved capability view, not a persisted entity,
  active-profile field, permission store, or second extension registry.
- Catalog ranking cannot mount a capability. Permission cannot mount a
  capability. OAuth cannot mount a capability. Only the existing assignment or
  Resolver owner can project an exact reference.
- A narrower runtime layer cannot add a Tool, Skill, MCP reference, or provider
  action absent from its owning projection.
- Provider secrets never enter prompts, search indexes, Task requests,
  Artifacts, logs, or package-readable plain configuration.
- A provider event identity alone never authorizes reuse of a Task created
  under a different pillar, squad, workflow, or request contract.
- One process owns unattended scheduling for a project at a time. The desktop
  is a management/inspection client while that daemon ownership is active.
- The first commercial slice must work before a universal connector framework
  exists.

### Sources read

- `/Users/yangheng/Downloads/deep-research-report.md`
- `AGENTS.md`
- `specs/current/architecture/{01-agents,02-data,03-control,04-extensions,05-config,08-agent-tool-adapter,15-agent-facts-and-turns,99-principles}.md`
- `specs/records/2026-07/2026-07-29-code-work-composer-and-grouped-references.md`
- `specs/records/2026-07/2026-07-29-conversation-backed-work-office-capability.md`
- `specs/records/2026-07/2026-07-29-work-harness-chat-mission-infrastructure-convergence.md`
- `specs/records/2026-07/2026-07-27-scheduled-automation-usability-repair.md`
- `specs/records/2026-07/2026-07-17-permissions-first-launch-global-switch.md`
- `specs/records/2026-07/2026-07-22-workbuddy-expert-squad-settings-parity.md`
- `packages/opencorvus/src/work/harness.ts`
- `packages/opencorvus/src/conversation/capability.ts`
- `packages/opencorvus/src/agent/{primary-assistant-registry,tool-pool-data,role-contract}.ts`
- `packages/sdk/js/src/expert-squad-manifest-v2.ts`
- `packages/opencorvus/src/expert-squad/{registry,catalog,prompt-profile-resolver,configuration}.ts`
- `packages/opencorvus/src/{agent/prompt-profile,tool/skill,tool/registry,tool/execution-surface}.ts`
- `packages/opencorvus/src/agent/{tool-pool-contract,runtime-override,session-agent-runtime}.ts`
- `packages/opencorvus/src/skill/{mounts,eligibility,surface}.ts`
- `packages/opencorvus/src/permission/next.ts`
- `packages/opencorvus/src/mcp/{auth,oauth-provider,index}.ts`
- `packages/opencorvus/src/scheduler/{index,automation-service,event-service,task-queue-service,task-wake-runtime}.ts`
- `packages/opencorvus/src/project/bootstrap.ts`
- `packages/opencorvus/src/session/{loop,wake,runtime-contract}.ts`
- `packages/opencorvus/src/prompt/core/{mission-core,orchestrator-core}.txt`
- `packages/opencorvus/src/{panel/capability,task-api/index}.ts`
- Google Workspace Gmail API documentation for OAuth scope classification,
  push notification watch renewal, Cloud Pub/Sub acknowledgement, and
  `historyId` synchronization:
  `https://developers.google.com/workspace/gmail/api/auth/scopes` and
  `https://developers.google.com/workspace/gmail/api/guides/push`

### Whole-repository search

The design followed repository-wide searches for:

```text
primary_assistant_capabilities
WORK_AGENT_ID / WORK_RUNTIME_PROMPT / wake_work / wake_mission
promptProfile / prompt_profile / Task package revision binding
ExpertSquadManifestV2Schema / ExpertSquadCatalog* / capability_projection / capability_sets
PermissionNext.ask / PermissionNext.evaluate / ctx.ask
McpAuth / OAuth / mcpPermissionPlan
AutomationService / EventService / TaskQueueService / SessionWake.wake
fuzzysort / skill search / artifact search
CreateTaskInput / TaskMessageInput / requestID / channel binding idempotency
InstanceBootstrap / registeredDirectories / Instance.disposeAll
```

Eight live Expert Squad manifests plus the portable authoring template were
found. None currently declares a Code/Work applicability field. Manifest,
authoring, Registry, catalog, resolver, route, generated SDK, package fixture,
and contract-test callers all require coordinated replacement.

The scheduler search proved three existing runtime owners:

- `AutomationService` is a persistent, lease-based timer poller;
- `EventService` persists internal Bus match rules and wakes Sessions;
- `TaskQueueService` serializes and recovers queued Session prompts.

All three are initialized by project bootstrap. The missing unattended
capability is therefore not another scheduler. It is a host process that keeps
registered project runtimes alive when the desktop window is absent, followed
later by package-owned external event adapters.

The permission search proved that Core already has one `allow | deny | ask`
evaluator, persisted project approvals, per-Agent/session overlays, Skill load
checks, Tool filtering, and MCP execution prompts. MCP OAuth already has
project-scoped credential identity, refresh, revocation revision, atomic
storage, and mode `0600`. The current file store is not a general encrypted
secret vault, so direct-provider credentials remain out of scope for the first
slice.

The Task-identity implementation makes `promptProfile` a Task creation input and
persists one immutable package-revision binding in the same transaction as the
Task row and root Session. Task messages and Session overlays must match that
binding. Request-ID replay compares the bound profile and optional expected
digest before returning the committed Task; a conflict fails with a typed error.

The MCP permission search found that non-Browser MCP tools currently fall back
to their runtime tool key with pattern `*`, while an unmatched
`PermissionNext` rule evaluates to `allow`. The manifest has no provider-action
permission declaration. A Gmail package cannot obtain recipient-aware
`gmail.send` semantics merely by naming permissions in README or prompt text.

The daemon search found that `InstanceBootstrap` also initializes Plugin,
FileWatcher, Version Control System (VCS),
garbage collection, and ChannelSupervisor. `Project.registeredDirectories()`
contains both canonical worktrees and sandboxes. A daemon therefore needs a
headless composition and an explicit project-ownership contract; opening every
registered directory through the current full bootstrap is not a thin host.

The harness projection search proved that OpenCorvus already has distinct
owners rather than one generic mount service:

- `AgentToolPool` bounds the built-in Tool set of native roles and runtime
  templates;
- `ConversationCapability` owns explicit Skill and MCP server assignments for
  the native Chat and Work harnesses;
- `MissionSkillRuntime` owns the native Mission Skill surface;
- `PromptProfileResolver` owns the exact scheduler and worker Tool, Skill, and
  MCP projection for Task runtimes;
- `ToolRegistry`, `SkillTool`, and the MCP resolver materialize only those
  resolved references for the current turn;
- `SessionLoop` finally applies switches and effective permission before
  exposing Tools.

This is already the correct ownership shape. The missing infrastructure is a
shared typed metadata catalog and one explicit projection contract that makes
these owners interoperable without replacing them.

### Independent review

Earlier Claude Code review of the completed Work harness convergence agreed
that Work should reuse Session, permission, Skill/MCP, Artifact, Mission,
Task/Goal, scheduler, and receipt infrastructure while retaining an independent
product identity. Earlier design feedback also supported peer Code/Work product
positioning, asymmetric engineering reuse, one catalog applicability field,
thin daemon ingress, and separating capability discovery from binding and
execution.

A fresh read-only Claude Code review was invoked for this revision with
`Read,Grep,Glob` only and no session persistence. Claude Code 2.1.220 rejected
the request before reading the repository because the account had reached its
monthly spend limit. This revision therefore does not claim fresh Claude
agreement; the failed review is an open external-review item, not evidence.
The calibrated Task, permission, daemon, and delivery-order revision was
submitted again under the same read-only restrictions and received the same
pre-read limit rejection.
A third focused review of Capability Catalog identity, Harness projection, and
permission non-expansion was attempted after the infrastructure reprioritizing;
it was rejected by the same spend limit before any repository read.

## Decision

### Product symmetry, engineering asymmetry

`Code` and `Work` are peer product pillars:

```text
OpenCorvus
├── Code: repository-aware software work
└── Work: office, research, operations, and business deliverables
```

They are not peer runtime stacks. Both consume one shared execution platform:

```text
Code or Work ingress
  -> direct conversation when one thread is enough
  -> Mission when durable orchestration is needed
  -> fixed-pillar, fixed-squad Tasks
  -> Goals, Agents, Tools, MCP, Skills, Artifacts, receipts
  -> Work Ledger
```

This is the commercially useful middle ground. It protects Code as a primary
product while letting Work reach market by reusing the mature runtime instead
of funding a second one.

### Four concepts must remain separate

| Concept | Owner | Meaning |
| --- | --- | --- |
| Product pillar | Composer and Task creation contract | `code` or `work`; controls applicable capability candidates and product metrics. |
| Conversation experience | persisted Session metadata | `chat` or `work`; selects the direct primary-assistant harness. |
| Durable organization | Mission, Task, Goal | decomposes and tracks long-running work. |
| Domain execution | Expert Squad package | supplies the fixed Task-local scheduler/Agent/Skill/Tool/MCP projection. |

`Code` currently enters the `chat` conversation experience. That naming is an
implementation fact, not evidence that Code is subordinate to Work. Work is a
dedicated `work` conversation experience. Either may hand off to Mission.

## Current-State Assessment

| Area | Current state | Decision |
| --- | --- | --- |
| Code/Work ingress | Two-segment Composer already exists. Code uses Chat by default; Work uses persisted Work conversation identity. | Keep. |
| Work harness | Fixed `work` identity, prompt, default capability assignment, Work-only Office tools, parent-only delivery. | Keep and extend through packages, not another base harness. |
| Shared conversation runtime | Work already reuses Session, Message, streaming loop, provider, permission, Skill, MCP, attachment, artifact, delegation, lifecycle, and ledger. | Keep. |
| Durable work | Work already recommends the real Mission path; Mission owns Tasks, Goals, scheduler, cancellation, archive, and receipts. | Keep. Make Work Mission packages a first-class catalog segment. |
| Expert Squad projection | Manifest v2 typed CapabilityRefs/CapabilitySets, Registry, catalog, `prompt_profile.active`, Resolver, and virtual workflow contract exist. Mission supplies `promptProfile`, but current Task/message paths do not enforce lifetime immutability. | Keep the single v2 grant contract, extend with pillar applicability, and close Mission Task mutation without adding another active field. |
| Office capability | First Work production slice already creates, validates, renders, reviews, and delivers PPTX through typed tools. | Use as the first proof that Work can ship vertical capability. |
| Time scheduling | Lease-based recurring automation and run history already exist. | Reuse. |
| Internal event scheduling | Persistent Bus event jobs already match, cool down, and wake Sessions. | Reuse for normalized events. |
| Prompt queue/recovery | Durable Task queue and Session wake paths already exist. | Reuse. |
| External always-on host | Runtime services currently depend on an opened project instance. Full `InstanceBootstrap` also starts interactive services and registered directories include sandboxes. | Missing. Add one headless composition plus explicit daemon/desktop ownership. |
| External provider ingress | No generic package-owned poll/webhook adapter emits normalized external events. | Partial future need; do not block the first paid slice. |
| Capability fuzzy search | A typed cross-kind `capability_search` exists, while Skill/Mission Skill and Expert Squad retain additional search contracts. The current Tool surface remains eager, and Catalog snapshots are rebuilt per call instead of following the documented owner-revision lifecycle. | Converge local capability discovery and replace eager model schemas through the dated search-native refactor; keep external Market and business-data search under their own owners. |
| Authorization | One permission evaluator and MCP OAuth path exist, but generic non-Browser MCP execution has no provider-semantic argument mapper and unmatched permissions default to allow. | Add a package-owned typed action boundary that calls the existing evaluator; do not create a grant service. |

## Product-Pillar Contract

### Manifest field

Add one required manifest field:

```ts
type ProductPillar = "code" | "work"

interface ExpertSquadManifestV2 {
  // Existing fields omitted.
  product_pillars: ProductPillar[]
}
```

Rules:

- the list is non-empty, unique, and canonically sorted;
- Code-only packages declare `["code"]`;
- Work-only packages declare `["work"]`;
- genuinely reusable packages declare `["code", "work"]`;
- there is no `shared`, `general`, implicit default, missing-field fallback, or
  filename/namespace inference;
- every existing package and the portable template is updated in the same
  schema replacement;
- the field describes product applicability, not active identity, installation
  scope, trust, permission, UI category, or workflow state.

The field belongs in the portable package manifest because package authors must
declare where the complete capability is valid. Registry validates it once and
catalog projections carry it unchanged. The UI merely renders the backend
result; it is not the enforcement owner.

### Task field

Add one immutable Task creation field:

```ts
interface CreateTaskInput {
  productPillar: "code" | "work"
  promptProfile?: string
  expectedPackageDigest?: string
}
```

Every Task creation surface supplies an exact pillar; no Task infers it from a
title, source string, directory, or profile name. Direct Code/Work ingress owns
that explicit product choice. For Mission-owned Tasks `promptProfile` is also
required. The Task transaction proves:

```text
selected manifest product_pillars contains productPillar
```

The Task row persists `productPillar`. The Task root Session persists
`prompt_profile.active`, while a typed Task artifact owns the exact package
revision, digest, scope, project identity, namespace, and manifest ID. Before
the Task becomes visible, the creation transaction validates the selected
manifest and commits the Task, root Session, and revision binding as one unit.

For every Task, the root profile and package revision are fixed from creation.
Runtime projection does not include a profile-changing surface, and later
Task-message or Session-config APIs cannot change `promptProfile`. Correcting a
selection creates a new Task. This is an immutable identity/data-integrity
contract, not a host workflow state machine.

`PromptProfileResolver` receives the immutable Task pillar and rejects an
incompatible active package before runtime projection. The pillar answers
“which product contract owns this Task”; `prompt_profile.active` remains the
only answer to “which exact squad executes it.”

### Creation idempotency

Task creation idempotency covers the complete creation contract, not only
Artifact imports. A stored Task creation fingerprint includes at least:

```text
project + request ID or channel binding
product pillar + effective creation prompt profile
exact authored request digest
exact Artifact import set
execution directory + workflow/collaboration identity
```

The request ID still finds an existing Task, but reuse succeeds only when the
fingerprint matches. A mismatched pillar, squad, request, workflow, directory,
or import set returns one explicit idempotency-conflict error. Provider event
identities are namespaced by the package source and stage contract:

```text
(source_ref, immutable_provider_item_id, collaboration_id, stage_id)
```

One mail message may therefore create a Work triage Task, a Code Task, and a
Work delivery Task without identity collision, while a retry of the same stage
returns the same Task.

Cross-pillar work is explicit:

```text
Mission
  -> Work Task: gather mail and produce requirements
  -> Code Task: implement an internal automation
  -> Work Task: prepare and submit the final business deliverable
```

Each Task has one pillar and one squad. Mission passes accepted predecessor
Artifacts through the existing exact locator protocol. A Task never changes
pillar or squad to advance the Mission.

### Catalog semantics

Add an exact `product_pillar` input to the Expert Squad recommendation/catalog
surface used for Task planning. Filtering occurs in the Registry/Resolver-owned
catalog projection before selectors reach an Agent.

Settings may still show all installed packages because installation management
is not Task selection. Task launchers and Mission recommendations see only
packages compatible with their exact pillar.

## Work Expert Squads

Work Squads are ordinary Expert Squad packages with `product_pillars:
["work"]`. They use the existing package boundaries:

```text
expert-squad.jsonc
README.md
selector.md
agents/**
skills/**
tools/**
mcp/**
lib/**
assets/**
```

Provider-specific ownership remains inside the package:

- Gmail labels, query strategy, message-thread semantics, draft/send policy,
  supported actions, required OAuth scopes, retry interpretation, and result
  normalization;
- office-domain instructions, typed provider tools, and evidence expectations;
- package configuration fields for non-secret behavior such as mailbox,
  folders, default destination, locale, or submission policy;
- MCP server references and package tools required by projected Agents.

Core owns only provider-neutral contracts:

- package installation, validation, configuration storage, and projection;
- generic MCP transport and OAuth lifecycle;
- permission evaluation and visible operator questions;
- immutable attachment/artifact storage;
- scheduler leases, normalized event delivery, Task queue, Session wake, and
  audit facts.

For the first Gmail slice, Gmail is an MCP server assigned by the Work package.
OAuth tokens remain in the existing MCP auth owner. The package stores only the
server reference and behavior configuration. Direct Gmail API credentials are
not added to `expert-squad` configuration until OpenCorvus has a general
encrypted secret store; mode-`0600` JSON is not treated as that abstraction.

### Provider action boundary

Raw provider MCP tools are transport capabilities, not the model-facing
authorization contract for transactional Work. The Gmail package projects
typed package actions such as read-message, create-draft, send-draft, modify
labels, and delete. Each action:

1. validates its exact typed arguments;
2. produces the package-owned semantic permission name, exact patterns,
   persistable `always` patterns, and redacted visible metadata;
3. calls one generic Host permission-and-MCP invocation adapter;
4. invokes the configured exact MCP server/tool only after
   `PermissionNext.ask` succeeds;
5. returns a typed normalized result with provider identity and no credential
   material.

The Host adapter owns no Gmail names, scopes, labels, recipients, or retry
policy. It accepts a strict generic permission plan plus an exact configured MCP
reference and reuses the existing MCP transport, OAuth, and
`PermissionNext`. The package owns the Gmail mapping. Model-facing raw Gmail MCP
tools are not projected alongside these package actions because that would
bypass the semantic permission plan.

The package must declare and test every externally mutating action. Unmatched
provider actions are not exposed; they do not inherit the generic unmatched
permission default. Read and draft defaults remain operator configuration.
Send, delete, external submission, and recipient expansion remain exact
`ask` operations unless the operator has persisted a narrower allow pattern.

## Platform Capability Infrastructure

The foundational platform is one directional chain:

```text
authoritative inventories
  -> normalized Capability Catalog snapshot
  -> caller-specific discovery view
  -> existing Harness owner projects exact references
  -> exact runtime contract materializes providers
  -> deny/switch filtering
  -> exact call-time allow | deny | ask
  -> provider authentication and execution
```

Every arrow narrows or preserves authority. No downstream stage may add an
identity absent from the preceding projection. Search can move knowledge
forward; only an existing owner can move authority forward.

### Canonical capability identity

Before fuzzy search, every searchable item receives one typed reference:

```ts
type CapabilityKind =
  | "capability_set"
  | "skill"
  | "tool"
  | "mcp_server"
  | "mcp_tool"
  | "mcp_prompt"
  | "mcp_resource"
  | "expert_squad"
  | "mission_skill"

interface CapabilityRef {
  kind: CapabilityKind
  source: "platform" | "project" | "package"
  owner_ref: string
  local_ref: string
}
```

The canonical serialized form is derived by one shared codec from these four
fields; adapters do not concatenate ad hoc strings. `owner_ref` identifies the
authoritative Registry or package projection owner. `local_ref` is that
owner's exact existing reference. The catalog does not replace current Skill,
Tool, MCP, Mission Skill, or Expert Squad identifiers.

Each owner publishes immutable, non-secret metadata plus its explicit source
revision. Stable `CapabilityDescriptor` records contain identity, searchable
metadata and exact-ref typed behavior only. Behavior targets use canonical
Tool/loader/action/MCP references and every target must resolve inside the
same snapshot. Caller assignment, policy, availability and
resolved `next_owner` live separately in `CapabilityCatalogViewEntry` records,
bound back to the owner descriptor by its metadata digest. The Catalog never
re-hashes caller rows and labels that value as an owner revision. One builder
validates descriptor/view digests and one-level Capability Sets, rejects
duplicate owners/references and unknown members, sorts deterministically, and
computes `catalog_revision` from the complete canonical context, owner and
projection revision vectors, descriptors, views, and sets. The pure ranking
function reads only a prepared snapshot. Runtime composition reads existing
owner inventory APIs but never initiates an MCP connection, executes package
code, refreshes OAuth, or owns an irreversible action.

Fuzzy scoring is deliberately replaceable and non-authoritative. The first
implementation reuses the repository's existing fuzzy-search library, with
weighted matching over canonical name, owner-supplied aliases, description,
kind, and owner label. Exact kind, owner, and pillar filters run before
ranking. Stable reference order breaks equal scores, so the same snapshot and
query produce the same result order.

### Snapshot lifecycle

The snapshot is context-bound, project-cached, derived, and currently in
memory. It is not a database or a second installation catalog. Its revision
input is a canonical vector of the current Tool Registry revision, Skill
publication revision, irreversible full MCP configuration digest plus global
observed status/inventory revision, exact Conversation Host Session MCP owner
revision, scoped Task MCP owner revision, Expert Squad catalog revision,
Mission Skill revision, Harness projection hash, Worker descriptor/stage
identity, and caller context. Global and scoped MCP inventories are never
unioned into one owner. Raw MCP configuration and credentials are never
published in the Catalog.

Every owner revision preimage uses canonical code-point ordering and encoded
tuples, including MCP configuration/status/tool identities, Harness refs, and
Mission Skill issue facts. Locale-dependent comparison and delimiter-joined
tuple keys are not revision authorities.

Conversation Host Session MCP Tools keep one exact reference end to end: the
materializing Host Session owner publishes the ref, Session Loop passes that
ref into `ConversationCapability`, Harness freezes it, and Catalog consumes it
without replacing the owner by matching a local Tool ID. Ordinary shared
project MCP Tools retain their `mcp-config` owner.

Existing owner publication revisions and runtime context hashes make mutation
produce a new source/snapshot key. Runtime composition is not joined across
requests: each call captures current owner facts, while existing owner caches
and the content-addressed, bounded source/snapshot cache reuse identical frozen
publications. This avoids returning a pre-mutation in-flight composition to a
post-mutation caller.
Queries never receive a partially rebuilt snapshot, and an invalidated snapshot
is not served as a silent stale fallback. An owner that cannot produce metadata
raises `CapabilityOwnerUnavailableError`; the builder does not drop that owner
and pretend the snapshot is complete. Durable binding of one exact snapshot to
an authoritative input Part remains a later cut and is not implied by this
in-memory cache.

The query contract includes normalized query text, optional exact filters,
configured result limit, caller context, and expected catalog revision. Empty
query returns deterministic exact-filter browsing rather than a fake fuzzy
score. The result limit and ranking weights live in catalog configuration, not
scattered caller constants. Query text and scores may be logged; catalog
descriptions remain non-secret by construction.

### Harness means a derived projection

Do not introduce a `Harness` database table or generic mount registry. In this
architecture, a Harness is the immutable result of resolving one execution
context:

```ts
interface HarnessProjection {
  context:
    | { kind: "conversation"; agent_id: "chat" | "work" }
    | { kind: "mission" }
    | { kind: "task_scheduler"; task_id: string; profile_id: string }
    | { kind: "task_agent"; task_id: string; profile_id: string; agent_id: string }
  owner_revision: string
  tool_refs: CapabilityRef[]
  skill_refs: CapabilityRef[]
  mission_skill_refs: CapabilityRef[]
  mcp_server_refs: CapabilityRef[]
  mcp_tool_refs: CapabilityRef[]
  mcp_prompt_refs: CapabilityRef[]
  mcp_resource_refs: CapabilityRef[]
  projection_hash: string
}
```

This object is an ephemeral, frozen Resolver output and diagnostic fact. It is
not independently editable or persisted as active state. Root Session
`prompt_profile.active` remains the only active Task Expert Squad identity, and
the projection hash detects stale continuation rather than creating another
source of truth.

### Mount hierarchy and exact owners

The mount hierarchy has five levels:

| Level | Meaning | Existing owner | May expand the surface? |
| --- | --- | --- | --- |
| 0. Inventory | Installed/configured metadata exists | Skill Manager, Tool Registry, MCP and package Registry, Expert Squad Registry, Mission Skill Registry | No runtime authority |
| 1. Runtime bounds | Built-in Tools the role/template can ever receive | `AgentToolPool` and runtime-template contract | Yes, but only as a static upper bound |
| 2. Harness assignment | Exact capability references for this context | Chat/Work `ConversationCapability`; Mission runtime; Task `PromptProfileResolver` | Yes: built-ins within level 1; package/provider refs within the owner's catalog |
| 3. Turn materialization | Instantiate exact Tool, Skill, and MCP providers | `ToolRegistry`, `SkillTool`, MCP resolver, Session runtime contract | No |
| 4. Operator narrowing | Tool switches plus Agent/Session denies | execution surface and `PermissionNext` | No |
| 5. Call authorization | Evaluate exact semantic action and arguments | Tool wrapper, package action mapper, `PermissionNext`, OAuth | No |

The concrete context rules are:

- Chat and Work use their fixed native role Tool pool. Their project
  `primary_assistant_capabilities` assignment adds only exact installed Skill
  refs and configured MCP server refs. Their default MCP assignment is empty:
  configured inventory never activates a provider by itself. A message may reference an attached
  Skill explicitly, but the same resolver revalidates installation,
  eligibility, Tool requirements, switches, and permission.
- Mission receives only Mission management Tools and Mission Skills. Catalog
  search may reveal compatible Expert Squads, but Mission must create a Task
  with an exact pillar and profile; it never mounts the package's domain Tools.
- A Task scheduler receives the active package scheduler projection plus its
  platform scheduler base Tools. A Task Agent receives only the exact active
  package Agent projection constrained by its runtime-template upper bound.
- Selector Skills are discovery material for Task ownership. Production Skills
  are execution material granted to exact projected scheduler/Agent identities.
  They are never merged as one universal Skill pool.
- Platform transport invariants such as required Task Artifact Tools remain
  runtime requirements, not discoverable package grants. A package cannot
  remove or impersonate them.

The effective executable Tool set is therefore:

```text
materialize(
  (exact projected built-ins intersect runtime-template upper bound)
  union exact projected package/MCP refs
  union platform-required transport Tools
)
minus explicit switches/denies
```

The final union is not a fallback or extension grant: those Tools are declared
by the platform runtime contract before package projection and are verified as
present during materialization.

### Caller discovery views

Every production Agent owns the search Tool, but it does not receive the same
catalog rows:

| Caller | Searchable view |
| --- | --- |
| Chat/Work | current Harness projection plus safe project-installed unbound Skills/MCP servers whose next owner is Settings |
| Mission | compatible Expert Squads, selectors, Mission Skills, and platform management capabilities; no inactive package provider internals |
| Task scheduler | its fixed active scheduler projection and required platform discovery/Artifact capabilities; inactive Squad selectors remain Mission-owned |
| Task Agent | only its exact active Agent projection plus safe owner metadata needed to explain an unavailable projected ref |
| Settings/operator API | all installed metadata and auth state; this is management inventory, not an Agent Harness |

This resolves the apparent conflict between “every Agent can search” and “a
Task has one immutable squad.” Search availability is universal; catalog
visibility remains role-specific.

## Capability Catalog Search

### Name and scope

The product idea may be called Harness Search. The runtime tool should be named
`capability_search` because `Work harness` already means a primary-assistant
runtime identity. One name must not represent both an Agent harness and a
catalog query.

Every production Agent receives `capability_search` as a platform-owned,
read-only level-1 Tool. It searches the canonical snapshot, then applies a
caller-specific discovery view:

- mounted and installed Skills;
- visible built-in and package Tools;
- configured and package-projected MCP servers, tools, prompts, and resources;
- pillar-compatible Expert Squads and selectors for callers that can plan or
  select Task ownership;
- visible Mission Skills.

Task workers search their active Resolver-projected surface plus redacted
discoverable metadata. Mission searches management/catalog metadata needed to
create fixed-profile Tasks. A result never claims that a caller owns a
configuration or execution action absent from that caller's real tool surface.

### Result contract

```ts
interface CapabilitySearchResult {
  ref: CapabilityRef
  name: string
  description: string
  product_pillars?: ProductPillar[] // Expert Squad applicability only
  availability: "visible" | "installed_unbound" | "requires_auth" | "denied" | "unavailable"
  next_owner:
    | { kind: "load_skill"; name: string }
    | { kind: "call_tool"; tool_id: string }
    | { kind: "create_task_with_expert_squad"; profile_id: string }
    | { kind: "open_settings"; target: string }
    | { kind: "unavailable"; reason: string }
  catalog_revision: string
}
```

The query supports fuzzy terms and optional exact filters for kind and pillar.
Pillar filtering is exact only for Expert Squads; Skill, Tool, and MCP
eligibility comes from their authoritative active projection rather than copied
pillar metadata. Result references are typed, stable identifiers, not
executable handles. `next_owner` describes the existing authority that could
perform the next operation; it is not a promise that the current Agent owns
that tool. Before load or execution, the owning resolver rechecks the exact
reference and current catalog revision. A stale result produces a visible
stale-reference error and a new search, never a compatibility fallback.

`availability` is descriptive current state, not a permission decision:

- `visible` means the current Harness already projects the exact ref;
- `installed_unbound` means inventory exists but the current owner did not
  project it;
- `requires_auth` means it is projected but transport authentication is absent;
- `denied` means safe metadata may be named but loading or execution is denied.
- `unavailable` means the exact owner/configuration exists but its current
  typed status cannot support the advertised next operation.

Search never calls OAuth, changes an assignment, persists an approval, or
returns provider arguments. `next_owner` is navigation to the authoritative
next step, not an executable continuation token.

### No universal binder

Do not add `capability_bind`. Existing owners remain exact:

| Discovery result | Exact next owner |
| --- | --- |
| mounted Skill | existing `skill` loader and Skill permission |
| visible Tool | existing ToolRegistry and execution permission |
| projected MCP tool | existing MCP resolver, OAuth, and MCP permission plan |
| inactive Expert Squad | Mission or Task launcher creates a new Task with the exact `promptProfile` |
| Mission Skill | existing Mission Skill loader |
| installed but unassigned capability | operator configuration or a future explicit package-install/configuration action |

This keeps fuzzy matching away from execution identity. The model may search
semantically, but every state-changing call uses an exact ID.

## Permission and Authentication Model

Four checks remain distinct:

| Check | Question | Owner |
| --- | --- | --- |
| Discovery visibility | May this caller know safe metadata exists? | catalog owner's caller-specific view |
| Projection/mount | Does this Harness own the exact reference? | `ConversationCapability`, Mission runtime, or `PromptProfileResolver` |
| Execution authority | May this exact action run on these arguments now? | existing execution wrapper and `PermissionNext` |
| Provider authentication | Can the transport prove the connected account identity? | MCP OAuth/auth owner |

Search does not call `PermissionNext.ask` for every result because metadata
discovery is not authority. A discovery deny removes sensitive metadata before
ranking; the caller may receive only a redacted `denied` tombstone when knowing
that a capability is administratively blocked is itself safe. The catalog
snapshot never contains secrets or resource bodies.

Permission does not add refs to a Harness. An `allow` for an unprojected Tool
does nothing. OAuth connection does not add an MCP server or Tool. Conversely,
a projected and authenticated provider action still passes its exact
permission check on every execution.

Provider-specific typed package actions build generic `PermissionNext` plans:

```text
gmail.read                 mailbox/account pattern
gmail.draft                mailbox/account pattern
gmail.send                 mailbox/account + recipient/domain pattern
gmail.modify               mailbox/account + label/thread pattern
gmail.delete               mailbox/account pattern
```

The package owns these semantic names, exact pattern extraction, redacted
argument summaries, and the mapping from its typed action to one exact MCP
reference. Core only validates the generic plan and evaluates `permission`,
`patterns`, and `allow | deny | ask`. The first slice defaults read and draft
according to operator configuration, while send, delete, external submission,
and broad recipient changes remain `ask` unless the operator has explicitly
persisted a narrower allow rule. The raw provider MCP tool is not separately
model-visible.

This is an execution permission, not a workflow gate. The model still decides
the workflow. Core checks only the irreversible tool call that actually
crosses an external boundary.

Mission and Task do not persist a parallel grant object. Their Session/Agent
permission overlays remain the effective ruleset. Current
`PermissionNext.merge(agent, session)` is ordered and last-match wins, while an
unmatched permission defaults to `allow`; it does not by itself prove
monotonic inheritance. Infrastructure completion therefore requires an
explicit non-expansion contract:

- projection is always checked before permission, so no permission rule can
  create a Tool;
- package external actions use a declared action catalog; undeclared actions
  are not projected, regardless of the generic default;
- Session/operator rules may change `allow` to `ask` or `deny`, but a child or
  package overlay cannot change an inherited `deny` to `ask` or `allow`;
- exact merge precedence and the non-expansion check are centralized and
  covered by contract tests rather than reimplemented in each Tool wrapper;
- persisted `always` approval is scoped to the semantic permission and exact
  normalized pattern emitted by the package action mapper.

This is data and authorization integrity, not a workflow gate. It constrains
the actual external call; it does not prescribe the model's sequence of work.

## Daemon and External Events

### What is actually missing

OpenCorvus already has scheduling behavior. The missing first-order component
is an always-on host lifecycle:

```text
OpenCorvusDaemon
  -> selects canonical project worktrees with unattended.enabled = true
  -> acquires one process-level project runtime lease
  -> initializes the headless project runtime composition
  -> AutomationService polls due work
  -> EventService receives normalized internal events
  -> TaskQueueService serializes/retries prompts
  -> SessionWake wakes Work or Mission
```

The daemon does not contain an LLM, business workflow, Gmail parser, second
cron engine, second Task queue, or second Session store. It owns process
lifetime, project activation, health, sleep/wake recovery, and graceful
disposal only.

`unattended.enabled` is the one explicit project-level activation source.
Active schedules remain owned by `AutomationService`; the flag only determines
whether an OS-managed daemon may keep that project's canonical runtime alive.
The daemon never activates registered sandboxes or execution directories by
enumeration. A Task may still execute in an explicitly registered directory
through the existing Task contract after its canonical project runtime is
active.

The headless composition reuses the existing configuration, package resolver,
permission, MCP auth, AutomationService, EventService, TaskQueueService,
EngineService, SessionWake, receipt bridges, recovery, and disposal owners. It
does not initialize Overlay-only or interactive development services such as
FileWatcher, interactive Version Control System
(VCS) watchers, or ChannelSupervisor unless a separately installed capability
explicitly requires and owns one.

The daemon and desktop cannot independently bootstrap the same project
scheduler. The daemon holds the project runtime lease while unattended mode is
enabled; the desktop reads status and submits management mutations through the
same backend owner. Disabling unattended mode drains accepted work, releases
the lease, and returns runtime ownership through one visible lifecycle path.
Crash recovery relies on the persisted scheduler/queue leases rather than a
second in-memory owner.

### First release: timer-driven polling

The fastest paid path does not require a generic external-event framework.
Create a recurring Automation that asks Mission to create one fixed-profile
Work inbox-triage Task for that poll run. The Mission never calls Gmail. The
triage Task's Work Squad calls its configured Gmail package action with the
package-owned pending-work query and exits visibly when there is no new work.
It publishes normalized actionable-message Artifacts with immutable provider
identity and no credential material. Mission consumes accepted triage
Artifacts and creates any dependent fixed-profile delivery Tasks.

Every actionable provider message and stage uses the namespaced creation key
defined by the Task idempotency contract. A matching retry reuses the same
stage Task only when the full creation fingerprint matches; it cannot create a
second reply or silently reuse work from another pillar, squad, or workflow.

This is less token-efficient than provider-native events but reuses every
shipping contract and validates demand before introducing adapter protocol.
The daemon makes the existing Automation reliable when the desktop window is
closed. Provider cursor ownership is deliberately deferred to the strict
adapter contract below; it is not improvised in an LLM prompt or Mission file.

### Later release: package-owned ingress

After the first scenario proves usage, add one provider-neutral adapter
contract. An installed and explicitly configured package may register an exact
poll or webhook adapter that returns:

```ts
interface ExternalEventEnvelope {
  source_ref: string
  event_id: string
  event_type: string
  occurred_at: number
  project_id: string
  subject_ref: string
  cursor: string
  summary: Record<string, string | number | boolean | null>
}
```

The adapter owns provider calls and normalization. Core validates the envelope,
deduplicates `(source_ref, event_id)`, commits the cursor only after durable
event acceptance, publishes one Bus event, and lets the existing EventService
match and wake the target. Raw mail bodies and secrets are not Bus properties;
the awakened Work Squad fetches exact content through its authorized MCP tool.

Required delivery semantics:

- one lease owner per source and project;
- idempotent event key and durable cursor;
- provider subscription/watch creation, renewal, expiration, and stop are owned
  by the package adapter;
- transport acknowledgement occurs only after durable envelope acceptance;
- a provider history range that expands to multiple envelopes advances its
  cursor only after the complete accepted batch is durable;
- retry without advancing the cursor on failed publication;
- bounded backoff and visible last error;
- sleep/wake catch-up;
- periodic reconciliation repairs delayed/dropped provider notifications and
  expired history cursors through the package's exact resynchronization
  contract;
- package removal or auth revocation stops future polls;
- no event is treated as a user-authored message;
- every wake records source, event ID, rule ID, target Session/Mission, and
  terminal outcome.

## First Monetizable Product

### Inbox-to-deliverable concierge

The first Work package should do one complete job:

```text
Check a selected Gmail mailbox
  -> identify actionable messages
  -> group duplicates and threads
  -> analyze the requested work
  -> execute research or office production
  -> produce a review-ready Artifact
  -> create a reply draft
  -> send only with exact permission
  -> record outcome in Work Ledger
```

Do not begin with calendar, CRM, Drive, Slack, and arbitrary browser submission
at once. Email provides a clear trigger, visible input, deliverable, reply
channel, and measurable cycle time. The existing Work presentation slice can
serve as one deliverable type without making presentation generation the whole
product.

Commercial packaging:

- personal paid tier: one mailbox, manual run and desktop-open schedule,
  bounded monthly executions;
- professional tier: always-on daemon, multiple schedules, Mission execution,
  draft review, and higher execution allowance;
- team tier later: shared package policy, managed OAuth, audit export, and
  organization-level permission templates.

Commercial readiness is not implied by successful local OAuth. Before the paid
slice exits beta, the owning Gmail integration must name the OAuth client
operator, exact requested scopes, Google verification status, restricted-scope
data handling boundary, retention/deletion policy, and any required security
assessment. These are release dependencies of the Gmail package/integration,
not generic Core authorization logic.

Primary metrics:

- actionable messages correctly identified;
- tasks reaching a review-ready Artifact;
- drafts accepted without material rewrite;
- median message-to-deliverable time;
- user review minutes per completed task;
- permission rejection and external-action correction rate;
- cost per accepted deliverable, not messages per user.

## Delivery Plan

### Milestone A: typed Capability Catalog and fuzzy search

Status: A1 Catalog single-source hard replacement implemented. Durable
input-Part snapshot binding and the later search/reveal execution cut remain
pending; eager execution is intentionally unchanged.

Goal: complete discovery identity and indexing without touching execution
authority.

Changes:

1. Add the shared `CapabilityRef` codec and reject duplicate canonical refs.
2. Add metadata adapters for Skill, ToolRegistry, MCP, Expert Squad, and
   Mission Skill owners.
3. Build one immutable, deterministic, revisioned snapshot with no secrets,
   resource bodies, provider connections, or package execution.
4. Wire owner revisions and content-addressed atomic snapshot publication;
   owner-specific readers retain their existing cache/single-flight contracts.
5. Add caller-specific discovery views for Chat, Work, Mission, Task
   scheduler, and Task Agent contexts.
6. Add fuzzy ranking after exact visibility, kind, owner, and pillar filters.
7. Add platform-owned `capability_search` to every production Tool pool and
   return only typed refs, availability, revision, and exact `next_owner`.

Exit criteria:

- one query can return deterministically ranked mixed kinds;
- duplicate refs, unstable owner revisions, and stale result reuse fail
  explicitly;
- concurrent first queries publish one complete snapshot and never observe a
  partially rebuilt or silently stale revision;
- denied metadata and wrong-pillar Squad details do not leak;
- search performs no config mutation, mounting, OAuth, approval, package load,
  or provider call;
- existing exact owners remain the only load/select/execute paths.

### Milestone B: Harness projection convergence

Goal: expose one inspectable projection contract while retaining current
specialized owners.

Changes:

1. Add the ephemeral `HarnessProjection` result shape and projection hash.
2. Adapt Chat/Work `ConversationCapability`, Mission Skill runtime, and Task
   `PromptProfileResolver` into that shape without creating a new Registry.
3. Make runtime-template bounds, owner projection, materialization, switches,
   and required transport Tools explicit in one projection assembly path.
4. Add `ProductPillarSchema` and required manifest `product_pillars`; update all
   live packages, Advanced, and the portable template.
5. Project pillar through Registry, catalog, authoring, package payload, API,
   OpenAPI, and SDK.
6. Add immutable Task `productPillar`; commit it and root Session
   `prompt_profile.active` as one recoverable creation unit.
7. Remove later profile mutation from Mission-created Task message/tool
   surfaces and fingerprint the complete Task creation contract.

Exit criteria:

- the same owner inputs produce the same frozen projection and hash;
- Chat/Work, Mission, scheduler, and worker surfaces contain only their exact
  assigned/projected refs;
- an unassigned catalog result never appears in the execution surface;
- a narrower layer cannot add a Tool beyond its runtime-template/owner bounds;
- incompatible pillar/profile creation and continuation fail explicitly;
- `prompt_profile.active` remains the only active squad source;
- conflicting idempotent Task reuse returns an explicit conflict.

### Milestone C: permission and provider-action convergence

Goal: make authorization monotonic after projection and close the generic MCP
semantic gap.

Changes:

1. Centralize effective permission precedence and the non-expansion check.
2. Keep deny filtering before Tool exposure and exact `allow | deny | ask`
   evaluation at call time.
3. Define a package external-action declaration and strict generic Host
   permission-and-MCP invocation adapter.
4. Require provider packages to map typed arguments to one semantic permission,
   normalized patterns, persistable exact patterns, redacted metadata, and one
   exact projected MCP reference.
5. Ensure undeclared provider actions and raw transactional MCP Tools are not
   model-visible.
6. Keep OAuth availability separate from projection and authorization.

Exit criteria:

- `allow` cannot materialize an unprojected capability;
- child/package/session composition cannot override an inherited deny;
- undeclared provider actions cannot inherit unmatched default allow;
- persisted approval matches only its normalized semantic pattern;
- revoked or missing OAuth fails even when projection and permission allow;
- every denial/ask names the semantic action without exposing secrets.

### Milestone D: Gmail Work Squad, desktop-open release

Goal: validate all three foundation layers with one chargeable workflow.

Changes:

1. Create one `["work"]` Inbox-to-deliverable Expert Squad.
2. Keep Gmail MCP reference, scopes, queries, labels, cursor interpretation,
   draft/send semantics, and permission patterns inside the package.
3. Use the Milestone C action adapter and expose only package-owned typed Gmail
   actions to the model.
4. Use existing MCP OAuth for account connection and record the OAuth
   client/verification/data-handling release owner.
5. Start with manual run and existing Scheduled Automation while OpenCorvus is
   running.
6. Have Mission create a fixed Work inbox-triage Task; Mission never calls
   Gmail directly.
7. Use existing Artifacts, receipts, and Work Ledger for results.
8. Default final external action to draft; exact send remains permissioned.

Exit criteria:

- `capability_search` discovers Gmail without mounting or authenticating it;
- Mission selects the exact Work Squad while the fixed Task owns Gmail actions;
- process a real message into a review-ready Artifact and draft;
- prove raw provider MCP Tools cannot bypass the package permission plan;
- rerun idempotently without duplicating Task, Artifact, draft, or reply;
- revoke auth and prove further access fails visibly;
- measure cost and acceptance for real completed work.

### Milestone E: thin always-on daemon

Goal: make the proven Work automation reliable without an open Overlay.

Changes:

1. Add one OS-managed daemon entrypoint using the headless runtime composition.
2. Add one explicit project `unattended.enabled` activation source and load only
   canonical worktrees for enabled projects.
3. Reuse AutomationService, TaskQueueService, SessionWake, Mission receipts,
   recovery, and disposal without initializing interactive project services.
4. Add process-level project ownership, health, wake-from-sleep catch-up,
   bounded retry, and visible daemon status.
5. Keep the desktop application as management and inspection UI, not a second
   scheduler authority.

Exit criteria:

- close the desktop window and execute a due Work automation exactly once;
- opening the desktop while daemon ownership is active does not initialize a
  second scheduler for that project;
- restart the daemon during execution and recover through existing leases;
- a sandbox is never activated merely because it is registered;
- disable unattended mode, automation, or auth and prove no new external read;
- reopen the desktop and observe the same Mission, messages, Artifacts, and
  Work Ledger outcome.

### Milestone F: event-efficient ingress

Goal: reduce polling cost after usage justifies the adapter.

Changes:

1. Add the strict package adapter envelope and cursor contract.
2. Normalize Gmail changes into non-sensitive Bus events.
3. Reuse EventService matching and SessionWake.
4. Add exact deduplication, lease, retry, revocation, and audit evidence.
5. Add provider subscription renewal, transport acknowledgement, batch cursor
   commit, dropped-notification reconciliation, and expired-cursor recovery.
6. Compare event-driven cost and latency against Milestone E polling.

Exit criteria:

- replayed provider events create one wake;
- failed publication does not lose the cursor;
- transport acknowledgement never precedes durable envelope acceptance;
- watch renewal and expired-history recovery are visible and testable;
- raw provider payloads and secrets never enter event rows or prompts;
- package replacement cannot silently reuse revoked credentials;
- event-driven cost per accepted deliverable is lower than timer polling.

## Call-Site Disposition

| Owner/callers | Planned disposition |
| --- | --- |
| `sdk/js/expert-squad-manifest-v2.ts`, authoring | Own the required pillar schema and canonical validation. |
| all package `expert-squad.jsonc` and portable template | Declare exact pillar lists in one replacement. |
| `expert-squad/registry.ts` | Parse and retain pillar metadata; no inference. |
| `expert-squad/catalog.ts` | Project pillar metadata and exact filtered recommendations. |
| `prompt-profile-resolver.ts` | Remain sole projection owner; validate Task pillar compatibility without reading a second active-squad field. |
| expert-squad routes, generated OpenAPI/SDK | Carry exact schema and catalog filter. |
| `panel.create_task`, Task API/model/runtime contract | Persist immutable Task pillar, atomically establish root `prompt_profile.active`, fingerprint the full creation contract, and reject conflicting idempotent reuse. |
| Task message and Mission Task tool projection | Remove later `promptProfile` mutation and profile-changing tools from every Task. |
| Mission and Orchestrator prompts | Require explicit pillar/profile per Mission Task; keep provider execution inside the fixed domain Task. |
| new capability catalog module | Own typed-ref codec, normalized snapshot, revision, caller discovery view, and fuzzy ranking; own no mounting or execution. |
| `ConversationCapability`, Mission Skill runtime, `PromptProfileResolver` | Publish the ephemeral Harness projection through their existing specialized ownership; do not create a generic mount Registry. |
| `AgentToolPool` and runtime-template contracts | Remain static runtime upper bounds and declare platform base/transport Tools. |
| `tool/skill.ts` and `skill/mounts.ts` | Remain exact Skill loader/projector; share indexing metadata, not loading authority. |
| ToolRegistry/execution surface/SessionLoop | Materialize exact projected refs, then apply switches and permission narrowing; remain exact execution owner. |
| MCP index/auth/OAuth | Publish safe metadata and auth status; remain transport/auth owner; authentication does not mount; raw transactional provider tools are not separately model-visible. |
| package ToolHost MCP invocation adapter | Accept one typed generic permission plan plus exact MCP reference; own no provider semantics. |
| `PermissionNext` | Centralize precedence/non-expansion and evaluate package-action exact patterns through the existing store; no new grant engine. |
| Automation/Event/TaskQueue/SessionWake | Remain scheduling, event matching, queue, and wake owners. |
| project bootstrap/instance lifecycle | Extract reusable headless composition and project runtime ownership; never activate every registered sandbox. |
| Work harness/conversation capability | Keep direct Work identity and assignments; hand durable work to Mission. |
| Overlay Settings/Composer/Ledger | Consume backend facts; do not infer pillar or capability authority. |

## Risks and Rejected Designs

### Rejected: Code as an Expert Squad under Work

This collapses a primary product into a package category, weakens Code
positioning, and makes a product navigation decision depend on extension
metadata. Code and Work remain peers.

### Rejected: fully symmetric Code and Work runtimes

Product symmetry does not justify duplicating Session, Mission, Task, Goal,
scheduler, permission, or Artifact infrastructure. That delays monetization and
creates permanent convergence cost.

### Rejected: Work-owned workflow engine

Email analysis, production, and submission are package workflow semantics.
Durability belongs to Mission and Task. A Work workflow store would duplicate
both the Mission ledger and Expert Squad virtual workflow contract.

### Rejected: universal capability binder

A fuzzy match cannot safely mutate active squads, mount Skills, assign MCP
servers, or expand Tool authority. Search returns exact references and lets the
existing owner perform the next operation.

### Rejected: Gmail adapter in Core

Core must not understand labels, threads, drafts, recipient policy, or Gmail
history cursors. Provider behavior belongs to the Work package. Core owns only
generic transport, authorization, event, permission, and persistence
contracts.

### Rejected: raw model-facing Gmail MCP tools beside package actions

Exposing both surfaces lets the model bypass recipient-aware package permission
plans through the generic MCP tool key. Transactional provider operations use
one typed package-action surface; MCP remains its transport.

### Rejected: new daemon scheduler

AutomationService, EventService, TaskQueueService, and SessionWake already
provide scheduling semantics. The daemon extends runtime lifetime; it does not
replace those services.

### Rejected: daemon reuse of the complete interactive bootstrap

Reusing service owners does not require starting FileWatcher, interactive
Version Control System (VCS), every sandbox, or
another desktop scheduler. Daemon runtime composition is headless and
project-lease owned.

## Implementation Governance

Every implementation phase requires:

- a refreshed whole-repository call-site inventory in its dated record;
- focused non-UI schema, Registry, Resolver, permission, scheduler, queue,
  idempotency, auth-revocation, and daemon lifecycle tests;
- no UI automated tests;
- real-page interaction and inspected screenshots for changed Settings,
  Composer, permission, Scheduled, Work Ledger, or daemon-status surfaces;
- generated OpenAPI/SDK/docs synchronization where contracts change;
- second review before commit;
- one task-owned commit series with the required `dsw-33987` subject prefix.

The next implementation starts at Milestone A and completes A -> B -> C as one
foundation program. Their contracts may be developed in parallel, but the
merge order stays Catalog identity, Harness projection, then authorization:
permission rules cannot compensate for an ambiguous capability identity, and
fuzzy search cannot be accepted until the owning projection proves that a
result remains non-executable. The Gmail vertical begins only after those three
contracts pass together; it is the first real provider acceptance, not the
place where platform semantics are invented.
