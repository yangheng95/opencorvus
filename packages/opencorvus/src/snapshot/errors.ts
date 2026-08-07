import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"

export const SnapshotIntegrityError = NamedError.create(
  "SnapshotIntegrityError",
  z.object({
    message: z.string(),
    operation: z.string(),
    cwd: z.string(),
    worktree: z.string(),
    gitDir: z.string(),
    exitCode: z.number().optional(),
    stderr: z.string().optional(),
    stdout: z.string().optional(),
  }),
)

export const SnapshotEmptyTreeError = NamedError.create(
  "SnapshotEmptyTreeError",
  z.object({
    message: z.string(),
    operation: z.string(),
    cwd: z.string(),
    worktree: z.string(),
    gitDir: z.string(),
    fileCount: z.number().optional(),
  }),
)
