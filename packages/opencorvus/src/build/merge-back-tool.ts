import { tool } from "ai"
import { z } from "zod"
import { bindStageToolMaterializer } from "@/agent/stage-tool-materializer"
import { Worktree } from "@/worktree"
import { MergeBackToolOutputSchema } from "./merge-back-tool-contract"

export function createMergeBackSingleFlight<T extends { status: string }>(execute: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | undefined
  let merged: T | undefined
  return async () => {
    if (merged) return merged
    if (inFlight) return await inFlight
    inFlight = execute()
    try {
      const result = await inFlight
      if (result.status === "merged") merged = result
      return result
    } finally {
      if (!merged) inFlight = undefined
    }
  }
}

const BuildMergeBackMaterializerInput = z
  .object({ taskID: z.string().min(1), branch: z.string().min(1), worktreeDir: z.string().min(1) })
  .strict()

export function materializeBuildMergeBackTool(raw: Record<string, unknown>, onMerged?: (head: string) => void) {
  const input = BuildMergeBackMaterializerInput.parse(raw)
  const execute = createMergeBackSingleFlight(async () => {
    const outcome = await Worktree.mergeSafely({ branch: input.branch, worktreeDir: input.worktreeDir })
    if (outcome.status === "merged") {
      onMerged?.(outcome.primaryHead)
      return MergeBackToolOutputSchema.parse({ status: "merged", primary_head: outcome.primaryHead, primary_branch: outcome.primaryBranch, ...(outcome.primaryRecoveryCommit ? { primary_recovery_commit: outcome.primaryRecoveryCommit } : {}) })
    }
    if (outcome.status === "conflict") {
      return MergeBackToolOutputSchema.parse({ status: "conflict", primary_branch: outcome.primaryBranch, primary_tip: outcome.primaryTip, conflict_paths: outcome.conflictPaths, hint: "Worktree is in MERGING state with conflict markers in the listed paths. Edit each path to resolve the markers, git add <path>, then `git commit` to finalize the merge. Then call merge_back again to ff-publish into " + outcome.primaryBranch + "." })
    }
    if (outcome.status === "blocked") {
      return MergeBackToolOutputSchema.parse({ status: "blocked", reason: outcome.reason, branch: outcome.branch, worktree_dir: outcome.worktreeDir, ...(outcome.dirtyPaths ? { dirty_paths: outcome.dirtyPaths } : {}), ...(outcome.mergeHead ? { merge_head: true } : {}) })
    }
    return MergeBackToolOutputSchema.parse({ status: "infra_error", reason: outcome.reason, branch: outcome.branch, ...(outcome.worktreeDir ? { worktree_dir: outcome.worktreeDir } : {}), ...(outcome.stderr ? { stderr: outcome.stderr } : {}) })
  })
  return bindStageToolMaterializer(tool({ description: "Publish this Task execution Session's committed branch into the primary worktree under the host merge lock.", inputSchema: z.object({}), execute }), { id: "build.merge-back", input })
}
