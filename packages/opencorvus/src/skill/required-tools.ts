import z from "zod"
import { reservedCoreToolIDs } from "@/agent/tool-pool-data"

export const SkillRequiredTools = z
  .array(z.string())
  .optional()
  .default([])
  .superRefine((value, ctx) => {
    const availableToolIDs = reservedCoreToolIDs()
    for (const [index, toolID] of value.entries()) {
      if (!availableToolIDs.has(toolID)) {
        ctx.addIssue({
          code: "custom",
          path: [index],
          message: `${toolID} is not a canonical OpenCorvus tool ID`,
        })
      }
    }
  })
