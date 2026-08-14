import { describe, expect, test } from "bun:test"
import { tool } from "ai"
import { z } from "zod"
import {
  bindInternalStageTool,
  internalStageToolBindingOf,
  materializeBoundStageTool,
  stageToolMaterializerBindingOf,
} from "../src/agent/stage-tool-materializer"
import { DispatchAdapterContractRegistry } from "../src/agent/dispatch-adapter-contract"
import { createRequirementsOutputTools } from "../src/requirements/output-tools"
import { materializeBuildMergeBackTool } from "../src/build/merge-back-tool"
import { materializeIntegrityRunCommandTool } from "../src/integrity/acceptance-tools"
import { materializeVisualQaProblemDomRegionTool } from "../src/visual-qa/output-tools"
import { materializeFrontendCaptureVisualEvidenceTool } from "../src/frontend-design/output-tools"

function binding(toolValue: object) {
  const value = stageToolMaterializerBindingOf(toolValue)
  if (!value) throw new Error("expected persistent stage materializer binding")
  return value
}

describe("effectful private stage Tool materializers", () => {
  test("the dispatch-adapter registry classifies only the five effectful private Tools", () => {
    const effectful = DispatchAdapterContractRegistry.ids.flatMap((adapterID) =>
      [...DispatchAdapterContractRegistry.permissionBearingStageToolIDSet(adapterID)].map((toolName) => ({
        adapterID,
        toolName,
      })),
    )
    expect(effectful).toEqual([
      { adapterID: "requirements", toolName: "register_decision" },
      { adapterID: "frontend_design", toolName: "capture_frontend_visual_evidence" },
      { adapterID: "visual_qa", toolName: "register_visual_qa_problem_dom_region" },
      { adapterID: "build", toolName: "merge_back" },
      { adapterID: "integrity", toolName: "run_command" },
    ])

    const collector = bindInternalStageTool(
      tool({ inputSchema: z.object({ value: z.string() }), execute: async ({ value }) => `OK:${value}` }),
      { adapterID: "requirements", toolName: "register_requirement" },
    )
    expect(internalStageToolBindingOf(collector)).toEqual({
      adapterID: "requirements",
      toolName: "register_requirement",
    })
    expect(collector.execute?.({ value: "collector" }, { toolCallId: "collector", messages: [] } as any)).resolves.toBe(
      "OK:collector",
    )
  })

  test("all five initial factories persist a revisioned stable input and rematerialize the same Tool identity", async () => {
    const requirements = createRequirementsOutputTools({ taskID: "task-requirements" }).tools.register_decision
    const originals = [
      {
        adapterID: "requirements" as const,
        toolName: "register_decision",
        tool: requirements,
      },
      {
        adapterID: "build" as const,
        toolName: "merge_back",
        tool: materializeBuildMergeBackTool({
          taskID: "task-build",
          branch: "opencorvus/task-build",
          worktreeDir: "D:/fixture/build",
        }),
      },
      {
        adapterID: "integrity" as const,
        toolName: "run_command",
        tool: materializeIntegrityRunCommandTool({ taskID: "task-integrity", projectDirectory: "D:/fixture/project" }),
      },
      {
        adapterID: "visual_qa" as const,
        toolName: "register_visual_qa_problem_dom_region",
        tool: materializeVisualQaProblemDomRegionTool({
          taskID: "task-visual",
          projectRoot: "D:/fixture/project",
          projectID: "project-visual",
        }),
      },
      {
        adapterID: "frontend_design" as const,
        toolName: "capture_frontend_visual_evidence",
        tool: materializeFrontendCaptureVisualEvidenceTool({
          mode: "greenfield_original",
          artifactRoot: "D:/fixture/artifacts",
          artifactRootRelative: ".opencorvus/artifacts/task-frontend/frontend-design",
          workspaceRoot: "D:/fixture/project",
          taskID: "task-frontend",
        }),
      },
    ]

    for (const original of originals) {
      const persisted = binding(original.tool as object)
      const recovered = await materializeBoundStageTool({
        adapterID: original.adapterID,
        toolName: original.toolName,
        binding: JSON.parse(JSON.stringify(persisted)),
      })
      expect(binding(recovered as object)).toEqual(persisted)
      expect({ description: recovered.description, hasExecute: typeof recovered.execute === "function" }).toEqual({
        description: original.tool.description,
        hasExecute: true,
      })
    }
  })

  test("requirements rematerialization executes the real persisted Decision Log effect once per invocation", async () => {
    const appended: Array<{ phase: string; key: string; value: string; reason: string }> = []
    const original = createRequirementsOutputTools({
      taskID: "task-decision-effect",
      decisionLog: { append: (entry) => appended.push(entry), read: () => [], readByPhase: () => [], renderForPrompt: () => "", renderScopedForPrompt: () => "", toDocument: () => "", toFullDocument: () => "" },
    }).tools.register_decision
    const persisted = binding(original as object)
    const recovered = await materializeBoundStageTool({
      adapterID: "requirements",
      toolName: "register_decision",
      binding: persisted,
    })
    const result = await original.execute?.(
      { key: "runtime", value: "Bun", reason: "repository fact" },
      { toolCallId: "decision", messages: [] } as any,
    )
    expect(result).toBe('OK: decision "runtime=Bun" registered')
    expect(appended).toEqual([{ phase: "requirements", key: "runtime", value: "Bun", reason: "repository fact" }])
    expect(binding(recovered as object)).toEqual(persisted)
  })

  test("materializer input hash drift fails closed", async () => {
    const original = materializeIntegrityRunCommandTool({
      taskID: "task-integrity",
      projectDirectory: "D:/fixture/project",
    })
    const persisted = binding(original as object)
    await expect(
      materializeBoundStageTool({
        adapterID: "integrity",
        toolName: "run_command",
        binding: { ...persisted, input: { ...persisted.input, projectDirectory: "D:/drifted" } },
      }),
    ).rejects.toThrow("input hash changed")
  })
})
