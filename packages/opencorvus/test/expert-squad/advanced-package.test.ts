import { describe, expect, test } from "bun:test"
import path from "node:path"
import { Config } from "../../src/config/config"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { Instance } from "../../src/project/instance"
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

    expect(loaded.manifest.version).toBe("2026.08.20.1")
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
  })

  test("orders Base verification behind implementation while research stays parallel", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(basePackageRoot)

    expect(loaded.manifest.version).toBe("2026.08.20.2")
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
})
