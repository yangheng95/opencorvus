// Upstream source: anomalyco/opencode packages/core/src/github-copilot/responses/tool/web-search.ts @ 8e2d422ffe56f3b2eb52e3f7195a2f9722a9fc46.
import { z } from "zod/v4"

export const webSearchArgsSchema = z.object({
  filters: z
    .object({
      allowedDomains: z.array(z.string()).optional(),
    })
    .optional(),

  searchContextSize: z.enum(["low", "medium", "high"]).optional(),

  userLocation: z
    .object({
      type: z.literal("approximate"),
      country: z.string().optional(),
      city: z.string().optional(),
      region: z.string().optional(),
      timezone: z.string().optional(),
    })
    .optional(),
})
