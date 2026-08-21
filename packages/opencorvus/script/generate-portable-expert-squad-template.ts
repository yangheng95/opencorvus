#!/usr/bin/env bun

import type { RuntimeTemplateID as RuntimeTemplateIDValue } from "../src/agent/runtime-template-id"
import { readFileSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  expertSquadAssetPath,
  renderExpertSquadPackageFiles,
  writeExpertSquadPackage,
  type ExpertSquadManifestV1,
  type ExpertSquadPackageDefinition,
} from "../../sdk/js/src/expert-squad-authoring"

export const PORTABLE_TEMPLATE_NAMESPACE = "template"
export const PORTABLE_TEMPLATE_ID = "portable-template"
export const PORTABLE_TEMPLATE_AUTHORING_SKILL_PATH = "authoring-skill/SKILL.md"
export const PORTABLE_TEMPLATE_AUTHORING_QUALITY_METHOD_PATH = "authoring-skill/references/authoring-quality-method.md"
export const PORTABLE_TEMPLATE_AUTHORING_CONTRACT_PATH = "authoring-skill/references/definition-contract.json"
export const PORTABLE_TEMPLATE_RECONCILIATION_POLICY_ARTIFACT_TYPE = `${PORTABLE_TEMPLATE_ID}/reconciliation-policy`
export const PORTABLE_TEMPLATE_RECONCILIATION_POLICY_ARTIFACT_LABEL = "Invoice ledger reconciliation policy"
export const PORTABLE_TEMPLATE_RECONCILIATION_POLICY_SCHEMA_VERSION = 1

export interface PortableTemplateAgentDefinition {
  agentID: string
  label: string
  baseRole: RuntimeTemplateIDValue
  executionContract?: "platform_integrity_review"
  dependsOn: readonly string[]
  description: string
  focus: string
}

const PORTABLE_TEMPLATE_AGENTS = [
  {
    agentID: "ledger-requirements",
    label: "Ledger Requirements Analyst",
    baseRole: "requirements",
    dependsOn: ["settlement-researcher", "source-evidence-explorer"],
    description: "Defines source-record, period, currency, tolerance, and close-report requirements.",
    focus:
      "capture every source file, authoritative key, period boundary, currency rule, tolerance, adjustment policy, and required report field before implementation",
  },
  {
    agentID: "reconciliation-architect",
    label: "Reconciliation Architect",
    baseRole: "architect",
    dependsOn: ["ledger-requirements"],
    description: "Designs deterministic matching rules and evidence-preserving reconciliation architecture.",
    focus:
      "turn approved requirements into matching keys, rounding rules, mismatch categories, evidence artifacts, and explicit rejection conditions",
  },
  {
    agentID: "primary-reconciliation-builder",
    label: "Primary Reconciliation Builder",
    baseRole: "build",
    dependsOn: ["close-workload-planner", "reconciliation-architect"],
    description: "Implements the read-only source comparison and reconciliation result pipeline.",
    focus:
      "implement the primary comparison pipeline without mutating source records, and tie every matched or unmatched output to its source-row evidence",
  },
  {
    agentID: "exception-remediation-builder",
    label: "Exception Remediation Builder",
    baseRole: "build",
    dependsOn: ["close-workload-planner", "reconciliation-architect"],
    description: "Implements approved exception classification and auditable remediation outputs.",
    focus:
      "implement only approved exception classifications and remediation reports, never hidden corrections or inferred adjustments",
  },
  {
    agentID: "source-evidence-explorer",
    label: "Source Evidence Explorer",
    baseRole: "explore",
    dependsOn: [],
    description: "Locates authoritative ledgers, settlement exports, refund records, and existing close evidence.",
    focus:
      "inspect available files, scripts, database tables, and prior close reports to locate authoritative inputs without changing them",
  },
  {
    agentID: "settlement-researcher",
    label: "Settlement Semantics Researcher",
    baseRole: "deep-research",
    dependsOn: [],
    description: "Researches source-system schemas, settlement semantics, refund flows, and audit constraints.",
    focus:
      "establish evidence-backed settlement, refund, fee, and timing semantics before anyone proposes matching rules",
  },
  {
    agentID: "close-integrity-reviewer",
    label: "Close Integrity Reviewer",
    baseRole: "integrity",
    executionContract: "platform_integrity_review",
    dependsOn: ["exception-remediation-builder", "primary-reconciliation-builder"],
    description: "Rejects close results that omit evidence, hide exceptions, or change approved rules.",
    focus:
      "reject reports that hide unmatched records, omit source-row evidence, silently correct totals, or drift from the approved contract",
  },
  {
    agentID: "discrepancy-fact-checker",
    label: "Discrepancy Fact Checker",
    baseRole: "fact-check",
    dependsOn: ["close-integrity-reviewer", "settlement-researcher"],
    description: "Verifies sampled matched and unmatched records against the raw source rows.",
    focus:
      "verify claims about matched totals, unmatched records, adjustments, and source semantics against primary evidence",
  },
  {
    agentID: "close-workload-planner",
    label: "Close Workload Planner",
    baseRole: "goal-workload-analyst",
    dependsOn: ["reconciliation-architect"],
    description: "Sizes evidence collection, rule definition, implementation, verification, and delivery work.",
    focus:
      "split the close into evidence collection, rule definition, implementation, verification, and report delivery without inflating generic goals",
  },
] as const satisfies readonly PortableTemplateAgentDefinition[]

export function portableTemplateAgentDefinitions(): readonly PortableTemplateAgentDefinition[] {
  return PORTABLE_TEMPLATE_AGENTS
}

export function portableTemplateAgentIDs(): string[] {
  return PORTABLE_TEMPLATE_AGENTS.map((agent) => agent.agentID)
}

export function resolvePortableExpertSquadTemplateRoot(repoRoot: string): string {
  return path.join(repoRoot, "templates", "portable-expert-squad-template")
}

export function resolvePortableExpertSquadTemplatePackageRoot(repoRoot: string): string {
  return path.join(resolvePortableExpertSquadTemplateRoot(repoRoot), "package")
}

function renderHumanTutorial(): string {
  return [
    "# Portable Expert Squad Template",
    "",
    "This artifact is an SDK-authored reference for an external OpenCorvus expert squad package.",
    "",
    "The concrete sample domain is invoice ledger reconciliation: matching application invoices, payment-provider settlement exports, refund records, and monthly-close audit evidence.",
    "",
    "The valid package root is `package/`. The file at `package/README.md` is runtime Orchestrator prompt content, not a human manual. Keep human instructions in this artifact README or in external docs outside the installed package root.",
    "",
    "The agent-facing authoring guide is `authoring-skill/SKILL.md`. It stays outside `package/` so an installed business squad never projects package-authoring instructions into its runtime.",
    "",
    "Choose only the agents and workflow topology the domain requires. Recommend simple direct Agent dispatch with `virtual_workflows: {}` when no binding graph is needed. Requirements, Architect, Integrity, and review roles are package-owned design choices, not universal SDK legality. Every workflow node is Task-level and executes once per Task.",
    "",
    "The concrete ledger sample intentionally uses one typed `requirements` adapter and one downstream `architect` adapter because that domain needs immutable requirement and planning lineage. It may create operator-visible Goals as versioned Delivery Slice contracts; exact Slice revision IDs are then dispatch and evidence subjects, never workflow multipliers or lifecycle owners.",
    "",
    "OpenCorvus projects the platform-owned `universal-build` capability only into the scheduler dispatch surface. Never copy it into package agents or virtual workflows; package Build-template agents are retained only when they own real domain implementation work.",
    "",
    "The model-facing file protocol uses `artifact_snapshot` to publish current-Task project files and return one exact content-addressed `resource_set` locator. `artifact_publish` accepts the complete evidence value only as strict JSON text in `payload_json`; object keys must be unique, `resource_set` is required (`null` when there are no files, otherwise the exact locator returned by `artifact_snapshot`), and `source_artifact_locators` is required (`[]` when there are no semantic Artifact sources). The Host validates every source against complete reads earlier in the same physical Turn, verifies and expands the immutable manifest inside its trusted boundary, and publishes the structured value through the same canonical service used by typed and package tools.",
    "",
    "TypeScript package tools do not invoke the model-facing `artifact_publish` tool. They publish Engine Artifacts explicitly through `context.host.engineArtifacts.publish` with stable `artifact_type`, `schema_version`, `label`, structured `payload`, `resources`, and `source_artifact_locators`, then return a compact locator/digest receipt. They publish immutable Task Artifact files through `context.host.taskArtifacts.stage(...)` followed by `context.host.taskArtifacts.publish(...)`, then return the typed snapshot locator. Returning a string from a package tool never publishes an Artifact. Consumers always discover the durable Artifact through the catalog and read/select its exact locator rather than treating the tool receipt as evidence transport.",
    "",
    "OpenCorvus projects the Core-owned `artifact_search`, `artifact_read`, and `artifact_select` discovery/provenance transport into every scheduler and worker, including projections with `inherit_base_tools: false`. Projected workers additionally receive `artifact_snapshot` and `artifact_publish`; schedulers do not. Do not declare, shadow, or wrap those tools in the package. A worker without a typed domain-output producer calls `artifact_publish` with a canonical JSON `expert_output` type under `<active-squad-id>/...`; it passes publication-specific `source_artifact_locators` drawn from complete reads earlier in that Turn, and the Host derives Task, Session, Agent, active-Squad, projection, observed, and selected provenance. Typed domain-output and package tools remain their domain's sole publishers and must not duplicate the same fact through `artifact_publish`. Ordinary dispatch outcomes and Agent messages never transport domain Artifact inventories, locators, or bodies. A consumer enumerates the complete same-Task catalog with a queryless search, chooses by immutable producer/type/workflow/node provenance, reads exact locators to completion, and calls `artifact_select` for each semantic source of its typed output. Reads remain observed even when unselected; zero selections are valid. A user-pinned locator is the sole same-Task exception and must be read exactly rather than replaced by search. For Cross-Task evidence, Mission references a completed source with `{authority: \"completion_decision\", source_task_id}` in `artifact_sources`; the Host imports that decision's complete deliverable set without copied locator IDs. Failed/cancelled recovery uses `{authority: \"terminal_lifecycle\", source_task_id, locator}`. The receiving catalog exposes target-owned imported Engine Artifacts preserving source type, schema, payload, and copied resources, with immutable `import_lineage`; request prose and foreign reads are not evidence. Missing optional fields and zero search results are valid; a missing selected locator, foreign-Task reference, corrupt manifest or bytes, wrong path, digest mismatch, or unreadable text is an explicit evidence error.",
    "",
    "Do not install this sample package as-is. Use its definition as a concrete reference, build one `ExpertSquadPackageDefinition`, and materialize a new source directory outside `.opencorvus/expert-squads/**` through `writeExpertSquadPackage` from `@opencorvus-ai/sdk/expert-squad-authoring`. Validate the source package before explicitly importing it into `.opencorvus/expert-squads/<namespace>/<id>/`.",
    "",
    "## Concrete Example",
    "",
    "The sample squad collects ledger evidence, defines deterministic matching rules, implements evidence-preserving comparison, verifies discrepancies, and produces an audit-ready close report with unresolved exceptions.",
    "",
    "## Dynamic Agents",
    "",
    ...PORTABLE_TEMPLATE_AGENTS.map(
      (agent) => `- \`${agent.agentID}\` -> template \`${agent.baseRole}\`: ${agent.description}`,
    ),
    "",
    "`primary-reconciliation-builder` and `exception-remediation-builder` intentionally share `base_role: build`. They remain different runtime identities with different prompts, responsibilities, dispatch targets, and projected resources.",
    "",
    "## Identity And Directory Rules",
    "",
    "- Each key under `capability_projection.agents.<agentID>` is the runtime agent identity and the exact `dispatch_agent.dispatch.target` value.",
    "- `base_role` selects only the platform core prompt, tool set, Session kind, and adapter template. It never becomes the runtime identity or dispatch target, and it does not add a terminal submit/finalizer protocol.",
    "- Every worker prompt is declared on its projection and stored at `agents/<agentID>/system.md`.",
    "- Scheduler configuration stays under `capability_projection.scheduler` with the fixed `orchestrator` template and optional `agents/orchestrator/system.md` prompt.",
    "- `capability_projection.virtual_workflows` declares immutable scheduler contracts. Before dispatch, the Orchestrator visibly selects the exact matching graph; every declared node and dependency then requires terminal-success evidence without omission, skipping, substitution, or reordering. The graph does not create active/default workflow fields or step state.",
    "- Every workflow node executes exactly once for its Task. An adapter that supports Slice subjects may name exact `goal_ids` as work and evidence subjects; dispatch lineage persists them as Delivery Slice revision IDs, but Slices never multiply nodes or own scheduling state.",
    "- Manifest `version` uses `YYYY.MM.DD.N`; `N` is the positive ordinal of this Squad's revision on that calendar date.",
    "- A virtual workflow declares one exact collaboration variant. Its ID, label, and description must state the complete applicability boundary and every mandatory external input so callers do not combine overlapping capability labels or select a graph whose required input is absent. It does not need to include every projected agent, but every node it includes is mandatory after selection and must reference a declared dynamic agent ID. Model conditional paths as separate workflows.",
    "- Every workflow references declared projected agents, uses canonical dependency ordering, and is acyclic; package-specific role topology is explained by its domain contract.",
    "- When several independent squads form one delivery, let Mission own the final outcome and create one dependent fixed-profile Task per squad stage. Each stage Task owns only its local Delivery Slice contracts, and domain prompts never select the next squad.",
    '- Describe cross-package composition with `ExpertSquadCollaborationDefinition`, set `stage_execution: "mission_task"`, and run `validateExpertSquadCollaboration({ definition, manifests })` during authoring. A stage is owned by its fixed-profile Task and complete selected workflow, never one worker or Slice. Use separate workflows for conditional variants within one squad and separate collaboration definitions when the conditional path changes the stage/squad graph; neither may contain optional nodes. The validator does not execute or persist them.',
    "- Treat collaboration `consumes` and `produces` values as semantic evidence-topology labels only. They do not configure Artifact transport, inventory values, copy payloads, or require a package-specific renderer.",
    "- Run `validateExpertSquadPackageDefinition(definition)` before materialization. The SDK verifies manifest/workflow legality, package paths, and required README/selector/prompt entrypoints; `writeExpertSquadPackage` invokes the same validator before creating the destination.",
    "- For source-derived packages, maintain one `ExpertSquadSourceCapabilityContract` audit artifact and run `validateExpertSquadSourceCapabilities(...)` against the exact manifests and collaboration definitions.",
    "- Package root `README.md` is appended to the active Orchestrator prompt. Do not put tutorial prose there.",
    "",
    "## Package Resource References",
    "",
    "| Resource | Shared ref | Agent-local ref |",
    "| --- | --- | --- |",
    "| Skill directory containing `SKILL.md` | `<squad-id>/shared/<skill>` | `<squad-id>/<agent-id>/<skill>` |",
    "| Tool file `tools/<tool>.ts` | `<squad-id>/shared/<tool>` | `<squad-id>/<agent-id>/<tool>` |",
    "| MCP declaration `mcp/<server>.jsonc` | `<squad-id>/shared/<server>` | `<squad-id>/<agent-id>/<server>` |",
    "| One MCP capability | `<server-ref>/tool/<name>`, `/prompt/<name>`, or `/resource/<name>` | same grammar |",
    "",
    "Project a shared ref from any scheduler or worker projection. Project an agent-local ref only from that owning agent. `package_mcp_server_refs` mounts every capability declared by that server; use the typed MCP arrays to mount selected capabilities instead, never both for the same capability. Default host resources use the separate `default/...` ref namespace and are not package files.",
    "",
    "## Create A Real Squad",
    "",
    "1. Define one `ExpertSquadPackageDefinition` with renamed `namespace`, `id`, `label`, package refs, dynamic agent IDs, matching agent files, and selector guidance.",
    "2. Use `virtual_workflows: {}` when no binding graph is needed. Otherwise declare only the exact once-per-Task Agent predecessor evidence order and domain roles required by the package.",
    "3. If the Task uses operator-visible Goals, model them as versioned Delivery Slice contracts and pass exact Slice revision IDs only as dispatch and evidence subjects.",
    "4. Delete every worker projection and agent file that is not part of the real squad, and keep one concrete responsibility, evidence surface, and stop condition in every retained prompt.",
    "5. Inventory every runtime input. Put model-readable supporting files inside their projected Skill directory, put immutable tool-only templates/configuration/data under `assets/`, statically import those assets from package tools, and project every Skill/tool/Model Context Protocol ref explicitly.",
    "6. Call `writeExpertSquadPackage({ directory: sourceDirectory, definition })` from `@opencorvus-ai/sdk/expert-squad-authoring`; do not handwrite the final package tree.",
    "7. Call `client.expertSquad.validateFolder({ sourceDirectory })` before installation; it uses the runtime registry without installing or activating the package.",
    '8. Install explicitly with `client.expertSquad.importFolder({ sourceDirectory, installationScope: "project" })`; choose `global` only for intentional cross-project installation. Replacing an existing exact installation requires its latest `expectedCurrentPackageDigest` and returns a typed conflict when stale.',
    "",
    "## Acceptance Checklist",
    "",
    "- The selector states when to choose and reject the squad.",
    "- The Orchestrator README defines coordination contracts rather than a second workflow engine.",
    "- Every dispatch target is a declared dynamic agent ID.",
    "- After a workflow is selected, every declared node is mandatory and executes once for the Task; independent nodes may run concurrently.",
    "- Every virtual workflow node references a declared dynamic agent ID.",
    '- A composed delivery has one fixed-profile Mission-owned Task per squad stage and local Delivery Slice contracts inside that Task; its static SDK collaboration definition references exact squad/workflow/evidence/repair identities and declares `stage_execution: "mission_task"`.',
    "- Virtual workflows contain only agent, description, and dependency facts; they never contain dispatch scope, active/default/status/auto-advance fields.",
    "- Every package resource has one explicit projection owner.",
    "- Every projected Agent uses the platform Artifact catalog for durable inter-Agent evidence; no prompt requires an upstream worker, message, dispatch result, or private package tool to transport an Artifact inventory, locator, or body.",
    "- The package is self-contained: every runtime input is a projected Skill file, a statically imported package asset, an explicit Task input, or a declared external service.",
    "- Multiple agents sharing a template remain isolated by agent ID and resource path.",
    "- No alias, name guessing, hidden routing, fallback, or second active squad field exists.",
    "",
  ].join("\n")
}

function schedulerToolIDs(): string[] {
  return [
    "capability_search",
    "skill",
    "question",
    "read_context",
    "dispatch_agent",
    "manage_task",
    "wait",
    "browser_preview",
    "bash",
    "respond_agent_coordination",
    "cancel_subagent",
  ]
}

function emptyProjectionResources() {
  return {
    built_in_tool_ids: [] as string[],
    default_skill_refs: [] as string[],
    package_skill_refs: [] as string[],
    default_tool_refs: [] as string[],
    package_tool_refs: [] as string[],
    default_mcp_server_refs: [] as string[],
    package_mcp_server_refs: [] as string[],
    default_mcp_tool_refs: [] as string[],
    package_mcp_tool_refs: [] as string[],
    default_mcp_prompt_refs: [] as string[],
    package_mcp_prompt_refs: [] as string[],
    default_mcp_resource_refs: [] as string[],
    package_mcp_resource_refs: [] as string[],
  }
}

function renderManifest(): ExpertSquadManifestV1 {
  const agents = Object.fromEntries(
    PORTABLE_TEMPLATE_AGENTS.map((agent) => [
      agent.agentID,
      {
        label: agent.label,
        description: agent.description,
        base_role: agent.baseRole,
        ...(agent.executionContract ? { execution_contract: agent.executionContract } : {}),
        prompt: `agents/${agent.agentID}/system.md`,
        inherit_base_tools: true,
        ...emptyProjectionResources(),
      },
    ]),
  )
  return {
    schema_version: 1,
    namespace: PORTABLE_TEMPLATE_NAMESPACE,
    id: PORTABLE_TEMPLATE_ID,
    name: "Portable Expert Squad Template",
    label: "Portable Expert Squad Template",
    description: "Concrete invoice-ledger reconciliation sample for authoring portable OpenCorvus expert squads.",
    version: "2026.08.21.2",
    product_pillars: ["code", "work"],
    readme: "README.md",
    selector: {
      summary:
        "Invoice ledger reconciliation authoring sample. Use only after copying, renaming, and specializing the package.",
      selection_guidance:
        "After specializing this sample, select its manifest id only for ledger-to-settlement reconciliation that requires source-row evidence.",
      instructions: "selector.md",
    },
    capability_projection: {
      scheduler: {
        base_role: "orchestrator",
        prompt: "agents/orchestrator/system.md",
        inherit_base_tools: false,
        ...emptyProjectionResources(),
        built_in_tool_ids: schedulerToolIDs(),
        package_tool_refs: ["portable-template/shared/reconciliation-policy"],
      },
      agents,
      virtual_workflows: {
        delivery: {
          label: "Invoice Ledger Reconciliation Delivery",
          description:
            "Evidence-guided invoice ledger reconciliation from source investigation through delivery and independent review.",
          nodes: Object.fromEntries(
            PORTABLE_TEMPLATE_AGENTS.map((agent) => [
              agent.agentID,
              {
                agent_id: agent.agentID,
                description: agent.description,
                depends_on: [...agent.dependsOn],
              },
            ]),
          ),
        },
      },
    },
  }
}

function renderPackageReadme(): string {
  return [
    "# Invoice Ledger Reconciliation Runtime Prompt",
    "",
    "This README is appended to the Orchestrator prompt only when this expert squad is active.",
    "",
    "All projected Agents inherit the platform fact/Turn contract. Domain tools record durable facts without acting as submit/finalizer calls; normal stream end remains a physical Turn observation; and the visible final assistant message is natural narration of work, limitations, and blockers rather than durable evidence transport. Git changes, command/test exits, process facts, and attachment consumption remain Host observations. Execution attempts and dispatch lineage are immutable physical evidence identities. Delivery Slice revision IDs are optional work and evidence subjects, never lifecycle or scheduling owners. The Orchestrator owns Task lifecycle judgment. Each completion atomically appends one typed decision artifact with the exact message/tool identity, typed EvidenceLocators, every intentionally delivered Artifact locator, every accepted current Delivery Slice revision ID, the exact selected workflow ID (`null` only for direct dispatch), and the active package revision scope, project identity, namespace, manifest ID, version, and package digest. Empty deliverable or Delivery Slice lists are valid only when the Task truthfully has none. Reopen preserves earlier decisions without an active/current pointer or acceptance aggregate; only the decision written at the Task's current terminal completion time governs current progress and workflow binding.",
    "",
    "The model-facing file protocol uses `artifact_snapshot` to publish current-Task project files and return one exact content-addressed `resource_set` locator. `artifact_publish` accepts the complete evidence value only as strict JSON text in `payload_json`; object keys must be unique, `resource_set` is required (`null` when there are no files, otherwise the exact locator returned by `artifact_snapshot`), and `source_artifact_locators` is required (`[]` when there are no semantic Artifact sources). The Host validates every source against complete reads earlier in the same physical Turn, verifies and expands the immutable manifest inside its trusted boundary, and publishes the structured value through the same canonical service used by typed and package tools.",
    "",
    "A TypeScript package tool publishes an Engine Artifact through `context.host.engineArtifacts.publish`, not the model-facing `artifact_publish` tool. Its call declares stable type/schema/label values, structured payload, explicit resources and source locators, and its returned string is only a compact receipt. A package tool publishes immutable Task Artifact files through `context.host.taskArtifacts.stage(...)` followed by `context.host.taskArtifacts.publish(...)` and returns the typed snapshot locator. A plain package-tool return never creates an Artifact.",
    "",
    "Every scheduler and worker uses the Core Task Artifact catalog through `artifact_search`, `artifact_read`, and `artifact_select`; projected workers additionally receive `artifact_snapshot` and `artifact_publish`, while schedulers do not. Use queryless search to enumerate durable same-Task evidence by immutable producer/type/workflow/node provenance, read exact locators to completion, and call `artifact_select` for each semantic source of a typed output. Reads remain observed even when unselected; zero selections are valid. A worker without a typed domain-output producer calls `artifact_publish` with a canonical JSON `expert_output` type under `<active-squad-id>/...` and publication-specific `source_artifact_locators` drawn from earlier complete reads; the Host supplies Task, Session, Agent, active-Squad, projection, observed, and selected provenance. Typed domain-output and package tools remain their domain's sole publishers. Never ask an upstream Agent, message, or dispatch result to transport an Artifact inventory, locator, or body. A user-pinned locator must not be silently replaced by another search result. For Cross-Task evidence, Mission references a completed source with `{authority: \"completion_decision\", source_task_id}` in `artifact_sources`; the Host imports that decision's complete deliverable set without copied locator IDs. Failed/cancelled recovery uses `{authority: \"terminal_lifecycle\", source_task_id, locator}`. The receiving catalog exposes target-owned imported Engine Artifacts preserving source type, schema, payload, and copied resources, with immutable `import_lineage`. Missing optional fields and zero matches are valid; missing selected evidence, wrong Task/path/digest, corrupt bytes, and unreadable text are explicit blockers.",
    "",
    "Coordinate only work that reconciles application invoices, payment-provider settlements, refunds, approved adjustments, and monthly-close evidence. Reject general bookkeeping advice or any task that lacks source records.",
    "",
    "Require authoritative inputs, approved reconciliation rules, separate primary-comparison and exception-remediation ownership, and independent source-evidence review. Finish only with matched totals, unmatched records, source-row references, and unresolved exceptions.",
    "",
    "Package tools, skills, and Model Context Protocol providers must be explicitly projected. Inactive packages are never searched for missing behavior.",
    "",
  ].join("\n")
}

function renderSelector(): string {
  return [
    "# Select The Invoice Ledger Reconciliation Squad",
    "",
    "Select the renamed and specialized package when the task compares invoice, settlement, refund, fee, or adjustment records and requires an evidence-backed close report.",
    "",
    "Do not select it for general accounting advice, unrelated software work, or any task without source records.",
    "",
    "Mission creates a new Task with this manifest `id` as the exact `promptProfile`. Labels, folder names, archive names, skill names, and projected worker names are not expert-squad IDs.",
    "",
  ].join("\n")
}

function renderOrchestratorPrompt(): string {
  return [
    "# Invoice Ledger Reconciliation Orchestrator Overlay",
    "",
    "Read the active package README and projected workflow guidance before dispatch.",
    "",
    "Confirm source files, period, currency, authoritative keys, tolerance, and adjustment policy before implementation.",
    "",
    `At the start of a fresh run and every resume, first search the complete current catalog for exact type \`${PORTABLE_TEMPLATE_RECONCILIATION_POLICY_ARTIFACT_TYPE}\` and exact label \`${PORTABLE_TEMPLATE_RECONCILIATION_POLICY_ARTIFACT_LABEL}\`. If exactly one authority exists, completely read and select it and do not invoke the package publisher. If the complete healthy catalog has zero matches, invoke the projected package tool ref \`${PORTABLE_TEMPLATE_ID}/shared/reconciliation-policy\` exactly once, then search again, completely read the unique exact locator, and select it before dispatch. Never treat the publisher's compact receipt as the policy body. Multiple exact matches, an incomplete catalog, or provider errors are explicit blockers; do not publish another copy to hide them.`,
    "",
    "Before implementation dispatch, require the planning chain to inventory every Task element: target identity, authoritative source and recency, required positive effect, negative or preservation guard, exact value/format/routing obligation, and final-state evidence. Require stable individually falsifiable Requirement and Slice-local acceptance criteria with an eligible acceptance owner; unresolved material elements remain explicit coverage, never a broad 'verify policy' placeholder.",
    "",
    "Before every dispatch, compare the required operation with the exact current projected Agent and Tool inventory. Name the required command, Skill, package Tool, Model Context Protocol capability, browser action, or read surface and dispatch only an Agent whose projection exposes it. A role label, a future worker report, or copied evidence never substitutes for physical capability. Treat a missing fact as discovery work owned by a capable Agent; call it a blocker only when current evidence proves missing authority, unsafe irreversible ambiguity, or that no projected capability and no supported interface representation can express a required effect.",
    "",
    "When dispatching `close-integrity-reviewer`, `discrepancy-fact-checker`, or any replacement acceptance identity in a derived package, identify the exact canonical RequirementSet and planning/acceptance Artifacts in the current Task catalog. Require the acceptance Agent to completely read and select those sources and report every owned criterion as passed, failed, or unresolved against current authoritative evidence. Do not copy a second criterion list into dispatch prose or reduce scope to the builders' account of what they changed.",
    "",
    "Keep final acceptance tied to matched totals, unmatched records, source-row references, and unresolved exceptions.",
    "",
    "`primary-reconciliation-builder` and `exception-remediation-builder` are domain implementation identities, not the platform repair fallback. Dispatch them only for their declared reconciliation pipeline or exception-remediation outputs. Concrete repository repair outside those domain contracts belongs to the scheduler-only `universal-build` capability, which is intentionally absent from this package manifest and its workflow graphs.",
    "",
  ].join("\n")
}

function renderReconciliationPolicyTool(): string {
  return [
    'import { tool } from "@opencorvus-ai/plugin"',
    'import policy from "../assets/reconciliation-policy.json" with { type: "text" }',
    "",
    `const ARTIFACT_TYPE = ${JSON.stringify(PORTABLE_TEMPLATE_RECONCILIATION_POLICY_ARTIFACT_TYPE)}`,
    `const ARTIFACT_SCHEMA_VERSION = ${PORTABLE_TEMPLATE_RECONCILIATION_POLICY_SCHEMA_VERSION}`,
    `const ARTIFACT_LABEL = ${JSON.stringify(PORTABLE_TEMPLATE_RECONCILIATION_POLICY_ARTIFACT_LABEL)}`,
    "",
    "export default tool({",
    '  description: "Publish the immutable reconciliation policy compiled into this self-contained package.",',
    "  args: {},",
    "  async execute(_args, context) {",
    "    const publication = await context.host.engineArtifacts.publish({",
    "      artifact_type: ARTIFACT_TYPE,",
    "      schema_version: ARTIFACT_SCHEMA_VERSION,",
    "      label: ARTIFACT_LABEL,",
    "      payload: JSON.parse(policy),",
    "      resources: [],",
    "      source_artifact_locators: [],",
    "    })",
    "    context.metadata({",
    "      title: ARTIFACT_LABEL,",
    "      metadata: { artifact_type: ARTIFACT_TYPE, artifact_sha256: publication.sha256 },",
    "    })",
    "    return JSON.stringify({ locator: publication.locator, sha256: publication.sha256 })",
    "  },",
    "})",
    "",
  ].join("\n")
}

function renderAuthoringSkill(): string {
  return readFileSync(
    path.resolve(import.meta.dir, "../../../expert-squads/builtin/squad-sdk/skills/authoring/SKILL.md"),
    "utf8",
  ).replace(/\r\n?/g, "\n")
}

function renderAuthoringQualityMethod(): string {
  return readFileSync(
    path.resolve(
      import.meta.dir,
      "../../../expert-squads/builtin/squad-sdk/skills/authoring/references/authoring-quality-method.md",
    ),
    "utf8",
  ).replace(/\r\n?/g, "\n")
}

function renderAuthoringContract(): string {
  return readFileSync(
    path.resolve(
      import.meta.dir,
      "../../../expert-squads/builtin/squad-sdk/skills/authoring/references/definition-contract.json",
    ),
    "utf8",
  ).replace(/\r\n?/g, "\n")
}

function renderAgentPrompt(agent: PortableTemplateAgentDefinition): string {
  return [
    `# ${agent.label}`,
    "",
    `Concrete responsibility: ${agent.focus}.`,
    "",
    ...(agent.agentID === "reconciliation-architect"
      ? [
          "Discover the RequirementSet in the same-Task catalog by immutable producer/type provenance, then read its exact locator through `artifact_read`. If a user explicitly pins a locator, read that locator exactly and do not substitute a search result. Do not request or trust a copied requirement body or a locator string from another Agent.",
          "",
        ]
      : []),
    ...(agent.agentID === "ledger-requirements"
      ? [
          `Before defining requirements, search the complete current catalog for exact type \`${PORTABLE_TEMPLATE_RECONCILIATION_POLICY_ARTIFACT_TYPE}\` and exact label \`${PORTABLE_TEMPLATE_RECONCILIATION_POLICY_ARTIFACT_LABEL}\`. Require one unique authority, completely read its exact locator with \`artifact_read\`, and call \`artifact_select\` before using it. This Agent does not own the scheduler-projected publisher and must not ask for a copied policy body or infer one from a package-tool receipt. Zero or multiple matches, incomplete catalog results, and provider errors are explicit blockers.`,
          "",
        ]
      : []),
    "Keep every conclusion tied to invoice, settlement, refund, adjustment, or close-report evidence. Stop and report missing evidence instead of inventing a correction or taking over another responsibility.",
    "",
    ...(agent.baseRole === "build"
      ? [
          "Run exactly once for the Task. Reproduce each concrete defect already established by the accepted input evidence, repair its root cause, rerun the affected checks, and leave the independent verdict to the later responsible reviewer. Findings published after this node remain terminal Task evidence; do not redispatch this workflow node. A new Task is required when the selected workflow must run again.",
          "",
        ]
      : []),
  ].join("\n")
}

export function renderPortableExpertSquadTemplateFiles(): Record<string, string> {
  const definition = portablePackageDefinition()
  return {
    "README.md": renderHumanTutorial(),
    [PORTABLE_TEMPLATE_AUTHORING_SKILL_PATH]: renderAuthoringSkill(),
    [PORTABLE_TEMPLATE_AUTHORING_QUALITY_METHOD_PATH]: renderAuthoringQualityMethod(),
    [PORTABLE_TEMPLATE_AUTHORING_CONTRACT_PATH]: renderAuthoringContract(),
    ...Object.fromEntries(
      Object.entries(renderExpertSquadPackageFiles(definition)).map(([file, content]) => {
        if (typeof content !== "string") throw new Error(`Portable template generated unexpected binary file ${file}`)
        return [`package/${file}`, content]
      }),
    ),
  }
}

function portablePackageDefinition(): ExpertSquadPackageDefinition {
  return {
    manifest: renderManifest(),
    files: {
      "README.md": renderPackageReadme(),
      "selector.md": renderSelector(),
      "agents/orchestrator/system.md": renderOrchestratorPrompt(),
      [expertSquadAssetPath("reconciliation-policy.json")]:
        `${JSON.stringify({ currency: "USD", tolerance: "0.01" }, null, 2)}\n`,
      "tools/reconciliation-policy.ts": renderReconciliationPolicyTool(),
      ...Object.fromEntries(
        PORTABLE_TEMPLATE_AGENTS.map((agent) => [`agents/${agent.agentID}/system.md`, renderAgentPrompt(agent)]),
      ),
    },
  }
}

export async function generatePortableExpertSquadTemplate(repoRoot: string): Promise<string> {
  const root = resolvePortableExpertSquadTemplateRoot(repoRoot)
  const files = renderPortableExpertSquadTemplateFiles()

  // This root is generator-owned. Recreate it exactly so removed schema eras
  // cannot survive as stale manifests, prompts, files, or empty directories.
  await fs.rm(root, { recursive: true, force: true })
  for (const [relativePath, content] of Object.entries(files).filter(([file]) => !file.startsWith("package/"))) {
    const file = path.join(root, ...relativePath.split("/"))
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, content)
  }
  await writeExpertSquadPackage({
    directory: resolvePortableExpertSquadTemplatePackageRoot(repoRoot),
    definition: portablePackageDefinition(),
  })
  return root
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
  const root = await generatePortableExpertSquadTemplate(repoRoot)
  console.log(`Generated ${path.relative(repoRoot, root).replaceAll(path.sep, "/")}`)
}

if (import.meta.main) {
  await main()
}
