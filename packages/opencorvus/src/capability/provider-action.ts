import z from "zod"
import { PermissionNext } from "@/permission/next"
import type { Tool } from "@/tool/tool"
import { CapabilityRef, CapabilityRefCodec } from "./ref"

const VisibleMetadataValue = z.union([z.string(), z.number(), z.boolean(), z.null()])

export const ProviderActionPermissionPlan = z
  .object({
    permission: z.string().trim().min(1),
    patterns: z.array(z.string().trim().min(1)).min(1),
    always: z.array(z.string().trim().min(1)),
    metadata: z.record(z.string(), VisibleMetadataValue),
    mcp_tool_ref: CapabilityRef.extend({ kind: z.literal("mcp_tool") }),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.patterns).size !== value.patterns.length) {
      ctx.addIssue({ code: "custom", path: ["patterns"], message: "Permission patterns must be unique." })
    }
    if (new Set(value.always).size !== value.always.length) {
      ctx.addIssue({ code: "custom", path: ["always"], message: "Persistable patterns must be unique." })
    }
    const patterns = new Set(value.patterns)
    for (const pattern of value.always) {
      if (!patterns.has(pattern)) {
        ctx.addIssue({
          code: "custom",
          path: ["always"],
          message: `Persistable pattern ${JSON.stringify(pattern)} is not an exact requested pattern.`,
        })
      }
    }
  })
export type ProviderActionPermissionPlan = z.infer<typeof ProviderActionPermissionPlan>

export class ProviderActionNotProjectedError extends Error {
  constructor(public readonly toolRef: string) {
    super(`Provider action transport ${JSON.stringify(toolRef)} is not projected in the current execution surface.`)
  }
}

export async function executeProviderAction<T>(input: {
  plan: ProviderActionPermissionPlan
  context: Tool.Context
  execute: () => Promise<T>
}): Promise<T> {
  const plan = ProviderActionPermissionPlan.parse(input.plan)
  const encodedToolRef = CapabilityRefCodec.encode(plan.mcp_tool_ref)
  const projectedMcpToolRefs = input.context.executionSurface.harness_projection?.mcp_tool_refs ?? []
  if (
    !projectedMcpToolRefs.some((ref) => CapabilityRefCodec.encode(ref) === encodedToolRef) ||
    !input.context.executionSurface.toolIDs.includes(plan.mcp_tool_ref.local_ref)
  ) {
    throw new ProviderActionNotProjectedError(encodedToolRef)
  }
  const agentRules = input.context.executionSurface.permission_layers?.agent
  if (!agentRules) {
    throw new Error("Provider action execution requires exact Agent and Session permission layers.")
  }
  for (const pattern of plan.patterns) {
    const inherited = PermissionNext.evaluate(plan.permission, pattern, agentRules)
    if (inherited.action === "deny") {
      throw new PermissionNext.DeniedError(
        agentRules.filter((rule) => PermissionNext.matches(plan.permission, pattern, rule)),
      )
    }
  }
  await input.context.ask({
    permission: plan.permission,
    patterns: plan.patterns,
    always: plan.always,
    metadata: plan.metadata,
  })
  return input.execute()
}
