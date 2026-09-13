import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { HostAgentRegistry } from "../../src/agent/host-agent-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { Config } from "../../src/config/config"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { Instance } from "../../src/project/instance"
import { SkillManager } from "../../src/skill/manager"
import { SkillMount } from "../../src/skill/mounts"
import { memoryProject } from "../fixture/memory"
import { agentCapabilityGrants, schedulerCapabilityGrants } from "./capability-grant-fixture"

const advancedPackageRoot = path.resolve(import.meta.dir, "../../src/expert-squad/builtin/advanced")
const basePackageRoot = path.resolve(import.meta.dir, "../../src/expert-squad/builtin/base")

function workflowNodes(loaded: Awaited<ReturnType<typeof ExpertSquadRegistry.loadSourcePackage>>, workflowID: string) {
  return Object.fromEntries(
    Object.entries(loaded.manifest.capability_projection.virtual_workflows[workflowID]!.nodes).map(([nodeID, node]) => [
      nodeID,
      node.depends_on,
    ]),
  )
}

describe("built-in interface review workflow authority", () => {
  test("projects autonomous greenfield and explicit independent-visual Advanced workflows", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(advancedPackageRoot)

    expect(loaded.manifest.version).toBe("2026.09.12.1")
    expect(schedulerCapabilityGrants(loaded.manifest).defaultSkillRefs).toEqual(["default/skill/grill-me"])
    expect(agentCapabilityGrants(loaded.manifest, "requirement-engineer").defaultSkillRefs).toEqual([
      "default/skill/grill-me",
    ])
    expect(loaded.promptProfile.agents["requirement-engineer"]).toContain(
      "Load and use the mounted `grill-me` Skill as the preferred requirements-discovery method",
    )
    expect(workflowNodes(loaded, "planned-delivery")).toEqual({
      "request-interpreter": [],
      "requirement-engineer": [],
      "source-investigator": [],
      "solution-architect": ["request-interpreter", "requirement-engineer", "source-investigator"],
      "workload-reviewer": ["solution-architect"],
      "implementation-engineer": ["solution-architect"],
      "test-engineer": ["implementation-engineer"],
      "system-integrity-reviewer": ["implementation-engineer", "test-engineer", "workload-reviewer"],
    })
    expect(workflowNodes(loaded, "researched-planned-delivery")).toEqual({
      "request-interpreter": [],
      "source-investigator": [],
      "research-investigator": [],
      "requirement-engineer": ["request-interpreter", "research-investigator", "source-investigator"],
      "solution-architect": ["requirement-engineer"],
      "workload-reviewer": ["solution-architect"],
      "implementation-engineer": ["solution-architect"],
      "test-engineer": ["implementation-engineer"],
      "system-integrity-reviewer": ["implementation-engineer", "test-engineer", "workload-reviewer"],
    })
    expect(workflowNodes(loaded, "greenfield-interface-delivery")).toEqual({
      "request-interpreter": [],
      "requirement-engineer": [],
      "source-investigator": [],
      "solution-architect": ["request-interpreter", "requirement-engineer", "source-investigator"],
      "interface-designer": ["solution-architect"],
      "workload-reviewer": ["solution-architect"],
      "implementation-engineer": ["interface-designer"],
      "test-engineer": ["implementation-engineer"],
      "interface-integrity-reviewer": ["implementation-engineer"],
      "system-integrity-reviewer": ["implementation-engineer", "test-engineer", "workload-reviewer"],
    })
    expect(workflowNodes(loaded, "greenfield-interface-visual-delivery")).toEqual({
      "request-interpreter": [],
      "requirement-engineer": [],
      "source-investigator": [],
      "solution-architect": ["request-interpreter", "requirement-engineer", "source-investigator"],
      "interface-designer": ["solution-architect"],
      "workload-reviewer": ["solution-architect"],
      "implementation-engineer": ["interface-designer"],
      "test-engineer": ["implementation-engineer"],
      "visual-reviewer": ["implementation-engineer"],
      "interface-integrity-reviewer": ["implementation-engineer"],
      "system-integrity-reviewer": ["implementation-engineer", "test-engineer", "workload-reviewer"],
    })
    expect(workflowNodes(loaded, "reference-interface-delivery")).toMatchObject({
      "interface-investigator": [],
      "visual-reviewer": ["implementation-engineer"],
      "interface-integrity-reviewer": ["implementation-engineer"],
    })
    expect(loaded.promptProfile.agents["implementation-engineer"]).toContain(
      "open and personally inspect the real rendered page and applicable interaction states",
    )
    // Verifying only what the implementation reported acting on turned a partial AutomationBench
    // delivery into a PASS verdict; scope comes from the request instead.
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "acceptance authority from the original request and current raw authorities",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "Before searching for, reading, or selecting any RequirementSet, Architect spec, implementation report, or prior verdict",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain("bidirectional traceability")
    expect(loaded.promptProfile.agents["system-integrity-reviewer"]).toContain(
      "treat both the inventory and verdict as claims to challenge",
    )
    expect(loaded.manifest.capability_projection.agents["source-investigator"]).toMatchObject({
      base_role: "delegated-worker",
      description:
        "Performs read-only repository and projected-client authority investigation and records source-grounded evidence.",
    })
    expect(agentCapabilityGrants(loaded.manifest, "source-investigator").explicitBuiltInToolIDs).toEqual([
      "bash",
      "glob",
      "read",
      "search_code",
      "skill",
    ])
    expect(loaded.promptProfile.agents["source-investigator"]).toContain(
      "use its executable surface only for read/list/get/search operations",
    )
    expect(loaded.promptProfile.agents["orchestrator"]).toContain(
      "requested outcome is a change to an external system of record",
    )
    expect(loaded.promptProfile.agents["orchestrator"]).toContain(
      "Do not dispatch platform `universal-build` directly for that work",
    )
    expect(loaded.selectorInstructions).toContain(
      "Select `researched-planned-delivery` when one coherent load-bearing external web-evidence gap",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "derive the obligations yourself, including the ones no implementation Artifact mentions",
    )
    expect(loaded.promptProfile.agents["requirement-engineer"]).toContain("complete Task-element analysis")
    expect(loaded.promptProfile.agents["solution-architect"]).toContain(
      "individually falsifiable Slice-local acceptance specs",
    )
    expect(loaded.promptProfile.agents["orchestrator"]).toContain(
      "exact current RequirementSet and Architect/Delivery Slice acceptance-spec Artifacts",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain("criterion-by-criterion coverage")
    expect(loaded.promptProfile.agents["system-integrity-reviewer"]).toContain("record passed, failed, or unresolved")
    expect(loaded.promptProfile.agents["orchestrator"]).toContain(
      "compare the required operation with the current projected Agent and Tool inventory",
    )
    expect(loaded.promptProfile.agents["requirement-engineer"]).toContain(
      "A missing fact is discovery work, not automatically a rejection condition",
    )
    expect(loaded.promptProfile.agents["requirement-engineer"]).toContain("finite authority-candidate ledger")
    expect(loaded.promptProfile.agents["solution-architect"]).toContain("authority-field effect ledger")
    expect(loaded.promptProfile.agents["implementation-engineer"]).toContain(
      "Missing a dedicated field never authorizes a different surrogate mutation",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "independently rebuild the finite authority-candidate ledger",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "omitted effects, extra or surrogate mutations, wrong identities, stale precedence",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "When the dynamic business-entity trigger applies, additionally report authority-ledger closure",
    )
    expect(loaded.promptProfile.agents["system-integrity-reviewer"]).toContain(
      "Require row-for-row coverage of every material source field/value, in-scope entity",
    )
    expect(loaded.promptProfile.agents["requirement-engineer"]).toContain(
      "When a dynamic current process, policy, template, backlog, or history decides actions for a set of business entities",
    )
    expect(loaded.promptProfile.agents["solution-architect"]).toContain(
      "Ordinary repository/software delivery retains its normal Requirement and Slice-local acceptance contract",
    )
    expect(loaded.promptProfile.agents["system-integrity-reviewer"]).toContain(
      "immutable `advanced/acceptance-inventory` and current `advanced/test-report`",
    )
    expect(loaded.promptProfile.agents["source-investigator"]).toContain(
      "A keyword-filtered empty record read proves only that filter",
    )
    expect(loaded.promptProfile.agents["implementation-engineer"]).toContain("authority-field effect ledger")
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "Publish that frozen baseline first as one `advanced/acceptance-inventory` Artifact",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "Include the independent authority-field effect ledger only when the dynamic business-entity trigger applies",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "First find that exact acceptance inventory through `artifact_search`, completely read it through `artifact_read`, and select it through `artifact_select` in the current physical Turn",
    )
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "current-Turn `artifact_read_ref` for the acceptance inventory and every semantically used RequirementSet, Architect, implementation, and prior test-owned Artifact in `source_read_refs`",
    )
  })

  test("projects workflow execution followed by independent verification and a separate research graph", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(basePackageRoot)
    expect(loaded.manifest.version).toBe("2026.09.13.49")
    expect(loaded.promptProfile.agents.orchestrator).toContain("workflow_subject.kind=virtual_workflow")
    expect(loaded.promptProfile.agents.orchestrator).toContain("read_agent_message")
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "must not add a durable report, evidence package, or coordination Artifact",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "The source-planned workflow's declared `base/implementation-plan` is its only planning Artifact",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Do not search, read, or select that plan in the Orchestrator",
    )
    expect(loaded.selectorInstructions).toContain("Select `source-planned-execution-verification`")
    expect(loaded.selectorInstructions).toContain(
      "when an irreversible external mutation depends on a material current business record",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "dispatch Planner to close only those read-only source prerequisites before any mutation",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "own only the read-only dynamic business-source prerequisites",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "Map closed obligations to exact source record IDs",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "Destination identity, capability, targeting, representation, mutation, and readback stay with Developer",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain("first authoritative record that resolves a fact closes it")
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "Admit a later anchor only when an authoritative record identifies it as the requested entity's ID",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "do not claim the fact or source is absent or hand it to Developer",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "preserve exact empty or typed-unavailable checked scope",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "one focused query naming all known source services and actions",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "record `mutation_preconditions` per independent mutation from the original request",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain("`Mutation preconditions:`")
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "assign it to Developer instead of adding a source blocker",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "current operational record stating concrete rules for the requested action is a guideline source regardless of title",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "as coverage labels, not separate source facts",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "never close them while retaining a duplicate residual category blocker",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "explicitly attributed `Original user input` or complete `SYSTEM`/`USER` business block",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "A first call-shape, argument-validation, or contract `TypeError` leaves the route incomplete",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "blocks the synonymous abstract category is such a proven misclassification",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Continue the same Planner once for that exact correction while other closed operations proceed",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "the operator-authored request inside the original Task input is the complete delivery and acceptance subject",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Agent-authored delegation may refine only from that intent, current authority, an applicable public contract",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "make one contract-correct read instead of replaying it",
    )
    expect(
      loaded.manifest.capability_projection.virtual_workflows["source-planned-execution-verification"]?.nodes[
        "base-planner"
      ]?.description,
    ).toContain("invalid call shapes and untried simpler queries leave it incomplete")
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "do not search for a Skill whose exact name is already visible",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "selected workflow node explicitly declares that exact Artifact type",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain("`Verification coordinates:` line")
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Treat a current authoritative operational record with concrete rules",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "A final-state rule is verified by comparing its source with the final state",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "a later empty or noisy title search does not invalidate positive evidence already read",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Query each material source obligation independently",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "If an empty query combined optional business terms, remove those co-filters on the next read",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "When an exact destination identity filter is sufficient",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "State each material source record already bound to an original obligation",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "do not perform endpoint-directory or capability discovery before trying it",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "put that literal value in the visible post, message, or content body",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "the loaded client contract supports structured batching",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "use one combined endpoint-contract discovery for independent missing capabilities",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "makes the source precondition blocked; report that exact change instead of starting broad source discovery",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Execute only each independent mutation whose own `mutation_preconditions` entry is `closed`",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "without attempting that mutation or repeating the Planner's source discovery",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "do not stop merely because the create interface has no separate targeting field",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Preserve every successful external mutation's exact Tool receipt",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain("do not copy the full response body")
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "do not search for a Skill whose exact name is already visible",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain("Return one concise visible final message")
    expect(loaded.promptProfile.agents["base-tester"]).toContain("exact method, URL, and parameter shape")
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "Do not repeat endpoint discovery for a complete current coordinate",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "Treat every empty query recorded in the plan as one failed fact-endpoint-anchor attempt",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Dispatch Developer only for the independent mutations whose visible `Mutation preconditions:` entries are `closed`",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "the original request or already observed authority proves the plan misclassified a destination fact",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "first complete and independently verify every closed operation",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "ignore incidental related entities",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "does not require a second product projection for every satisfied fact",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "the loaded client contract supports structured batching",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain("process, approval, or historical rules")
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "the original request and corresponding source surface",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "if an empty anchor is a full title or phrase, reduce it once",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "When an exact destination identity filter is sufficient",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "do not invent a structured targeting control for an organic content action",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "selected workflow node explicitly declares that exact Artifact type",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "completely read the canonical `base/implementation-plan` as source coordinates",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "verify that value in the visible post, message, or content body",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "A hidden metadata value alone is insufficient",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "judge destination identity, capability, and representation through the actual destination interface",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "absence of a separate targeting field is not a failure",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "A Host-recorded successful mutation Tool output",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "or definite later mutation, operation-outcome, or rollback evidence",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "only when the API contract defines that successful response as a synchronous commit",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Never ask a worker to repeat a successful irreversible create",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Before the first worker dispatch, do not search for, load, or inspect that Skill merely to confirm its name",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "when conflicting evidence leaves one material coordination or acceptance question",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain("copy them verbatim into the Tester brief")
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "tell Tester to completely read that same plan as source coordinates",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "the Planner brief may assign only source-side business facts",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "A missing optional structured destination field is not a missing source fact",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "use `evidence_reads` to retrieve the complete non-secret output before dispatching Tester",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "A full successful mutation receipt is authoritative operation evidence",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "or definite later mutation, operation-outcome, or rollback evidence",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain("causal Tool Message and Part identities")
    expect(loaded.promptProfile.agents.orchestrator).toContain("`evidence_reads`")
    expect(loaded.promptProfile.agents.orchestrator).toContain("`inventory_next_before`")
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "does not require the same page cursor again",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "do not label that combined shape the uniquely required readback",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain("may prove a final-state obligation")
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "present the original criteria neutrally and supply positive executor observations only as coordinates",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "the Tester independently judges every material negative claim",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "do not search the Artifact catalog for a report that the workflow did not create",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Do not continue Tester against the same exhausted read surface",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain(
      "Complete only when every original obligation is satisfied",
    )
    expect(loaded.promptProfile.agents.orchestrator).toContain("call the real `fail_task` decision")
    expect(workflowNodes(loaded, "execution-verification")).toEqual({
      "base-developer": [],
      "base-tester": ["base-developer"],
    })
    expect(workflowNodes(loaded, "source-planned-execution-verification")).toEqual({
      "base-planner": [],
      "base-developer": ["base-planner"],
      "base-tester": ["base-developer"],
    })
    expect(workflowNodes(loaded, "planner-parallel-delivery")).toEqual({
      "base-planner": [],
      "base-researcher": ["base-planner"],
      "base-developer": ["base-planner"],
      "base-tester": ["base-developer"],
    })
    expect(loaded.manifest.capability_projection.agents["base-planner"]).toMatchObject({
      base_role: "delegated-worker",
      description:
        "Resolves only pre-mutation dynamic source prerequisites, excluding destination identity, capability, representation, and readback, or allocates a justified parallel research and implementation partition.",
    })
    expect(
      loaded.manifest.capability_projection.virtual_workflows["source-planned-execution-verification"]?.nodes[
        "base-planner"
      ]?.description,
    ).toContain("destination identity, capability, representation, and readback remain Developer work")
    expect(
      loaded.manifest.capability_projection.virtual_workflows["source-planned-execution-verification"]?.nodes[
        "base-developer"
      ]?.description,
    ).toContain("complete Host-recorded receipt")
    expect(
      loaded.manifest.capability_projection.virtual_workflows["source-planned-execution-verification"]?.nodes[
        "base-tester"
      ]?.description,
    ).toContain("raw mutation receipt")
    expect(agentCapabilityGrants(loaded.manifest, "base-planner").explicitBuiltInToolIDs).toEqual([
      "bash",
      "capability_search",
      "external_code_search",
      "glob",
      "read",
      "search_code",
      "skill",
      "webfetch",
      "websearch",
    ])
  })

  test("resolves the exact Base Planner publication and read surface", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({
          prompt_profile: { active: "base" },
          mcp: { browser: BrowserMCPBuiltin.localConfig() },
        })
        const projection = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config,
          agentID: "base-planner",
        })
        expect([...projection.workerCapability.builtInToolIDs].sort()).toEqual([
          "artifact_publish",
          "artifact_read",
          "artifact_search",
          "artifact_select",
          "artifact_snapshot",
          "bash",
          "capability_search",
          "external_code_search",
          "glob",
          "publish_interactive_artifact",
          "read",
          "search_code",
          "skill",
          "webfetch",
          "websearch",
        ])
      },
    })
  })

  test("resolves grill-me on the exact Advanced Requirement Engineer turn surface", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({
          prompt_profile: { active: "advanced" },
          mcp: { browser: BrowserMCPBuiltin.localConfig() },
        })
        const turn = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config,
          agentID: "requirement-engineer",
        })
        const worker = turn.workerCapability
        const surface = await SkillMount.resolve({
          identity: { ...worker.identity, expertSquadID: worker.expertSquadID },
          runtime: worker.runtime,
          scope: "session",
          projectDirectory: project.path,
          skillProjection: turn.skillProjection,
          availableToolNames: worker.builtInToolIDs,
        })

        expect(worker.productionSkills.map((skill) => ({ ref: skill.ref, source: skill.source }))).toEqual([
          { ref: "default/skill/grill-me", source: "default" },
          { ref: "advanced/shared/method", source: "package" },
        ])
        expect(surface.skills.map((skill) => ({ name: skill.name, enabled: skill.enabled }))).toEqual([
          { name: "advanced-delivery-method", enabled: true },
          { name: "grill-me", enabled: true },
        ])
      },
    })
  })

  test("mounts an operator Skill onto dispatchable universal-build and serves it on that real turn", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const skillDirectory = path.join(project.path, ".opencorvus", "skill", "turn-visible-probe")
        await fs.mkdir(skillDirectory, { recursive: true })
        await fs.writeFile(
          path.join(skillDirectory, "SKILL.md"),
          [
            "---",
            "name: turn-visible-probe",
            "description: Probe Skill used to prove an operator mount reaches a real projected turn.",
            "---",
            "",
            "# Probe",
            "",
            "Body.",
            "",
          ].join("\n"),
          "utf8",
        )
        await SkillManager.refreshDiscoveryState()

        // The matrix is the operator surface. `universal-build` was absent from it, so it could not
        // be granted a Skill at all — while still being the worker an Advanced Task dispatches
        // directly for bounded implementation.
        const discovered = await SkillMount.matrix({ expertSquadID: "advanced" })
        expect(discovered.agents.find((agent) => agent.agent_id === "universal-build")).toMatchObject({
          base_role: "build",
          capability_owner: "platform",
          skill_mountable: true,
          skill_tool_available: true,
        })
        expect(discovered.agents.filter((agent) => agent.capability_owner === "package").length).toBe(
          discovered.agents.length - 1,
        )

        const mounted = await SkillMount.setOverride({
          scope: "project",
          expertSquadID: "advanced",
          agentID: "universal-build",
          defaultSkillRef: "default/skill/turn-visible-probe",
          override: true,
        })
        expect(
          mounted.matrix
            .find((row) => row.agent_id === "universal-build")!
            .grants.find((grant) => grant.ref === "default/skill/turn-visible-probe"),
        ).toMatchObject({ effective: true, enabled: true, project_override: true })

        // A matrix row is not proof. Resolve the projection the way a dispatched turn does and
        // require the Skill on that worker's own surface.
        // The turn resolves the *active* profile, so the override under `advanced` only applies
        // when `advanced` is the active one — matrix() takes an explicit id, a dispatched turn does not.
        const config = { ...(await Config.get()), prompt_profile: { active: "advanced" } }
        const turn = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config,
          agentID: "universal-build",
        })
        const worker = turn.workerCapability
        const surface = await SkillMount.resolve({
          identity: { ...worker.identity, expertSquadID: worker.expertSquadID },
          runtime: worker.runtime,
          scope: "session",
          projectDirectory: project.path,
          skillProjection: turn.skillProjection,
          availableToolNames: worker.builtInToolIDs,
        })
        expect(surface.skills.map((skill) => ({ name: skill.name, enabled: skill.enabled }))).toEqual([
          { name: "turn-visible-probe", enabled: true },
        ])
      },
    })
  })

  test("mounts an operator Skill onto the real scheduler, Base Planner, and Advanced source investigator surfaces", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const skillDirectory = path.join(project.path, ".opencorvus", "skill", "authority-read-probe")
        await fs.mkdir(skillDirectory, { recursive: true })
        await fs.writeFile(
          path.join(skillDirectory, "SKILL.md"),
          [
            "---",
            "name: authority-read-probe",
            "description: Read-only authority probe for projected scheduler and source turns.",
            "---",
            "",
            "# Authority read probe",
            "",
            "Read current authority before judging delivery.",
            "",
          ].join("\n"),
          "utf8",
        )
        await SkillManager.refreshDiscoveryState()

        const baseDiscovered = await SkillMount.matrix({ expertSquadID: "base" })
        expect(baseDiscovered.agents.find((agent) => agent.agent_id === "orchestrator")).toMatchObject({
          base_role: "orchestrator",
          capability_owner: "package",
          skill_mountable: true,
          skill_tool_available: true,
        })
        expect(baseDiscovered.agents.find((agent) => agent.agent_id === "base-planner")).toMatchObject({
          base_role: "delegated-worker",
          capability_owner: "package",
          skill_mountable: true,
          skill_tool_available: true,
        })
        for (const agentID of ["orchestrator", "base-planner"]) {
          await SkillMount.setOverride({
            scope: "project",
            expertSquadID: "base",
            agentID,
            defaultSkillRef: "default/skill/authority-read-probe",
            override: true,
          })
        }
        const baseConfig = Config.Info.parse({
          ...(await Config.get()),
          prompt_profile: { active: "base" },
          mcp: { browser: BrowserMCPBuiltin.localConfig() },
        })
        const baseSkillProjection = await PromptProfileResolver.resolveSkillProjection({
          projectDirectory: project.path,
          config: baseConfig,
        })
        const baseScheduler = baseSkillProjection.projectedScheduler
        const baseSchedulerSurface = await SkillMount.resolve({
          identity: { ...baseScheduler.identity, expertSquadID: baseSkillProjection.expertSquadID },
          runtime: sessionRuntimeFromNativeAgent(await HostAgentRegistry.get("orchestrator", { config: baseConfig })),
          scope: "session",
          projectDirectory: project.path,
          skillProjection: baseSkillProjection,
          availableToolNames: baseScheduler.builtInToolIDs,
        })
        expect(baseSchedulerSurface.skills).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: "authority-read-probe", enabled: true })]),
        )
        const basePlannerTurn = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config: baseConfig,
          agentID: "base-planner",
        })
        expect(basePlannerTurn.workerCapability.builtInToolIDs).toEqual(expect.arrayContaining(["bash", "skill"]))
        const basePlannerSurface = await SkillMount.resolve({
          identity: {
            ...basePlannerTurn.workerCapability.identity,
            expertSquadID: basePlannerTurn.workerCapability.expertSquadID,
          },
          runtime: basePlannerTurn.workerCapability.runtime,
          scope: "session",
          projectDirectory: project.path,
          skillProjection: basePlannerTurn.skillProjection,
          availableToolNames: basePlannerTurn.workerCapability.builtInToolIDs,
        })
        expect(basePlannerSurface.skills).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: "authority-read-probe", enabled: true })]),
        )
        const explicitlyActivatedBasePlannerSurface = await SkillMount.resolve({
          identity: {
            ...basePlannerTurn.workerCapability.identity,
            expertSquadID: basePlannerTurn.workerCapability.expertSquadID,
          },
          runtime: basePlannerTurn.workerCapability.runtime,
          scope: "session",
          projectDirectory: project.path,
          skillProjection: basePlannerTurn.skillProjection,
          availableToolNames: basePlannerTurn.workerCapability.builtInToolIDs,
          explicitSkillNames: ["base-delivery-method"],
          activeSkillNames: ["authority-read-probe"],
        })
        expect(explicitlyActivatedBasePlannerSurface.skills.map((skill) => skill.name).sort()).toEqual([
          "authority-read-probe",
          "base-delivery-method",
        ])
        await expect(
          SkillMount.resolve({
            identity: {
              ...basePlannerTurn.workerCapability.identity,
              expertSquadID: basePlannerTurn.workerCapability.expertSquadID,
            },
            runtime: basePlannerTurn.workerCapability.runtime,
            scope: "session",
            projectDirectory: project.path,
            skillProjection: basePlannerTurn.skillProjection,
            availableToolNames: basePlannerTurn.workerCapability.builtInToolIDs,
            explicitSkillNames: ["unprojected-skill"],
          }),
        ).rejects.toBeInstanceOf(SkillMount.ExplicitSkillProjectionError)

        const discovered = await SkillMount.matrix({ expertSquadID: "advanced" })
        expect(discovered.agents.find((agent) => agent.agent_id === "orchestrator")).toMatchObject({
          base_role: "orchestrator",
          capability_owner: "package",
          skill_mountable: true,
          skill_tool_available: true,
        })
        expect(discovered.agents.find((agent) => agent.agent_id === "source-investigator")).toMatchObject({
          base_role: "delegated-worker",
          capability_owner: "package",
          skill_mountable: true,
          skill_tool_available: true,
        })

        for (const agentID of ["orchestrator", "source-investigator"]) {
          await SkillMount.setOverride({
            scope: "project",
            expertSquadID: "advanced",
            agentID,
            defaultSkillRef: "default/skill/authority-read-probe",
            override: true,
          })
        }

        const effectiveConfig = Config.Info.parse({
          ...(await Config.get()),
          prompt_profile: { active: "advanced" },
          mcp: { browser: BrowserMCPBuiltin.localConfig() },
        })
        const skillProjection = await PromptProfileResolver.resolveSkillProjection({
          projectDirectory: project.path,
          config: effectiveConfig,
        })
        const scheduler = skillProjection.projectedScheduler
        const schedulerSurface = await SkillMount.resolve({
          identity: { ...scheduler.identity, expertSquadID: skillProjection.expertSquadID },
          runtime: sessionRuntimeFromNativeAgent(
            await HostAgentRegistry.get("orchestrator", { config: effectiveConfig }),
          ),
          scope: "session",
          projectDirectory: project.path,
          skillProjection,
          availableToolNames: scheduler.builtInToolIDs,
        })
        expect(schedulerSurface.skills).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: "authority-read-probe", enabled: true })]),
        )

        const sourceTurn = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config: effectiveConfig,
          agentID: "source-investigator",
        })
        expect(sourceTurn.workerCapability.builtInToolIDs).toEqual([
          "artifact_publish",
          "artifact_read",
          "artifact_search",
          "artifact_select",
          "artifact_snapshot",
          "capability_search",
          "publish_interactive_artifact",
          "bash",
          "glob",
          "read",
          "search_code",
          "skill",
        ])
        const sourceSurface = await SkillMount.resolve({
          identity: {
            ...sourceTurn.workerCapability.identity,
            expertSquadID: sourceTurn.workerCapability.expertSquadID,
          },
          runtime: sourceTurn.workerCapability.runtime,
          scope: "session",
          projectDirectory: project.path,
          skillProjection: sourceTurn.skillProjection,
          availableToolNames: sourceTurn.workerCapability.builtInToolIDs,
        })
        expect(sourceSurface.skills).toEqual(
          expect.arrayContaining([expect.objectContaining({ name: "authority-read-probe", enabled: true })]),
        )
      },
    })
  })
})
