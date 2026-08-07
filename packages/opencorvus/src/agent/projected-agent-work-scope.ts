import z from "zod"

export const ProjectedAgentWorkScopeSchema = z
  .object({
    kind: z.literal("task"),
  })
  .strict()
  .describe("Exact projected-agent execution ownership scope. Every projected workflow node executes once per Task.")

export type ProjectedAgentWorkScope = z.output<typeof ProjectedAgentWorkScopeSchema>

export namespace ProjectedAgentWorkScope {
  export function equals(left: ProjectedAgentWorkScope, right: ProjectedAgentWorkScope): boolean {
    return left.kind === right.kind
  }
}
