import { describe, expect, test } from "bun:test"
import path from "node:path"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"

const advancedPackageRoot = path.resolve(import.meta.dir, "../../src/expert-squad/builtin/advanced")
const basePackageRoot = path.resolve(import.meta.dir, "../../src/expert-squad/builtin/base")

function workflowNodes(
  loaded: Awaited<ReturnType<typeof ExpertSquadRegistry.loadSourcePackage>>,
  workflowID: string,
) {
  return Object.fromEntries(
    Object.entries(loaded.manifest.capability_projection.virtual_workflows[workflowID]!.nodes).map(
      ([nodeID, node]) => [nodeID, node.depends_on],
    ),
  )
}

describe("built-in interface review workflow authority", () => {
  test("projects autonomous greenfield and explicit independent-visual Advanced workflows", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(advancedPackageRoot)

    expect(loaded.manifest.version).toBe("2026.08.09.1")
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
  })

  test("keeps Base review depth as an explicit workflow choice", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(basePackageRoot)

    expect(loaded.manifest.version).toBe("2026.08.09.1")
    expect(workflowNodes(loaded, "composite-delivery")).toEqual({
      "base-researcher": [],
      "base-planner": ["base-researcher"],
      "base-developer": ["base-planner"],
      "base-tester": ["base-developer"],
    })
    expect(workflowNodes(loaded, "visual-verified-delivery")).toEqual({
      "base-researcher": [],
      "base-planner": ["base-researcher"],
      "base-developer": ["base-planner"],
      "base-tester": ["base-developer"],
      "base-visual-reviewer": ["base-developer"],
      "base-integrity-reviewer": ["base-tester", "base-visual-reviewer"],
    })
    expect(loaded.selectorInstructions).toContain(
      "only when the operator or repository explicitly requires a separate Visual Reviewer judgment",
    )
  })
})
