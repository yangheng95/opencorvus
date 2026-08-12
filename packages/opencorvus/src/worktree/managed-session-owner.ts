import { Ownership } from "@/engine/ownership"
import { ProjectGitLock } from "@/worktree/git-lock"

export type ManagedWorktreeSessionOwnerAuthority = Readonly<{
  projectID: string
  primaryWorktreeDir: string
  directory: string
  sessionID: string
}>

export async function releaseManagedWorktreeSessionOwner(
  authority: ManagedWorktreeSessionOwnerAuthority,
): Promise<Ownership.ReleaseReceipt> {
  return ProjectGitLock.withLease(
    { projectID: authority.projectID, primaryWorktreeDir: authority.primaryWorktreeDir },
    async () =>
      Ownership.Worktree.requireCompleteRelease(
        await Ownership.Worktree.releaseSessionOwner({
          primaryWorktreeDir: authority.primaryWorktreeDir,
          worktreeDir: authority.directory,
          sessionID: authority.sessionID,
        }),
      ),
  )
}
