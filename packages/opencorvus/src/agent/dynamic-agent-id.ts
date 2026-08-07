import z from "zod"

export const DYNAMIC_AGENT_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const RESERVED_DYNAMIC_AGENT_IDS = new Set(["orchestrator", "shared"])

export const DynamicAgentIDSchema = z
  .string()
  .regex(DYNAMIC_AGENT_ID_PATTERN, "dynamic agent id must be kebab-case")
  .superRefine((agentID, context) => {
    if (!RESERVED_DYNAMIC_AGENT_IDS.has(agentID)) return
    context.addIssue({ code: "custom", message: `dynamic agent id "${agentID}" is reserved` })
  })

export type DynamicAgentID = z.output<typeof DynamicAgentIDSchema>
