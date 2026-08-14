# Agent Tool Block Projection Plan

## Outcome

Replace eager Model Context Protocol (MCP) Tool exposure with one caller-scoped Tool-block projection mechanism. Browser and Computer are the first two default-available blocks, and the same mechanism accepts any MCP server that is already configured or package-projected. Every execution Agent can search the compact catalog, explicitly load an allowed block for its current run, and invoke the resulting exact Tools through the existing durable permission authority.

This is a projection change, not dynamic installation, capability leasing, keyword routing, or a second permission system.

## Recall

### User requirements

- First deliver Browser and Computer as two blocks.
- At the same time, make the block mechanism generic for the current MCP server Tool system rather than hard-coding only those two capabilities.
- Every Agent must be able to discover and use allowed capabilities.
- Complete the permission path so an actual loaded Tool invocation can raise an approval request and permission decisions and execution evidence are recorded.
- Reduce default context inflation by exposing Tool definitions only after the Agent asks to load a block.
- Produce the plan before implementation.

### Acceptance indicators

1. Browser and Computer are discoverable and loadable by every execution Agent without eagerly projecting their 53 Tool definitions.
2. A configured project MCP server or an explicitly projected package MCP server uses the same block contract.
3. Every general execution Agent always receives `capability_search` and `capability_load`; non-model helper roles such as title, summary, compaction, and memory maintenance remain Tool-less, while the specialized control role retains its existing panel-only contract unless it is deliberately promoted to a general execution role.
4. Discovery does not grant operator authorization. A load that starts/connects to a provider and every concrete Browser, Computer, ordinary MCP, package MCP, and MCP App call cross `withTaskToolInvocation` and `PermissionAuthority.authorizeAndExecute` with their exact, distinct operation scopes.
5. In `ask` mode, each permission-bearing provider connection or concrete invocation creates the canonical durable request, pauses, resumes the exact operation after a decision, and records the decision, execution start, result, or unknown outcome. In `full_access`, admission and outcome remain recorded without prompting.
6. A loaded block is visible only for the current execution occurrence. It survives process restart while that occurrence is active and is absent from the next independent occurrence unless loaded again.
7. The base model request contains only the existing compact search Tool plus one bounded load Tool. Full MCP schemas enter context only after an exact load and only for the loaded blocks.
8. No Host keyword router, automatic capability choice, fallback implementation, parallel configuration source, hidden message, or synthetic approval is introduced.

### Hard constraints

- Current architecture files under `specs/current/architecture/**` remain the public contract authority.
- Agent assignment and Harness projection remain capability controls; they cannot become operator permission grants.
- Projected worker and scheduler authority remains immutable across restart. Their allowed block references and digests must be frozen in the persisted turn descriptor before execution.
- Messages, Tool calls, Tool results, permission requests, and decisions are produced by their real owners and remain visible.
- All model calls remain streaming.
- No User Interface (UI) automation test may be added, modified, or run. Any touched UI must be accepted through the real page, screenshots, and manual review.
- No new database table is planned: the existing durable input Message or Worker Turn descriptor freezes block authority, the persisted `capability_load` Tool part is the block-load receipt, and the existing permission ledger remains the sole authorization and execution ledger.

### Material read

- `packages/opencorvus/src/agent/tool-pool-data.ts`
- `packages/opencorvus/src/agent/tool-pool-contract.ts`
- `packages/opencorvus/src/capability/catalog.ts`
- `packages/opencorvus/src/tool/capability-search.ts`
- `packages/opencorvus/src/conversation/capability.ts`
- `packages/opencorvus/src/session/loop.ts`
- `packages/opencorvus/src/agent/worker-turn-descriptor.ts`
- `packages/opencorvus/src/permission/invocation.ts`
- `packages/opencorvus/src/permission/authority.ts`
- `packages/opencorvus/src/permission/permission.sql.ts`
- `packages/opencorvus/src/tool/task-tool-invocation.ts`
- `specs/current/architecture/04-extensions.md`
- `specs/current/architecture/security-permission.md`
- `specs/records/2026-08/2026-08-14-default-browser-computer-capabilities.md`
- `specs/records/2026-08/2026-08-10-expert-squad-bounded-catalog-and-context.md`

### Repository-wide search result

- `PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS` currently places `capability_search` on coding, Chat, Work, Mission, Orchestrator, delegated-worker, build, explore, stage, research, design, visual, and integrity execution surfaces. This list is the correct single place to add the loader for every execution Agent.
- `SessionLoop.resolveTools()` is rerun for every model step. It can therefore include a block after a completed load Tool call without restarting the provider stream or mounting schemas in the initial request.
- Native Chat and Work currently treat assigned MCP server references as eager schema projection. Browser contributes 45 Tools and 21,398 schema characters; Computer contributes 8 Tools and 5,500 characters. Together they cost an estimated 6,725 tokens on every model step.
- The capability catalog already publishes compact configured-server identities separately from exact visible MCP Tool identities, but its current `next_owner` contract can only call an already-visible Tool or open Settings. It needs one exact `load_tool_block` next owner.
- Projected workers persist an exact `WorkerTurnDescriptor`, then require the recovered Tool set to equal the persisted set. On-demand blocks therefore require a frozen allowed-block set in the descriptor and a separately derived current loaded subset; silently appending Tools at recovery would violate current authority.
- All physical Tool sources already enter the unified `withTaskToolInvocation` envelope. Browser, Computer, MCP, and MCP App have distinct provider kinds, provider/config digests, redacted argument scopes, durable decisions, exact continuation recovery, MCP protocol Task recovery, and at-most-once execution evidence.
- The current permission contract deliberately separates capability visibility from authorization. The block loader must preserve that separation.

### Independent Agent feedback

The independent read-only review found no missing execution role and no P0 issue. It identified four P1 contract gaps and two P2 calibration gaps, all incorporated below:

- give native, scheduler, and worker occurrences an explicit durable allowed-set authority instead of relying on the process-local runtime-contract map;
- keep the receipt-derived loaded execution layer separate from immutable package/Harness and registry projections;
- preserve `mcp`, `mcp_app`, `browser`, and `computer` provider kinds in one shared loaded-MCP wrapper rather than using the generic `projected` classification;
- make provider/schema drift terminal for the current occurrence so a later receipt cannot silently supersede an earlier frozen receipt;
- treat load-time connection, process startup, authentication, timeout, cleanup, and audit as real provider control-plane effects;
- use actual serialized provider Tool payload cost for both limits and verification, including history, cold start, unions, and name collisions.

A second review confirmed those six findings were closed, then identified and drove two further clarifications: recovery must rebuild schemas from the successful receipt without replaying a completed provider connection, and a load that has several physical properties needs one deterministic dominant permission effect plus a resource scope that records all properties. A third review confirmed both corrections and required the payload budget to apply to the prospective cumulative block union rather than each block independently. The fourth review confirmed that correction and reported no remaining P0, P1, or P2 findings.

## Root-cause and impact analysis

### Observable condition

Default-enabling Browser and Computer fixed missing capability projection for native conversations, but it added all 53 Tool definitions to every model step whether they were needed or not. Permission approval cannot solve this context cost because permission runs after the model has already received and selected a Tool.

### Direct trigger

`ConversationCapability.runtimeMcpTools()` resolves every assigned MCP server before each provider call. The Harness then treats all returned MCP Tools as the current exact execution surface.

### Data/control-flow root cause

One field, `mcp_server_refs`, currently conflates two states:

1. the Agent is allowed to discover and select this server; and
2. every Tool schema from this server is already projected into the current model step.

Because there is no explicit intermediate load event, the runtime can either hide the server completely or pay its complete schema cost. The catalog can describe an unbound server but cannot convert a caller-owned exact server reference into the next step's Tool projection.

### Why earlier paths did not root-cure it

- Per-Agent assignment solved availability but remained eager.
- Permission controls concrete effects; moving approval earlier would lack exact arguments and would incorrectly turn capability selection into authorization.
- `capability_search` is intentionally metadata-only and has no load next-owner contract.
- Expert Squad package projection is exact and restart-safe, but exactness currently assumes the entire enabled set is known before the first model step.

### Impact surface

- Tool identity catalog and Agent Tool pools.
- Capability catalog result and next-owner schemas.
- Native conversation, Mission, Orchestrator, delegated worker, Task scheduler, and projected worker resolution.
- Worker turn descriptor, runtime-contract recovery, permission-continuation recovery, and Harness projection digests.
- MCP connection ownership and Browser/Computer session lifecycle.
- Capability settings wording and diagnostics if assignment is currently presented as immediate Tool visibility.
- Focused backend contracts, real permission recovery, context measurements, current architecture, generated API/Software Development Kit (SDK) only if a public schema changes.

The underlying Browser, Computer, ordinary MCP execution, authentication, permission decision, and permission ledger implementations do not need parallel replacements.

## Proposed contract

### 1. One block identity

Use the existing canonical MCP server reference as the block identity. A block descriptor is compact and contains:

- exact server reference and source (`platform`, `project`, or `package`);
- display name and bounded description;
- provider/config/package digest;
- authentication/availability state;
- callers allowed to discover it;
- optional measured Tool count and schema-character estimate when already cached.

Browser is `default/mcp/browser`; Computer is `default/mcp/computer`. Ordinary configured and package-scoped MCP servers use their existing references. Do not create Browser-only or Computer-only loading protocols.

### 2. Two sets, one authority

Each execution occurrence has:

- `allowed_block_refs`: compact references the caller may discover and load, frozen with provider/config digests;
- `loaded_block_refs`: the subset established by completed `capability_load` Tool parts in this exact occurrence.

The allowed set is authority. The loaded set is context projection state, not new authority. Its canonical binding includes a format version, occurrence/input-message identity, ordered block bindings, provider/config/package digests, capability-policy revision, and an `allowed_set_hash`.

There are exactly three durable carriers, selected by occurrence kind through one resolver:

1. native conversation, coding, Mission, and session-local delegated occurrences freeze the binding in metadata on their durable input Message before the first model step;
2. projected scheduler wakes freeze the binding in the durable scheduler ingress/wake input Message referenced by `SessionRuntimeContract.identity.inputMessageID`; the process-local `SessionRuntimeContractStore` is never the authority;
3. projected Task workers freeze the binding in `WorkerTurnDescriptor.tools`, whose `messageAuthority.user_message_id` identifies the same durable input occurrence.

The binding is written atomically with occurrence admission. Search, load, restart reconstruction, and permission-continuation recovery all call the same resolver and read only that occurrence-kind carrier. They never recompute an active occurrence's allowed set from latest config.

For native Agent runs, the initially frozen set is resolved from platform defaults, project-configured MCP blocks, explicit denials, and the current Agent identity. For Task schedulers and projected workers, the same allowed references and digests are frozen before the first model call. Package MCP blocks remain limited to the scheduler or worker projection that owns them; a worker cannot discover another package Agent's private block.

Browser and Computer are platform-default allowed blocks for all execution Agents. Project MCP blocks are project-level allowed blocks unless explicitly denied by the existing capability policy. Package MCP blocks remain package-projection scoped.

### 3. Universal discovery and explicit load

Extend `PLATFORM_CAPABILITY_DISCOVERY_TOOL_IDS` to contain:

- `capability_search`;
- `capability_load`.

`capability_search` remains bounded metadata retrieval. MCP server results that the caller may load return:

```json
{
  "next_owner": {
    "kind": "load_tool_block",
    "block_ref": "default/mcp/browser"
  }
}
```

`capability_load` accepts only an exact block reference and the expected catalog revision. It:

1. validates the caller, allowed set, catalog revision, and provider digest;
2. enters the permission envelope for any required provider connection, local process startup, remote read, or credential release, then lists/materializes the exact server Tools through the existing MCP owner;
3. validates and normalizes the exact model-visible Tool definitions, computes their identity list and payload digest, and rejects duplicate/colliding names, non-serializable schemas, over-budget payloads, or credential/config material;
4. persists those complete, strictly bounded normalized Tool definitions in the visible Tool part metadata while keeping the textual result bounded, then returns the load receipt;
5. causes the next `resolveTools()` step to add precisely that loaded block.

There is no keyword selection, implicit load, or Host decision about which block the model should use.

### 4. Occurrence lifecycle and recovery

The activation owner is the runtime's authoritative durable input occurrence: a user/input Message for a native conversation, coding Agent, Mission, or Orchestrator wake, or the persisted dispatch/input-message authority for a projected worker. All model steps belonging to that occurrence see the union of its completed valid load receipts.

At terminal completion, the next independent input starts with no loaded blocks. Blocks are not accumulated for the lifetime of the Session. Multiple loads in one occurrence form a bounded union of at most four successful block receipts. Before accepting each load, the runtime constructs the prospective `ToolBlockExecutionProjection` from all current valid receipts plus the requested block, serializes the complete incremental provider Tool payload that this union would add to the next model step, and applies one 40,000-character cumulative ceiling, including Tool names, descriptions, schemas, wrapper fields, and provider serialization. A typed `tool_block_budget_exceeded` result reports the current union, requested block, prospective cumulative cost, character ceiling, and block-count ceiling. The second or later block is rejected before receipt persistence if either cumulative limit would be exceeded.

Each successful receipt explicitly contains its format version, occurrence/input-message ID, `allowed_set_hash`, block/provider binding, complete normalized model-visible Tool definitions, exact Tool identities, Tool-payload digest, measured payload characters, and load connection-owner identity. Only the model-visible Tool contract is persisted: credentials, authorization headers, environment, process arguments containing secrets, cookies, and connection handles are excluded.

Recovery reconstructs the loaded subset and the next provider Tool payload entirely from persisted Tool parts bound to the same occurrence and verifies every field. It does not reconnect, restart a process, repeat authentication, or rerun `tools/list`; a completed load permission attempt is never replayed. The scoped owner from the old process is considered released. The later concrete MCP Tool invocation establishes whatever live connection it needs inside that invocation's own permission attempt, then verifies the live provider and Tool digest before sending `tools/call`. A mismatch terminally stales that concrete invocation and the active occurrence before the business effect.

Catalog, provider, allowed-set, or persisted Tool-payload drift likewise makes the current occurrence terminally stale; it cannot accept another load receipt or supersede the old one. A new authoritative input occurrence must freeze a new allowed set and load again. The runtime never silently substitutes a server or replays an effect.

For projected workers, extend `WorkerTurnDescriptor.tools` with frozen allowed block bindings. The existing `enabled` list remains the immutable package/base Tool set. Do not append loaded Tools to `projectedRegistryToolIDs`, `projectedTools`, or the base Harness projection and do not replace the installed runtime contract.

Instead, add one `ToolBlockExecutionProjection` sibling layer, hashed from the frozen authority plus validated receipts. `SessionLoop` validates the immutable base runtime/Harness first, validates this additive layer second, rejects Tool-name collisions across the base and loaded sets, then composes the model-visible and execution surfaces. Permission-continuation recovery reconstructs the identical additive layer before checking and resuming the exact requested Tool. The execution surface records both the base Harness projection and the block-projection hash/refs without mutating either owner revision.

### 5. Permission and audit contract

`capability_load` is a capability-projection operation, but materialization may open a network connection, start a configured local MCP process, perform an authentication handshake, release a credential to the exact configured provider, and own a scoped connection that must be closed. Metadata-only search remains non-permission-bearing.

The permission descriptor uses one deterministic dominant effect because the ledger currently has one `effectClass`: `credential_release` outranks `process`, which outranks `network_read`. A typed `provider_control` resource scope still records every applicable property: operation `load_tools`, transport kind, normalized remote endpoint or canonical local process identity, `starts_process`, `network_read`, `releases_credential`, provider/config digest, redacted input, and its hash. The dominant effect plus complete resource scope enter the permission fingerprint, restart continuation, summary, and tests. This is a typed extension to the canonical descriptor, not a bypass or a second permission path.

Load enters the canonical permission envelope in `ask` mode. The successful ordinary Tool result is the canonical load receipt; failures and timeouts produce durable permission/execution evidence but no valid receipt. The exact Session/Task scoped MCP connection owner is closed after its normalized Tool definitions are persisted, and also on failed or stale load cleanup; it is not retained as recoverable authority.

One shared loaded-MCP materializer must serve native and projected paths. Its authority binding selects `browser`, `computer`, `mcp_app`, or ordinary `mcp` from the real server/tool identity and preserves the provider/config digest. A loaded ordinary MCP Tool must never fall through to `providerKind="projected"`. This same wrapper retains MCP App lifecycle behavior and MCP protocol Task recovery.

Every concrete loaded Tool call retains the existing permission envelope:

```text
Agent load or Tool call
  -> exact loaded Tool wrapper
  -> withTaskToolInvocation
  -> PermissionAuthority.authorizeAndExecute
  -> ask/full_access decision evidence
  -> physical MCP/Browser/Computer execution
  -> durable result or outcome_unknown
```

The provider kind, provider identity and digest, exact control-plane or Tool operation, effect class, redacted normalized arguments/hash, Session/Task/message/call identity, decision scope, actor, execution attempt, protocol MCP Task, and terminal outcome continue to be recorded in the existing permission ledger. Secret values remain excluded.

Approval of a block's control-plane connection cannot pre-approve its Tools. In `ask` mode, a later concrete invocation raises its own canonical permission request. A material Tool argument or provider-digest change produces a different fingerprint. In `full_access`, the ledger still records each admission and outcome. Browser/Computer authentication or operating-system permission failures remain runtime/auth facts, not fabricated OpenCorvus approvals.

### 6. Context contract

Initial model steps no longer contain Browser or Computer schemas. They contain only the bounded `capability_load` definition in addition to the existing `capability_search` definition. The implementation acceptance target is at most 1,200 added characters in the exact serialized provider Tool payload, approximately 300 tokens, on the base step.

After load, measured current costs apply only to that active occurrence:

| Loaded block | Tools | Current schema characters | Estimated tokens per loaded model step |
| --- | ---: | ---: | ---: |
| Browser | 45 | 21,398 | 5,350 |
| Computer | 8 | 5,500 | 1,375 |
| Both | 53 | 26,898 | 6,725 |

An ordinary MCP block has its measured runtime provider-payload cost. Search results and load receipts stay bounded and enter history only when called. Acceptance also reports the cumulative transcript cost of repeated searches/loads, cold connection attempts, and multi-block unions rather than reporting schema cost alone.

## Implementation sequence

### Phase A — block catalog and native execution

1. Add the `load_tool_block` next-owner schema and compact block entries to the capability catalog.
2. Add `capability_load` to the platform discovery Tool IDs and all execution Agent pools.
3. Introduce one block projection resolver that owns the three durable authority carriers, allowed-set validation, exact load receipts, provider-payload digests, and occurrence reconstruction.
4. Change native Chat/Work eager MCP resolution to load only receipt-selected blocks. Apply the same platform layer to coding, Mission, and Orchestrator Agent runs.
5. Keep Browser and Computer default-allowed while removing their eager default projection.

### Phase B — every Agent and restart authority

1. Add frozen allowed block bindings to native/scheduler durable input Messages and `WorkerTurnDescriptor` payloads, with one occurrence-kind resolver and no process-local authority.
2. Project the loader into delegated workers and every runtime template through the common platform list.
3. Add the separate `ToolBlockExecutionProjection`; update projected worker Tool resolution, exact additive-layer validation, wake/retry/restart reconstruction, and permission-continuation recovery without mutating the base Harness/runtime contract.
4. Preserve package-private MCP ownership and Task/project isolation. Prove concurrent Agents can load different blocks without sharing loaded state or Computer connection owners.

### Phase C — permission completeness, product surface, and evidence

1. Add the deterministic load control-plane permission descriptor and scope; verify every materialized loaded Tool retains its real `mcp`, `mcp_app`, `browser`, or `computer` provider kind and digest.
2. Add positive contracts for `ask`, allow-once/task eligibility, denial, full-access admission, restart continuation, MCP protocol Task recovery, terminal result, and unknown outcome.
3. Update Settings/diagnostics wording from eager assignment to default availability if the current copy would misstate the new contract.
4. Update current architecture and generated public contracts where schemas changed.
5. Measure base and loaded context with `SessionLoop.estimateToolPayloadChars`, then perform real end-to-end Agent runs and manual UI permission review.

## Verification plan

### Positive focused contracts

- Every execution Agent and runtime template exposes `capability_search` and `capability_load` initially.
- Non-model helper roles retain their intentionally empty Tool pools, and the specialized control role retains its panel-only surface.
- Browser, Computer, project MCP, and package MCP appear only for authorized callers and return `load_tool_block`.
- Exact revision/digest load succeeds and the next model step sees the exact Tool set.
- The next independent occurrence starts without the prior loaded block.
- Two concurrent Sessions/Tasks do not share receipts, MCP owners, Computer logical sessions, permissions, or outcomes.
- Native input admission, scheduler ingress/wake, and worker dispatch each persist the allowed block binding in their one canonical carrier; restart reconstructs the same active loaded set.
- Stale catalog/provider/schema identities return typed current-contract errors.
- Drift terminally stales the current occurrence; no later receipt can supersede it inside that occurrence.
- Restart reconstructs model-visible Tool definitions solely from the bounded receipt, performs no load-time physical replay, and opens a new live connection only inside the later concrete invocation's distinct permission attempt.
- A permission-bearing load and a loaded concrete Tool call in `ask` create and resume distinct durable exact requests; `full_access` records each admission; both record one terminal outcome or the canonical unknown outcome.
- Multi-property loads use the deterministic dominant effect and include every process/network/credential fact in the exact `provider_control` scope and fingerprint.
- Loaded ordinary MCP remains `providerKind="mcp"`; MCP App, Browser, and Computer retain their exact provider kinds and protocol recovery behavior.
- Base/loaded Tool name collisions fail with a typed error before a model step or physical execution.
- The fifth block and any earlier block whose prospective cumulative union exceeds 40,000 serialized provider-payload characters are rejected before receipt persistence.
- Browser and Computer real runtime catalogs remain 45 and 8 Tools respectively, and generic MCP uses the same loader.

### Real end-to-end acceptance

1. Start the project development application through its normal development entry.
2. Run one native Agent, one Mission/Orchestrator path, one delegated worker, and one projected Task worker.
3. In each, search Browser or Computer, load it, observe the next-step Tool surface, and execute a harmless exact operation.
4. Repeat at least one concrete invocation in `ask`, approve it in the real UI, and prove persisted decision plus resumed result after process recovery.
5. Exercise a configured non-built-in MCP server with the same search/load/call flow and verify its real `mcp` permission evidence.
6. Inspect real UI screenshots manually if settings or permission presentation changes. Do not use UI automation.

### Required checks

- Focused backend tests for Tool pools, catalog, native Session loop, projected runtime, worker descriptor, permission authority, Browser, Computer, and ordinary MCP.
- Package typecheck, route/schema generation checks if applicable, documentation checks, and Git whitespace review.
- Independent read-only review after implementation; repair every valid finding and repeat review until clear.

## Cost and rollout

This is a medium-to-large runtime change because “every Agent” crosses immutable Task descriptors and restart recovery, not because the loader itself is complex.

| Workstream | Estimate |
| --- | ---: |
| Block catalog, loader, receipts, native Agents | 3–4 engineer-days |
| Scheduler, delegated/projected workers, restart and continuation | 3–5 engineer-days |
| Permission/control-plane evidence, focused end-to-end acceptance, docs/UI wording | 2–4 engineer-days |
| Total | 8–13 engineer-days |

Expected change surface is approximately 18–30 production, test, generated-contract, and documentation files. Calendar time is about two to three weeks for one engineer including independent review and real end-to-end evidence; estimate confidence is ±30%, mainly due to the three durable occurrence carriers, projected-worker recovery, and external MCP connection/authentication variants.

Recommended rollout is one implementation behind the existing single capability configuration surface, with Browser and Computer as the first acceptance fixtures. Do not ship a native-only intermediate semantics where workers still eagerly load or cannot discover blocks; that would create two Tool systems. Generic MCP support should land in the same block resolver, while public UI copy and additional remote-server authentication coverage may be completed after the runtime contract is green but before release.

## Explicit exclusions

- Dynamic plugin or Skill installation.
- Downloading capabilities from a marketplace.
- Host inference from user text or Tool/server names.
- Block-level blanket permission grants.
- Session-lifetime accumulation of loaded schemas.
- A new permission ledger, load-state table, background capability service, or compatibility read path.
- Replacing MCP authentication or operating-system Browser/Computer authorization.
