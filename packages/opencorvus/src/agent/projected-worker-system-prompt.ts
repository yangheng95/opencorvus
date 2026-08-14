import { appendScopedProjectSourceBoundary } from "@/prompt/scoped-project-source-boundary"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import type { RuntimeTemplateID } from "@/agent/runtime-template-id"

export async function composeProjectedWorkerSystemPrompt(input: {
  taskID: string
  baseRole: RuntimeTemplateID
  core: string
  projectDirectory: string
  capability: PromptProfileResolver.ResolvedWorkerCapability
}): Promise<{ prompt: string }> {
  const base = [input.core, input.capability.promptLayers.templateAppend]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join("\n\n")
  const prompt = appendScopedProjectSourceBoundary({
    baseRole: input.baseRole,
    prompt: await PromptProfileResolver.composeResolvedAgentPrompt({
      taskID: input.taskID,
      projectDirectory: input.projectDirectory,
      base,
      userAppend: input.capability.promptLayers.projectedAgentAppend,
      capability: input.capability,
    }),
  })
  return { prompt }
}
