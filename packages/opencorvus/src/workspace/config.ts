import z from "zod"

export const Config = z.object({
  directory: z.string(),
  type: z.literal("worktree"),
})

export type Config = z.infer<typeof Config>
