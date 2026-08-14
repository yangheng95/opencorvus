import { Identifier } from "@/id/id"
import { hostGit as runGit } from "@/util/git"
import { resolveBuildObservationGitDir } from "./build-observation-cleanup"

export function buildObservationRefName(observationID: string, phase: "base" | "head"): string {
  return `refs/opencorvus/build-observations/${Identifier.schema("artifact").parse(observationID)}/${phase}`
}

export async function deleteBuildObservationRefs(input: {
  worktreeDir: string
  observationIDs: readonly string[]
}): Promise<void> {
  const gitDir = await resolveBuildObservationGitDir(input.worktreeDir)
  for (const observationID of [...new Set(input.observationIDs)].sort()) {
    for (const phase of ["base", "head"] as const) {
      const refName = buildObservationRefName(observationID, phase)
      const result = await runGit(["--git-dir", gitDir, "update-ref", "-d", refName], {
        cwd: input.worktreeDir,
        timeoutProfile: "fast",
      })
      if (result.exitCode !== 0) {
        throw new Error(
          `git update-ref -d ${refName} failed with exit code ${result.exitCode}: ${result.stderr.toString().trim()}`,
        )
      }
    }
  }
}
