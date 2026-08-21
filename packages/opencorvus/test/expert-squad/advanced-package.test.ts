import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "../../src/config/config"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { Instance } from "../../src/project/instance"
import { SkillManager } from "../../src/skill/manager"
import { SkillMount } from "../../src/skill/mounts"
import { memoryProject } from "../fixture/memory"

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

    expect(loaded.manifest.version).toBe("2026.08.21.1")
    expect(loaded.manifest.capability_projection.scheduler.default_skill_refs).toEqual(["default/skill/grill-me"])
    expect(loaded.manifest.capability_projection.agents["requirement-engineer"]!.default_skill_refs).toEqual([
      "default/skill/grill-me",
    ])
    expect(loaded.promptProfile.agents["requirement-engineer"]).toContain(
      "Load and use the mounted `grill-me` Skill as the preferred requirements-discovery method",
    )
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
      "system-integrity-reviewer": ["implementation-engineer", "workload-reviewer"],
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
      "system-integrity-reviewer": ["implementation-engineer", "workload-reviewer"],
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
      "acceptance scope from the original request and the authoritative sources it names",
    )
    expect(loaded.promptProfile.agents["orchestrator"]).toContain(
      "requested outcome is a change to an external system of record",
    )
    expect(loaded.promptProfile.agents["orchestrator"]).toContain(
      "Do not dispatch platform `universal-build` directly for that work",
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
      "record passed, failed, or unresolved with exact evidence",
    )
    expect(loaded.promptProfile.agents["system-integrity-reviewer"]).toContain(
      "record passed, failed, or unresolved",
    )
  })

  test("orders Base verification behind implementation while research stays parallel", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(basePackageRoot)

    expect(loaded.manifest.version).toBe("2026.08.21.1")
    // Verification cannot race the mutation it checks: an AutomationBench Base trial failed its
    // Task with "No post was created" after the Tester verified a pre-mutation world.
    expect(workflowNodes(loaded, "planner-parallel-delivery")).toEqual({
      "base-planner": [],
      "base-researcher": ["base-planner"],
      "base-developer": ["base-planner"],
      "base-tester": ["base-developer"],
    })
    expect(loaded.selectorInstructions).toContain(
      "Researcher and Developer then become dependency-ready together and consume only the plan; the Tester runs after the Developer's node settles",
    )
    // The parallel frontier stays, but a report published before the mutation owner's latest
    // occurrence can no longer carry the terminal decision.
    expect(loaded.promptProfile.agents["orchestrator"]).toContain("that report is stale for the mutated surface")
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "acceptance scope comes from the original Task request and the authoritative sources it names",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain(
      "read-oriented identity with no shell and no command execution",
    )
    // The new edge is ordering only. If it ever becomes a report handoff, the Tester inherits the
    // Developer's blind spots and the scope fix above is undone.
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "that ordering is not a handoff, and you do not consume the Researcher's or Developer's report as your scope",
    )
    expect(loaded.promptProfile.agents["base-planner"]).toContain("explicit Task-element analysis")
    expect(loaded.promptProfile.agents["orchestrator"]).toContain(
      "complete read/select coverage of every `AC-N`",
    )
    expect(loaded.promptProfile.agents["base-tester"]).toContain(
      "criterion-by-criterion coverage for every planned `AC-N`",
    )
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
})
