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
): Promise<void> {
  await ProjectGitLock.withLease(
    { projectID: authority.projectID, primaryWorktreeDir: authority.primaryWorktreeDir },
    () =>
      Ownership.Worktree.releaseSessionOwner({
        primaryWorktreeDir: authority.primaryWorktreeDir,
        worktreeDir: authority.directory,
        sessionID: authority.sessionID,
      }),
  )
}
