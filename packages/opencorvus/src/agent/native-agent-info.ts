import z from "zod"
import { PermissionNext } from "@/permission/next"

export const NativeAgentInfoSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    hidden: z.boolean().optional(),
    topP: z.number().optional(),
    temperature: z.number().optional(),
    color: z.string().optional(),
    permission: PermissionNext.Ruleset.optional(),
    model: z
      .object({
        modelID: z.string(),
        providerID: z.string(),
      })
      .optional(),
    variant: z.string().optional(),
    prompt: z.string().optional(),
    promptAppend: z.string().optional(),
    options: z.record(z.string(), z.any()),
    steps: z.number().int().positive().optional(),
    tools: z
      .object({
        global: z.array(z.string()).optional(),
        private: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .meta({
    ref: "Agent",
  })

export type NativeAgentInfo = z.infer<typeof NativeAgentInfoSchema>
