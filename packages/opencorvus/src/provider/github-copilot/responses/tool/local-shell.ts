// Upstream source: anomalyco/opencode packages/core/src/github-copilot/responses/tool/local-shell.ts @ 8e2d422ffe56f3b2eb52e3f7195a2f9722a9fc46.
import { z } from "zod/v4"

export const localShellInputSchema = z.object({
  action: z.object({
    type: z.literal("exec"),
    command: z.array(z.string()),
    timeoutMs: z.number().optional(),
    user: z.string().optional(),
    workingDirectory: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
  }),
})

export const localShellOutputSchema = z.object({
  output: z.string(),
})
