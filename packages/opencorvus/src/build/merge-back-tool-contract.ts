import z from "zod"

// SHA means Secure Hash Algorithm. Git repositories use either SHA-1 or SHA-256 object identifiers.
export const GitObjectIDSchema = z.union([
  z.string().regex(/^[0-9a-f]{40}$/),
  z.string().regex(/^[0-9a-f]{64}$/),
])

export const MergeBackToolOutputSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("merged"),
      primary_head: GitObjectIDSchema,
      primary_branch: z.string().min(1),
      primary_recovery_commit: GitObjectIDSchema.optional(),
    })
    .strict(),
  z
    .object({
      status: z.literal("conflict"),
      primary_branch: z.string().min(1),
      primary_tip: GitObjectIDSchema,
      conflict_paths: z.array(z.string().min(1)),
      hint: z.string().min(1),
    })
    .strict(),
  z
    .object({
      status: z.literal("blocked"),
      reason: z.string().min(1),
      branch: z.string().min(1),
      worktree_dir: z.string().min(1),
      dirty_paths: z.array(z.string().min(1)).optional(),
      merge_head: z.literal(true).optional(),
    })
    .strict(),
  z
    .object({
      status: z.literal("infra_error"),
      reason: z.string().min(1),
      branch: z.string().min(1),
      worktree_dir: z.string().min(1).optional(),
      stderr: z.string().min(1).optional(),
    })
    .strict(),
])

export type MergeBackToolOutput = z.infer<typeof MergeBackToolOutputSchema>
