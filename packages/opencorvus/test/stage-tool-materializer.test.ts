import { describe, expect, test } from "bun:test"
import { tool } from "ai"
import { z } from "zod"
import { createHash } from "node:crypto"
import {
  bindInternalStageTool,
  createStageToolMaterializerBinding,
  internalStageToolBindingOf,
  materializeBoundStageTool,
  stageToolMaterializerBindingOf,
  stageToolMaterializerInputSha256,
} from "../src/agent/stage-tool-materializer"
import { DispatchAdapterContractRegistry } from "../src/agent/dispatch-adapter-contract"
import { createRequirementsOutputToolFactory } from "../src/requirements/output-tools"
import { materializeBuildMergeBackTool } from "../src/build/merge-back-tool"
import { materializeIntegrityRunCommandTool } from "../src/integrity/acceptance-tools"
import { createVisualQaOutputTools } from "../src/visual-qa/output-tools"
import { materializeFrontendCaptureVisualEvidenceTool } from "../src/frontend-design/output-tools"
import { bindRuntimeToolFactory, createRuntimeToolOwner } from "../src/session/runtime-tool-owner"

function binding(toolValue: object) {
  const value = stageToolMaterializerBindingOf(toolValue)
  if (!value) throw new Error("expected persistent stage materializer binding")
  return value
}

describe("effectful private stage Tool materializers", () => {
  test("Visual QA parity context has one descriptor, initial Tool and recovered Tool binding", async () => {
    const input = { taskID: "task-parity", projectRoot: "D:/fixture/parity", referenceParityRequired: true, requiredReferenceRegions: ["desktop::header"] }
    const descriptor = createStageToolMaterializerBinding({ id: "visual-qa.problem-dom-region", input })
    const original = createVisualQaOutputTools(input).materializeExact("register_visual_qa_problem_dom_region")!
    expect(binding(original)).toEqual(descriptor)
    const recovered = await materializeBoundStageTool({ adapterID: "visual_qa", toolName: "register_visual_qa_problem_dom_region", binding: descriptor })
    expect(binding(recovered)).toEqual(descriptor)
  })

  test("optional object fields share one stable JSON input and digest through persistence", () => {
    const input = { taskID: "task-visual", projectRoot: "D:/fixture/project", projectID: undefined,
      options: { label: "desktop", unused: undefined, checks: [{ ready: true, note: undefined }] } }
    const expected = { options: { checks: [{ ready: true }], label: "desktop" }, projectRoot: "D:/fixture/project", taskID: "task-visual" }
    const bound = createStageToolMaterializerBinding({ id: "visual-qa.problem-dom-region", input })
    expect(bound.input).toEqual(expected)
    expect(bound.inputSha256).toBe(createHash("sha256").update(JSON.stringify(expected)).digest("hex"))
    expect(stageToolMaterializerInputSha256(input)).toBe(bound.inputSha256)
    expect(JSON.parse(JSON.stringify(bound))).toEqual(bound)
  })

  test("invalid materializer data returns the declared JSON or acyclic-data error", () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    for (const input of [cyclic, { date: new Date(0) }]) {
      expect(() => createStageToolMaterializerBinding({ id: "visual-qa.problem-dom-region", input }))
        .toThrow(new TypeError("Stage Tool materializer input must be acyclic plain JSON data"))
    }
    expect(() => createStageToolMaterializerBinding({ id: "visual-qa.problem-dom-region", input: { values: [undefined] } }))
      .toThrow(z.ZodError)
  })

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
    const requirements = createRequirementsOutputToolFactory({ taskID: "task-requirements" }).materializeExact("register_decision")!
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
        tool: createVisualQaOutputTools({
          taskID: "task-visual",
          projectRoot: "D:/fixture/project",
        }).materializeExact("register_visual_qa_problem_dom_region")!,
      },
      {
        adapterID: "frontend_design" as const,
        toolName: "capture_frontend_visual_evidence",
        tool: materializeFrontendCaptureVisualEvidenceTool({
          mode: "greenfield_original",
          artifactRoot: "D:/fixture/artifacts",
          artifactRootRelative: undefined,
          workspaceRoot: "D:/fixture/project",
          taskID: "task-frontend",
        }),
      },
    ]

    for (const original of originals) {
      const persisted = binding(original.tool as object)
      const owner = createRuntimeToolOwner({ leaves: [bindRuntimeToolFactory({
        toolID: original.toolName,
        kind: "stage",
        factoryInput: JSON.parse(JSON.stringify(persisted)),
        materialize: () => original.tool,
      })] })
      expect(binding(await owner.exact(original.toolName) as object)).toEqual(JSON.parse(JSON.stringify(persisted)))
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
    const original = createRequirementsOutputToolFactory({
      taskID: "task-decision-effect",
      decisionLog: { append: (entry) => appended.push(entry), read: () => [], readByPhase: () => [], renderForPrompt: () => "", renderScopedForPrompt: () => "", toDocument: () => "", toFullDocument: () => "" },
    }).materializeExact("register_decision")!
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
