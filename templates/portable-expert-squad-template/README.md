# Portable Expert Squad Template

This artifact is an SDK-authored reference for an external OpenCorvus expert squad package.

The concrete sample domain is invoice ledger reconciliation: matching application invoices, payment-provider settlement exports, refund records, and monthly-close audit evidence.

The valid package root is `package/`. The file at `package/README.md` is runtime Orchestrator prompt content, not a human manual. Keep human instructions in this artifact README or in external docs outside the installed package root.

The agent-facing authoring guide is `authoring-skill/SKILL.md`. It stays outside `package/` so an installed business squad never projects package-authoring instructions into its runtime.

Choose only the agents and workflow topology the domain requires. Recommend simple direct Agent dispatch with `virtual_workflows: {}` when no binding graph is needed. Requirements, Architect, Integrity, and review roles are package-owned design choices, not universal SDK legality. Every workflow node is Task-level and executes once per Task.

The concrete ledger sample intentionally uses one typed `requirements` adapter and one downstream `architect` adapter because that domain needs immutable requirement and planning lineage. It may create operator-visible Goals as versioned Delivery Slice contracts; exact Slice revision IDs are then dispatch and evidence subjects, never workflow multipliers or lifecycle owners.

OpenCorvus projects the platform-owned `universal-build` capability only into the scheduler dispatch surface. Never copy it into package agents or virtual workflows; package Build-template agents are retained only when they own real domain implementation work.

The model-facing file protocol uses `artifact_snapshot` to publish current-Task project files and return one exact content-addressed `resource_set` locator. `artifact_publish` accepts the complete evidence value only as strict JSON text in `payload_json`; object keys must be unique, `resource_set` is required (`null` when there are no files, otherwise the exact locator returned by `artifact_snapshot`), and `source_artifact_locators` is required (`[]` when there are no semantic Artifact sources). The Host validates every source against complete reads earlier in the same physical Turn, verifies and expands the immutable manifest inside its trusted boundary, and publishes the structured value through the same canonical service used by typed and package tools.

TypeScript package tools do not invoke the model-facing `artifact_publish` tool. They publish Engine Artifacts explicitly through `context.host.engineArtifacts.publish` with stable `artifact_type`, `schema_version`, `label`, structured `payload`, `resources`, and `source_artifact_locators`, then return a compact locator/digest receipt. They publish immutable Task Artifact files through `context.host.taskArtifacts.stage(...)` followed by `context.host.taskArtifacts.publish(...)`, then return the typed snapshot locator. Returning a string from a package tool never publishes an Artifact. Consumers always discover the durable Artifact through the catalog and read/select its exact locator rather than treating the tool receipt as evidence transport.

OpenCorvus projects the Core-owned `artifact_search`, `artifact_read`, and `artifact_select` discovery/provenance transport into every projected worker and every scheduler that inherits its base Tools. A scheduler with `inherit_base_tools: false` receives only its explicit `built_in_tool_ids`, so it must list the platform Artifact Tools it actually uses. Projected workers additionally receive `artifact_snapshot` and `artifact_publish`. Do not shadow or wrap those tools in the package. A worker without a typed domain-output producer calls `artifact_publish` with a canonical JSON `expert_output` type under `<active-squad-id>/...`; it passes publication-specific `source_artifact_locators` drawn from complete reads earlier in that Turn, and the Host derives Task, Session, Agent, active-Squad, projection, observed, and selected provenance. Typed domain-output and package tools remain their domain's sole publishers and must not duplicate the same fact through `artifact_publish`. Ordinary dispatch outcomes and Agent messages never transport domain Artifact inventories, locators, or bodies. A consumer enumerates the complete same-Task catalog with a queryless search, chooses by immutable producer/type/workflow/node provenance, reads exact locators to completion, and calls `artifact_select` for each semantic source of its typed output. Reads remain observed even when unselected; zero selections are valid. A user-pinned locator is the sole same-Task exception and must be read exactly rather than replaced by search. For Cross-Task evidence, Mission references a completed source with `{authority: "completion_decision", source_task_id}` in `artifact_sources`; the Host imports that decision's complete deliverable set without copied locator IDs. Failed/cancelled recovery uses `{authority: "terminal_lifecycle", source_task_id, locator}`. The receiving catalog exposes target-owned imported Engine Artifacts preserving source type, schema, payload, and copied resources, with immutable `import_lineage`; request prose and foreign reads are not evidence. Missing optional fields and zero search results are valid; a missing selected locator, foreign-Task reference, corrupt manifest or bytes, wrong path, digest mismatch, or unreadable text is an explicit evidence error.

Do not install this sample package as-is. Use its definition as a concrete reference, build one `ExpertSquadPackageDefinition`, and materialize a new source directory outside `.opencorvus/expert-squads/**` through `writeExpertSquadPackage` from `@opencorvus-ai/sdk/expert-squad-authoring`. Validate the source package before explicitly importing it into `.opencorvus/expert-squads/<namespace>/<id>/`.

## Concrete Example

The sample squad collects ledger evidence, defines deterministic matching rules, implements evidence-preserving comparison, verifies discrepancies, and produces an audit-ready close report with unresolved exceptions.

## Dynamic Agents

- `ledger-requirements` -> template `requirements`: Defines source-record, period, currency, tolerance, and close-report requirements.
- `reconciliation-architect` -> template `architect`: Designs deterministic matching rules and evidence-preserving reconciliation architecture.
- `primary-reconciliation-builder` -> template `build`: Implements the read-only source comparison and reconciliation result pipeline.
- `exception-remediation-builder` -> template `build`: Implements approved exception classification and auditable remediation outputs.
- `source-evidence-explorer` -> template `explore`: Locates authoritative ledgers, settlement exports, refund records, and existing close evidence.
- `settlement-researcher` -> template `deep-research`: Researches source-system schemas, settlement semantics, refund flows, and audit constraints.
- `close-integrity-reviewer` -> template `integrity`: Rejects close results that omit evidence, hide exceptions, or change approved rules.
- `discrepancy-fact-checker` -> template `fact-check`: Verifies sampled matched and unmatched records against the raw source rows.
- `close-workload-planner` -> template `goal-workload-analyst`: Sizes evidence collection, rule definition, implementation, verification, and delivery work.

`primary-reconciliation-builder` and `exception-remediation-builder` intentionally share `base_role: build`. They remain different runtime identities with different prompts, responsibilities, dispatch targets, and projected resources.

## Identity And Directory Rules

- Each key under `capability_projection.agents.<agentID>` is the runtime agent identity and the exact `dispatch_agent.dispatch.target` value.
- `base_role` selects only the platform core prompt, tool set, Session kind, and adapter template. It never becomes the runtime identity or dispatch target, and it does not add a terminal submit/finalizer protocol.
- Every worker prompt is declared on its projection and stored at `agents/<agentID>/system.md`.
- Scheduler configuration stays under `capability_projection.scheduler` with the fixed `orchestrator` template and optional `agents/orchestrator/system.md` prompt.
- `capability_projection.virtual_workflows` declares immutable scheduler contracts. Before dispatch, the Orchestrator visibly selects the exact matching graph; every declared node and dependency then requires terminal-success evidence without omission, skipping, substitution, or reordering. The graph does not create active/default workflow fields or step state.
- Every workflow node executes exactly once for its Task. An adapter that supports Slice subjects may name exact `goal_ids` as work and evidence subjects; dispatch lineage persists them as Delivery Slice revision IDs, but Slices never multiply nodes or own scheduling state.
- Manifest `version` uses `YYYY.MM.DD.N`; `N` is the positive ordinal of this Squad's revision on that calendar date.
- A virtual workflow declares one exact collaboration variant. Its ID, label, and description must state the complete applicability boundary and every mandatory external input so callers do not combine overlapping capability labels or select a graph whose required input is absent. It does not need to include every projected agent, but every node it includes is mandatory after selection and must reference a declared dynamic agent ID. Model conditional paths as separate workflows.
- Every workflow references declared projected agents, uses canonical dependency ordering, and is acyclic; package-specific role topology is explained by its domain contract.
- When several independent squads form one delivery, let Mission own the final outcome and create one dependent fixed-profile Task per squad stage. Each stage Task owns only its local Delivery Slice contracts, and domain prompts never select the next squad.
- Describe cross-package composition with `ExpertSquadCollaborationDefinition`, set `stage_execution: "mission_task"`, and run `validateExpertSquadCollaboration({ definition, manifests })` during authoring. A stage is owned by its fixed-profile Task and complete selected workflow, never one worker or Slice. Use separate workflows for conditional variants within one squad and separate collaboration definitions when the conditional path changes the stage/squad graph; neither may contain optional nodes. The validator does not execute or persist them.
- Treat collaboration `consumes` and `produces` values as semantic evidence-topology labels only. They do not configure Artifact transport, inventory values, copy payloads, or require a package-specific renderer.
- Run `validateExpertSquadPackageDefinition(definition)` before materialization. The SDK verifies manifest/workflow legality, package paths, and required README/selector/prompt entrypoints; `writeExpertSquadPackage` invokes the same validator before creating the destination.
- For source-derived packages, maintain one `ExpertSquadSourceCapabilityContract` audit artifact and run `validateExpertSquadSourceCapabilities(...)` against the exact manifests and collaboration definitions.
- Package root `README.md` is appended to the active Orchestrator prompt. Do not put tutorial prose there.

## Package Resource References

| Resource | Shared ref | Agent-local ref |
| --- | --- | --- |
| Skill directory containing `SKILL.md` | `<squad-id>/shared/<skill>` | `<squad-id>/<agent-id>/<skill>` |
| Tool file `tools/<tool>.ts` | `<squad-id>/shared/<tool>` | `<squad-id>/<agent-id>/<tool>` |
| MCP declaration `mcp/<server>.jsonc` | `<squad-id>/shared/<server>` | `<squad-id>/<agent-id>/<server>` |
| One MCP capability | `<server-ref>/tool/<name>`, `/prompt/<name>`, or `/resource/<name>` | same grammar |

Project a shared ref from any scheduler or worker projection. Project an agent-local ref only from that owning agent. `package_mcp_server_refs` mounts every capability declared by that server; use the typed MCP arrays to mount selected capabilities instead, never both for the same capability. Default host resources use the separate `default/...` ref namespace and are not package files.

## Create A Real Squad

1. Define one `ExpertSquadPackageDefinition` with renamed `namespace`, `id`, `label`, package refs, dynamic agent IDs, matching agent files, and selector guidance.
2. Use `virtual_workflows: {}` when no binding graph is needed. Otherwise declare only the exact once-per-Task Agent predecessor evidence order and domain roles required by the package.
3. If the Task uses operator-visible Goals, model them as versioned Delivery Slice contracts and pass exact Slice revision IDs only as dispatch and evidence subjects.
4. Delete every worker projection and agent file that is not part of the real squad, and keep one concrete responsibility, evidence surface, and stop condition in every retained prompt.
5. Inventory every runtime input. Put model-readable supporting files inside their projected Skill directory, put immutable tool-only templates/configuration/data under `assets/`, statically import those assets from package tools, and project every Skill/tool/Model Context Protocol ref explicitly.
6. Call `writeExpertSquadPackage({ directory: sourceDirectory, definition })` from `@opencorvus-ai/sdk/expert-squad-authoring`; do not handwrite the final package tree.
7. Call `client.expertSquad.validateFolder({ sourceDirectory })` before installation; it uses the runtime registry without installing or activating the package.
8. Install explicitly with `client.expertSquad.importFolder({ sourceDirectory, installationScope: "project" })`; choose `global` only for intentional cross-project installation. Replacing an existing exact installation requires its latest `expectedCurrentPackageDigest` and returns a typed conflict when stale.

## Acceptance Checklist

- The selector states when to choose and reject the squad.
- The Orchestrator README defines coordination contracts rather than a second workflow engine.
- Every dispatch target is a declared dynamic agent ID.
- After a workflow is selected, every declared node is mandatory and executes once for the Task; independent nodes may run concurrently.
- Every virtual workflow node references a declared dynamic agent ID.
- A composed delivery has one fixed-profile Mission-owned Task per squad stage and local Delivery Slice contracts inside that Task; its static SDK collaboration definition references exact squad/workflow/evidence/repair identities and declares `stage_execution: "mission_task"`.
- Virtual workflows contain only agent, description, and dependency facts; they never contain dispatch scope, active/default/status/auto-advance fields.
- Every package resource has one explicit projection owner.
- Every projected Agent uses the platform Artifact catalog for durable inter-Agent evidence; no prompt requires an upstream worker, message, dispatch result, or private package tool to transport an Artifact inventory, locator, or body.
- The package is self-contained: every runtime input is a projected Skill file, a statically imported package asset, an explicit Task input, or a declared external service.
- Multiple agents sharing a template remain isolated by agent ID and resource path.
- No alias, name guessing, hidden routing, fallback, or second active squad field exists.
