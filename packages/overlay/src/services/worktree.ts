import {
  ProjectWorktreeDeleteReceipt,
  ProjectWorktreeList,
  type ProjectWorktreeInfo,
} from "@opencorvus-ai/transport-protocol"
import { apiJson } from "./api"

export const PROJECT_WORKTREE_DELETE_TIMEOUT_MILLISECONDS = 15 * 60 * 1000

export type { ProjectWorktreeInfo }

export interface ProjectWorktreeDeleteFailure {
  directory: string
  error: string
}

export class ProjectWorktreeBulkDeleteError extends Error {
  readonly deleted: number
  readonly failures: ProjectWorktreeDeleteFailure[]

  constructor(input: { deleted: number; failures: ProjectWorktreeDeleteFailure[] }) {
    const failureDetails = input.failures.map((failure) => `${failure.directory}: ${failure.error}`).join("; ")
    super(
      `Failed to delete ${input.failures.length} project worktree(s) after deleting ${input.deleted}. ${failureDetails}`,
    )
    this.name = "ProjectWorktreeBulkDeleteError"
    this.deleted = input.deleted
    this.failures = input.failures
  }
}

function projectWorktreesPath(projectDirectory: string): string {
  const directory = String(projectDirectory || "").trim()
  if (!directory) throw new Error("project/current/worktrees requires a project directory")
  return `project/current/worktrees?directory=${encodeURIComponent(directory)}`
}

export async function loadProjectWorktrees(projectDirectory: string): Promise<ProjectWorktreeInfo[]> {
  return ProjectWorktreeList.parse(await apiJson<unknown>(projectWorktreesPath(projectDirectory)))
}

export async function deleteProjectWorktree(projectDirectory: string, directory: string): Promise<boolean> {
  if (!directory) throw new Error("deleteProjectWorktree requires a target directory")
  const result = await apiJson<unknown>(projectWorktreesPath(projectDirectory), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ directory }),
    timeoutMilliseconds: PROJECT_WORKTREE_DELETE_TIMEOUT_MILLISECONDS,
  })
  ProjectWorktreeDeleteReceipt.parse(result)
  return true
}

export async function deleteProjectWorktrees(projectDirectory: string, directories: string[]): Promise<number> {
  const targets = directories.filter((directory) => directory.trim())
  const failures: ProjectWorktreeDeleteFailure[] = []
  let deleted = 0
  for (const directory of targets) {
    try {
      await deleteProjectWorktree(projectDirectory, directory)
      deleted += 1
    } catch (error) {
      failures.push({
        directory,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  if (failures.length > 0) throw new ProjectWorktreeBulkDeleteError({ deleted, failures })
  return deleted
}
