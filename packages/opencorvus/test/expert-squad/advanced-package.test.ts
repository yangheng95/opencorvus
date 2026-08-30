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

    expect(loaded.manifest.version).toBe("2026.08.30.2")
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
      description: "Performs read-only repository and projected-client authority investigation and records source-grounded evidence.",
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
    expect(loaded.promptProfile.agents["test-engineer"]).toContain(
      "criterion-by-criterion coverage",
    )
    expect(loaded.promptProfile.agents["system-integrity-reviewer"]).toContain(
      "record passed, failed, or unresolved",
    )
    expect(loaded.promptProfile.agents["orchestrator"]).toContain(
      "compare the required operation with the current projected Agent and Tool inventory",
    )
    expect(loaded.promptProfile.agents["requirement-engineer"]).toContain(
      "A missing fact is discovery work, not automatically a rejection condition",
    )
    expect(loaded.promptProfile.agents["requirement-engineer"]).toContain(
      "finite authority-candidate ledger",
    )
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
      "current-Turn `artifact_selection_ref` for the acceptance inventory and every semantically used RequirementSet, Architect, implementation, and prior test-owned Artifact in `source_selection_refs`",
    )
  })

  test("projects capability-matched Base workflows and the read-only authority Planner surface", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(basePackageRoot)

    expect(loaded.manifest.version).toBe("2026.08.30.1")
    expect(workflowNodes(loaded, "planner-execution-verification")).toEqual({
      "base-planner": [],
      "base-developer": ["base-planner"],
      "base-tester": ["base-developer"],
    })
    // Verification cannot race the mutation it checks: an AutomationBench Base trial failed its
    // Task with "No post was created" after the Tester verified a pre-mutation world.
    expect(workflowNodes(loaded, "planner-parallel-delivery")).toEqual({
      "base-planner": [],
      "base-researcher": ["base-planner"],
      "base-developer": ["base-planner"],
      "base-tester": ["base-developer"],
    })
    expect(loaded.selectorInstructions).toContain(
      "Select `planner-execution-verification` when source discovery, implementation, or verification requires a project Skill",
    )
    // The parallel frontier stays, but a report published before the mutation owner's latest
    // occurrence can no longer carry the terminal decision.
    expect(loaded.promptProfile.agents["orchestrator"]).toContain("that report is stale for the mutated surface")
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "acceptance authority is the original Task request plus current raw authoritative sources",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "Allocate work from the actual projected Tool inventory",
    )
    // The new edge is ordering only. If it ever becomes a report handoff, the Tester inherits the
    // Developer's blind spots and the scope fix above is undone.
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "that ordering is not a handoff, and you do not consume the Researcher's or Developer's report as your scope",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain("explicit Task-element analysis")
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "A missing fact is not itself a blocker",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "finite authority-candidate ledger",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "close the plan's authority-field effect ledger before external-state mutation",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain(
      "Missing a dedicated field never authorizes a different surrogate mutation",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "independently rebuild the finite authority-candidate ledger",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "omitted required effects, extra or surrogate mutations, wrong identities, stale precedence",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "When the dynamic business-entity trigger applies, it additionally records row-for-row comparison of the published independent effect ledger",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "Ordinary repository/software delivery continues to use the existing `AC-N` contract",
    )
    expect(loaded.promptProfile.agents["orchestrator"]).toContain(
      "challenges every `AC-N` and omission against that immutable baseline",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "criterion-by-criterion coverage for every planned `AC-N`",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "Before searching for, reading, or selecting the plan or any worker claim, perform pass one",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain("bidirectional traceability")
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "The plan is an allocation claim, not acceptance authority",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "invoke its local client or shell only for read/list/get/search operations",
    )
    expect(loaded.promptProfile.agents["base-developer"]).toContain("authority-field effect ledger")
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "Publish that frozen baseline first as one `base/acceptance-inventory` Artifact",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "Include the independent authority-field effect ledger only when the dynamic business-entity trigger applies",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "First find that exact acceptance inventory through `artifact_search`, completely read it through `artifact_read`, and select it through `artifact_select` in the current physical Turn",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "current-Turn `artifact_selection_ref` in `source_selection_refs`",
    )
    expect(loaded.manifest.capability_projection.agents["base-planner"]).toMatchObject({
      base_role: "delegated-worker",
    })
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
          runtime: sessionRuntimeFromNativeAgent(
            await HostAgentRegistry.get("orchestrator", { config: baseConfig }),
          ),
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
        expect(basePlannerTurn.workerCapability.builtInToolIDs).toEqual(
          expect.arrayContaining(["bash", "skill"]),
        )
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
