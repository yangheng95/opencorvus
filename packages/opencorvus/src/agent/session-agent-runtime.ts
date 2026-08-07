import { z } from "zod"
import { PermissionNext } from "@/permission/next"
import type { RuntimeTemplateContract } from "@/agent/runtime-template-registry"
import type { RuntimeExecutionOverride } from "@/agent/runtime-override"

const SessionAgentModel = z
  .object({
    modelID: z.string(),
    providerID: z.string(),
  })
  .strict()

const SessionAgentTools = z
  .object({
    global: z.array(z.string()).optional(),
    private: z.array(z.string()).optional(),
  })
  .strict()

/**
 * Execution data installed for one session. Identity, discovery, visibility,
 * and agent classification belong to their dedicated registries.
 */
export const SessionAgentRuntime = z
  .object({
    model: SessionAgentModel.optional(),
    options: z.record(z.string(), z.unknown()),
    prompt: z.string().optional(),
    promptAppend: z.string().optional(),
    temperature: z.number().optional(),
    topP: z.number().optional(),
    variant: z.string().optional(),
    steps: z.number().int().positive().optional(),
    tools: SessionAgentTools.optional(),
    permission: PermissionNext.Ruleset.optional(),
  })
  .strict()
  .meta({ ref: "SessionAgentRuntime" })

export type SessionAgentRuntime = z.infer<typeof SessionAgentRuntime>

type NativeAgentRuntimeSource = SessionAgentRuntime & {
  name?: string
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return value
  const object = value as object
  if (seen.has(object)) return value
  seen.add(object)
  for (const nested of Object.values(object)) deepFreeze(nested, seen)
  return Object.freeze(value)
}

function isDeepFrozen(value: unknown, seen = new WeakSet<object>()): boolean {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return true
  const object = value as object
  if (seen.has(object)) return true
  seen.add(object)
  return Object.isFrozen(object) && Object.values(object).every((nested) => isDeepFrozen(nested, seen))
}

function freezeRuntime(runtime: SessionAgentRuntime): SessionAgentRuntime {
  return deepFreeze(runtime)
}

export function assertFrozenSessionAgentRuntime(runtime: SessionAgentRuntime): void {
  if (!isDeepFrozen(runtime)) throw new Error("SessionAgentRuntime execution snapshot must be deeply frozen")
}

export function sessionRuntimeFromNativeAgent(agent: NativeAgentRuntimeSource): SessionAgentRuntime {
  return freezeRuntime(
    SessionAgentRuntime.parse({
      model: agent.model,
      options: agent.options,
      prompt: agent.prompt,
      promptAppend: agent.promptAppend,
      temperature: agent.temperature,
      topP: agent.topP,
      variant: agent.variant,
      steps: agent.steps,
      tools: agent.tools,
      permission: agent.permission,
    }),
  )
}

export function sessionRuntimeFromProjectedTemplate(input: {
  template: RuntimeTemplateContract
  templateOverride?: RuntimeExecutionOverride
  projectedAgentOverride?: RuntimeExecutionOverride
  model?: { providerID: string; modelID: string }
}): SessionAgentRuntime {
  const projected = input.projectedAgentOverride
  const template = input.templateOverride
  return freezeRuntime(
    SessionAgentRuntime.parse({
      model: input.model,
      options: { ...(template?.options ?? {}), ...(projected?.options ?? {}) },
      prompt: undefined,
      promptAppend: undefined,
      temperature: projected?.temperature ?? template?.temperature,
      topP: projected?.top_p ?? template?.top_p,
      variant: projected?.variant ?? template?.variant,
      steps: projected?.steps ?? template?.steps,
      tools: {
        global: [...input.template.baseToolPool.global],
        private: [...input.template.baseToolPool.private],
      },
      permission: undefined,
    }),
  )
}

export function sessionRuntimeWithResolvedModel(
  runtime: SessionAgentRuntime,
  model: { providerID: string; modelID: string },
): SessionAgentRuntime {
  return freezeRuntime(
    SessionAgentRuntime.parse({
      ...runtime,
      model,
    }),
  )
}
