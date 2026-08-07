import { apiJson } from "./api"

export interface ProjectGitInitializationResult {
  created: boolean
}

/**
 * Initialize one exact project directory through the canonical server
 * endpoint. Callers pass the directory explicitly so a concurrent workspace
 * selection cannot redirect this identity mutation through ambient API state.
 */
export async function initializeProjectDirectoryGit(
  directory: string,
): Promise<ProjectGitInitializationResult> {
  const target = directory.trim()
  if (!target) throw new Error("Git initialization requires a project directory")
  const query = new URLSearchParams({ directory: target })
  return await apiJson(`project/current/init-git?${query.toString()}`, { method: "POST" })
}
