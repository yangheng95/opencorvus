import { createHash } from "node:crypto"
import type { Tool as AITool } from "ai"
import z from "zod"
import type { AgentDispatchAdapterID } from "./dispatch-adapter-contract"

export const StageToolMaterializerBindingSchema = z
  .object({
    id: z.enum([
      "requirements.register-decision",
      "build.merge-back",
      "integrity.run-command",
      "visual-qa.problem-dom-region",
      "frontend-design.capture-visual-evidence",
    ]),
    revision: z.literal(1),
    input: z.record(z.string(), z.unknown()),
    inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
export type StageToolMaterializerBinding = z.infer<typeof StageToolMaterializerBindingSchema>

const bindingSymbol = Symbol("opencorvus.stage-tool-materializer-binding")
const internalSymbol = Symbol("opencorvus.internal-stage-tool-binding")

export type InternalStageToolBinding = Readonly<{ adapterID: AgentDispatchAdapterID; toolName: string }>

export function bindInternalStageTool<T extends object>(tool: T, binding: InternalStageToolBinding): T {
  Object.defineProperty(tool, internalSymbol, {
    value: Object.freeze({ ...binding }),
    enumerable: false,
    configurable: false,
    writable: false,
  })
  return tool
}

export function internalStageToolBindingOf(tool: object | undefined): InternalStageToolBinding | undefined {
  return tool && (tool as { [internalSymbol]?: InternalStageToolBinding })[internalSymbol]
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stable(item)]),
  )
}

export function stageToolMaterializerInputSha256(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(stable(input))).digest("hex")
}

export function bindStageToolMaterializer<T extends object>(
  tool: T,
  binding: Omit<StageToolMaterializerBinding, "revision" | "inputSha256">,
): T {
  const parsed = createStageToolMaterializerBinding(binding)
  Object.defineProperty(tool, bindingSymbol, {
    value: parsed,
    enumerable: false,
    configurable: false,
    writable: false,
  })
  return tool
}

export function createStageToolMaterializerBinding(
  binding: Omit<StageToolMaterializerBinding, "revision" | "inputSha256">,
): StageToolMaterializerBinding {
  const parsed = StageToolMaterializerBindingSchema.parse({
    ...binding,
    revision: 1,
    inputSha256: stageToolMaterializerInputSha256(binding.input),
  })
  return Object.freeze({ ...parsed, input: Object.freeze({ ...parsed.input }) })
}

export function stageToolMaterializerBindingOf(tool: object | undefined): StageToolMaterializerBinding | undefined {
  return tool && (tool as { [bindingSymbol]?: StageToolMaterializerBinding })[bindingSymbol]
}

const identity = Object.freeze({
  "requirements.register-decision": { adapter: "requirements", tool: "register_decision" },
  "build.merge-back": { adapter: "build", tool: "merge_back" },
  "integrity.run-command": { adapter: "integrity", tool: "run_command" },
  "visual-qa.problem-dom-region": { adapter: "visual_qa", tool: "register_visual_qa_problem_dom_region" },
  "frontend-design.capture-visual-evidence": {
    adapter: "frontend_design",
    tool: "capture_frontend_visual_evidence",
  },
} as const)

export async function materializeBoundStageTool(input: {
  adapterID: AgentDispatchAdapterID
  toolName: string
  binding: StageToolMaterializerBinding
  authority?: { taskID: string; projectDirectory: string; toolDirectory: string }
}): Promise<AITool> {
  const binding = StageToolMaterializerBindingSchema.parse(input.binding)
  if (stageToolMaterializerInputSha256(binding.input) !== binding.inputSha256) {
    throw new Error(`Stage Tool materializer ${binding.id} input hash changed`)
  }
  const expected = identity[binding.id]
  if (expected.adapter !== input.adapterID || expected.tool !== input.toolName) {
    throw new Error(
      `Stage Tool materializer ${binding.id} cannot materialize ${input.adapterID}:${input.toolName}`,
    )
  }
  if (input.authority) {
    if (binding.input.taskID !== input.authority.taskID) {
      throw new Error(`Stage Tool materializer ${binding.id} Task authority changed`)
    }
    if (
      binding.id === "build.merge-back" &&
      binding.input.worktreeDir !== input.authority.toolDirectory
    ) {
      throw new Error(`Stage Tool materializer ${binding.id} worktree authority changed`)
    }
    if (
      binding.id === "integrity.run-command" &&
      binding.input.projectDirectory !== input.authority.projectDirectory
    ) {
      throw new Error(`Stage Tool materializer ${binding.id} project authority changed`)
    }
    if (
      binding.id === "visual-qa.problem-dom-region" &&
      binding.input.projectRoot !== input.authority.projectDirectory
    ) {
      throw new Error(`Stage Tool materializer ${binding.id} project authority changed`)
    }
    if (
      binding.id === "frontend-design.capture-visual-evidence" &&
      binding.input.workspaceRoot !== input.authority.toolDirectory
    ) {
      throw new Error(`Stage Tool materializer ${binding.id} workspace authority changed`)
    }
  }
  switch (binding.id) {
    case "requirements.register-decision":
      return (await import("@/requirements/output-tools")).materializeRequirementsRegisterDecisionTool(binding.input)
    case "build.merge-back":
      return (await import("@/build/merge-back-tool")).materializeBuildMergeBackTool(binding.input)
    case "integrity.run-command":
      return (await import("@/integrity/acceptance-tools")).materializeIntegrityRunCommandTool(binding.input)
    case "visual-qa.problem-dom-region":
      return (await import("@/visual-qa/output-tools")).materializeVisualQaProblemDomRegionTool(binding.input)
    case "frontend-design.capture-visual-evidence":
      return (await import("@/frontend-design/output-tools")).materializeFrontendCaptureVisualEvidenceTool(binding.input)
  }
}
